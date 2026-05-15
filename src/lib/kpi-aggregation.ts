/**
 * Classification flow / stock pour les KPIs avec history quarterly.
 *
 * Flow (= flux)   : Revenue, Sales, Profit, Recurring, Comptes, Dividend payout,
 *                   Demand, Operational throughput. Aggregation annuelle = SUM
 *                   des 4 quarters. Annual = "ce que l'entreprise a généré
 *                   pendant l'année" (P&L items).
 *
 * Stock           : Margin %, Profitability ratios, Balance Sheet (assets,
 *                   liabilities, equity), User counts (DAP, MAU, subscribers),
 *                   Backlog (visibility à un moment T), Headcount, Capital
 *                   ratios. Aggregation annuelle = LAST quarter (snapshot fin
 *                   d'année).
 *
 * Référence : règle Yann 16 mai 2026 — "le revenu annuel d'une sté = somme
 * des 4 trimestres, pas le Q4 seul ; mais le nombre d'abonnés en fin d'année
 * = le dernier Q (= état au moment T)".
 */
export type KpiAggregationKind = "flow" | "stock";

type AggKpi = {
  type?: string | null;
  unit?: string | null;
  short?: string | null;
  name_fr?: string | null;
  name_en?: string | null;
};

const STOCK_TYPE_PATTERNS = [
  /^margin/i,
  /^profitability/i,
  /^risk/i,
  /^balance\s*sheet/i,
  /^capital/i,
  /^backlog/i,
  /^headcount/i,
  /^stock/i,
  /^user/i,
];

const STOCK_NAME_PATTERNS = [
  /\bsubscribers?\b/i,
  /\babonn[ée]s?\b/i,
  /\busers?\b/i,
  /\butilisateurs?\b/i,
  /\bdap\b/i,
  /\bmau\b/i,
  /\bdau\b/i,
  /\bbacklog\b/i,
  /\bcarnet\s+de\s+commandes?\b/i,
  /\bencours\b/i,
  /\bheadcount\b/i,
  /\beffectifs?\b/i,
  /\bemployees?\b/i,
  /\bsalari[ée]s?\b/i,
  /\binventory\b/i,
  /\bloan\s+book\b/i,
  /\bdeposits?\b/i,
  /\breserves?\b/i,
  /\baum\b/i,
  /\bauc\b/i,
  /\brun\s+rate\b/i,
];

/**
 * Détermine si un KPI est flow (somme sur l'année) ou stock (snapshot fin de
 * période). Heuristique conservatrice : par défaut = flow (cas majoritaire
 * P&L), sauf si signal explicite stock dans type/unit/nom.
 */
export function getKpiAggregationKind(kpi: AggKpi): KpiAggregationKind {
  const unit = (kpi.unit || "").trim().toLowerCase();
  const type = (kpi.type || "").trim();
  const haystack = `${kpi.short || ""} ${kpi.name_fr || ""} ${kpi.name_en || ""}`;

  // 1. Unité = % / ratio / pp → stock (ratio à un moment T, jamais sommable)
  if (/%|^pp$|ratio|bps|points?/i.test(unit)) return "stock";

  // 2. Type explicite stock (cf. survey dataset : "Margin", "Balance Sheet",
  //    "Profitability", "Risk", "Capital", "User", "Backlog")
  if (STOCK_TYPE_PATTERNS.some((re) => re.test(type))) return "stock";

  // 3. Nom contient un mot clé stock (subscribers, users, backlog, AUM, etc.)
  if (STOCK_NAME_PATTERNS.some((re) => re.test(haystack))) return "stock";

  // 4. Default = flow (Revenue, Sales, Profit, Cash flow, Dividende payout,
  //    Comptes génériques, etc.)
  return "flow";
}

/**
 * Agrège un tableau de valeurs quarterly en valeurs annuelles selon le type
 * du KPI. Retourne {values, years} où:
 *  - values[i] = valeur année i (somme 4Q ou Q4 selon flow/stock)
 *  - years[i] = label année correspondant (string)
 *
 * Règles strictes:
 *  - Seulement les années COMPLÈTES (= 4 quarters publiés)
 *  - Année courante incomplète → exclue (remplacée par TTM séparé)
 *  - TTM = somme des 4 derniers Q publiés (pour flow) OU dernier Q (pour stock)
 *
 * @param history quarterly values, oldest first, newest last
 * @param lastDataDate ISO date of the last published quarter end
 * @param kind flow | stock
 * @param fiscalYearEndMonth 12 par défaut (calendrier), sinon NVDA=1, AAPL=9, etc.
 */
