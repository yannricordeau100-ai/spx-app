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
  // Positions 1-2 : 2 wow consécutifs (les plus longs en history)
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
