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
  // Yann 12 juil 2026 (chunk 1 vue annuelle vide) : moyennes par unite et
  // comptages point-in-time classes flow a tort (AVB avg_monthly_rev,
  // AVB dev_pipeline, CCL per diems PCD/ALBD, CHTR ARPU + lignes mobiles,
  // CASY marge par gallon + nombre de magasins).
  /\barpu\b/i,
  /\bpar\s+jour\s+passager\b/i, // CCL Ticket/Onboard per PCD
  /\bper\s+pcd\b|perpcd/i,
  /\balbd\b/i, // CCL FuelCostALBD (cout par ALBD)
  /\bpipeline\s+d[ée]veloppement\b|\bd[ée]veloppement\s+pipeline\b|\bdev(elopment)?\s+pipeline\b/i,
  /\blignes?\s+mobiles?\b|\bmobile\s+lines?\b/i,
  /\bnombre\s+total\s+de\s+magasins\b|\btotal\s+stores?\b/i,
  /\bmensuel\s+moyen\b|\bmoyen\s+mensuel\b/i,
  // Yann 12 juil 2026 (chunk 2 vue annuelle vide) : encours contractuel
  // point-in-time (Gartner GTS/GBS Contract Value) + revenu par chambre
  // disponible (MAR RevPAR = moyenne de periode, jamais sommable).
  /\bcontract\s+value\b/i,
  /\bvaleur\s+contractuelle\b/i,
  /\brevpar\b/i,
  /\bper\s+available\s+room\b/i,
  // Yann 12 juil 2026 (chunk 3 vue annuelle vide) : moyennes par compte /
  // par chambre occupee (VZ ARPA, VTR RevPOR) + surface operee point-in-time
  // (ARE "Total Operating RSF") classees flow a tort.
  /\barpa\b/i,
  /\brevpor\b/i,
  /\bper\s+occupied\s+(room|bed|unit)\b/i,
  /\boperating\s+rsf\b/i,
  // Yann 12 juil 2026 (chunk 0 vue annuelle vide) : comptages fin de periode
  // classes flow a tort — polices en vigueur (ALL pif_auto/pif_home), prets
  // au bilan (RJF BANK_LOANS "Loans Held for Investment"), nombre de
  // conseillers (RJF FA_COUNT "Financial Advisor Count").
  /\bpolic(?:ies|es)\s+in\s+force\b/i,
  /\bpolices\s+en\s+vigueur\b/i,
  /\bloans?\s+held\b/i,
  /\bpr[eê]ts\s+bancaires\b/i,
  /\badvisor\s+count\b/i,
  /\bnombre\s+de\s+conseillers\b/i,
  // Yann 12 juil 2026 (chunk 4 vue annuelle vide) : comptages de membres fin
  // de periode (CVS Medicare Advantage Membership) classes flow a tort.
  /\bmembership\b/i,
  /\bmembres\b/i,
  // Yann 12 juil 2026 (chunk 7 vue annuelle vide) : prix moyen chambre
  // (WYNN "Average Daily Rate" = moyenne de periode), comptage de magasins
  // fin de periode (ULTA "Store Count") et actifs clients fin de periode
  // (AMP "Total Client Assets") classes flow a tort.
  /\baverage\s+daily\s+rate\b/i,
  /\bprix\s+moyen\s+chambre\b/i,
  /\bstore\s+count\b/i,
  /\bnombre\s+de\s+magasins\b/i,
  /\bclient\s+assets\b/i,
  /\bactifs\s+clients\b/i,
  // Yann 12 juil 2026 (chunk 9 vue annuelle vide) : ARR (Annualized Recurring
  // Revenue GDDY) = snapshot fin de periode annualise, pas sommable. CASM/CASM-X
  // (LUV Cost per Available Seat Mile) = taux moyen de periode. Fleet Total
  // (LUV nombre d'appareils) et Restaurant Count (MCD comptage etablissements)
  // = comptages point-in-time.
  /\bannualized\s+recurring\s+revenue\b/i,
  /\brevenu\s+r[eé]current\s+annualis[eé]\b/i,
  /\bcasm(?:\b|-)/i,
  /\bcost\s+per\s+available\s+seat\s+mile\b/i,
  /\bfleet(?:\s+total|\s+count)?\b/i,
  /\bnombre\s+d[' ]appareils?\b/i,
  /\brestaurant\s+count\b/i,
  /\bnombre\s+de\s+restaurants\b/i,
  // Yann 12 juil 2026 (chunk 10 vue annuelle vide) : soldes de bilan (advance
  // ticket sales, loan receivables, finance receivables) et comptages moyens
  // classes flow a tort — sont des stocks point-in-time.
  /\badvance\s+ticket\s+sales?\b/i,
  /\bfuture\s+bookings?\b/i,
  /\bloan\s+receivables?\b/i,
  /\bcr[eé]ances?\s+(sur\s+)?pr[eê]ts\b/i,
  /\baverage\s+active\s+accounts?\b/i,
  /\bcomptes?\s+actifs?\s+moyens?\b/i,
  /\bcarried\s+interest\b/i,
  /\bcontract\s+receivables?\b/i,
  /\bfinance\s+receivables?\b/i,
  /\bfranchise\s+receivables?\b/i,
  // Yann 12 juil 2026 (chunk 11 vue annuelle vide) : soldes clients point-in-
  // time (BAC GWIM_CB "Client Balances"), comptages de clients / sites clients
  // fin de periode (DDOG total_customers, FAST large_sites_50k "Monthly
  // Customer Sites") classes flow a tort.
  /\bclient\s+balances?\b/i,
  /\bcustomers?\b/i,
  /\bcustomer\s+sites?\b/i,
  // Yann 12 juil 2026 (chunk 13 vue annuelle vide) : poids moyen par
  // expedition (ODFL weight_per_shipment) = moyenne de periode, jamais
  // sommable sur 4 trimestres. Annual = valeur FY publiee (stock).
  /\bper\s+shipment\b/i,
  /\bpar\s+exp[eé]dition\b/i,
  /\bweight\s+per\b/i,
  // Yann 12 juil 2026 (chunk 17 vue annuelle vide) : prix moyen par cas
  // (ALGN clear_aligner_asp "USD/cas" = ASP moyen de periode), comptages
  // point-in-time de medecins actifs (ALGN active_doctor_submitters
  // "milliers de medecins"), soumetteurs (submitters), moyennes non
  // sommables — ASP generique.
  /\basp\b/i,
  /\bprix\s+moyen\s+par\s+(cas|case|unit[eé])\b/i,
  /\bm[eé]decins?\s+actifs?\b/i,
  /\bactive\s+doctors?\b/i,
  /\bsubmitters?\b/i,
  // Yann 12 juil 2026 (chunk 20 vue annuelle vide) : comptages fin de periode
  // point-in-time — communities (PHM community_count nombre de communautes
  // ouvertes) classees flow a tort. Annual = valeur FY publiee (stock).
  /\bcommunity\s+count\b/i,
  /\bcommunit(?:y|ies)\b/i,
];