export function aggregateQuarterlyToAnnual(
  history: number[],
  lastDataDate: string | null | undefined,
  kind: KpiAggregationKind,
  fiscalYearEndMonth: number = 12,
): { years: string[]; values: number[]; ttm: number | null } {
  if (!Array.isArray(history) || history.length === 0) {
    return { years: [], values: [], ttm: null };
  }

  // Pas de date → fallback ancien comportement (last value of each 4-block)
  const d = lastDataDate ? new Date(lastDataDate) : null;
  if (!d || Number.isNaN(d.getTime())) {
    const out: number[] = [];
    for (let i = history.length - 1; i >= 0; i -= 4) out.unshift(history[i]);
    return { years: out.map((_, i) => String(2026 - out.length + i + 1)), values: out, ttm: null };
  }

  // Calcule la FY et le Q fiscaux du DERNIER quarter publié.
  // Pour FY end = 12 (calendrier) : Q1 jan-mar, Q2 avr-juin, Q3 juil-sept, Q4 oct-dec
  // Pour FY end = 1 (NVDA) : FY commence en fév. Q1 fév-avr, ...
  const calY = d.getUTCFullYear();
  const calM = d.getUTCMonth() + 1; // 1-12
  // FY label : si calM > fyEndMonth (cas calendrier décembre), FY = calY + 1
  // Ex NVDA d=2026-04-30 calM=4, fyEnd=1 → 4>1 donc fyOfLastQ = 2026+1 = 2027 (FY27)
  // Ex AAPL d=2025-09-28 calM=9, fyEnd=9 → 9>9 false → fyOfLastQ = 2025 (FY25, qui se termine en sept 2025)
  // Ex GOOGL d=2026-03-31 calM=3, fyEnd=12 → 3>12 false → fyOfLastQ = 2026
  const fyOfLastQ = calM > fiscalYearEndMonth ? calY + 1 : calY;
  // Q dans la FY (1-4) : (monthInFY-1) // 3 + 1 où monthInFY = ((calM - fyEnd - 1) mod 12) + 1
  const monthInFY = ((calM - fiscalYearEndMonth - 1 + 12) % 12) + 1;
  const qOfLastQ = Math.ceil(monthInFY / 3);

  // Marche en arrière depuis le dernier Q pour assigner chaque history[i] à
  // (fy, q). On suppose history est consécutif sans trou.
  const stamps: Array<{ fy: number; q: number; v: number }> = [];
  let fy = fyOfLastQ;
  let q = qOfLastQ;
  for (let i = history.length - 1; i >= 0; i--) {
    stamps.unshift({ fy, q, v: history[i] });
    q -= 1;
    if (q === 0) { q = 4; fy -= 1; }
  }

  // Grouper par FY ; ne garder que les FY avec 4 quarters
  const byFy = new Map<number, number[]>();
  for (const s of stamps) {
    if (!byFy.has(s.fy)) byFy.set(s.fy, []);
    byFy.get(s.fy)!.push(s.v);
  }
  const completeFys = [...byFy.entries()]
    .filter(([, qs]) => qs.length === 4)
    .sort((a, b) => a[0] - b[0]);

  const years = completeFys.map(([fy]) => String(fy));
  const values = completeFys.map(([, qs]) => {
    if (kind === "flow") return qs.reduce((a, b) => a + b, 0);
    return qs[qs.length - 1]; // stock : Q4 / dernier Q de la FY
  });

  // TTM : somme des 4 derniers Q publiés (flow) ou dernier Q (stock)
  let ttm: number | null = null;
  if (history.length >= 4 && kind === "flow") {
    ttm = history.slice(-4).reduce((a, b) => a + b, 0);
  } else if (history.length >= 1 && kind === "stock") {
    ttm = history[history.length - 1];
  }

  // Si le TTM == dernière FY complète, ne pas l'afficher en double
  if (ttm != null && values.length > 0 && Math.abs(values[values.length - 1] - ttm) < 0.01) {
    ttm = null;
  }

  return { years, values, ttm };
}
