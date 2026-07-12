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
  // Yann 12 juil 2026 (fix vue annuelle vide) : métriques non sommables
  // classées flow à tort — encours sous gestion et moyennes/taux publiés
  // en valeur annuelle dans le 10-K (BX total_aum, DAL PRASM, CME ADV).
  /\bsous\s+gestion\b/i,
  /\bunder\s+management\b/i,
  /\bprasm\b/i,
  /\bper\s+available\s+seat\s+mile\b/i,
  /\baverage\s+daily\s+volume\b/i,
  /\bjournalier\s+moyen\b/i,
  // Yann 12 juil 2026 (chunk 4 vue annuelle vide) : encours sous
  // administration (RJF AUA) + taux/moyennes par unite (loyer par sq ft,
  // yield par APCD) non sommables.
  /\baua\b/i,
  /\bunder\s+administration\b/i,
  /\bsous\s+administration\b/i,
  /\bper\s+(occupied\s+)?sq\s*\.?\s*ft\b/i,
  /\bpar\s+pied\s+carr[ée]\b/i,
  /\bper\s+apcd\b/i,
  /\bpar\s+apcd\b/i,
  // Yann 12 juil 2026 (chunk 5 vue annuelle vide) : revenu moyen par colis
  // (UPS us_dom_rpp "Revenue Per Piece") = moyenne de periode, jamais sommable.
  /\bper\s+piece\b/i,
  /\bpar\s+pi[eè]ce\b/i,
  /\bpar\s+colis\b/i,
];

// Yann 12 juil 2026 : unites "par jour" / "par unite de capacite" = debits
// moyens de la periode, jamais sommables sur 4 trimestres (OKE MMcf/d,
// PSX MB/D, RCL USD/APCD, PSA $/sq ft). Annual = valeur FY publiee (stock).
const STOCK_UNIT_PATTERNS = [
  /\/\s*d(ay)?\b/i, // MMcf/d, MB/D, boe/d
  /\/\s*apcd\b/i, // USD/APCD
  /\/\s*sq\s*\.?\s*ft\b/i, // $/sq ft
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

  // 1bis. Unité = taux par jour / par unité de capacité → stock (moyenne de
  // période, jamais sommable)
  if (STOCK_UNIT_PATTERNS.some((re) => re.test(unit))) return "stock";

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
 * @param historyPeriods Optional: explicit period labels per index (ex ["Q1 2024", "Q2 2024", ...]).
 *                       Si fourni : utilisé comme vérité absolue (gère history non-contigu,
 *                       ex NVDA XBRL où Q1 de chaque calendar year est manquant).
 *                       Si absent : fallback walking-back contigu depuis lastDataDate.
 */
export function aggregateQuarterlyToAnnual(
  history: number[],
  lastDataDate: string | null | undefined,
  kind: KpiAggregationKind,
  fiscalYearEndMonth: number = 12,
  historyPeriods?: string[] | null,
): { years: string[]; values: number[]; ttm: number | null } {
  if (!Array.isArray(history) || history.length === 0) {
    return { years: [], values: [], ttm: null };
  }

  // Strategy A : history_periods fourni → on parse les labels et on
  // dérive (fy, q) fiscal de chaque index. Robust à history non-contigu.
  const stamps: Array<{ fy: number; q: number; v: number }> = [];
  if (Array.isArray(historyPeriods) && historyPeriods.length === history.length) {
    for (let i = 0; i < history.length; i++) {
      const parsed = parsePeriodLabel(historyPeriods[i], fiscalYearEndMonth);
      if (!parsed) continue;
      stamps.push({ fy: parsed.fy, q: parsed.q, v: history[i] });
    }
  } else {
    // Strategy B : fallback walking-back contigu depuis lastDataDate.
    const d = lastDataDate ? new Date(lastDataDate) : null;
    if (!d || Number.isNaN(d.getTime())) {
      const out: number[] = [];
      for (let i = history.length - 1; i >= 0; i -= 4) out.unshift(history[i]);
      return { years: out.map((_, i) => String(2026 - out.length + i + 1)), values: out, ttm: null };
    }
    const calY = d.getUTCFullYear();
    const calM = d.getUTCMonth() + 1;
    const fyOfLastQ = calM > fiscalYearEndMonth ? calY + 1 : calY;
    const monthInFY = ((calM - fiscalYearEndMonth - 1 + 12) % 12) + 1;
    const qOfLastQ = Math.ceil(monthInFY / 3);
    let fy = fyOfLastQ;
    let q = qOfLastQ;
    for (let i = history.length - 1; i >= 0; i--) {
      stamps.unshift({ fy, q, v: history[i] });
      q -= 1;
      if (q === 0) { q = 4; fy -= 1; }
    }
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
    return qs[qs.length - 1];
  });

  // TTM : somme des 4 derniers Q publiés (flow) ou dernier Q (stock)
  let ttm: number | null = null;
  if (history.length >= 4 && kind === "flow") {
    ttm = history.slice(-4).reduce((a, b) => a + b, 0);
  } else if (history.length >= 1 && kind === "stock") {
    ttm = history[history.length - 1];
  }

  // Dédup TTM == dernière FY
  if (ttm != null && values.length > 0 && Math.abs(values[values.length - 1] - ttm) < 0.01) {
    ttm = null;
  }

  return { years, values, ttm };
}

