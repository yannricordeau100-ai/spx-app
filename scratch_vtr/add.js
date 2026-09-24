const fs = require("fs");
const p = ".batches-drafts-safe/kpis-haut/VTR.json";
const d = JSON.parse(fs.readFileSync(p, "utf8"));

const mk = (arr) => arr.map(([q, v]) => ({ q, v }));
const occ = mk([["Q1-2022",80.0],["Q2-2022",80.4],["Q3-2022",81.3],["Q1-2023",80.6],["Q2-2023",80.5],["Q3-2023",81.6],["Q1-2024",82.7],["Q2-2024",83.8],["Q3-2024",85.3],["Q1-2025",86.0],["Q2-2025",86.5],["Q3-2025",87.9],["Q1-2026",88.5]]);
const rev = mk([["Q1-2022",4.373],["Q2-2022",4.391],["Q3-2022",4.399],["Q1-2023",4.624],["Q2-2023",4.679],["Q3-2023",4.715],["Q1-2024",4.935],["Q2-2024",4.893],["Q3-2024",4.937],["Q1-2025",5.134],["Q2-2025",5.241],["Q3-2025",5.307],["Q1-2026",5.573]]);
const cnt = mk([["Q1-2022",546],["Q2-2022",548],["Q3-2022",549],["Q1-2023",551],["Q2-2023",570],["Q3-2023",583],["Q1-2024",581],["Q2-2024",582],["Q3-2024",591],["Q1-2025",654],["Q2-2025",683],["Q3-2025",714],["Q1-2026",783]]);
const ffo = mk([["FY2019",1.423],["FY2020",1.250],["FY2021",1.119],["FY2022",1.207],["FY2023",1.212],["FY2024",1.327],["FY2025",1.610]]);

const GAP = "T4 non publie en standalone dans les filings (mesure de periode moyenne, 10-K = donnee annuelle non additive, non derivable en trimestre isole). Trimestres concernes: Q4-2022, Q4-2023, Q4-2024, Q4-2025.";

const add = [
  {
    short: "SHOP Total Occupancy",
    name_fr: "Taux d'occupation SHOP (portefeuille total)",
    name_en: "Total SHOP Portfolio Average Occupancy",
    value: 88.5, unit: "%", yoy: "+250bps",
    history: occ, pv_score: 8,
    signal: "Occupation moyenne du portefeuille SHOP complet (783 communautes) : 88,5% au T1 2026 vs 86,0% un an plus tot",
    frequency: "quarterly", last_data_date: "2026-03-31",
    notes: "Total communities (toutes communautes SHOP, incluant les acquisitions), verbatim 10-Q, table Average Unit Occupancy for the Three Months Ended. Distinct du same-store (cohorte fixe).",
    _gap_note: GAP,
  },
  {
    short: "SHOP Total RevPOR",
    name_fr: "Revenu mensuel par chambre occupee (portefeuille SHOP total)",
    name_en: "Total SHOP Portfolio Average Monthly Revenue Per Occupied Room",
    value: 5.573, unit: "K $/mois", yoy: "+8.5%",
    history: rev, pv_score: 7,
    signal: "Revenu mensuel par chambre occupee sur l'ensemble du portefeuille SHOP : 5 573 $ au T1 2026 vs 5 134 $ (+8,5%)",
    frequency: "quarterly", last_data_date: "2026-03-31",
    notes: "Total communities RevPor, verbatim 10-Q (Average Monthly Revenue Per Occupied Room for the Three Months Ended). yoy = variation vs meme trimestre N-1 des montants publies (derive arithmetique).",
    _gap_note: GAP,
  },
  {
    short: "SHOP Community Count",
    name_fr: "Nombre de communautes SHOP (portefeuille total)",
    name_en: "Total SHOP Community Count",
    value: 783, unit: "unités", yoy: "+19.7%",
    history: cnt, pv_score: 7,
    signal: "Portefeuille SHOP porte a 783 communautes au T1 2026 vs 654 un an plus tot (+129 communautes), effet des acquisitions",
    frequency: "quarterly", last_data_date: "2026-03-31",
    notes: "Total communities (compte de communautes SHOP au sein du calcul occupation), verbatim 10-Q. yoy = variation vs meme trimestre N-1 (derive arithmetique).",
    _gap_note: GAP,
  },
  {
    short: "Normalized FFO",
    name_fr: "Resultat FFO normalise (attribuable aux actionnaires)",
    name_en: "Normalized FFO Attributable to Common Stockholders",
    value: 1.61, unit: "Mds $", yoy: "+21.3%",
    history: ffo, pv_score: 9,
    signal: "Normalized FFO attribuable aux actionnaires : 1,610 Md $ en 2025 vs 1,327 Md $ en 2024 (+21,3%)",
    frequency: "annual", last_data_date: "2025-12-31",
    notes: "Normalized FFO attributable to common stockholders, verbatim 10-K (reconciliation, dollars in thousands): FY2019=1 423 047, FY2020=1 249 972, FY2021=1 118 576, FY2022=1 206 971, FY2023=1 211 884, FY2024=1 327 447, FY2025=1 610 178. yoy = variation FY2025/FY2024 (derive arithmetique).",
  },
  {
    short: "SHOP Segment NOI",
    name_fr: "NOI total du segment SHOP",
    name_en: "Total SHOP Segment NOI",
    value: 1184.064, unit: "M $", yoy: "+36.7%",
    history: [{ q: "FY2024", v: 866.383 }, { q: "FY2025", v: 1184.064 }], pv_score: 7,
    is_short_history: true,
    signal: "NOI du segment SHOP (toutes communautes) : 1 184,1 M $ en 2025 vs 866,4 M $ en 2024 (+36,7%), hausse portee par l'occupation et les acquisitions",
    frequency: "annual", last_data_date: "2025-12-31",
    notes: "NOI-SHOP Segment, verbatim 10-K FY2025 (dollars in thousands): NOI 2025=1 184 064, 2024=866 383, Increase 317 681 soit +36,7%. FY2024 sur base retraitee du 10-K FY2025. Serie courte: 2 points sur base comparable (10-K FY2024 publiait 711 407 sur ancien perimetre, non comparable).",
  },
];

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const existing = new Set(d.kpis.map((k) => norm(k.name_fr)));
const toAdd = add.filter((k) => !existing.has(norm(k.name_fr)));
console.log("adding:", toAdd.map((k) => k.short).join(", "));
console.log("skipped dup:", add.filter((k) => existing.has(norm(k.name_fr))).map((k) => k.short).join(", ") || "none");
d.kpis.push(...toAdd);
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log("total kpis now:", d.kpis.length);
