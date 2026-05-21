#!/usr/bin/env node
/**
 * Sub-agent #92: Mission A
 * Tag _hero_is_company_specific_legitimate=true sur les stés EU/UK où le hero
 * est un KPI officiel publié par l'entreprise (Beer Volume, VYVGART, Vehicle
 * Deliveries, CET1 Ratio, Pipeline biotech, etc.).
 *
 * Cap : 10 % du dataset (~78 stés sur 779). Sélection conservative ≥20.
 *
 * Sources : annual reports officiels EU/UK + local filings dans sec-data/.
 *
 * Output : edit dans src/data/v2-pipeline-enrich/<lowercase>.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..');
const ENRICH = path.join(REPO, 'src/data/v2-pipeline-enrich');

// 21 EU/UK candidates avec hero KPI officiellement publié par l'entreprise
const CANDIDATES = {
  // Pipeline biotech / R&D
  'ARGX.BR': {
    category: 'biotech_pipeline',
    rationale:
      'argenx Annual Report 2024: VYVGART franchise + new molecules in late-stage pipeline (Pipeline Projects = KPI flagship investor day)',
  },
  'AZN.L': {
    category: 'biotech_pipeline',
    rationale:
      'AstraZeneca Annual Report 2024 p.18-25: Oncology/CVRM/Rare disease pipeline projects (KPI flagship CMD)',
  },
  // Banks CET1 / RoE
  'BMED.MI': {
    category: 'bank_cet1',
    rationale:
      'Banca Mediolanum Annual Report 2024: CET1 Ratio (KPI prudentiel obligatoire EU banks)',
  },
  'NDA-SE.ST': {
    category: 'bank_roe',
    rationale:
      'Nordea Bank Annual Report 2024: RoE flagship metric Nordic bank (targets investor presentations)',
  },
  // Automotive deliveries
  'P911.DE': {
    category: 'automotive_deliveries',
    rationale:
      'Porsche AG Annual Report 2024: Vehicle Deliveries (KPI officiel investor presentations)',
  },
  'VOW.DE': {
    category: 'automotive_deliveries',
    rationale:
      'Volkswagen Annual Report 2024: Deliveries to customers (KPI officiel investor day)',
  },
  'VOW3.DE': {
    category: 'automotive_deliveries',
    rationale:
      'Volkswagen preferred shares Annual Report 2024: Vehicle Deliveries (KPI officiel)',
  },
  // Industrial segments officiels
  'ABBN.SW': {
    category: 'industrial_segment',
    rationale:
      'ABB Annual Report 2024: Electrification segment revenue (segment officiel + KPI flagship)',
  },
  'PRY.MI': {
    category: 'industrial_segment',
    rationale:
      'Prysmian Annual Report 2024: Energy Projects Revenue (segment officiel + KPI flagship)',
  },
  'VOE.VI': {
    category: 'industrial_segment',
    rationale:
      'voestalpine Annual Report 2024: Steel Division Revenue (segment officiel + KPI flagship)',
  },
  // Mining / aluminium
  'POLY.L': {
    category: 'mining_production',
    rationale:
      'Polymetal Annual Report 2024: Gold Equivalent Production (KPI flagship miner ounces)',
  },
  'NHY.OL': {
    category: 'aluminium_adj_ebitda',
    rationale:
      'Norsk Hydro Annual Report 2024: Adjusted EBITDA flagship metric (aluminium producer)',
  },
  // Real estate / REIT
  'WDP.BR': {
    category: 'reit_portfolio_value',
    rationale:
      'Warehouses De Pauw Annual Report 2024: Property Portfolio Value (KPI flagship REIT logistique)',
  },
  // Aviation / hospitality / utility regulated
  'WIZZ.L': {
    category: 'aviation_fleet',
    rationale:
      'Wizz Air Annual Report 2024: Fleet Size (KPI flagship low-cost carrier expansion)',
  },
  'WTB.L': {
    category: 'hospitality_rooms',
    rationale:
      'Whitbread Annual Report 2024: Premier Inn Rooms count (KPI flagship UK hospitality)',
  },
  'SRG.MI': {
    category: 'utility_rab',
    rationale:
      'Snam Annual Report 2024: Regulatory Asset Base (KPI prudentiel regulated TSO gaz)',
  },
  // Asset management
  'AMUN.PA': {
    category: 'asset_mgmt_aum',
    rationale:
      'Amundi Annual Report 2024: AUM Assets Under Management (KPI flagship asset manager)',
  },
  // Industrial orders
  'SIE.DE': {
    category: 'industrial_orders',
    rationale:
      'Siemens Annual Report 2024: Orders Received (KPI flagship demand metric investor day)',
  },
  // Holding portfolio composition
  'COFB.BR': {
    category: 'holding_portfolio_share',
    rationale:
      'Cofinimmo Annual Report 2024: Healthcare Portfolio Share (KPI flagship REIT santé)',
  },
  // Utility waste segment
  'HER.MI': {
    category: 'utility_waste_ebitda',
    rationale:
      'Hera Annual Report 2024: Waste Management EBITDA (segment officiel + KPI flagship)',
  },
  // Building materials margin guidance
  'HOLN.SW': {
    category: 'industrial_recurring_ebit',
    rationale:
      'Holcim Annual Report 2024: Recurring EBIT Margin (KPI guidance investor day officiel)',
  },
};

let tagged = 0;
let skipped = 0;
const errors = [];

for (const [ticker, meta] of Object.entries(CANDIDATES)) {
  const lower = ticker.toLowerCase();
  const enrichPath = path.join(ENRICH, `${lower}.json`);
  if (!fs.existsSync(enrichPath)) {
    errors.push(`${ticker}: enrich file missing at ${enrichPath}`);
    skipped += 1;
    continue;
  }
  try {
    const enrich = JSON.parse(fs.readFileSync(enrichPath, 'utf8'));
    // Tag at root level of enrich
    enrich._hero_is_company_specific_legitimate = true;
    enrich._hero_specific_rationale = meta.rationale;
    enrich._hero_specific_category = meta.category;
    enrich._hero_specific_tagged_at = new Date().toISOString();
    enrich._hero_specific_tagged_by = 'sub-agent-92';
    fs.writeFileSync(enrichPath, JSON.stringify(enrich, null, 2) + '\n');
    console.log(`[ok] ${ticker} → ${meta.category}`);
    tagged += 1;
  } catch (e) {
    errors.push(`${ticker}: ${e.message}`);
    skipped += 1;
  }
}

console.log(`\n========================================`);
console.log(`Tagged: ${tagged}`);
console.log(`Skipped: ${skipped}`);
if (errors.length) {
  console.log(`Errors:`);
  errors.forEach((e) => console.log(`  - ${e}`));
}
