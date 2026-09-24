const fs = require("fs");
const p = "/Users/yann/spx-app/.batches-drafts-safe/kpis-haut/ECL.json";
const d = require(p);
const h = (arr) => arr.map(([q, v]) => ({ q, v }));

const add = [
  {
    short: "oi_margin_institutional",
    name_fr: "Marge opérationnelle Global Institutional & Specialty",
    name_en: "Global Institutional & Specialty Operating Income Margin",
    value: 23.0, unit: "%", yoy: "+1.8pp",
    frequency: "quarterly", pv_score: 8,
    last_data_date: "2026-04-28",
    signal: "Marge en hausse continue portée par le prix valeur et le mix; +1,8 pt sur un an au T1 2026",
    _derived_note: "FY2023 dérivé = résultat opérationnel devise fixe 856,5 / ventes 5779,4; trimestres 2024 = colonnes N-1 retraitées des ER 2025",
    history: h([["FY2023", 14.8], ["Q1-2024", 17.8], ["Q2-2024", 21.3], ["Q3-2024", 21.5], ["Q4-2024", 19.7], ["Q1-2025", 21.2], ["Q2-2025", 23.8], ["Q3-2025", 23.6], ["Q4-2025", 22.3], ["Q1-2026", 23.0]]),
  },
  {
    short: "oi_margin_pest",
    name_fr: "Marge opérationnelle Global Pest Elimination",
    name_en: "Global Pest Elimination Operating Income Margin",
    value: 16.7, unit: "%", yoy: "+0.1pp",
    frequency: "quarterly", pv_score: 7,
    last_data_date: "2026-04-28",
    signal: "Marge proche de 17% au T1 2026; acquisitions ciblées en Amérique du Nord et offre pest intelligence",
    _derived_note: "FY2023 dérivé = résultat opérationnel devise fixe 200,9 / ventes 1044,3; trimestres 2024 = colonnes N-1 retraitées des ER 2025",
    history: h([["FY2023", 19.2], ["Q1-2024", 17.9], ["Q2-2024", 20.7], ["Q3-2024", 20.1], ["Q4-2024", 14.8], ["Q1-2025", 16.6], ["Q2-2025", 19.7], ["Q3-2025", 20.9], ["Q4-2025", 20.3], ["Q1-2026", 16.7]]),
  },
  {
    short: "oi_margin_lifesciences",
    name_fr: "Marge opérationnelle Global Life Sciences",
    name_en: "Global Life Sciences Operating Income Margin",
    value: 18.7, unit: "%", yoy: "+3.6pp",
    frequency: "quarterly", pv_score: 8,
    last_data_date: "2026-04-28",
    signal: "Forte expansion (+3,6 pt sur un an); bioprocessing dont les ventes ont doublé au T1 2026",
    _derived_note: "FY2023 dérivé = résultat opérationnel devise fixe 118,9 / ventes 650,8; trimestres 2024 = colonnes N-1 retraitées des ER 2025",
    history: h([["FY2023", 18.3], ["Q1-2024", 12.1], ["Q2-2024", 10.0], ["Q3-2024", 14.8], ["Q4-2024", 17.6], ["Q1-2025", 15.1], ["Q2-2025", 19.7], ["Q3-2025", 16.4], ["Q4-2025", 17.0], ["Q1-2026", 18.7]]),
  },
  {
    short: "adj_oi_margin",
    name_fr: "Marge opérationnelle ajustée (groupe)",
    name_en: "Adjusted Operating Income Margin (total)",
    value: 16.7, unit: "%", yoy: "+0.7pp",
    frequency: "quarterly", pv_score: 9,
    last_data_date: "2026-04-28",
    signal: "Expansion de 70 pb sur un an à 16,7% au T1 2026; objectif de marge au-delà de 20% d'ici 2027",
    _derived_note: "Dérivé = résultat opérationnel ajusté non-GAAP / ventes nettes GAAP par trimestre (ER). T1 2026 = 679,7/4066,1 = 16,7%, conforme à la présentation Ecolab",
    history: h([["Q1-2024", 14.6], ["Q2-2024", 16.8], ["Q3-2024", 17.8], ["Q4-2024", 17.2], ["FY2024", 16.6], ["Q1-2025", 16.0], ["Q2-2025", 18.3], ["Q3-2025", 18.9], ["Q4-2025", 18.8], ["FY2025", 18.0], ["Q1-2026", 16.7]]),
  },
  {
    short: "rd_expenditures",
    name_fr: "Dépenses de recherche et développement",
    name_en: "Research and Development Expenditures",
    value: 202, unit: "M $", yoy: "-2%",
    frequency: "annual", pv_score: 6,
    last_data_date: "2026-02-23",
    signal: "Investissement R&D stable autour de 200 M$ par an; 202 M$ en 2025 après 207 M$ en 2024",
    history: h([["FY2018", 193], ["FY2019", 190], ["FY2020", 185], ["FY2021", 186], ["FY2022", 190], ["FY2023", 192], ["FY2024", 207], ["FY2025", 202]]),
  },
];

const existing = new Set(d.kpis.map((k) => k.short));
let added = 0;
for (const k of add) {
  if (!existing.has(k.short)) { d.kpis.push(k); added++; }
}
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log("added:", added, "total kpis:", d.kpis.length);