/**
 * Parse un label de période XBRL ("Q1 2024", "Q3 FY25", "FY24 Q2") en
 * coordonnées (fy fiscale, q dans la fy). Retourne null si non parsable.
 *
 * Convention NVDA-like (XBRL labels = calendar quarter de la PÉRIODE
 * d'END) : "Q3 2024" = period ending Oct 2024 = NVDA FY25 Q3.
 * On convertit toujours en (fy fiscale, q fiscal).
 */
function parsePeriodLabel(label: string, fiscalYearEndMonth: number): { fy: number; q: number } | null {
  // Format "Q1-FY2024" (déjà exprimé en trimestre fiscal, ex kpis-haut) :
  // q et fy directement utilisables, pas de conversion calendaire.
  let m = label.match(/^Q([1-4])-FY(\d{4})$/i);
  if (m) {
    return { fy: Number(m[2]), q: Number(m[1]) };
  }
  // Format "Q1-2024" (kpis-haut, trimestre calendaire avec tiret) : même
  // logique de conversion fiscale que "Q1 2024" ci-dessous.
  m = label.match(/^Q([1-4])-(20\d{2}|\d{2})$/i);
  if (m) {
    const calQ = Number(m[1]);
    let calY = Number(m[2]);
    if (calY < 100) calY += 2000;
    const calM = calQ * 3;
    const fy = calM > fiscalYearEndMonth ? calY + 1 : calY;
    const monthInFY = ((calM - fiscalYearEndMonth - 1 + 12) % 12) + 1;
    const q = Math.ceil(monthInFY / 3);
    return { fy, q };
  }
  // Format "Q1 2024" / "Q1 24" (calendar quarter + calendar year)
  m = label.match(/^Q([1-4])\s+(20\d{2}|\d{2})$/i);
  if (m) {
    const calQ = Number(m[1]);
    let calY = Number(m[2]);
    if (calY < 100) calY += 2000;
    // calM = mois de fin du calendar quarter
    const calM = calQ * 3; // 3, 6, 9, 12
    const fy = calM > fiscalYearEndMonth ? calY + 1 : calY;
    const monthInFY = ((calM - fiscalYearEndMonth - 1 + 12) % 12) + 1;
    const q = Math.ceil(monthInFY / 3);
    return { fy, q };
  }
  // Format "FY24 Q3" or "Q3 FY24"
  m = label.match(/FY\s*(\d{2,4}).*Q([1-4])/i) || label.match(/Q([1-4]).*FY\s*(\d{2,4})/i);
  if (m) {
    let fy = Number(m[1]?.length === 2 ? `20${m[1]}` : m[1]);
    const q = Number(m[2]);
    if (fy < 100) fy += 2000;
    return { fy, q };
  }
  return null;
}
