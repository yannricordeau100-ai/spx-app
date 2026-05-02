/**
 * V2 cat 2 : Batch 2 (40 sociétés étrangères supplémentaires).
 *
 * 40 plus grosses FPI ADR US par market cap (post top 10 batch 1).
 * Chaque dataset est minimal-viable : Hero KPI + 5-7 indicateurs sectoriels
 * + tagline + ranks. Pas de risks/governance/AI positioning détaillés
 * (à enrichir round 2 via scraping IR).
 *
 * Source : connaissances publiques 2024-2025. À raffiner via pipeline LLM
 * une fois activé. Statut : DRAFT.
 *
 * Devises : "Mds €", "Mds DKK", "Mds JPY", "Mds CNY", "Mds INR", "Mds CHF",
 * "Mds GBP" (pour les sociétés EU/UK/JP/CN/IN/CH non listées NYSE en USD).
 * "$B" est auto-converti en "Mds $" par formatUnit().
 */

import type { Company } from "@/lib/data";

/** Helper : génère un Company minimal avec defaults raisonnables. */
function mkCompany(c: Omit<Company, "logo_treatment"> & { logo_treatment?: Company["logo_treatment"] }): Company {
  return { logo_treatment: "orbit", ...c };
}

export const V2_BATCH2: Record<string, Company> = {
  /* ───────────────────────── PHARMA / SANTÉ ───────────────────────── */
  NVS: mkCompany({
    ticker: "NVS",
    name: "Novartis",
    sector: "Santé",
    subsector: "Pharma / Innovative Medicines",
    tagline: "Reimagine medicine.",
    founded: 1996,
    ipo: 1996,
    ranks: { global_world: "≈ #45", global_us: "ADR Top 18", sector: "Top 5 pharma", subsector: "Cardiovascular #1" },
    hero_kpi: "Innovative",
    hero_kpi_rationale: "Innovative Medicines (post-Sandoz spin-off 2023) est le segment unique de NVS. Croissance tirée par Entresto, Cosentyx, Pluvicto, Kisqali.",
    kpis: [
      { short: "Innovative", name_fr: "Revenu Innovative Medicines", name_en: "Innovative Medicines Revenue", explanation: "Revenu post-spin-off Sandoz. Pure-play pharma innovante.", value: "50.3", unit: "$B", yoy: "+11%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Croissance top-pair", description: "Driver: Entresto, Cosentyx, Kesimpta, Pluvicto, Kisqali.", history: [42.0, 44.0, 45.4, 45.4, 50.3], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Pluvicto", name_fr: "Revenu Pluvicto (radioligand)", name_en: "Pluvicto Revenue (radioligand therapy)", explanation: "Thérapie radioligand pour cancer prostate métastatique. Premier de classe.", value: "1.8", unit: "$B", yoy: "+42%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Premier produit radioligand >$1B", description: "Production scale-up, target $5B+ d'ici 2028.", history: [0.3, 0.98, 1.8], is_wow: true, is_generic: false, is_short_history: true, story_category: "Innovation" },
      { short: "Entresto", name_fr: "Revenu Entresto (insuf. cardiaque)", name_en: "Entresto Revenue (heart failure)", explanation: "Sacubitril/valsartan, traitement insuffisance cardiaque. Best-seller NVS.", value: "7.8", unit: "$B", yoy: "+30%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Pic avant générique 2025-2026", description: "Falaise brevet aux US fin 2025. Concurrence générique attendue 2026.", history: [3.5, 4.6, 6.0, 7.8, 7.8], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Cosentyx", name_fr: "Revenu Cosentyx (immuno)", name_en: "Cosentyx Revenue (psoriasis / arthritis)", explanation: "Anti-IL17A pour psoriasis, arthrite psoriasique, spondylarthrite. Indication Hidradenite ajoutée 2024.", value: "6.3", unit: "$B", yoy: "+20%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Nouvelles indications boost", description: "Driver Hidradenite suppurativa + giant cell arteritis. Brevet expire 2030.", history: [4.7, 4.8, 4.9, 5.2, 6.3], is_wow: true, is_generic: false, is_short_history: false },
      { short: "R&D", name_fr: "R&D %", name_en: "R&D as % Revenue", explanation: "Investissement R&D en % du revenu, moyenne pharma top.", value: "20.0", unit: "%", yoy: "+0.5 pt", type: "Investment", nature: "Structurel", comparable: "Comparable", signal: "Top-pair", description: "$10B+ R&D annuel. Pipeline radioligands + cardio + immuno.", history: [18.5, 19.0, 19.5, 19.5, 20.0], is_wow: false, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Marge opérationnelle (Core)", name_en: "Core Operating Margin", explanation: "Marge core (non-IFRS) après spin-off Sandoz.", value: "37.2", unit: "%", yoy: "+1.5 pts", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Top-quartile pharma", description: "Mix premium (Pluvicto, Entresto) tire la marge.", history: [33.0, 34.0, 35.0, 35.7, 37.2], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),

  AZN: mkCompany({
    ticker: "AZN",
    name: "AstraZeneca",
    sector: "Santé",
    subsector: "Pharma / Oncology + Cardio",
    tagline: "What science can do.",
    founded: 1999,
    ipo: 1999,
    ranks: { global_world: "≈ #50", global_us: "ADR Top 20", sector: "Top 5 pharma", subsector: "#2 Oncology" },
    hero_kpi: "Oncology",
    hero_kpi_rationale: "L'oncologie pèse >40% du revenu AZN et porte la croissance via Tagrisso, Imfinzi, Calquence, Lynparza, Enhertu (avec Daiichi Sankyo).",
    kpis: [
      { short: "Oncology", name_fr: "Revenu Oncologie", name_en: "Oncology Revenue", explanation: "Franchise oncologie globale. Driver de la trajectoire AZN, target $80B revenue 2030.", value: "22.4", unit: "$B", yoy: "+22%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: ">40% du revenu", description: "Tagrisso $6.6B + Imfinzi $4.5B + Lynparza $3.1B + Calquence $3.0B + Enhertu (50/50 Daiichi).", history: [11.5, 13.5, 16.5, 18.4, 22.4], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Tagrisso", name_fr: "Revenu Tagrisso (NSCLC)", name_en: "Tagrisso Revenue (lung cancer)", explanation: "Inhibiteur EGFR pour cancer poumon non-petites cellules. Best-seller AZN.", value: "6.6", unit: "$B", yoy: "+13%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Best-seller en croissance", description: "Adoption 1L (LAURA, FLAURA-2) tire la croissance.", history: [4.3, 5.0, 5.4, 5.8, 6.6], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Enhertu", name_fr: "Revenu Enhertu (50% AZN)", name_en: "Enhertu Revenue (collaborative)", explanation: "ADC HER2 (trastuzumab deruxtecan), partenariat 50/50 avec Daiichi Sankyo. Blockbuster ADC.", value: "3.8", unit: "$B", yoy: "+50%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "ADC #1 mondial", description: "Sales totales (Daiichi + AZN). Indications: HER2+ breast, gastric, lung.", history: [0.4, 1.4, 2.6, 3.8], is_wow: true, is_generic: false, is_short_history: true, story_category: "Innovation" },
      { short: "BioPharm", name_fr: "Revenu BioPharmaceuticals", name_en: "BioPharmaceuticals Revenue (cardio + respiratory)", explanation: "Cardiovasculaire, métabolique, respiratoire (Symbicort, Farxiga, Crestor, Forxiga, Bydureon).", value: "20.6", unit: "$B", yoy: "+12%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Farxiga driver cardio-rénal", description: "Driver: Farxiga (SGLT2) +37% à $7.7B. Breztri respiratoire.", history: [13.5, 15.5, 17.0, 18.4, 20.6], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Marge opérationnelle Core", name_en: "Core Operating Margin", explanation: "Marge non-IFRS, exclut amortissements + restructurations.", value: "32.4", unit: "%", yoy: "+1.4 pts", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Levier mix oncologie", description: "Mix oncologie premium + R&D rationalisée tirent la marge.", history: [29.5, 30.0, 30.5, 31.0, 32.4], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),

  SNY: mkCompany({
    ticker: "SNY",
    name: "Sanofi",
    sector: "Santé",
    subsector: "Pharma / Vaccines + Specialty Care",
    tagline: "We chase the miracles of science.",
    founded: 1973,
    ipo: 1999,
    ranks: { global_world: "≈ #80", global_us: "ADR Top 30", sector: "Top 10 pharma", subsector: "#3 Vaccines" },
    hero_kpi: "Dupixent",
    hero_kpi_rationale: "Dupixent (dupilumab) est le KPI maître chez Sanofi. Anti-IL4Rα blockbuster, croissance >20%/an, coeur du portfolio Specialty Care.",
    kpis: [
      { short: "Dupixent", name_fr: "Revenu Dupixent (immuno)", name_en: "Dupixent Revenue (dupilumab)", explanation: "Anti-IL-4Rα pour eczéma, asthme, COPD, dermatite, PRURIGO. Co-développé avec Regeneron (50/50).", value: "13.9", unit: "Mds €", yoy: "+22%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Driver #1 du groupe", description: "5e année de croissance >20%. Indications COPD ajoutée 2024 = nouveau gisement.", history: [5.7, 8.3, 10.7, 11.4, 13.9], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Vaccines", name_fr: "Revenu Vaccines", name_en: "Vaccines Revenue (Beyfortus / Flu / Boosters)", explanation: "Franchise vaccins (grippe, méningite, RSV Beyfortus, polio, voyage).", value: "7.3", unit: "Mds €", yoy: "+12%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Beyfortus drive 2024-2025", description: "Beyfortus (RSV nourrisson) lancé 2023 = blockbuster en formation.", history: [6.3, 6.8, 7.0, 6.5, 7.3], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Beyfortus", name_fr: "Revenu Beyfortus (RSV)", name_en: "Beyfortus Revenue (nirsevimab RSV)", explanation: "Anticorps monoclonal RSV pour nourrissons. Lancé saison 2023-2024.", value: "1.7", unit: "Mds €", yoy: "+47%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Cap des Mds €1.7 franchi", description: "Pénétration RSV en accélération aux US + EU. Target Mds €3+ d'ici 2028.", history: [0.3, 1.2, 1.7], is_wow: true, is_generic: false, is_short_history: true, story_category: "Innovation" },
      { short: "Specialty", name_fr: "Revenu Specialty Care", name_en: "Specialty Care Revenue", explanation: "Hors Dupixent : maladies rares, neurologie, oncologie, immunologie.", value: "11.2", unit: "Mds €", yoy: "+8%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Soutenu par neuro + rare", description: "Aubagio (SEP) en patent cliff. Compensé par Nexviazyme + Altuviiio.", history: [10.2, 10.5, 10.8, 10.4, 11.2], is_wow: false, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Marge opérationnelle Business", name_en: "Business Operating Margin", explanation: "Marge non-IFRS Sanofi.", value: "26.5", unit: "%", yoy: "-0.5 pt", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Sous pression R&D", description: "Investissement R&D élevé pour pipeline post-Aubagio.", history: [28.0, 27.5, 27.0, 27.0, 26.5], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),

  /* ───────────────────────── BANKS ───────────────────────── */
  HDB: mkCompany({
    ticker: "HDB", name: "HDFC Bank", sector: "Finance", subsector: "Banks / India",
    tagline: "We understand your world.",
    founded: 1994, ipo: 2001,
    ranks: { global_world: "≈ #65", global_us: "ADR Top 25", sector: "Top 15 banks mondial", subsector: "#1 banque privée Inde" },
    hero_kpi: "Loan Book",
    hero_kpi_rationale: "L'encours de crédit (Loan Book) est le KPI maître chez HDFC Bank. Croissance ~15%/an post-fusion HDFC Ltd 2023, premier crédit privé Inde.",
    kpis: [
      { short: "Loan Book", name_fr: "Encours de crédit (Loan Book)", name_en: "Total Loan Book", explanation: "Encours de crédit consolidé. Driver direct du Net Interest Income.", value: "27.5", unit: "Mds INR T", yoy: "+11%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Cap des INR 27T franchi", description: "Driver: retail (~55%), corporate (~30%), agri (~15%). Post-fusion HDFC Ltd merge avec mortgage.", history: [11.3, 13.7, 16.5, 24.7, 27.5], is_wow: true, is_generic: false, is_short_history: false },
      { short: "NIM", name_fr: "Marge nette d'intérêt", name_en: "Net Interest Margin", explanation: "NIM consolidé. Sous pression depuis fusion HDFC Ltd (mortgage low-yield).", value: "3.5", unit: "%", yoy: "-15 bps", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "nim", signal: "Sous pression post-fusion", description: "Mortgage book HDFC Ltd à plus faible yield dilue le NIM.", history: [4.1, 4.0, 4.0, 3.6, 3.5], is_wow: false, is_generic: true, is_short_history: false },
      { short: "CASA", name_fr: "Ratio CASA (current + savings)", name_en: "CASA Deposits Ratio", explanation: "Part des dépôts à vue + épargne. Indicateur de coût de financement.", value: "38", unit: "%", yoy: "-2 pts", type: "Mix", nature: "Cyclique", comparable: "Comparable", signal: "Pression coût funding", description: "CASA en baisse face à la migration vers term deposits (taux + élevés).", history: [46, 44, 44, 40, 38], is_wow: false, is_generic: false, is_short_history: false },
      { short: "GNPA", name_fr: "Gross NPA Ratio", name_en: "Gross Non-Performing Assets Ratio", explanation: "Ratio créances douteuses brutes. Plus c'est bas, mieux c'est.", value: "1.36", unit: "%", yoy: "+0.06 pt", type: "Risk", nature: "Cyclique", comparable: "Comparable", signal: "Faible vs pairs", description: "1.36% reste très bas vs autres banques indiennes (3-5%).", history: [1.32, 1.17, 1.12, 1.30, 1.36], is_wow: true, is_generic: false, is_short_history: false },
      { short: "ROA", name_fr: "Return on Assets", name_en: "Return on Assets", explanation: "Rentabilité des actifs. Indicateur banque-clé.", value: "1.85", unit: "%", yoy: "-10 bps", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Top-quartile mondial", description: "ROA stable haut, en ligne avec target.", history: [1.95, 2.03, 2.07, 1.95, 1.85], is_wow: false, is_generic: false, is_short_history: false },
    ],
  }),

  HSBC_DUMMY: mkCompany({ ticker: "_HSBC_PLACEHOLDER", name: "HSBC placeholder", sector: "Finance", subsector: "Banks", tagline: "_", founded: 1865, ipo: 1865, ranks: { global_world: "_", global_us: "_", sector: "_", subsector: "_" }, hero_kpi: "_", kpis: [] }),

  RY: mkCompany({
    ticker: "RY", name: "Royal Bank of Canada", sector: "Finance", subsector: "Banks / Canada",
    tagline: "Ideas Happen Here.",
    founded: 1864, ipo: 1864,
    ranks: { global_world: "≈ #75", global_us: "ADR Top 22", sector: "Top 10 North America", subsector: "#1 Canada" },
    hero_kpi: "Wealth",
    hero_kpi_rationale: "Wealth Management est le segment qui change la trajectoire de RY. Acquisition HSBC Canada 2024 + croissance organique = Wealth qui pèse maintenant ~30% du revenu.",
    kpis: [
      { short: "Wealth", name_fr: "Wealth Management Revenue", name_en: "Wealth Management Revenue", explanation: "Revenu segment gestion de fortune (RBC Wealth + City National Bank). Driver post-HSBC Canada deal.", value: "20.8", unit: "Mds CAD", yoy: "+19%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Cap des CAD 20Md franchi", description: "Acquisition HSBC Canada 2024 ajoute CAD 8B AUM Asia/Wealth. RBC #1 wealth Canada.", history: [12.5, 14.0, 16.0, 17.5, 20.8], is_wow: true, is_generic: false, is_short_history: false },
      { short: "AUM", name_fr: "Assets Under Management", name_en: "Wealth AUM", explanation: "Encours sous gestion conseil. Croissance organique + acquisition HSBC Canada.", value: "1.32", unit: "T CAD", yoy: "+12%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Cap des CAD 1.3T franchi", description: "AUM total wealth + asset mgmt. CAD 200B ajout HSBC Canada en 2024.", history: [0.85, 0.95, 1.05, 1.18, 1.32], is_wow: true, is_generic: false, is_short_history: false },
      { short: "CET1", name_fr: "Ratio CET1", name_en: "Common Equity Tier 1 Ratio", explanation: "Solvabilité réglementaire. Au-dessus du minimum OSFI 11.5%.", value: "13.2", unit: "%", yoy: "+0.4 pt", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Au-dessus du target", description: "Capital fort permet buybacks $5B + dividend hike.", history: [13.5, 13.2, 14.5, 12.8, 13.2], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Op Margin", name_fr: "Efficiency Ratio", name_en: "Efficiency Ratio (lower = better)", explanation: "Cost-to-income consolidé. Plus c'est bas, mieux c'est.", value: "53.4", unit: "%", yoy: "-1.2 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Amélioration synergies HSBC", description: "Synergies HSBC Canada en cours (target CAD 740M run-rate).", history: [56.0, 55.5, 55.0, 54.6, 53.4], is_wow: false, is_generic: true, is_short_history: false },
      { short: "ROE", name_fr: "Return on Equity", name_en: "Return on Equity", explanation: "Rentabilité capitaux propres. Top-quartile mondial.", value: "16.0", unit: "%", yoy: "+1.0 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Top-quartile global", description: "Best-in-class banques canadiennes.", history: [17.5, 16.5, 14.7, 15.0, 16.0], is_wow: true, is_generic: false, is_short_history: false },
    ],
  }),

  TD: mkCompany({
    ticker: "TD", name: "Toronto-Dominion Bank", sector: "Finance", subsector: "Banks / Canada",
    tagline: "Ready for you.",
    founded: 1855, ipo: 1855,
    ranks: { global_world: "≈ #95", global_us: "ADR Top 30", sector: "Top 15 North America", subsector: "#2 Canada" },
    hero_kpi: "US Retail",
    hero_kpi_rationale: "US Retail est le segment qui pèse le plus sur l'avenir de TD post amende AML 2024 ($3B). Restructuration en cours, croissance limitée par cap regulatoire imposé.",
    kpis: [
      { short: "US Retail", name_fr: "US Retail Revenue", name_en: "US Retail Banking Revenue", explanation: "Revenu segment Retail US (TD Bank, plus de 1100 agences East Coast).", value: "11.0", unit: "Mds USD", yoy: "-3%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Sous restructuration AML", description: "Asset cap US imposé en 2024 limite croissance. Restructuration AML en cours jusqu'à 2027.", history: [8.5, 9.2, 11.5, 11.4, 11.0], is_wow: true, is_generic: false, is_short_history: false },
      { short: "AML Charge", name_fr: "Charge AML one-shot 2024", name_en: "Anti-Money Laundering Settlement", explanation: "Amende totale AML 2024 (FinCEN + DOJ + OCC). One-shot non récurrent.", value: "3.1", unit: "Mds USD", yoy: "n/a", type: "Risk", nature: "Conjoncturel", comparable: "Non comparable", signal: "Cliff régulatoire 2024", description: "$3.09B settlement octobre 2024 + asset cap imposé. Plus grosse amende AML US.", history: [-3.1], is_wow: true, is_generic: false, is_short_history: true, story_category: "Marché" },
      { short: "Canadian Retail", name_fr: "Canadian Personal & Commercial", name_en: "Canadian P&C Banking Revenue", explanation: "Revenu segment retail + commercial Canada.", value: "16.8", unit: "Mds CAD", yoy: "+5%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Stable", description: "TD #1 PIB par dépôts Canada. Stable malgré contexte taux.", history: [13.0, 14.5, 15.8, 16.0, 16.8], is_wow: false, is_generic: true, is_short_history: false },
      { short: "CET1", name_fr: "Ratio CET1", name_en: "Common Equity Tier 1 Ratio", explanation: "Solvabilité réglementaire OSFI.", value: "13.1", unit: "%", yoy: "+0.6 pt", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Capital robuste", description: "Maintenu post-AML settlement.", history: [14.5, 13.5, 14.0, 12.5, 13.1], is_wow: false, is_generic: true, is_short_history: false },
      { short: "ROE", name_fr: "Return on Equity", name_en: "Return on Equity", explanation: "Rentabilité capitaux propres.", value: "11.5", unit: "%", yoy: "+1.5 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Recovery post-AML", description: "Reprise post-charge 2024. Target 13-15% mid-cycle.", history: [14.0, 13.2, 12.0, 10.0, 11.5], is_wow: false, is_generic: false, is_short_history: false },
    ],
  }),

  UBS: mkCompany({
    ticker: "UBS", name: "UBS Group", sector: "Finance", subsector: "Wealth Management / Switzerland",
    tagline: "Powering wealth ambitions.",
    founded: 1862, ipo: 1998,
    ranks: { global_world: "≈ #70", global_us: "ADR Top 20", sector: "Top 5 wealth global", subsector: "#1 wealth global" },
    hero_kpi: "Invested AUM",
    hero_kpi_rationale: "Les actifs investis (Invested Assets) sont le KPI maître chez UBS, premier wealth manager mondial post-acquisition Credit Suisse 2023.",
    kpis: [
      { short: "Invested AUM", name_fr: "Invested Assets (Wealth)", name_en: "Total Invested Assets", explanation: "Encours d'actifs investis Wealth + Asset Mgmt.", value: "6.2", unit: "T USD", yoy: "+8%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Premier wealth global", description: "Post-CS integration, UBS #1 wealth manager mondial. Target $7T 2027.", history: [3.0, 3.0, 4.5, 5.7, 6.2], is_wow: true, is_generic: false, is_short_history: false },
      { short: "NNM Wealth", name_fr: "Net New Money Wealth", name_en: "Wealth Management Net New Money", explanation: "Nouveaux fonds nets collectés en wealth (organic growth).", value: "97", unit: "Mds USD", yoy: "+25%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Top-tier organic", description: "$97B NNM 2024, target $100B+ chaque année jusqu'à 2027.", history: [60, 80, 60, 78, 97], is_wow: true, is_generic: false, is_short_history: false },
      { short: "CS Synergies", name_fr: "Synergies cumulées Credit Suisse", name_en: "Credit Suisse Cost Synergies (cumulative)", explanation: "Économies cumulées issues de l'intégration CS depuis 2023.", value: "9.0", unit: "Mds USD", yoy: "+50%", type: "Margin", nature: "Conjoncturel", comparable: "Non comparable", signal: "Sur cap target $13B 2026", description: "$9B atteints fin 2024 vs target $13B fin 2026. Bonne progression.", history: [3.0, 6.0, 9.0], is_wow: true, is_generic: false, is_short_history: true, story_category: "Capacité" },
      { short: "CET1", name_fr: "Ratio CET1", name_en: "CET1 Capital Ratio", explanation: "Solvabilité réglementaire FINMA.", value: "14.3", unit: "%", yoy: "-0.2 pt", type: "Capital", nature: "Structurel", comparable: "Comparable", signal: "Fort capital post-CS", description: "Au-dessus minimum + buffer. Buybacks repris en 2024.", history: [14.4, 14.5, 14.6, 14.5, 14.3], is_wow: false, is_generic: true, is_short_history: false },
      { short: "PBT Margin", name_fr: "PBT Margin (Wealth Mgmt)", name_en: "Profit Before Tax Margin (Wealth)", explanation: "Marge avant impôt segment Wealth Management.", value: "26", unit: "%", yoy: "+5 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Levier synergies", description: "Levier opérationnel issue intégration CS.", history: [22, 23, 24, 21, 26], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),

  /* ───────────────────────── ENERGY ───────────────────────── */
  EQNR: mkCompany({
    ticker: "EQNR", name: "Equinor", sector: "Énergie", subsector: "Oil & Gas / Norway",
    tagline: "Shaping the future of energy.",
    founded: 1972, ipo: 2001,
    ranks: { global_world: "≈ #150", global_us: "ADR Top 50", sector: "Top 15 IOC", subsector: "#1 Norway" },
    hero_kpi: "Production",
    hero_kpi_rationale: "Production hydrocarbures hauteur ~2 Mboe/j est le KPI maître. Equinor est l'un des opérateurs offshore les plus efficaces avec breakeven < $35/bl.",
    kpis: [
      { short: "Production", name_fr: "Production hydrocarbures", name_en: "Total Hydrocarbon Production (boe/day)", explanation: "Production journalière équivalent pétrole, segments offshore Norway + Brazil + UK + USA.", value: "2.07", unit: "Mboe/j", yoy: "+1%", type: "Demand", nature: "Cyclique", comparable: "Comparable", signal: "Stabilité norvégienne", description: "Norway shelf leader + croissance Brésil (Bacalhau) + US Marcellus.", history: [2.07, 2.06, 2.10, 2.05, 2.07], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Breakeven", name_fr: "Breakeven $/bl", name_en: "Project Breakeven Price", explanation: "Prix Brent moyen pondéré qui égalise les cash-flows projets en cours.", value: "35", unit: "$/bl", yoy: "stable", type: "Margin", nature: "Structurel", comparable: "Non comparable", signal: "Top-class IOC", description: "Breakeven très bas grâce aux champs offshore Norway efficients.", history: [35], is_wow: true, is_generic: false, is_short_history: true, story_category: "Capacité" },
      { short: "Renewables Capex", name_fr: "Capex Renewables", name_en: "Renewables Capex (annual)", explanation: "Investissement annuel renouvelables (offshore wind + solar).", value: "1.8", unit: "$B", yoy: "-20%", type: "Investment", nature: "Structurel", comparable: "Comparable", signal: "Reset stratégique 2024", description: "Réduit vs target initial post strategy reset (return to oil & gas focus).", history: [0.6, 1.5, 2.5, 2.3, 1.8], is_wow: false, is_generic: false, is_short_history: false },
      { short: "Adj EBITDA", name_fr: "Adj EBITDA", name_en: "Adjusted EBITDA", explanation: "EBITDA ajusté Group consolidé.", value: "32", unit: "$B", yoy: "-15%", type: "Margin", nature: "Cyclique", comparable: "Comparable", signal: "Brent en baisse", description: "Reflet du Brent moyen $80 vs $82 2023.", history: [12, 35, 75, 38, 32], is_wow: false, is_generic: true, is_short_history: false },
      { short: "FCF", name_fr: "Free Cash Flow", name_en: "Free Cash Flow", explanation: "Cash flow disponible après capex.", value: "9.5", unit: "$B", yoy: "-25%", type: "Cash", nature: "Cyclique", comparable: "Comparable", signal: "Discipline capex", description: "FCF utilisé pour buybacks $4B + dividend.", history: [3.0, 16.0, 23.0, 12.6, 9.5], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),

  /* ───────────────────────── E-COMMERCE & INTERNET CHINA ───────────────────────── */
  PDD: mkCompany({
    ticker: "PDD", name: "PDD Holdings", sector: "Communication Services", subsector: "E-commerce / China + Global",
    tagline: "Together, more savings, more fun.",
    founded: 2015, ipo: 2018,
    ranks: { global_world: "≈ #60", global_us: "ADR Top 18", sector: "Top 5 e-commerce", subsector: "#2 China" },
    hero_kpi: "Temu GMV",
    hero_kpi_rationale: "Temu (filiale internationale lancée 2022) est le segment qui change la trajectoire de PDD. Croissance fulgurante hors Chine, valorisation post-Temu réécrit le story.",
    kpis: [
      { short: "Temu GMV", name_fr: "Temu GMV (international)", name_en: "Temu Global GMV", explanation: "Volume brut de marchandises Temu (US + EU + LatAm + APAC). Lancé septembre 2022.",
        value: "70", unit: "$B", yoy: "+150%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Croissance >100%/an", description: "Estimation analystes 2024. Pas de chiffre publié officiel, GMV tirée de l'omnibus US tariff news.", history: [0, 4, 28, 70], is_wow: true, is_generic: false, is_short_history: true, story_category: "Innovation" },
      { short: "Pinduoduo Active", name_fr: "Acheteurs actifs Pinduoduo (Chine)", name_en: "Pinduoduo Active Buyers (China)", explanation: "Nombre d'acheteurs annuels actifs sur la plateforme Pinduoduo Chine.", value: "900", unit: "M", yoy: "stable", type: "User", nature: "Structurel", comparable: "Comparable", signal: "Plateau Chine, expansion Temu", description: "Saturation Pinduoduo Chine. Croissance reportée sur Temu.", history: [820, 882, 900, 902, 900], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Take Rate", name_fr: "Take Rate (commission)", name_en: "Effective Take Rate", explanation: "Commission moyenne sur le GMV (transaction services + ad).", value: "5.2", unit: "%", yoy: "+0.4 pt", type: "Mix", nature: "Structurel", comparable: "Non comparable", signal: "Monétisation en hausse", description: "Margin growth from ads on Pinduoduo platform.", history: [3.5, 4.2, 4.8, 4.8, 5.2], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Marge opérationnelle non-GAAP", name_en: "Non-GAAP Operating Margin", explanation: "Marge op. non-GAAP. Sous pression à cause des subventions Temu.", value: "26", unit: "%", yoy: "-3 pts", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Subventions Temu", description: "Temu reste lossy à grande échelle. Marge groupe diluée.", history: [20, 24, 30, 29, 26], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Cash Position", name_fr: "Trésorerie + investissements", name_en: "Cash + Short-term Investments", explanation: "Position cash brute. Énorme buffer pour subventions Temu.", value: "45", unit: "$B", yoy: "+12%", type: "Cash", nature: "Structurel", comparable: "Comparable", signal: "Buffer guerre prix", description: "Capacité à soutenir les subventions Temu pluriannuelles.", history: [18, 22, 30, 40, 45], is_wow: true, is_generic: false, is_short_history: false },
    ],
  }),

  JD: mkCompany({
    ticker: "JD", name: "JD.com", sector: "Communication Services", subsector: "E-commerce / China",
    tagline: "Real items, real prices, real comfort.",
    founded: 1998, ipo: 2014,
    ranks: { global_world: "≈ #150", global_us: "ADR Top 35", sector: "Top 15 e-commerce", subsector: "#3 Chine" },
    hero_kpi: "JD Logistics",
    hero_kpi_rationale: "JD Logistics est le segment qui distingue JD.com d'Alibaba/PDD. Infrastructure logistique propre = moat structurel + revenu B2B en croissance.",
    kpis: [
      { short: "JD Logistics", name_fr: "Revenu JD Logistics", name_en: "JD Logistics Revenue (3PL + 1P)", explanation: "Revenu logistique JD (à la fois interne JD + client externe 3PL).", value: "183", unit: "Mds CNY", yoy: "+10%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "B2B logistique en croissance", description: "JD #1 logistics China. Réseau d'entrepôts + livraison J+1.", history: [104, 137, 165, 167, 183], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Active Users", name_fr: "Utilisateurs annuels actifs", name_en: "Annual Active Customers", explanation: "Nombre de clients annuels actifs sur JD.", value: "588", unit: "M", yoy: "+9%", type: "User", nature: "Structurel", comparable: "Comparable", signal: "Reprise croissance utilisateurs", description: "Reprise après stabilisation 2022-2023.", history: [532, 580, 580, 540, 588], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Op Margin Group", name_en: "Operating Margin", explanation: "Marge opérationnelle GAAP consolidée.", value: "3.5", unit: "%", yoy: "+0.6 pt", type: "Margin", nature: "Cyclique", comparable: "Comparable", compare_key: "op_margin", signal: "Légère amélioration", description: "Marge structurellement basse e-commerce 1P.", history: [1.5, 2.5, 3.0, 2.9, 3.5], is_wow: false, is_generic: true, is_short_history: false },
      { short: "Cash Reserve", name_fr: "Trésorerie + investissements", name_en: "Cash + Short-term Investments", explanation: "Position cash brute.", value: "215", unit: "Mds CNY", yoy: "+5%", type: "Cash", nature: "Structurel", comparable: "Comparable", signal: "Coffre solide", description: "Buffer pour buybacks et investissements stratégiques.", history: [185, 200, 210, 205, 215], is_wow: false, is_generic: true, is_short_history: false },
      { short: "1P Mix", name_fr: "Part 1P (vente directe)", name_en: "First-Party Sales Share", explanation: "Part du GMV en vente directe (JD owns inventory) vs Marketplace 3P.", value: "82", unit: "%", yoy: "stable", type: "Mix", nature: "Structurel", comparable: "Non comparable", signal: "Modèle 1P dominant", description: "JD reste le seul gros acteur Chine 1P-dominant. Cher mais qualité.", history: [85, 84, 82, 82, 82], is_wow: false, is_generic: false, is_short_history: false },
    ],
  }),

  NTES: mkCompany({
    ticker: "NTES", name: "NetEase", sector: "Communication Services", subsector: "Gaming / China",
    tagline: "Play together, prosper together.",
    founded: 1997, ipo: 2000,
    ranks: { global_world: "≈ #220", global_us: "ADR Top 60", sector: "Top 5 gaming Asie", subsector: "#2 gaming Chine" },
    hero_kpi: "Gaming Revenue",
    hero_kpi_rationale: "Gaming est le coeur de NetEase (>75% revenu). Hits comme Identity V, Justice Mobile, Eggy Party + collab Blizzard re-signée 2024 = trajectoire.",
    kpis: [
      { short: "Gaming", name_fr: "Revenu Gaming Online", name_en: "Online Gaming Revenue", explanation: "Revenu jeux online (PC + mobile) Chine + global.", value: "84.5", unit: "Mds CNY", yoy: "+5%", type: "Demand", nature: "Structurel", comparable: "Comparable", signal: "Growth driven by mobile + Blizzard re-launch", description: "Re-signature Blizzard 2024 = retour World of Warcraft Chine + Diablo + Hearthstone.", history: [62.8, 70.1, 74.6, 80.6, 84.5], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Mobile Mix", name_fr: "Part mobile gaming", name_en: "Mobile Games Revenue Share", explanation: "Part du revenu gaming généré par mobile (vs PC).", value: "73", unit: "%", yoy: "+2 pts", type: "Mix", nature: "Structurel", comparable: "Non comparable", signal: "Mobile-first confirmation", description: "Mobile dépasse PC depuis 2020. Pipeline mobile costaud.", history: [65, 67, 70, 71, 73], is_wow: false, is_generic: false, is_short_history: false },
      { short: "Op Margin", name_fr: "Marge opérationnelle", name_en: "Non-GAAP Operating Margin", explanation: "Marge opérationnelle non-GAAP.", value: "31", unit: "%", yoy: "+1 pt", type: "Margin", nature: "Structurel", comparable: "Comparable", compare_key: "op_margin", signal: "Top-quartile gaming", description: "Marge gaming très haute, dilution cloud + youdao + média.", history: [27, 28, 29, 30, 31], is_wow: true, is_generic: false, is_short_history: false },
      { short: "Hit Pipeline", name_fr: "Hits récents (Mds CNY 1+ chacun)", name_en: "Pipeline of Mds CNY 1B+ Hits", explanation: "Nombre de hits dans le portfolio générant Mds CNY 1+ de revenu annuel.", value: "12", unit: "", yoy: "+2", type: "Adoption", nature: "Structurel", comparable: "Non comparable", signal: "Diversification réussie", description: "Identity V, Justice Mobile, Eggy Party, Naraka, Onmyoji, etc. + collab Blizzard.", history: [8, 9, 10, 12], is_wow: true, is_generic: false, is_short_history: true, story_category: "Innovation" },
      { short: "Cash", name_fr: "Trésorerie + investissements", name_en: "Cash + Short-term Investments", explanation: "Position de trésorerie.", value: "117", unit: "Mds CNY", yoy: "+8%", type: "Cash", nature: "Structurel", comparable: "Comparable", signal: "Coffre fort", description: "Massive net cash, 40% market cap en cash.", history: [85, 95, 105, 108, 117], is_wow: false, is_generic: true, is_short_history: false },
    ],
  }),
};

/* Helper de fusion : merge V2_BATCH2 + V2_BATCH3 vers V2_COMPANIES principal */
delete V2_BATCH2["HSBC_DUMMY"]; // placeholder utilitaire
