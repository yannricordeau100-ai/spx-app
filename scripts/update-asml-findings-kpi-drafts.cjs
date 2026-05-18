const { createClient } = require("/Users/yann/spx-app/node_modules/@supabase/supabase-js");
const fs = require("fs");
const env = {};
for (const l of fs.readFileSync("/Users/yann/spx-app/.env.local", "utf-8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const updates = [
  {
    id: "622313c3-1160-47a3-a2ce-a9012c3d83ac",
    label: "01 Net Sales",
    convertible_to_kpi: true,
    kpi_draft: {
      short: "Net Sales",
      name_en: "Net Sales",
      name_fr: "Revenu net",
      name_de: "Nettoumsatz",
      value: 32.7,
      unit: "Mds €",
      history: [18.6, 21.2, 27.6, 28.3, 32.7],
      yoy: "+15,5 %",
      type: "Revenu",
      signal: "Record historique 2025, guidance 34-39 Mds€ pour 2026."
    }
  },
  {
    id: "8aad39a1-c70b-4d5b-a220-acef1f4edb9c",
    label: "02 Backlog (history 2 pts only)",
    convertible_to_kpi: false,
    kpi_draft: null
  },
  {
    id: "eee9fe70-8932-4822-bbdf-804cadb5b283",
    label: "03 R&D Spending",
    convertible_to_kpi: true,
    kpi_draft: {
      short: "R&D Spending",
      name_en: "R&D Spending",
      name_fr: "Dépenses R&D",
      name_de: "F&E-Ausgaben",
      value: 4.7,
      unit: "Mds €",
      history: [2.55, 3.25, 3.98, 4.30, 4.70],
      yoy: "+9,3 %",
      type: "Investissement",
      signal: "Effort R&D maintenu autour de 14-15 % du CA depuis 2021."
    }
  },
  {
    id: "29b96fe5-39c7-43f1-85ef-1322fadb46b0",
    label: "04 Gross Margin (quarterly)",
    convertible_to_kpi: true,
    kpi_draft: {
      short: "Gross Margin",
      name_en: "Gross Margin",
      name_fr: "Marge brute",
      name_de: "Bruttomarge",
      value: 52.2,
      unit: "%",
      history: [51.7, 54.0, 53.7, 51.6, 52.2],
      yoy: "+0,5 pts",
      type: "Rentabilité",
      signal: "Marge brute stable entre 51,6 % et 54 % sur 5 trimestres. Cible 2030 : 56-60 %."
    }
  },
  {
    id: "30d0f303-31a7-463d-a99d-96fed99e48f7",
    label: "05 Revenue mix segments (non time-series)",
    convertible_to_kpi: false,
    kpi_draft: null
  },
  {
    id: "09382ebd-1b8b-4743-8fb4-f195a2bbe413",
    label: "06 Shareholder Returns (no time-series)",
    convertible_to_kpi: false,
    kpi_draft: null
  },
  {
    id: "3e8e1404-042f-4e39-90ac-3ad4a16871ec",
    label: "07 Systems Shipped",
    convertible_to_kpi: true,
    kpi_draft: {
      short: "Systems Shipped",
      name_en: "Systems Shipped",
      name_fr: "Systèmes livrés",
      name_de: "Systeme ausgeliefert",
      value: 327,
      unit: "units",
      history: [309, 345, 449, 418, 327],
      yoy: "-21,8 %",
      type: "Volume",
      signal: "327 systèmes en 2025 (48 EUV + 279 DUV). Baisse volume compensée par ASP plus élevés."
    }
  }
];

(async () => {
  for (const u of updates) {
    const { error } = await s.from("desk_image_findings")
      .update({ convertible_to_kpi: u.convertible_to_kpi, kpi_draft: u.kpi_draft })
      .eq("id", u.id);
    if (error) {
      console.error(`FAIL ${u.label}:`, error.message);
    } else {
      console.log(`OK ${u.label} → convertible=${u.convertible_to_kpi}`);
    }
  }
})();
