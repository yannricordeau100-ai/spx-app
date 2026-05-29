/**
 * Algorithme de scoring PV (plus-value investisseur) pour les KPIs.
 *
 * Donne un score numérique 0-10 à chaque KPI d'une société selon 5 dimensions :
 *
 *   1. CONTRIBUTION (3 pts)    : importance du KPI dans le récit business
 *      - hero KPI                                       = +3
 *      - sub-segment majeur (>20% revenu)               = +2
 *      - niche / unique à la sté                        = +1
 *
 *   2. TRAJECTOIRE (2 pts)     : profondeur historique disponible
 *      - history >= 5 ans                               = +2
 *      - history >= 3 ans                               = +1
 *      - history < 3 ans                                = 0
 *
 *   3. WHAOU (2 pts)           : caractère différenciant
 *      - présent dans kpi-generic-library.json (29 entrées comptables) = 0
 *      - business-specific                              = +2
 *
 *   4. VOLATILITÉ INTÉRÊT (2 pts) : intérêt narratif du YoY
 *      - |YoY| > 20% (forte croissance ou déclin)       = +2
 *      - |YoY| > 5%                                     = +1
 *      - plat                                           = 0
 *
 *   5. VS PEERS (1 pt)         : comparabilité sectorielle
 *      - top quartile sub-secteur via compare_key       = +1
 *      - sinon                                          = 0
 *
 * Total = 0 → 10.
 *
 * La fonction est pure et déterministe. Pas de date.now(), pas d'aléa.
 * Le scoring vit côté JSON dataset (champ pv_score) pour ne pas être
 * recalculé à chaque rendu.
 *
 * Voir : MISSION 3 du prompt REEXTRACT-OPUS-29MAY.
 */

import genericLib from "@/data/kpi-generic-library.json";

/** Forme minimale de KPI suffisante pour scorer. */
export type ScorableKpi = {
  short: string;
  name_en?: string;
  name_fr?: string;
  history?: (number | null)[] | number[];
  yoy?: string | number | null;
  is_short_history?: boolean;
  is_wow?: boolean;
  is_generic?: boolean;
  compare_key?: string;
  _specific_to?: string;
};

/** Contexte société (optionnel) pour affiner le scoring. */
export type ScoringContext = {
  heroShort?: string;
  /** Liste de KPI shorts considérés comme sub-segment majeur >20% revenu. */
  majorSegmentShorts?: string[];
  /** Liste de compare_key où la sté est top-quartile de son sous-secteur. */
  topQuartileCompareKeys?: string[];
};

/** Détail de scoring (utile pour audit / debug). */
export type ScoreBreakdown = {
  contribution: number; // 0-3
  trajectoire: number;  // 0-2
  whaou: number;        // 0-2
  volatilite: number;   // 0-2
  vs_peers: number;     // 0-1
  total: number;        // 0-10
};

// --- Set des shorts génériques (kpi-generic-library.json, 29 entrées).
const GENERIC_SHORTS = new Set<string>(
  (genericLib as Array<{ short: string }>).map((g) => g.short),
);

/** Normalise un short pour matcher la generic library (espaces, casse). */
function isGenericShort(short: string | undefined | null): boolean {
  if (!short || typeof short !== "string") return false;
  if (GENERIC_SHORTS.has(short)) return true;
  const n = short.trim().toLowerCase();
  for (const g of GENERIC_SHORTS) {
    if (g.toLowerCase() === n) return true;
  }
  return false;
}

/** Parse un YoY string ("+12%", "-3%", "stable", "+800 M") en abs delta %. */
function parseYoyAbsPct(yoy: ScorableKpi["yoy"]): number | null {
  if (yoy === null || yoy === undefined) return null;
  if (typeof yoy === "number") return Math.abs(yoy);
  const s = String(yoy).trim();
  if (!s) return null;
  if (/^stable$|^flat$|^plat$/i.test(s)) return 0;
  // Cherche un nombre suivi de %
  const m = s.match(/-?\d+(?:[\.,]\d+)?\s*%/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(",", ".").replace("%", "").trim());
  if (Number.isNaN(n)) return null;
  return Math.abs(n);
}

