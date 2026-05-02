/**
 * V2 cat 2 : Batch 3 (28 sociétés FPI ADR US restantes pour atteindre top 50).
 *
 * Format ultra-compact : Hero KPI + 4-5 indicateurs sectoriels par sté.
 * Pas de governance / AI positioning / risks (à enrichir round 2).
 * Source : connaissances publiques 2024-2025, statut DRAFT.
 */

import type { Company } from "@/lib/data";

function mk(c: Omit<Company, "logo_treatment"> & { logo_treatment?: Company["logo_treatment"] }): Company {
  return { logo_treatment: "orbit", ...c };
}

export const V2_BATCH3: Record<string, Company> = {
  /* ─── INDIA TECH ─── */
  INFY: mk({
    ticker: "INFY", name: "Infosys", sector: "Technologie", subsector: "IT Services / India",
    tagline: "Navigate your next.",
    founded: 1981, ipo: 1999,
    ranks: { global_world: "≈ #170", global_us: "ADR Top 40", sector: "Top 10 IT services", subsector: "#2 India IT" },
    hero_kpi: "Digital Revenue",
    hero_kpi_rationale: "Digital Revenue (cloud + AI + data) est le segment qui change la trajectoire d'Infosys. Plus de 60% du revenu en 2025, croît plus vite que le legacy IT services.",
    kpis: [
      { short: "Digital Revenue", name_fr: "Revenu Digital", name_en: "Digital Services Revenue", explanation: "Revenu segments digitaux (cloud, data, AI, cybersecurity).", value: "11.0", unit: "$B", yoy: "+8%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "60% du revenu", description: "Driver: Cobalt cloud, Topaz AI suite, partenariats hyperscalers.", history: [6.5, 8.0, 9.5, 10.2, 11.0], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Topaz AI", name_fr: "Engagements IA Topaz", name_en: "Topaz AI Engagements", explanation: "Nombre de programmes IA Topaz signés avec clients enterprise.", value: "270+", unit: "deals", yoy: "+4x", type: "Adoption", nature: "Structurel", comparable: "Non comparable", signal: "Adoption rapide", description: "Topaz est la plateforme AI-first d'Infosys. >270 deals signés post-launch.", history: [60, 270], is_wow: true, is_generic: false, is_short_history: true, story_category: "Innovation" },
      { short: "Op Margin", name_fr: "Marge opérationnelle", name_en: "Operating Margin", explanation: "Marge op. consolidée.", value: "21.1", unit: "%", yoy: "+0.1 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Stable", description: "Levier prix vs pression salariale Inde.", history: [24.5, 23.0, 21.0, 21.0, 21.1], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Headcount", name_fr: "Effectif", name_en: "Total Employees", explanation: "Nombre total d'employés (mostly Inde).", value: "323", unit: "K", yoy: "+1%", type: "Investment", nature: "Structurel", comparable: "Comparable", signal: "Stabilisation après cuts 2023", description: "320K+ employés. Croissance lente, focus sur productivité.", history: [259, 314, 343, 318, 323], is_wow: false, is_generic: false, is_short_history: false },
    ],
  }),
  WIT: mk({
    ticker: "WIT", name: "Wipro", sector: "Technologie", subsector: "IT Services / India",
    tagline: "Limitless human ingenuity.",
    founded: 1945, ipo: 2000,
    ranks: { global_world: "≈ #350", global_us: "ADR Top 90", sector: "Top 15 IT services", subsector: "#3 India IT" },
    hero_kpi: "Consulting",
    hero_kpi_rationale: "Capco (consulting acquis 2021) est le segment qui change la trajectoire post-restructuration Wipro 2024.",
    kpis: [
      { short: "Consulting", name_fr: "Revenu Consulting (Capco)", name_en: "Consulting Revenue (Capco-led)", explanation: "Revenu consulting (Capco financial services + Wipro Consulting).", value: "1.8", unit: "$B", yoy: "+5%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Driver post-restructuration", description: "Capco $1B+ ARR. Driver de la repositioning.", history: [1.0, 1.4, 1.7, 1.7, 1.8], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Marge opérationnelle IT Services", name_en: "IT Services Operating Margin", explanation: "Marge op. segment IT Services (post-restructuration).", value: "16.8", unit: "%", yoy: "+0.5 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Recovery progressif", description: "Sous pression vs pairs Inde mais en amélioration.", history: [21.0, 19.0, 17.0, 16.3, 16.8], is_wow: false, is_generic: true, is_short_history: false },
      { short: "TCV", name_fr: "Total Contract Value (large deals)", name_en: "Quarterly TCV (deal wins)", explanation: "Valeur totale des deals >$30M signés au trimestre.", value: "5.6", unit: "$B", yoy: "+30%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Pipeline qui repart", description: "TCV en hausse = visibilité sur 2025-2026.", history: [3.5, 3.8, 4.0, 4.3, 5.6], is_wow: true, is_generic: false, is_short_history: false },
    ],
  }),
  IBN: mk({
    ticker: "IBN", name: "ICICI Bank", sector: "Finance", subsector: "Banks / India",
    tagline: "Hum hai na.",
    founded: 1955, ipo: 1998,
    ranks: { global_world: "≈ #110", global_us: "ADR Top 32", sector: "Top 30 banks mondial", subsector: "#2 India private" },
    hero_kpi: "Loan Book",
    hero_kpi_rationale: "Croissance loan book ~17%/an = leader croissance crédit Inde, devant HDFC post-fusion.",
    kpis: [
      { short: "Loan Book", name_fr: "Encours de crédit", name_en: "Total Loan Book", explanation: "Encours de crédit consolidé.", value: "13.3", unit: "T INR", yoy: "+15%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Croissance >15%/an", description: "Driver: retail (~52%), SME, corporate.", history: [7.4, 8.6, 10.2, 11.5, 13.3], is_wow: true, is_generic: false, is_short_history: false },
      { short: "NIM", name_fr: "Marge nette d'intérêt", name_en: "Net Interest Margin", explanation: "NIM consolidé.", value: "4.39", unit: "%", yoy: "-7 bps", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "nim", signal: "Top-class banque indienne", description: "NIM le plus haut parmi les top 5 banks indiennes.", history: [3.81, 4.04, 4.48, 4.49, 4.39], is_wow: true, is_generic: false, is_short_history: false },
      { short: "GNPA", name_fr: "Gross NPA Ratio", name_en: "Gross NPA Ratio", explanation: "Ratio créances douteuses brutes.", value: "1.96", unit: "%", yoy: "-46 bps", type: "Risk", nature: "Cyclique", comparable: "Comparable", signal: "Amélioration continue", description: "GNPA en baisse continue depuis 2020.", history: [4.96, 3.60, 2.81, 2.16, 1.96], is_wow: true, is_generic: false, is_short_history: false },
      { short: "ROA", name_fr: "Return on Assets", name_en: "Return on Assets", explanation: "Rentabilité actifs.", value: "2.32", unit: "%", yoy: "+5 bps", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Top-class mondial", description: "ROA très haut, levée de capital faible nécessaire.", history: [1.39, 1.84, 2.16, 2.27, 2.32], is_wow: false, is_generic: false, is_short_history: false },
    ],
  }),

  /* ─── JAPAN ─── */
  SONY: mk({
    ticker: "SONY", name: "Sony Group", sector: "Communication Services", subsector: "Entertainment + Hardware / Japan",
    tagline: "Be Moved.",
    founded: 1946, ipo: 1958,
    ranks: { global_world: "≈ #75", global_us: "ADR Top 22", sector: "Top 5 entertainment global", subsector: "#1 PlayStation" },
    hero_kpi: "Game & Network",
    hero_kpi_rationale: "Game & Network Services (PlayStation) pèse ~30% du revenu Sony et drive croissance + marge. PS5 fin de cycle, GTA VI 2025-2026 = boost attendu.",
    kpis: [
      { short: "Game & Network", name_fr: "Revenu Game & Network Services", name_en: "Game & Network Services Revenue", explanation: "PlayStation hardware + software + PS+ subscriptions.", value: "4.4", unit: "T JPY", yoy: "+18%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Cap des JPY 4.4T franchi", description: "PS5 LTM sales 65M+ units. PS+ 116M abonnés.", history: [2.6, 2.7, 3.6, 3.7, 4.4], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Music", name_fr: "Revenu Music", name_en: "Music Segment Revenue (recorded + publishing)", explanation: "Sony Music = #2 mondial recorded music + publishing #1.", value: "1.7", unit: "T JPY", yoy: "+10%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Streaming continue de tirer", description: "Catalog + nouveaux artistes. Streaming royalties driver.", history: [0.9, 1.1, 1.4, 1.5, 1.7], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Image Sensors", name_fr: "Revenu Image Sensors (CMOS)", name_en: "Imaging & Sensing Solutions Revenue", explanation: "Capteurs CMOS pour smartphones + auto + industriel. Sony #1 mondial.", value: "1.7", unit: "T JPY", yoy: "+24%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Mix premium iPhone tire", description: "Sensors flagship Apple iPhone Pro = pricing premium.", history: [1.0, 1.1, 1.4, 1.4, 1.7], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Marge opérationnelle Group", name_en: "Operating Income Margin", explanation: "Marge op. consolidée.", value: "11.0", unit: "%", yoy: "+1 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Mix Music + Sensors tire", description: "Mix premium services + sensors améliore la marge.", history: [10.0, 11.0, 9.0, 10.0, 11.0], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
  HMC: mk({
    ticker: "HMC", name: "Honda Motor", sector: "Industrie", subsector: "Auto + Motorcycles / Japan",
    tagline: "The power of dreams.",
    founded: 1948, ipo: 1957,
    ranks: { global_world: "≈ #100", global_us: "ADR Top 30", sector: "Top 10 auto", subsector: "#1 motorcycles mondial" },
    hero_kpi: "Motorcycles",
    hero_kpi_rationale: "Honda est #1 mondial des motos avec marges très supérieures à l'auto. Le segment Motorcycles drive le profit alors que l'auto est sous pression.",
    kpis: [
      { short: "Motorcycles", name_fr: "Revenu Motorcycles", name_en: "Motorcycle Business Revenue", explanation: "Revenu motos (Honda #1 mondial volumes + revenu).", value: "3.5", unit: "T JPY", yoy: "+15%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Driver profit groupe", description: "20M+ motos vendues/an. Marché Inde + Asie tire.", history: [2.4, 2.7, 3.0, 3.0, 3.5], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Moto Op Margin", name_fr: "Marge opérationnelle Motorcycles", name_en: "Motorcycle Operating Margin", explanation: "Marge motos. Très supérieure à l'auto chez Honda.", value: "18.0", unit: "%", yoy: "+1 pt", type: "Margin", nature: "Structurel", comparable: "Comparable", signal: "3x supérieure à auto", description: "Pricing power motos vs auto. Pricing premium en Inde.", history: [13.5, 14.0, 16.0, 17.0, 18.0], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Auto Sales", name_fr: "Ventes Auto unités", name_en: "Auto Unit Sales", explanation: "Ventes auto en unités globales.", value: "3.8", unit: "M unités", yoy: "-3%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Sous pression Chine + EV", description: "Honda perd des parts en Chine + transition EV difficile.", history: [4.5, 4.1, 4.1, 3.9, 3.8], is_wow: false, is_generic: true, is_short_history: false },
      { short: "EV Strategy", name_fr: "Capex EV/Software 2030", name_en: "EV + Software Capex Plan 2030", explanation: "Plan capex pluriannuel pour EV + software (annoncé 2024).", value: "10", unit: "T JPY", yoy: "n/a", type: "Investment", nature: "Structurel", comparable: "Non comparable", signal: "Pivot stratégique", description: "JPY 10T (~$65B) annoncé pour 2024-2030 EV + software-defined cars.", history: [10], is_wow: true, is_generic: false, is_short_history: true, story_category: "Capacité" },
    ],
  }),
  MUFG: mk({
    ticker: "MUFG", name: "Mitsubishi UFJ Financial", sector: "Finance", subsector: "Banks / Japan",
    tagline: "Empowering a brighter future.",
    founded: 2005, ipo: 2005,
    ranks: { global_world: "≈ #110", global_us: "ADR Top 35", sector: "Top 20 banks mondial", subsector: "#1 Japan" },
    hero_kpi: "Net Interest Income",
    hero_kpi_rationale: "Le retour des taux positifs au Japon (2024) bouleverse la trajectoire MUFG. NII = driver direct, sortie de 20 ans de taux nuls.",
    kpis: [
      { short: "NII", name_fr: "Revenu d'intérêts net", name_en: "Net Interest Income", explanation: "Revenu d'intérêts net consolidé.", value: "3.2", unit: "T JPY", yoy: "+22%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Effet hausse taux BoJ", description: "Sortie taux 0%, hausse BoJ mars 2024. Bénéfice direct sur NII.", history: [2.0, 2.2, 2.4, 2.6, 3.2], is_wow: true, is_generic: false, is_short_history: false },
      { short: "ROE", name_fr: "Return on Equity", name_en: "Return on Equity", explanation: "Rentabilité capitaux propres.", value: "9.5", unit: "%", yoy: "+1.5 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Target 9%+ atteint", description: "Première fois que MUFG dépasse 9% durablement depuis 2008.", history: [6.0, 5.5, 7.0, 8.0, 9.5], is_wow: true, is_generic: false, is_short_history: false },
      { short: "CET1", name_fr: "Ratio CET1", name_en: "Common Equity Tier 1 Ratio", explanation: "Solvabilité réglementaire FSA.", value: "10.8", unit: "%", yoy: "+0.4 pt", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Au-dessus du target", description: "Capital permet buybacks JPY 1T+.", history: [11.0, 10.4, 10.0, 10.4, 10.8], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Morgan Stanley", name_fr: "Stake Morgan Stanley (24%)", name_en: "MSeval. equity-method earnings", explanation: "MUFG détient 24% de Morgan Stanley depuis 2008. Important contributeur profit.", value: "780", unit: "Mds JPY", yoy: "+15%", type: "Demand", nature: "Cyclique", comparable: "Non comparable", signal: "MS profit driver", description: "Contribution équivalent ~25% du profit MUFG. Stratégique.", history: [550, 500, 600, 680, 780], is_wow: true, is_generic: false, is_short_history: false },
    ],
  }),
  SMFG: mk({
    ticker: "SMFG", name: "Sumitomo Mitsui Financial", sector: "Finance", subsector: "Banks / Japan",
    tagline: "Make Tomorrow Better.",
    founded: 2002, ipo: 2002,
    ranks: { global_world: "≈ #160", global_us: "ADR Top 50", sector: "Top 25 banks mondial", subsector: "#3 Japan" },
    hero_kpi: "Net Interest Income",
    hero_kpi_rationale: "Comme MUFG, le retour des taux BoJ 2024 = trajectoire transformative. SMFG plus exposé au retail Japan que MUFG, donc levier NII plus direct.",
    kpis: [
      { short: "NII", name_fr: "Revenu d'intérêts net", name_en: "Net Interest Income", explanation: "Revenu d'intérêts net consolidé.", value: "2.4", unit: "T JPY", yoy: "+24%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Hausse taux BoJ tire", description: "Forte sensibilité retail JP aux taux BoJ.", history: [1.5, 1.6, 1.8, 1.9, 2.4], is_wow: true, is_generic: false, is_short_history: false },
      { short: "ROE", name_fr: "Return on Equity", name_en: "Return on Equity", explanation: "Rentabilité capitaux.", value: "9.1", unit: "%", yoy: "+1 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Target 9%+", description: "Atteint target plan stratégique 2026.", history: [6.3, 6.7, 7.5, 8.1, 9.1], is_wow: true, is_generic: false, is_short_history: false },
      { short: "CET1", name_fr: "Ratio CET1", name_en: "CET1 Ratio (FSA)", explanation: "Solvabilité.", value: "11.7", unit: "%", yoy: "+0.4 pt", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Capital fort", description: "Au-dessus minimum + buffer.", history: [11.0, 11.0, 11.3, 11.3, 11.7], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Asia Stake", name_fr: "Stratégie Asie (Jefferies stake)", name_en: "Asia Strategic Stakes (Jefferies + Yes Bank)", explanation: "Participations stratégiques: 51% Yes Bank India 2024, 5%+ Jefferies US.", value: "2", unit: "stakes", yoy: "n/a", type: "Investment", nature: "Structurel", comparable: "Non comparable", signal: "Expansion Asie agressive", description: "Yes Bank India: $1.6B pour 51%. Jefferies: alliance stratégique 2023-2024.", history: [2], is_wow: true, is_generic: false, is_short_history: true, story_category: "Marché" },
    ],
  }),

  /* ─── MINING ─── */
  BHP: mk({
    ticker: "BHP", name: "BHP Group", sector: "Industrie", subsector: "Mining / Australia",
    tagline: "Think big.",
    founded: 1885, ipo: 1885,
    ranks: { global_world: "≈ #80", global_us: "ADR Top 25", sector: "Top 5 mining mondial", subsector: "#1 mining diversifié" },
    hero_kpi: "Iron Ore",
    hero_kpi_rationale: "Iron Ore reste le KPI maître de BHP : ~50% du revenu, marge 60%+. Volume + Pilbara cost competitiveness = trajectoire.",
    kpis: [
      { short: "Iron Ore", name_fr: "Revenu Iron Ore", name_en: "Iron Ore Revenue (Pilbara WA)", explanation: "Revenu segment iron ore Pilbara (Western Australia + Brasil Samarco).", value: "26", unit: "$B", yoy: "-8%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Prix en repli", description: "Vol 290 Mt FY24, prix moyen ~$95/t (vs $120 2021).", history: [22, 39, 33, 28, 26], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Copper", name_fr: "Revenu Copper", name_en: "Copper Revenue", explanation: "Revenu segment copper (Escondida Chile + Olympic Dam Australia + Spence + Antamina).", value: "11.8", unit: "$B", yoy: "+24%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "IA + EV drive demand", description: "Cuivre = #1 long-terme bet BHP (IA + EV + grids).", history: [7.0, 7.5, 8.5, 9.5, 11.8], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Underlying EBITDA margin", name_en: "Underlying EBITDA Margin", explanation: "Marge EBITDA underlying.", value: "53", unit: "%", yoy: "-2 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Top-class mining", description: "Iron ore Pilbara cost <$20/t = leader cost worldwide.", history: [55, 60, 56, 55, 53], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Capex Copper", name_fr: "Capex Copper expansion", name_en: "Copper Capex (multi-year)", explanation: "Capex pluriannuel sur copper (Escondida growth, Filo del Sol Argentine, Olympic Dam).", value: "13.5", unit: "$B (5y)", yoy: "n/a", type: "Investment", nature: "Structurel", comparable: "Non comparable", signal: "Pivot copper", description: "Plan capex copper $13.5B sur 2024-2028. Plus gros pari BHP depuis 20 ans.", history: [13.5], is_wow: true, is_generic: false, is_short_history: true, story_category: "Capacité" },
    ],
  }),
  RIO: mk({
    ticker: "RIO", name: "Rio Tinto", sector: "Industrie", subsector: "Mining / UK + Australia",
    tagline: "Materials for the future.",
    founded: 1873, ipo: 1873,
    ranks: { global_world: "≈ #100", global_us: "ADR Top 30", sector: "Top 5 mining mondial", subsector: "#2 mining diversifié" },
    hero_kpi: "Iron Ore",
    hero_kpi_rationale: "Comme BHP, Iron Ore reste le moteur Rio Tinto. Mais focus accru sur copper + lithium pour transition énergétique.",
    kpis: [
      { short: "Iron Ore", name_fr: "Revenu Iron Ore", name_en: "Iron Ore Revenue (Pilbara)", explanation: "Revenu segment Iron Ore Pilbara WA.", value: "27", unit: "$B", yoy: "-7%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Prix en baisse", description: "Vol 327 Mt 2024. Simandou Guinée projet 2025-2027.", history: [22, 38, 30, 29, 27], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Aluminium", name_fr: "Revenu Aluminium", name_en: "Aluminium Revenue", explanation: "Aluminium primaire + alumina + bauxite.", value: "13.5", unit: "$B", yoy: "+15%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Driver low-carbon Al", description: "Premium ELYSIS (zero-carbon Al partnership Apple).", history: [10, 13, 12, 11.7, 13.5], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Copper", name_fr: "Revenu Copper", name_en: "Copper Revenue", explanation: "Copper segment (Kennecott Utah, Escondida 30%, Oyu Tolgoi Mongolie).", value: "8.4", unit: "$B", yoy: "+30%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Oyu Tolgoi underground ramp", description: "Production +50% à terme avec ramp underground Oyu Tolgoi.", history: [4.5, 5.8, 6.0, 6.5, 8.4], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Simandou", name_fr: "Projet Simandou (Guinée)", name_en: "Simandou Iron Ore Project (Guinea)", explanation: "Plus grand projet greenfield iron ore au monde. Premier minerai 2025-2026.", value: "11.6", unit: "$B capex", yoy: "n/a", type: "Investment", nature: "Structurel", comparable: "Non comparable", signal: "First ore 2025-2026", description: "First production 2025-2026. Capacité 60 Mt/an. Plus haute teneur Fe au monde.", history: [11.6], is_wow: true, is_generic: false, is_short_history: true, story_category: "Capacité" },
    ],
  }),

  /* ─── EU CONSUMER + INDUSTRIAL ─── */
  UL: mk({
    ticker: "UL", name: "Unilever", sector: "Conso", subsector: "FMCG / UK",
    tagline: "Brighter Future. Better Business.",
    founded: 1929, ipo: 1929,
    ranks: { global_world: "≈ #90", global_us: "ADR Top 28", sector: "Top 5 FMCG", subsector: "#3 FMCG mondial" },
    hero_kpi: "Underlying Sales",
    hero_kpi_rationale: "Underlying Sales Growth (price + volume excl. FX/M&A) est le KPI maître Unilever. Indicateur de la capacité à grandir organiquement.",
    kpis: [
      { short: "Underlying Sales", name_fr: "Underlying Sales Growth", name_en: "Underlying Sales Growth (USG)", explanation: "Croissance organique price + volume.", value: "+4.2", unit: "% YoY", yoy: "+0.5 pt", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Volumes redeviennent positifs", description: "Volumes +2% en 2024 vs -1% en 2023. Premium + Beauty drivers.", history: [4.5, 4.5, 9.0, 7.0, 4.2], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Power Brands", name_fr: "Top 30 Power Brands", name_en: "Top 30 Power Brands Sales", explanation: "Sales des 30 marques principales (Dove, Hellmann's, Magnum, Knorr, etc.).", value: "70", unit: "%", yoy: "+1 pt", type: "Mix", nature: "Structurel", comparable: "Non comparable", signal: "Concentration sur top 30", description: "75% des sales totales viennent du top 30. Stratégie focus.", history: [65, 67, 68, 69, 70], is_wow: false, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Underlying Op Margin", name_en: "Underlying Operating Margin", explanation: "Marge op underlying (excl. one-offs).", value: "18.4", unit: "%", yoy: "+1.7 pts", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Levier mix premium", description: "Cost-out + premiumization tirent la marge.", history: [18.5, 18.4, 16.1, 16.7, 18.4], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Ice Cream Spin", name_fr: "Spin-off Ice Cream (2025)", name_en: "Ice Cream Demerger (announced 2024)", explanation: "Annoncé 2024 : démarrage de la franchise Ice Cream (Magnum, Wall's, Ben & Jerry's, Cornetto).", value: "8.7", unit: "Mds €", yoy: "n/a", type: "Investment", nature: "Conjoncturel", comparable: "Non comparable", signal: "Démantèlement Q4 2025", description: "Ice Cream = €8.7B sales 2024. Spin-off prévu Q4 2025. Structure post-Unilever.", history: [8.7], is_wow: true, is_generic: false, is_short_history: true, story_category: "Marché" },
    ],
  }),
  RELX: mk({
    ticker: "RELX", name: "RELX", sector: "Communication Services", subsector: "Information & Analytics / UK",
    tagline: "Unique contributions to society.",
    founded: 1993, ipo: 1993,
    ranks: { global_world: "≈ #85", global_us: "ADR Top 26", sector: "Top 5 information", subsector: "#1 risk + scientific" },
    hero_kpi: "Risk",
    hero_kpi_rationale: "Risk segment (data + analytics for insurance + business risk + government) est la plus grosse division RELX et celle qui croît le + vite (+8%/an).",
    kpis: [
      { short: "Risk", name_fr: "Revenu Risk segment", name_en: "Risk Business Revenue", explanation: "LexisNexis Risk Solutions: data + analytics insurance, business risk, government, fraud.", value: "3.5", unit: "Mds £", yoy: "+8%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Croissance soutenue", description: "Driver data + analytics IA. ~35% du revenue groupe.", history: [2.6, 2.85, 3.13, 3.25, 3.5], is_wow: true, is_generic: false, is_short_history: false },
      { short: "STM", name_fr: "Revenu Scientific Technical Medical", name_en: "STM Revenue (Elsevier)", explanation: "Elsevier publishing scientifique + Reaxys.", value: "3.2", unit: "Mds £", yoy: "+4%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Stable récurrent", description: "Modèle subscription resilient. AI integration via ScienceDirect.", history: [2.7, 2.9, 3.05, 3.1, 3.2], is_wow: false, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Adj Op Margin", name_en: "Adjusted Operating Margin", explanation: "Marge op. ajustée (excl. amortissements).", value: "33.6", unit: "%", yoy: "+0.7 pt", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Top-quartile services info", description: "Mix data + analytics + AI tire.", history: [31.5, 32.0, 32.5, 32.9, 33.6], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
  DEO: mk({
    ticker: "DEO", name: "Diageo", sector: "Conso", subsector: "Spirits / UK",
    tagline: "Celebrating life.",
    founded: 1997, ipo: 1997,
    ranks: { global_world: "≈ #240", global_us: "ADR Top 65", sector: "Top 5 spirits", subsector: "#1 spirits global" },
    hero_kpi: "Premium+",
    hero_kpi_rationale: "Premium+ (super-premium et au-delà) est le moteur de croissance de Diageo, capte la trade-up consumer + meilleure marge.",
    kpis: [
      { short: "Premium+", name_fr: "Part Premium+ dans les sales", name_en: "Premium+ Share of Sales", explanation: "Part super-premium + ultra-premium (Don Julio, Casamigos, Johnnie Walker Black+, Tanqueray No. Ten).", value: "57", unit: "%", yoy: "stable", type: "Mix", nature: "Structurel", comparable: "Non comparable", signal: "Trade-up structurel", description: "Driver: Casamigos, Don Julio (tequila), Johnnie Walker Blue.", history: [50, 53, 55, 57, 57], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Net Sales", name_fr: "Net Sales", name_en: "Net Sales", explanation: "Revenu organique consolidé.", value: "20.3", unit: "Mds £", yoy: "-1%", type: "Revenue", nature: "Cyclique", comparable: "Comparable", signal: "Léger repli LatAm", description: "Volumes -2% (LatAm + USA spirits softness).", history: [12.7, 15.5, 17.1, 20.3, 20.3], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Op Margin", name_fr: "Op Margin organique", name_en: "Organic Operating Margin", explanation: "Marge op. organique.", value: "29.9", unit: "%", yoy: "-0.5 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Top-class spirits", description: "Pricing + cost discipline maintiennent la marge.", history: [30.5, 31.2, 31.0, 30.4, 29.9], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
  BUD: mk({
    ticker: "BUD", name: "Anheuser-Busch InBev", sector: "Conso", subsector: "Beer / Belgium",
    tagline: "Brewing a future with more cheers.",
    founded: 2008, ipo: 2009,
    ranks: { global_world: "≈ #180", global_us: "ADR Top 50", sector: "Top 3 brewers mondial", subsector: "#1 brewer global" },
    hero_kpi: "Premium",
    hero_kpi_rationale: "Premiumisation (Corona, Stella, Michelob Ultra, Spaten) est le moteur de croissance vs marchés value plus matures.",
    kpis: [
      { short: "Premium", name_fr: "Part Premium dans les sales", name_en: "Premium Beer Share of Sales", explanation: "Part Premium + Super Premium (Corona, Stella, Michelob Ultra).", value: "60", unit: "%", yoy: "+2 pts", type: "Mix", nature: "Structurel", comparable: "Non comparable", signal: "Trade-up persistant", description: "Driver: Corona +9% globally, Stella +6%, Michelob Ultra +4%.", history: [50, 53, 57, 58, 60], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Volume", name_fr: "Volume Hectolitres", name_en: "Total Volume Hectoliters", explanation: "Volume total bière (hectolitres).", value: "548", unit: "M hL", yoy: "-1%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Stagnation volume", description: "Volume mature, croissance vient du mix premium + price.", history: [581, 595, 595, 555, 548], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Op Margin", name_fr: "EBITDA margin organique", name_en: "Organic EBITDA Margin", explanation: "Marge EBITDA organique.", value: "34.0", unit: "%", yoy: "+0.5 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Recovery progressive", description: "Margin recovery post-Bud Light boycott 2023.", history: [34.5, 34.0, 32.8, 33.5, 34.0], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
  STLA: mk({
    ticker: "STLA", name: "Stellantis", sector: "Industrie", subsector: "Auto / Multi-national",
    tagline: "Mobility for our planet.",
    founded: 2021, ipo: 2021,
    ranks: { global_world: "≈ #90", global_us: "ADR Top 27", sector: "Top 5 OEM", subsector: "#4 OEM" },
    hero_kpi: "North America",
    hero_kpi_rationale: "North America (Jeep + Ram + Chrysler) pèse ~35% revenu mais ~50% profit. C'est le segment maître mais en pleine restructuration 2024-2025.",
    kpis: [
      { short: "North America", name_fr: "Revenu North America", name_en: "North America Region Revenue", explanation: "Revenu segment Amérique du Nord (Jeep, Ram, Chrysler, Dodge).", value: "65", unit: "Mds €", yoy: "-32%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Crise inventory + execution", description: "Crise majeure 2024: inventory excess + pricing trop agressif. Carlos Tavares parti déc 2024.", history: [60, 70, 95, 95, 65], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Europe Enlarged", name_fr: "Revenu Europe Enlarged", name_en: "Europe Enlarged Region Revenue", explanation: "Revenu Europe + UK + autres EMEA.", value: "57", unit: "Mds €", yoy: "-7%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Marché EU compressé", description: "Pression CO2 + hausse couts. Multi-energy strategy continue.", history: [40, 50, 60, 61, 57], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Op Margin Group", name_fr: "Adj op margin group", name_en: "Adjusted Operating Income Margin", explanation: "Marge op ajustée groupe.", value: "5.5", unit: "%", yoy: "-7.5 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Crise majeure 2024", description: "Marge passe de 13% en 2023 à ~5.5% en 2024. Recovery 2025.", history: [10.4, 10.6, 13.0, 13.0, 5.5], is_wow: false, is_generic: true, is_short_history: false },
      { short: "BEV Sales", name_fr: "Ventes BEV (full electric)", name_en: "BEV (Battery EV) Sales", explanation: "Ventes véhicules 100% électriques.", value: "0.50", unit: "M unités", yoy: "+15%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Adoption progressive", description: "8% du mix global. Plan 2030 : 50% BEV en EU, 50% BEV+ICE en US.", history: [0.04, 0.10, 0.30, 0.43, 0.50], is_wow: true, is_generic: false, is_short_history: false },
    ],
  }),
  PHG: mk({
    ticker: "PHG", name: "Philips", sector: "Santé", subsector: "Medical Devices / Netherlands",
    tagline: "There's always a way to make life better.",
    founded: 1891, ipo: 1987,
    ranks: { global_world: "≈ #350", global_us: "ADR Top 90", sector: "Top 10 medical devices", subsector: "#3 imaging" },
    hero_kpi: "Diagnosis & Treatment",
    hero_kpi_rationale: "Diagnosis & Treatment (imaging + image-guided therapy) est le segment qui drive la trajectoire post-recall Respironics 2021-2024.",
    kpis: [
      { short: "Diagnosis & Treatment", name_fr: "Revenu Diagnosis & Treatment", name_en: "Diagnosis & Treatment Revenue", explanation: "Imaging (CT, MRI, ultrasound) + image-guided therapy + diagnostic informatics.", value: "9.6", unit: "Mds €", yoy: "+2%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Stabilisation post-recall", description: "Croissance modérée. Pipeline AI imaging actif.", history: [8.0, 8.6, 9.4, 9.4, 9.6], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Connected Care", name_fr: "Revenu Connected Care", name_en: "Connected Care Revenue", explanation: "Patient monitoring + emergency care + sleep & respiratory care (post-recall).", value: "5.0", unit: "Mds €", yoy: "+1%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Recovery Respironics", description: "Sleep & respiratory care en recovery progressive.", history: [5.5, 5.4, 5.1, 4.95, 5.0], is_wow: false, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Adj EBITA margin", name_en: "Adjusted EBITA Margin", explanation: "Marge EBITA ajustée.", value: "11.5", unit: "%", yoy: "+1.5 pts", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Recovery progressif", description: "Marge en récupération après crise Respironics.", history: [13.2, 11.0, 9.5, 10.0, 11.5], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Respironics", name_fr: "Coût total recall Respironics", name_en: "Respironics Recall Total Cost", explanation: "Coûts cumulés recall sleep apnea machines (depuis 2021).", value: "1.6", unit: "Mds €", yoy: "stable", type: "Risk", nature: "Conjoncturel", comparable: "Non comparable", signal: "Settlement 2024", description: "Settlement personal injury $1.1B 2024. Provision totale ~€1.6B.", history: [1.6], is_wow: false, is_generic: false, is_short_history: true, story_category: "Marché" },
    ],
  }),
  ABB: mk({
    ticker: "ABB", name: "ABB Group", sector: "Industrie", subsector: "Electrification + Automation / Switzerland",
    tagline: "Engineered to outrun.",
    founded: 1988, ipo: 1990,
    ranks: { global_world: "≈ #150", global_us: "ADR Top 45", sector: "Top 10 industrial automation", subsector: "#2 electrification" },
    hero_kpi: "Electrification",
    hero_kpi_rationale: "Le segment Electrification est le moteur ABB : data centers, EV charging, grid modernization. Croissance double-digit, marge en hausse.",
    kpis: [
      { short: "Electrification", name_fr: "Revenu Electrification", name_en: "Electrification Business Revenue", explanation: "Switchgear, distribution, EV charging, data center power, smart buildings.", value: "16.0", unit: "$B", yoy: "+8%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Driver data centers + EV", description: "Driver: data center buildout + EV charging + grid mod.", history: [11.0, 12.7, 14.4, 14.8, 16.0], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Op EBITA Elec", name_fr: "Op EBITA Margin Electrification", name_en: "Electrification Operational EBITA Margin", explanation: "Marge EBITA opérationnelle segment electrification.", value: "23.7", unit: "%", yoy: "+1.7 pts", type: "Margin", nature: "Structurel", comparable: "Comparable", signal: "Premium pricing data center", description: "Levier pricing + scale.", history: [16.0, 18.0, 20.4, 22.0, 23.7], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Op EBITA Group", name_fr: "Op EBITA Margin Group", name_en: "Group Operational EBITA Margin", explanation: "Marge consolidée groupe.", value: "18.4", unit: "%", yoy: "+1.5 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Levier mix electrification", description: "Mix electrification améliore la marge groupe.", history: [13.0, 15.0, 16.5, 16.9, 18.4], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Backlog", name_fr: "Carnet de commandes", name_en: "Order Backlog", explanation: "Carnet de commandes (book of business).", value: "23.0", unit: "$B", yoy: "+10%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Visibilité 12 mois+", description: "Backlog ratio 0.85x revenue. Solide visibilité.", history: [16, 19, 20, 21, 23], is_wow: true, is_generic: false, is_short_history: false },
    ],
  }),
  STM: mk({
    ticker: "STM", name: "STMicroelectronics", sector: "Technologie", subsector: "Semiconductors / France-Italy",
    tagline: "Life.augmented.",
    founded: 1987, ipo: 1994,
    ranks: { global_world: "≈ #500", global_us: "ADR Top 110", sector: "Top 15 semiconductors", subsector: "#3 EU semiconductors" },
    hero_kpi: "Auto + Industrial",
    hero_kpi_rationale: "Auto + Industrial pèse plus de 65% du revenu STM. Cycle EV + power semi (GaN/SiC) = trajectoire structurelle.",
    kpis: [
      { short: "Auto + Industrial", name_fr: "Revenu Auto + Industrial", name_en: "Auto + Industrial (ADG + IPD) Revenue", explanation: "Cumul Automotive + Industrial Power & Discrete + Embedded.", value: "8.7", unit: "$B", yoy: "-30%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Cycle bottom", description: "Bottom du cycle 2024. Inventory destocking. Reprise attendue H2 2025.", history: [7.8, 9.3, 11.5, 12.4, 8.7], is_wow: true, is_generic: false, is_short_history: false },
      { short: "SiC", name_fr: "Revenu SiC (silicon carbide)", name_en: "Silicon Carbide Revenue", explanation: "Substrats + power devices SiC pour EV + industriel.", value: "1.1", unit: "$B", yoy: "+50%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Driver EV power", description: "STM #1 SiC mondial avec Wolfspeed. Scale-up Catania (Italie).", history: [0.2, 0.5, 0.8, 1.1], is_wow: true, is_generic: false, is_short_history: true, story_category: "Innovation" },
      { short: "Gross Margin", name_fr: "Marge brute", name_en: "Gross Margin", explanation: "Marge brute consolidée.", value: "33.6", unit: "%", yoy: "-15 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "gross_margin", signal: "Cycle bottom", description: "Marge sous pression utilisation usines.", history: [41.7, 47.4, 49.5, 47.7, 33.6], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
  RACE: mk({
    ticker: "RACE", name: "Ferrari", sector: "Industrie", subsector: "Luxury Auto / Italy",
    tagline: "We are the makers of dreams.",
    founded: 1939, ipo: 2015,
    ranks: { global_world: "≈ #210", global_us: "ADR Top 55", sector: "Luxury auto #1", subsector: "#1 luxury auto" },
    hero_kpi: "Personalisation",
    hero_kpi_rationale: "Personalisation (configurations clients sur-mesure) est le KPI maître Ferrari. Plus de 19% du revenu, marge >50%, drive le mix value.",
    kpis: [
      { short: "Personalisation", name_fr: "Revenu Personalisation", name_en: "Personalization Revenue Share", explanation: "Part du revenu généré par les options et configurations sur-mesure.", value: "19", unit: "%", yoy: "+1 pt", type: "Mix", nature: "Structurel", comparable: "Non comparable", signal: "Pricing power exclusif", description: "Marge 50%+ sur perso. 5 ans de croissance ininterrompue.", history: [15, 16, 18, 18, 19], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Shipments", name_fr: "Livraisons unités", name_en: "Vehicle Shipments", explanation: "Volume de véhicules livrés (Ferrari maintient quotas serrés).", value: "13.7", unit: "K unités", yoy: "+1%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Volume quasi-stable, prix tire", description: "Stratégie de rareté maintenue. ~13.7K en 2024 vs 13.7K 2023.", history: [9.1, 11.2, 13.2, 13.7, 13.7], is_wow: false, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Adj EBIT margin", name_en: "Adjusted EBIT Margin", explanation: "Marge EBIT ajustée.", value: "29.0", unit: "%", yoy: "+1 pt", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Top-class luxury auto", description: "Plus haute marge auto au monde. Pricing power inégalé.", history: [25.2, 25.2, 26.5, 28.0, 29.0], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Order Book", name_fr: "Carnet de commandes (en années)", name_en: "Order Book Coverage (years)", explanation: "Couverture du carnet de commandes en années de production.", value: "2.5", unit: "ans", yoy: "stable", type: "Demand", nature: "Structurel", comparable: "Non comparable", signal: "Carnet jusqu'à 2027", description: "Visibilité jusqu'au-delà de 2026 sur l'essentiel du portfolio.", history: [2.5], is_wow: true, is_generic: false, is_short_history: true, story_category: "Marché" },
    ],
  }),

  /* ─── CANADA RAIL + ENERGY ─── */
  CNI: mk({
    ticker: "CNI", name: "Canadian National Railway", sector: "Industrie", subsector: "Rail / Canada",
    tagline: "North America's Railroad.",
    founded: 1919, ipo: 1995,
    ranks: { global_world: "≈ #220", global_us: "ADR Top 60", sector: "Top 5 rail North America", subsector: "#1 Canada rail" },
    hero_kpi: "Carloads",
    hero_kpi_rationale: "Carloads (volume de wagons transportés) est le KPI maître. Driver direct du revenu et de la marge.",
    kpis: [
      { short: "Carloads", name_fr: "Carloads volume", name_en: "Total Carloads (rail)", explanation: "Nombre de wagons transportés sur l'année.", value: "5.5", unit: "M", yoy: "+1%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Volume modeste", description: "Stable malgré ralentissement intermodal Pacific.", history: [5.7, 5.9, 5.6, 5.5, 5.5], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Op Ratio", name_fr: "Operating Ratio", name_en: "Operating Ratio (lower = better)", explanation: "Op expenses / revenue. Plus c'est bas, mieux c'est.", value: "62.8", unit: "%", yoy: "+1 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Légère détérioration", description: "Cible long-terme <60%. Inflation + retour pré-COVID dilue.", history: [57.0, 58.0, 60.0, 61.4, 62.8], is_wow: false, is_generic: true, is_short_history: false },
      { short: "FCF", name_fr: "Free Cash Flow", name_en: "Free Cash Flow", explanation: "Cash flow libre.", value: "4.0", unit: "Mds CAD", yoy: "+5%", type: "Cash", nature: "Cyclique", comparable: "Comparable", signal: "Stable", description: "FCF utilisé pour buybacks + dividendes.", history: [3.3, 3.7, 4.3, 3.9, 4.0], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
  CP: mk({
    ticker: "CP", name: "Canadian Pacific Kansas City", sector: "Industrie", subsector: "Rail / Canada-US-Mexico",
    tagline: "Single line across North America.",
    founded: 1881, ipo: 2001,
    ranks: { global_world: "≈ #240", global_us: "ADR Top 65", sector: "Top 5 rail North America", subsector: "Seul rail Canada→Mexico" },
    hero_kpi: "Synergies KCS",
    hero_kpi_rationale: "L'intégration KCS (Kansas City Southern, fusionné en 2023) crée le seul rail unique Canada-US-Mexique. Synergies cumulées = trajectoire.",
    kpis: [
      { short: "Synergies KCS", name_fr: "Synergies cumulées CPKC", name_en: "Kansas City Southern Synergies (cumulative)", explanation: "Synergies revenue + cost cumulées issues fusion 2023.", value: "1.3", unit: "$B", yoy: "+85%", type: "Margin", nature: "Conjoncturel", comparable: "Non comparable", signal: "Sur cap target $1.85B 2028", description: "Atteinte 70% du target. Mexico-US-Canada single-line.", history: [0.3, 0.7, 1.3], is_wow: true, is_generic: false, is_short_history: true, story_category: "Capacité" },
      { short: "Carloads", name_fr: "Carloads volume", name_en: "Total Carloads (CPKC combined)", explanation: "Volume wagons.", value: "3.0", unit: "M", yoy: "+5%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Mexico growth driver", description: "Mexique + reshoring driver structurel.", history: [2.6, 2.7, 2.8, 2.9, 3.0], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Op Ratio", name_fr: "Operating Ratio", name_en: "Operating Ratio", explanation: "Op expenses / revenue.", value: "61.5", unit: "%", yoy: "-1 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Synergies tirent", description: "Amélioration grâce synergies KCS.", history: [56.0, 57.0, 64.0, 62.5, 61.5], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
  ENB: mk({
    ticker: "ENB", name: "Enbridge", sector: "Énergie", subsector: "Pipelines + Utilities / Canada",
    tagline: "Life takes energy.",
    founded: 1949, ipo: 1953,
    ranks: { global_world: "≈ #170", global_us: "ADR Top 50", sector: "Top 5 pipeline / midstream", subsector: "#1 North America pipelines" },
    hero_kpi: "Liquids Volume",
    hero_kpi_rationale: "Volume liquides transporté est le KPI maître Enbridge. Mainline System = 30% de la production WCSB Canada importée aux US.",
    kpis: [
      { short: "Liquids Volume", name_fr: "Volume liquides Mainline", name_en: "Liquids Mainline Throughput", explanation: "Volume de pétrole brut + LGN transporté sur le Mainline System.", value: "3.1", unit: "Mb/j", yoy: "stable", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Près du plein utilization", description: "Mainline ~95% utilisation. Capacité goulotée.", history: [2.7, 3.0, 3.1, 3.1, 3.1], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Gas Distribution", name_fr: "Gas Distribution Customers", name_en: "Gas Distribution Customers", explanation: "Clients raccordés gaz naturel résidentiel + commercial.", value: "7.0", unit: "M", yoy: "+30%", type: "User", nature: "Structurel", comparable: "Comparable", signal: "Acquisition Dominion 2024", description: "Acquisition Dominion Gas (3 utilities US) ajoute ~3M clients.", history: [3.9, 4.0, 4.0, 4.0, 7.0], is_wow: true, is_generic: false, is_short_history: true, story_category: "Marché" },
      { short: "Adj EBITDA", name_fr: "Adj EBITDA", name_en: "Adjusted EBITDA", explanation: "EBITDA ajusté consolidé.", value: "17.5", unit: "Mds CAD", yoy: "+12%", type: "Margin", nature: "Structurel", comparable: "Comparable", signal: "Croissance contracted", description: "98%+ revenue contracted long-term. Recurring.", history: [13.3, 14.0, 15.5, 15.6, 17.5], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Renewables Capex", name_fr: "Capex Renewables", name_en: "Renewables + Low-Carbon Capex", explanation: "Investissement renouvelables (solar, wind, hydrogen, capture CO2).", value: "1.5", unit: "Mds CAD", yoy: "+25%", type: "Investment", nature: "Structurel", comparable: "Comparable", signal: "Pivot graduel", description: "Croissance progressive du segment Low-Carbon.", history: [0.7, 0.9, 1.1, 1.2, 1.5], is_wow: false, is_generic: false, is_short_history: false },
    ],
  }),
  SU: mk({
    ticker: "SU", name: "Suncor Energy", sector: "Énergie", subsector: "Oil Sands / Canada",
    tagline: "We see possibility.",
    founded: 1953, ipo: 1953,
    ranks: { global_world: "≈ #260", global_us: "ADR Top 70", sector: "Top 30 oil major", subsector: "#1 Canada oil sands" },
    hero_kpi: "Upgraded Production",
    hero_kpi_rationale: "Production raffinée intégrée (oil sands → upgraders → raffineries Suncor) est le KPI maître. Marge intégrée vs simple producteur.",
    kpis: [
      { short: "Upgraded Production", name_fr: "Production raffinée upstream", name_en: "Upgraded Production (oil sands)", explanation: "Production sables bitumineux passée par upgraders Suncor.", value: "780", unit: "Kb/j", yoy: "+5%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Cap des 780K franchi", description: "Performance opérationnelle restored 2024 vs problèmes 2022-2023.", history: [710, 720, 745, 740, 780], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Refining Margin", name_fr: "Refining Margin (utilization)", name_en: "Refinery Utilization", explanation: "Utilisation des 4 raffineries Suncor (Ontario, Quebec, Alberta, Colorado).", value: "97", unit: "%", yoy: "+5 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Best-in-class utilization", description: "97% utilisation = top-pair Canadian + US. Marge crack solide.", history: [90, 92, 93, 92, 97], is_wow: true, is_generic: false, is_short_history: false },
      { short: "FCF", name_fr: "Free Cash Flow", name_en: "Free Cash Flow", explanation: "Cash flow libre.", value: "8.3", unit: "Mds CAD", yoy: "+18%", type: "Cash", nature: "Cyclique", comparable: "Comparable", signal: "Cash discipline", description: "FCF utilisé buybacks CAD 2.4B + dividend.", history: [4.5, 9.0, 13.0, 7.0, 8.3], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),

  /* ─── EU BANKS ─── */
  BBVA: mk({
    ticker: "BBVA", name: "Banco Bilbao Vizcaya Argentaria", sector: "Finance", subsector: "Banks / Spain + LatAm",
    tagline: "Creating opportunities.",
    founded: 1857, ipo: 1857,
    ranks: { global_world: "≈ #180", global_us: "ADR Top 50", sector: "Top 30 banks Europe", subsector: "#2 Spain" },
    hero_kpi: "Mexico",
    hero_kpi_rationale: "BBVA Mexico (Bancomer) est le KPI maître : 50%+ du profit groupe, NIM le plus élevé du secteur (~6%).",
    kpis: [
      { short: "Mexico", name_fr: "Net Profit Mexico", name_en: "Mexico Segment Net Profit", explanation: "Net profit BBVA Mexico (Bancomer).", value: "5.4", unit: "Mds €", yoy: "+10%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "50%+ du profit groupe", description: "Mexico = banque la plus profitable d'Espagne. NIM ~6%.", history: [3.0, 3.6, 4.5, 5.1, 5.4], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Spain NII", name_fr: "Net Interest Income Spain", name_en: "Spain Net Interest Income", explanation: "Net interest income segment Espagne.", value: "5.8", unit: "Mds €", yoy: "+15%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Effet hausse ECB", description: "Bénéfice direct hausse taux ECB 2022-2023.", history: [3.5, 3.5, 4.5, 5.0, 5.8], is_wow: false, is_generic: true, is_short_history: false },
      { short: "CET1", name_fr: "Ratio CET1", name_en: "CET1 Capital Ratio", explanation: "Solvabilité réglementaire.", value: "12.85", unit: "%", yoy: "+0.2 pt", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Au-dessus du target", description: "Permet payout 50% (dividende + buybacks).", history: [12.5, 12.6, 12.6, 12.7, 12.85], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Sabadell Bid", name_fr: "OPA Banco Sabadell (en cours)", name_en: "Banco Sabadell Hostile Bid", explanation: "OPA hostile lancée mai 2024 sur Banco Sabadell. Saga politique espagnole.", value: "12", unit: "Mds €", yoy: "n/a", type: "Investment", nature: "Conjoncturel", comparable: "Non comparable", signal: "Approbation politique en attente", description: "Mai 2024. Approbation antitrust + politique espagnole en attente.", history: [12], is_wow: true, is_generic: false, is_short_history: true, story_category: "Marché" },
    ],
  }),
  SAN: mk({
    ticker: "SAN", name: "Banco Santander", sector: "Finance", subsector: "Banks / Spain + LatAm + UK",
    tagline: "The Bank for everyone, every step of the way.",
    founded: 1857, ipo: 1857,
    ranks: { global_world: "≈ #160", global_us: "ADR Top 45", sector: "Top 25 banks Europe", subsector: "#1 Spain" },
    hero_kpi: "Brazil",
    hero_kpi_rationale: "Brésil reste le moteur Santander : 25% du profit groupe, exposition reflation Latam, gestion locale forte.",
    kpis: [
      { short: "Brazil", name_fr: "Net Profit Brazil", name_en: "Brazil Segment Profit", explanation: "Net profit Santander Brasil.", value: "2.6", unit: "Mds €", yoy: "+30%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Reflation Latam", description: "25% du profit groupe. Banque #3 Brésil.", history: [3.5, 3.0, 1.8, 2.0, 2.6], is_wow: true, is_generic: false, is_short_history: false },
      { short: "NII", name_fr: "Net Interest Income groupe", name_en: "Group Net Interest Income", explanation: "Revenu d'intérêts net consolidé.", value: "46.7", unit: "Mds €", yoy: "+8%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Bénéfice taux", description: "Hausses taux ECB + BCB tirent.", history: [33.4, 34.7, 43.3, 43.3, 46.7], is_wow: false, is_generic: true, is_short_history: false },
      { short: "CET1", name_fr: "Ratio CET1", name_en: "CET1 Ratio", explanation: "Solvabilité.", value: "12.8", unit: "%", yoy: "+0.3 pt", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Stable", description: "Permet payout 50% (€10B+ buybacks + dividend).", history: [12.5, 12.0, 12.3, 12.5, 12.8], is_wow: false, is_generic: true, is_short_history: false },
      { short: "ROE", name_fr: "Return on Tangible Equity", name_en: "Return on Tangible Equity", explanation: "Rentabilité capitaux propres tangibles.", value: "16.3", unit: "%", yoy: "+1.5 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Top-tier EU banks", description: "Cible 16-17% atteinte plan 2024.", history: [10.7, 13.4, 15.0, 14.8, 16.3], is_wow: true, is_generic: false, is_short_history: false },
    ],
  }),
  BCS: mk({
    ticker: "BCS", name: "Barclays", sector: "Finance", subsector: "Banks / UK + IB",
    tagline: "Thinking forward.",
    founded: 1690, ipo: 1953,
    ranks: { global_world: "≈ #200", global_us: "ADR Top 55", sector: "Top 30 banks", subsector: "Top 10 IB" },
    hero_kpi: "Investment Bank",
    hero_kpi_rationale: "Investment Bank (FICC + Equities + Banking) est le KPI maître Barclays, en restructuration vers ratio plus équilibré IB/Retail (target 50/50 vs 60/40).",
    kpis: [
      { short: "Investment Bank", name_fr: "Revenu Investment Bank", name_en: "Investment Bank Revenue", explanation: "Revenu segment IB (FICC + Equities + Advisory + Banking).", value: "12.3", unit: "Mds £", yoy: "+7%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Volatilité macro tire FICC", description: "FICC tire grâce volatilité taux + crédit. Equities stable.", history: [10.6, 12.6, 13.5, 11.5, 12.3], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Barclays UK", name_fr: "Revenu Barclays UK retail", name_en: "Barclays UK Retail Revenue", explanation: "Retail + business banking UK + Tesco Bank acquisition 2024.", value: "8.3", unit: "Mds £", yoy: "+9%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Tesco Bank ajout 2024", description: "Acquisition Tesco Bank (€700M, +2.7M clients) ajoute revenue.", history: [6.6, 6.5, 7.6, 7.6, 8.3], is_wow: true, is_generic: false, is_short_history: false },
      { short: "CET1", name_fr: "Ratio CET1", name_en: "CET1 Ratio", explanation: "Solvabilité PRA.", value: "13.6", unit: "%", yoy: "-0.2 pt", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Stable", description: "Capital permet £10B distribution sur 3 ans.", history: [15.1, 15.0, 13.8, 13.8, 13.6], is_wow: false, is_generic: true, is_short_history: false },
      { short: "ROTE", name_fr: "Return on Tangible Equity", name_en: "Return on Tangible Equity", explanation: "Rentabilité capitaux tangibles.", value: "10.5", unit: "%", yoy: "+1 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Target 12% 2026", description: "Sur la trajectoire plan 2024-2026 RoTE 12%+.", history: [11.4, 10.4, 10.6, 9.0, 10.5], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
  LYG: mk({
    ticker: "LYG", name: "Lloyds Banking Group", sector: "Finance", subsector: "Banks / UK retail",
    tagline: "By your side.",
    founded: 1995, ipo: 1995,
    ranks: { global_world: "≈ #210", global_us: "ADR Top 60", sector: "Top 30 banks", subsector: "#1 UK retail" },
    hero_kpi: "Mortgage Book",
    hero_kpi_rationale: "Mortgage Book (£310B+) est le KPI maître Lloyds. Premier prêteur mortgage UK, hyper sensible aux taux BoE et au cycle housing UK.",
    kpis: [
      { short: "Mortgage Book", name_fr: "Encours mortgage", name_en: "Mortgage Lending Book", explanation: "Encours prêts hypothécaires (UK).", value: "313", unit: "Mds £", yoy: "+1%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Stable, refi cycle", description: "Lloyds #1 mortgage UK. Volume stable, marge dépend taux.", history: [307, 314, 309, 310, 313], is_wow: true, is_generic: false, is_short_history: false },
      { short: "NIM", name_fr: "Banking NIM", name_en: "Banking Net Interest Margin", explanation: "NIM segment banking.", value: "2.97", unit: "%", yoy: "-22 bps", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "nim", signal: "Pic taux passé", description: "Pic 3.22% en 2023, légère contraction 2024.", history: [2.50, 2.54, 3.22, 3.11, 2.97], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Motor Finance", name_fr: "Motor Finance Provision (FCA)", name_en: "Motor Finance FCA Investigation Provision", explanation: "Provision pour enquête FCA sur commissions motor finance UK.", value: "1.15", unit: "Mds £", yoy: "n/a", type: "Risk", nature: "Conjoncturel", comparable: "Non comparable", signal: "Risque réglementaire UK", description: "FCA enquête commissions PCP. Risque industriel global ~£15-50B selon analyses.", history: [1.15], is_wow: true, is_generic: false, is_short_history: true, story_category: "Marché" },
      { short: "ROTE", name_fr: "Return on Tangible Equity", name_en: "Return on Tangible Equity", explanation: "Rentabilité.", value: "12.3", unit: "%", yoy: "-2.6 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Sous pression motor finance", description: "Cible 13%+ 2026. Pression motor finance.", history: [11.0, 13.5, 16.2, 14.9, 12.3], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),

  /* ─── BRAZIL ─── */
  ITUB: mk({
    ticker: "ITUB", name: "Itaú Unibanco", sector: "Finance", subsector: "Banks / Brazil",
    tagline: "Made for you.",
    founded: 2008, ipo: 2008,
    ranks: { global_world: "≈ #170", global_us: "ADR Top 40", sector: "Top 30 banks", subsector: "#1 Brazil" },
    hero_kpi: "Loan Book",
    hero_kpi_rationale: "Loan Book BRL 1T+ est le KPI maître Itaú, banque privée #1 Amérique Latine. Sensible au cycle Selic et reflation Brésil.",
    kpis: [
      { short: "Loan Book", name_fr: "Encours de crédit", name_en: "Total Credit Portfolio", explanation: "Portefeuille crédit total.", value: "1.30", unit: "T BRL", yoy: "+15%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Cap des BRL 1.3T", description: "Reprise cycle crédit Brésil. Mix retail + corporate.", history: [0.96, 1.08, 1.13, 1.13, 1.30], is_wow: true, is_generic: false, is_short_history: false },
      { short: "ROE", name_fr: "Return on Equity", name_en: "Return on Equity", explanation: "Rentabilité capitaux propres.", value: "22.7", unit: "%", yoy: "+1.8 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Top-tier mondial", description: "ROE le plus élevé des big banks Latam.", history: [18.9, 20.0, 20.7, 20.9, 22.7], is_wow: true, is_generic: false, is_short_history: false },
      { short: "NIM", name_fr: "Net Interest Margin", name_en: "Net Interest Margin", explanation: "Marge nette d'intérêt.", value: "8.7", unit: "%", yoy: "stable", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "nim", signal: "NIM élevé Brésil", description: "Brésil = NIM structurellement haut (Selic 11-13%).", history: [7.5, 7.8, 8.5, 8.7, 8.7], is_wow: false, is_generic: true, is_short_history: false },
      { short: "GNPA", name_fr: "Gross NPA Ratio", name_en: "90+ Days NPL Ratio", explanation: "Ratio créances 90j+ overdue.", value: "2.4", unit: "%", yoy: "-0.6 pt", type: "Risk", nature: "Cyclique", comparable: "Comparable", signal: "Amélioration", description: "Cycle credit normalisé.", history: [2.5, 2.9, 3.0, 3.0, 2.4], is_wow: true, is_generic: false, is_short_history: false },
    ],
  }),

  /* ─── JAPAN IB ─── */
  NMR: mk({
    ticker: "NMR", name: "Nomura Holdings", sector: "Finance", subsector: "Investment Bank / Japan",
    tagline: "Connecting markets East and West.",
    founded: 1925, ipo: 1925,
    ranks: { global_world: "≈ #350", global_us: "ADR Top 90", sector: "Top 30 IB", subsector: "#1 Japan IB" },
    hero_kpi: "Wholesale",
    hero_kpi_rationale: "Wholesale (FICC + Equities + Banking) est le KPI maître Nomura. Reprise du cycle IB Asie + retour des taux JP = trajectoire favorable.",
    kpis: [
      { short: "Wholesale", name_fr: "Revenu Wholesale", name_en: "Wholesale Revenue (Global IB)", explanation: "FICC + Equities + Investment Banking + Research.", value: "1.2", unit: "T JPY", yoy: "+25%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Reprise post-difficultés", description: "Reprise IB Asie + EMEA. FICC tire grâce volatilité.", history: [0.7, 0.6, 0.7, 1.0, 1.2], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Retail", name_fr: "Retail (Wealth Mgmt JP)", name_en: "Retail (Wealth Management JP)", explanation: "Wealth management Japon + securities retail.", value: "0.42", unit: "T JPY", yoy: "+10%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Inflation flux retail JP", description: "Investisseurs JP retail bénéficient de l'inflation post-déflation.", history: [0.32, 0.30, 0.33, 0.38, 0.42], is_wow: false, is_generic: true, is_short_history: false },
      { short: "ROE", name_fr: "Return on Equity", name_en: "Return on Equity", explanation: "Rentabilité.", value: "8.2", unit: "%", yoy: "+3 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Target 8-10% atteint", description: "Pour la 1ère fois depuis 2007 ROE >8% durable.", history: [4.0, 3.5, 5.0, 5.2, 8.2], is_wow: true, is_generic: false, is_short_history: false },
      { short: "CET1", name_fr: "Ratio CET1 (Bâle III)", name_en: "CET1 Ratio (Basel III)", explanation: "Solvabilité.", value: "16.5", unit: "%", yoy: "stable", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Capital fort", description: "Permet buybacks JPY 100B+ annuels.", history: [16.5, 16.0, 16.5, 16.5, 16.5], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),

  /* ─── CANADA TECH ─── */
  SHOP: mk({
    ticker: "SHOP", name: "Shopify", sector: "Technologie", subsector: "E-commerce SaaS / Canada",
    tagline: "Make commerce better for everyone.",
    founded: 2006, ipo: 2015,
    ranks: { global_world: "≈ #110", global_us: "ADR Top 30", sector: "Top 5 e-commerce SaaS", subsector: "#1 SMB e-commerce" },
    hero_kpi: "GMV",
    hero_kpi_rationale: "Le GMV (Gross Merchandise Volume) est le KPI maître Shopify : driver direct du Merchant Solutions revenue (la majorité du chiffre).",
    kpis: [
      { short: "GMV", name_fr: "Gross Merchandise Volume", name_en: "Gross Merchandise Volume", explanation: "Volume brut de marchandises sur la plateforme.", value: "292", unit: "$B", yoy: "+24%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Cap des $290B franchi", description: "Croissance résiliente vs concurrents e-commerce.", history: [120, 175, 197, 236, 292], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Take Rate", name_fr: "Take Rate Merchant Solutions", name_en: "Effective Take Rate (Merchant Solutions)", explanation: "Commission moyenne sur le GMV (Shopify Payments + Shipping + Capital).", value: "2.7", unit: "%", yoy: "+0.1 pt", type: "Mix", nature: "Structurel", comparable: "Comparable", signal: "Monétisation en hausse", description: "Plus de marchands utilisent Shopify Payments + ad tech.", history: [2.0, 2.2, 2.4, 2.6, 2.7], is_wow: true, is_generic: false, is_short_history: false },
      { short: "FCF Margin", name_fr: "Free Cash Flow Margin", name_en: "Free Cash Flow Margin", explanation: "FCF / Revenue. Indicateur clé après pivot post-2022.", value: "20", unit: "%", yoy: "+5 pts", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Discipline cost confirmée", description: "Pivot \"profitable growth\" depuis 2023 paye.", history: [-5, -10, 5, 15, 20], is_wow: true, is_generic: false, is_short_history: false },
      { short: "AI Sidekick", name_fr: "Adoption Sidekick AI", name_en: "Sidekick AI Merchants", explanation: "Adoption de Sidekick (assistant IA Shopify) par les marchands.", value: "1+", unit: "M", yoy: "n/a", type: "Adoption", nature: "Structurel", comparable: "Non comparable", signal: "Lancement 2024", description: "Sidekick = IA agent qui aide à gérer la boutique. Différenciation AI.", history: [1], is_wow: true, is_generic: false, is_short_history: true, story_category: "Innovation" },
    ],
  }),
};