// Yann 12 juil 2026 : unites "par jour" / "par unite de capacite" = debits
// moyens de la periode, jamais sommables sur 4 trimestres (OKE MMcf/d,
// PSX MB/D, RCL USD/APCD, PSA $/sq ft). Annual = valeur FY publiee (stock).
const STOCK_UNIT_PATTERNS = [
  /\/\s*d(ay)?\b/i, // MMcf/d, MB/D, boe/d
  /\/\s*apcd\b/i, // USD/APCD
  /\/\s*sq\s*\.?\s*ft\b/i, // $/sq ft
  // Yann 12 juil 2026 (chunk 1) : moyennes par mois / par gallon
  /\/\s*mois\b|\/\s*month\b|\/\s*mo\b/i, // $/mois (AVB), USD/mois (CHTR ARPU)
  /\/\s*gal(lon)?s?\b/i, // cents/gallon (CASY fuel_cpg)
  // Yann 12 juil 2026 (chunk 4 vue annuelle vide) : debits journaliers ADV
  // (CBOE "M contrats/jour", CME "M contracts/jour"), taux par contrat
  // (CME RPC "$/contrat") et prix/marges moyens par tonne (CF "$/ton").
  /\/\s*jours?\b/i, // contrats/jour (ADV)
  /\/\s*contra(?:c)?ts?\b/i, // $/contrat, $/contract (RPC)
  /\/\s*(?:metric\s+)?tonn?e?s?\b/i, // $/ton, $/tonne (prix moyen CF)
  // Yann 12 juil 2026 (chunk 6 vue annuelle vide) : marges moyennes par baril
  // (PSX "Realized refining margin/bbl" en $/bbl) = moyenne de periode,
  // jamais sommable sur 4 trimestres. Annual = valeur Q4 publiee (stock).
  /\/\s*bbl\b/i, // $/bbl
  // Yann 12 juil 2026 (chunk 16 vue annuelle vide) : prix moyen realise par
  // BOE (TPL PRICE_BOE en $/Boe) = moyenne de periode, jamais sommable sur
  // 4 trimestres. Annual = valeur Q4 publiee (stock).
  /\/\s*bo?e\b/i, // $/BOE, $/BE
  // Yann 12 juil 2026 (chunk 17 vue annuelle vide) : debit journalier
  // raffinage (CVX DS_REFINERY_INPUTS "MBD" = Million Barrels per Day)
  // = moyenne de periode, jamais sommable, unite sans slash a matcher
  // explicitement.
  /^mbd$|^mb\/d$|\bmbd\b/i,
  // ALGN clear_aligner_asp unit "USD/cas" — prix moyen par cas.
  /\/\s*cas\b/i,
  // Yann 12 juil 2026 (chunk 20 vue annuelle vide) : prix moyen par unite
  // energetique (EQT $/Mcfe = prix realise moyen gaz naturel) et prix moyen
  // par traitement dialyse (DVA USD/traitement) = moyennes ponderees de
  // periode, jamais sommables sur 4 trimestres. Annual = valeur FY publiee
  // (stock).
  /\/\s*mcfe?\b/i,
  /\/\s*traitement\b/i,
  /\/\s*treatment\b/i,
  /\/\s*acre\b/i,
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