/** Compte les valeurs réelles (non-null, non-undefined) dans l'historique. */
function historyDepth(h: ScorableKpi["history"]): number {
  if (!Array.isArray(h)) return 0;
  let c = 0;
  for (const v of h) {
    if (v !== null && v !== undefined && typeof v === "number" && Number.isFinite(v)) c++;
  }
  return c;
}

/** Score CONTRIBUTION (0-3). */
function scoreContribution(kpi: ScorableKpi, ctx: ScoringContext): number {
  if (ctx.heroShort && kpi.short && kpi.short === ctx.heroShort) return 3;
  if (kpi.short && ctx.majorSegmentShorts?.includes(kpi.short)) return 2;
  // Heuristique sub-segment majeur via _specific_to si pas de liste fournie
  if (kpi._specific_to && /segment|hero|major|core|principal/i.test(kpi._specific_to)) return 2;
  // is_wow = différenciant → niche/unique = +1
  if (kpi.is_wow) return 1;
  // _specific_to renseigné = niche caractérisée
  if (kpi._specific_to) return 1;
  return 0;
}

/** Score TRAJECTOIRE (0-2). */
function scoreTrajectoire(kpi: ScorableKpi): number {
  const depth = historyDepth(kpi.history);
  if (depth >= 5) return 2;
  if (depth >= 3) return 1;
  return 0;
}

/** Score WHAOU (0-2). */
function scoreWhaou(kpi: ScorableKpi): number {
  if (isGenericShort(kpi.short)) return 0;
  if (kpi.is_generic === true) return 0;
  return 2;
}

/** Score VOLATILITÉ INTÉRÊT (0-2). */
function scoreVolatilite(kpi: ScorableKpi): number {
  const abs = parseYoyAbsPct(kpi.yoy);
  if (abs === null) return 0;
  if (abs > 20) return 2;
  if (abs > 5) return 1;
  return 0;
}

/** Score VS PEERS (0-1). */
function scoreVsPeers(kpi: ScorableKpi, ctx: ScoringContext): number {
  if (!kpi.compare_key) return 0;
  if (!ctx.topQuartileCompareKeys) return 0;
  return ctx.topQuartileCompareKeys.includes(kpi.compare_key) ? 1 : 0;
}

/**
 * Calcule le détail de scoring d'un KPI.
 * Pure : même input → même output.
 */
export function scoreKpiPvBreakdown(
  kpi: ScorableKpi,
  ctx: ScoringContext = {},
): ScoreBreakdown {
  const contribution = scoreContribution(kpi, ctx);
  const trajectoire = scoreTrajectoire(kpi);
  const whaou = scoreWhaou(kpi);
  const volatilite = scoreVolatilite(kpi);
  const vs_peers = scoreVsPeers(kpi, ctx);
  const total = contribution + trajectoire + whaou + volatilite + vs_peers;
  return { contribution, trajectoire, whaou, volatilite, vs_peers, total };
}

/** Raccourci : retourne seulement le total 0-10. */
export function scoreKpiPv(kpi: ScorableKpi, ctx: ScoringContext = {}): number {
  return scoreKpiPvBreakdown(kpi, ctx).total;
}

/**
 * Trie une liste de KPIs par pv_score décroissant.
 * En cas d'égalité, conserve l'ordre d'origine (stable).
 */
export function orderKpisByPv<T extends ScorableKpi>(
  kpis: T[],
  ctx: ScoringContext = {},
): Array<T & { pv_score: number }> {
  const scored = kpis.map((k, i) => ({
    kpi: k,
    score: scoreKpiPv(k, ctx),
    idx: i,
  }));
  scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
  return scored.map((s) => ({ ...s.kpi, pv_score: s.score }));
}

/**
 * Applique le scoring en place : retourne un nouveau tableau avec
 * pv_score injecté sur chaque KPI, ordre d'origine préservé.
 * Pour persister dans v2-pipeline-specific-kpis/*.json.
 */
export function annotateKpisWithPvScore<T extends ScorableKpi>(
  kpis: T[],
  ctx: ScoringContext = {},
): Array<T & { pv_score: number }> {
  return kpis.map((k) => ({ ...k, pv_score: scoreKpiPv(k, ctx) }));
}
