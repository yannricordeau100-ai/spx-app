/**
 * Order des KPIs dans le bloc "Indicateurs clés".
 *
 * Yann 5 juin 2026 — Refactor critères : alignement strict avec l'algo
 * `autoPromoteHero` pour cohérence sélection hero ↔ ordre indicateurs clés.
 *
 * Critères de priorité (descendants) :
 *   1. is_wow=true (KPI distinctif propre à la sté ou sous-secteur)
 *   2. history.length plus long
 *   3. period_type="quarter" (tie-breaker uniquement, peu importe annuel
 *      ou absence de type/nature/catégorie)
 *
 * Les KPIs génériques (Revenue, EBITDA, EPS, etc.) sont conservés mais
 * descendus en bas. Leur masquage final est appliqué côté `company-view.tsx`
 * via `isGenericKpi` (cf règle §0septies "KPI SPÉCIFIQUES UNIQUEMENT").
 *
 * Le hero KPI lui-même est exclu (rendu en grand au-dessus du bloc).
 *
 * Les KPIs avec is_short_history = true sont aussi exclus (ils vont dans
 * le bloc Stories). orderKpis ne les inclut pas.
 *
 * Cette fonction est PURE et déterministe.
 */

import type { KPI } from "./data";
import { isGenericKpi } from "./kpi-generic";

function kpiScore(k: KPI): number {
  // Tri composite : wow gagne toujours, puis history desc, puis quarter
  // tie-breaker. Pas de pénalité annuel ni de filtre type/nature.
  const wow = k.is_wow ? 1 : 0;
  const hist = Array.isArray(k.history) ? k.history.length : 0;
  const periodType = (k as KPI & { period_type?: string }).period_type;
  const isQuarter = periodType === "quarter" ? 1 : 0;
  // Encodage : wow×10000 + history×10 + quarter. history ≤ 999 attendu.
  return wow * 10000 + hist * 10 + isQuarter;
}

/**
 * Yann 18 août 2026 — le 1er KPI du bloc "Indicateurs clés" doit être
 * QUALITATIF : exprimé en unités physiques (abonnés, unités, tonnes, MW,
 * magasins…), jamais en devise ni en pourcentage financier. C'est la seule
 * ligne visible en clair pour le tier free (les suivantes sont floutées).
 */
// Devises uniquement. "Mds"/"M" nus sont ambigus (souvent monétaires) et
// traités à part ; "Mds unités", "Mds de puces"… restent physiques.
const MONEY_UNIT_RE = /(\$|€|£|CHF|TWD|SEK|NOK|DKK|EUR|USD|GBP|JPY|M\$|M€|\bkr\b)/i;
const BARE_MAGNITUDE_RE = /^(mds|m|k|b)$/i;
const FINANCIAL_PCT_RE = /marge|margin|payout|tax|imposition|yield|rendement|ratio|roe|rotce|mcr|combined|bpa|eps/i;

export function isPhysicalKpi(k: KPI): boolean {
  const unit = String(k.unit ?? "").trim();
  if (!unit) return false;
  if (MONEY_UNIT_RE.test(unit)) return false;
  if (BARE_MAGNITUDE_RE.test(unit)) return false;
  const label = `${k.name_fr ?? ""} ${k.short ?? ""}`;
  if (unit === "%" && FINANCIAL_PCT_RE.test(label)) return false;
  return true;
}

export function orderKpis(kpis: KPI[], heroShort?: string): KPI[] {
  const filtered = kpis.filter(
    (k) => !k.is_short_history && k.short !== heroShort,
  );

  // Sépare wow vs generic pour conserver l'alternance historique du bloc.
  // Au sein de chaque groupe : tri descendant par history puis quarter.
  const wow: KPI[] = [];
  const generic: KPI[] = [];
  for (const k of filtered) {
    if (k.is_wow) wow.push(k);
    else generic.push(k);
  }
  wow.sort((a, b) => kpiScore(b) - kpiScore(a));
  generic.sort((a, b) => kpiScore(b) - kpiScore(a));

  const ordered: KPI[] = [];
  // Position 1 (Yann 18 août 2026) : le meilleur KPI PHYSIQUE (unité non
  // monétaire, ≥3 points d'history), wow d'abord. Seule ligne en clair en free.
  const pickPhysical = (pool: KPI[]): KPI | null => {
    const idx = pool.findIndex(
      (k) =>
        isPhysicalKpi(k) &&
        !isGenericKpi(k.short) &&
        Array.isArray(k.history) &&
        k.history.length >= 3,
    );
    return idx >= 0 ? pool.splice(idx, 1)[0] : null;
  };
  const firstPhysical = pickPhysical(wow) ?? pickPhysical(generic);
  if (firstPhysical) ordered.push(firstPhysical);
  // Positions suivantes : 2 wow consécutifs (les plus longs en history)
  if (wow.length > 0) ordered.push(wow.shift()!);
  if (wow.length > 0) ordered.push(wow.shift()!);
  // Positions 3+ : alternance generic, wow, generic, wow, …
  while (wow.length > 0 || generic.length > 0) {
    if (generic.length > 0) ordered.push(generic.shift()!);
    if (wow.length > 0) ordered.push(wow.shift()!);
  }
  return ordered;
}

/**
 * Sépare les KPIs en (mainKpis pour bloc "Indicateurs clés", storyKpis
 * pour bloc "Stories") selon is_short_history.
 *
 * Le hero est exclu des deux (il est rendu séparément).
 */
export function splitKpis(kpis: KPI[], heroShort?: string): {
  mainKpis: KPI[];
  storyKpis: KPI[];
} {
  const mainKpis = orderKpis(kpis, heroShort);
  const storyKpis = kpis.filter((k) => k.is_short_history && k.short !== heroShort);
  return { mainKpis, storyKpis };
}
