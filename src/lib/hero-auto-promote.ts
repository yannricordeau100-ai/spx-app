/**
 * Auto-promote hero KPI — refactor Yann 5 juin 2026.
 *
 * Logique : sélectionne le meilleur KPI hero candidat pour une sté en
 * privilégiant :
 *   1. is_wow=true (KPI distinctif propre à la sté ou sous-secteur)
 *   2. plus long historique (history.length)
 *   3. trimestriel (tie-breaker uniquement, peu importe annuel sinon)
 *
 * RÈGLES STRICTES :
 *   - Les KPIs génériques (voir `kpi-generic-library.json` via `isGenericKpi`)
 *     sont EXCLUS des candidats. Si TOUS les KPIs sont génériques, fallback
 *     sur le KPI avec le plus d'history (confidence="low").
 *   - Pas de pénalité annuel vs trimestriel (sauf en tie-breaker).
 *   - Pas de filtre sur `type` / `nature` / `category`.
 *
 * Confidence :
 *   - "high"   → 1 seul KPI clairement meilleur (top loin devant le 2e)
 *   - "medium" → 2 candidats quasi-équivalents (même flag wow, ≤2 points
 *                de history d'écart) → doute, à valider
 *   - "low"    → fallback générique (aucun KPI spécifique disponible)
 *
 * Utilisé par :
 *   - `/admin/kpis-toggle` (page SSR) pour calculer le statut visuel des
 *     points colorés à gauche de chaque ligne sté.
 *   - À terme : pages sté V1.9.5 pour proposer un hero auto si Yann
 *     n'a pas validé d'override Supabase.
 */
import { isGenericKpi } from "./kpi-generic";

export type AutoPromoteCandidate = {
  short: string;
  history_length: number;
  is_wow?: boolean;
  period_type?: string;
};

export type AutoPromoteResult = {
  hero: string; // KPI.short choisi (ou "" si aucun candidat exploitable)
  confidence: "high" | "medium" | "low";
};

/**
 * Sélectionne le meilleur hero parmi une liste de KPIs candidats.
 *
 * @param kpis Liste de KPIs (au minimum { short, history_length, is_wow,
 *             period_type }).
 * @returns { hero, confidence } — `hero` peut être "" si la liste est vide.
 */
export function autoPromoteHero(
  kpis: ReadonlyArray<AutoPromoteCandidate>,
): AutoPromoteResult {
  if (!Array.isArray(kpis) || kpis.length === 0) {
    return { hero: "", confidence: "low" };
  }

  const specific = kpis.filter((k) => !isGenericKpi(k.short));

  // Fallback : aucun KPI spécifique → on prend le plus long history parmi
  // les génériques. Confidence "low" pour signaler que la sté n'a aucun
  // KPI distinctif disponible.
  if (specific.length === 0) {
    const sorted = [...kpis].sort(
      (a, b) => (b.history_length ?? 0) - (a.history_length ?? 0),
    );
    return { hero: sorted[0].short, confidence: "low" };
  }

  // Tri descendant : is_wow > history.length > trimestriel (tie-breaker)
  const sorted = [...specific].sort((a, b) => {
    const aWow = Boolean(a.is_wow);
    const bWow = Boolean(b.is_wow);
    if (aWow !== bWow) return aWow ? -1 : 1;
    const aH = a.history_length ?? 0;
    const bH = b.history_length ?? 0;
    if (aH !== bH) return bH - aH;
    const aQ = a.period_type === "quarter";
    const bQ = b.period_type === "quarter";
    if (aQ !== bQ) return aQ ? -1 : 1;
    return 0;
  });

  const top = sorted[0];
  const second = sorted[1];

  let confidence: AutoPromoteResult["confidence"] = "high";
  if (second) {
    const topWow = Boolean(top.is_wow);
    const secondWow = Boolean(second.is_wow);
    const topH = top.history_length ?? 0;
    const secondH = second.history_length ?? 0;
    // Doute si même flag wow ET écart history ≤ 2 points.
    if (topWow === secondWow && Math.abs(topH - secondH) <= 2) {
      confidence = "medium";
    }
  }

  return { hero: top.short, confidence };
}
