#!/usr/bin/env node
/**
 * fill-super-kpi-virtuals.mjs
 *
 * Mission Yann 2 juin 2026 — compléter Super KPI bloc sur TOUTES les
 * stés V1.9.5.
 *
 * Stratégie : pour chaque sté, vérifier si les KPIs requis par les Super
 * KPI (Revenue, Op Margin, Op Income, Capex) sont déjà dans data.kpis
 * (pipeline + enrich.kpis + enrich.kpis_supplementary). Si manquants ET
 * que _super_kpi_inputs contient les données quarterly équivalentes,
 * synthétiser des KPIs virtuels annuels (Sum/Mean des 4 derniers
 * trimestres complets) et les pousser dans `kpis_supplementary` du
 * fichier enrich (qui sera APPEND-mergé par load-company.ts).
 *
 * IMPORTANT :
 *  - Ne JAMAIS modifier `src/data/v2-pipeline/<t>.json` (scope CONV-DATA).
 *  - Modifier UNIQUEMENT `src/data/v2-pipeline-enrich/<t>.json` champ
 *    `kpis_supplementary` (append-merge automatique sur shorts inconnus).
 *  - Préserver tous les autres champs.
 *  - Anti-invention : ne créer un KPI virtuel QUE si les inputs sources
 *    SEC EDGAR XBRL sont présents. NULL si manquant.
 *
 * Inputs disponibles dans _super_kpi_inputs :
 *  - revenue_q, op_income_q, ni_q, op_cf_q, rd_q : tableaux {q, v, date, source}
 *    avec Q4 souvent calc (FY - Q1-Q2-Q3) → valeur négative à reconstruire.
 *  - op_margin_q_pct : tableau {q, v} (pct trimestriel)
 *  - Units : Mds $ par défaut.
 *
 * Logique reconstruction annuelle :
 *   Pour les valeurs flow (Revenue, Op Income, NI, Op CF, R&D) :
 *     - Si revenue_q est "real" Q1-Q3 + "calc" Q4 (négative car = FY - somme),
 *       alors annual_v = Q1 + Q2 + Q3 - Q4_calc (note: Q4 calc est stocké
 *       comme négatif quand source = "10-K calc"). Mais valeur réelle Q4 =
 *       -Q4_calc + FY. Plus simple : on fait Q1 + Q2 + Q3 + Q4_real, où
 *       Q4_real = abs(Q4_calc) si flag "10-K calc" ET signe négatif.
 *     - Vérification : signe "10-K calc" + negative dans source string.
 *   Pour Op Margin annuel : moyenne des 4 trimestres pondérée par revenue.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TICKERS_FILE = path.join(ROOT, 'src/data/v1-9-5-clean-all-tickers.json');
const PIPELINE_DIR = path.join(ROOT, 'src/data/v2-pipeline');
const ENRICH_DIR = path.join(ROOT, 'src/data/v2-pipeline-enrich');

const REVENUE_SHORTS = ["Revenue","Total Revenue","Total Revenues","Net Sales","Total Net Sales","Sales","Net Sales (Group)","Net Revenue","Total Net Revenue","Revenues","Net Revenues","Group Revenue","Group Sales","Total fee revenue","Net interest income","Operating revenue","Operating revenues"];
const MARGIN_SHORTS = ["Op Margin","Operating Margin","EBITDA Mgn","EBITDA Margin","Op. Margin","Op Mgn","Adjusted Operating Margin","Adj Operating Margin","Adj Op Margin","Adjusted EBITDAC Margin","Adjusted EBITDA Margin","Adj EBITDA Margin","EBIT Margin","EBIT Margin before Special Items","Pre-tax margin"];
const OPINC_SHORTS = ["Operating Income","Op Income","Adjusted Operating Income","EBIT","Adjusted EBIT"];
const CAPEX_SHORTS = ["Capex","CapEx","Capex Total","Capex total","Capital Expenditure","Capital Expenditures"];

function findKpiInArray(kpis, shorts) {
  if (!Array.isArray(kpis)) return null;
  for (const s of shorts) {
    const k = kpis.find(k => k && k.short === s);
    if (k) return k;
  }
  return null;
}

/**
 * Reconstruit la série annuelle (5 dernières années) à partir d'un tableau
 * de quarterly objects {q: "Q1 2024", v: number, date: string, source: string}.
 *
 * Convention détectée dans les données AAPL :
 *  - Q1, Q2, Q3 = valeurs Q réelles "10-Q" positives
 *  - Q4 = "10-K calc" stocké négatif (signe inversé pour distinguer)
 *  - FY réel = Q1 + Q2 + Q3 + abs(Q4)
 *
 * MAIS d'autres stés peuvent avoir Q4 stocké positif directement. On
 * détecte via le pattern source: si source contient "10-K calc" et v<0,
 * on prend abs(v). Sinon on prend v tel quel.
 *
 * Pour les KPIs non-flow (ex margin %), on prend la moyenne pondérée par
 * revenue (mais ici op_margin_q_pct n'a pas de calc, donc moyenne simple).
 *
 * Retourne {value: dernière année complète, history: [Y-4 ... Y0] sur 5 ans}.
 * Si on n'a pas 5 années complètes, retourne ce qu'on a.
 */
function reconstructAnnualFromQuarterly(quartersArr, isFlow = true) {
  if (!Array.isArray(quartersArr) || quartersArr.length === 0) return null;
  // Group by FY year. Le label "Q4 2025" est dans "q" et représente la fin
  // d'exercice. Pour AAPL: FY se termine fin septembre. On groupe par année
  // calendaire mentionnée dans "q".
  const byFy = new Map();
  for (const item of quartersArr) {
    if (!item || typeof item.q !== 'string') continue;
    const m = item.q.match(/Q(\d)\s*(\d{4})/);
    if (!m) continue;
    const qNum = parseInt(m[1], 10);
    const fy = parseInt(m[2], 10);
    if (!byFy.has(fy)) byFy.set(fy, { Q1: null, Q2: null, Q3: null, Q4: null });
    const fyRec = byFy.get(fy);
    const isCalc = typeof item.source === 'string' && /10-K calc/i.test(item.source);
    let v = item.v;
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (isFlow && isCalc && v < 0) v = -v; // restore Q4 sign
    fyRec[`Q${qNum}`] = v;
  }
  // Pour chaque FY, computer la valeur annuelle
  const annualByFy = [];
  for (const [fy, rec] of byFy.entries()) {
    if (isFlow) {
      // Need all 4 quarters
      if (rec.Q1 == null || rec.Q2 == null || rec.Q3 == null || rec.Q4 == null) continue;
      annualByFy.push({ fy, v: rec.Q1 + rec.Q2 + rec.Q3 + rec.Q4 });
    } else {
      // Mean of available quarters
      const vals = [rec.Q1, rec.Q2, rec.Q3, rec.Q4].filter(v => v != null);
      if (vals.length === 0) continue;
      annualByFy.push({ fy, v: vals.reduce((a, b) => a + b, 0) / vals.length });
    }
  }
  // Sort ascending by FY
  annualByFy.sort((a, b) => a.fy - b.fy);
  if (annualByFy.length === 0) return null;
  // Take last 5
  const last5 = annualByFy.slice(-5);
  const lastValue = last5[last5.length - 1].v;
  return {
    value: lastValue,
    history: last5.map(x => x.v),
    fyYears: last5.map(x => x.fy),
  };
}

/** YoY % from last two values */
function calcYoy(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const prev = history[history.length - 2];
  const last = history[history.length - 1];
  if (!prev) return null;
  const pct = ((last - prev) / Math.abs(prev)) * 100;
  return pct;
}

function formatYoyString(pct, isPercentKpi = false) {
  if (pct == null || !Number.isFinite(pct)) return "";
  const sign = pct >= 0 ? "+" : "";
  // For percentage KPIs (margin), YoY is in points
  const suffix = isPercentKpi ? " pts" : " %";
  return `${sign}${pct.toFixed(1).replace('.', ',')}${suffix}`;
}

/** Loads enrich file (lowercase, then uppercase fallback). Returns {data, path}. */
function loadEnrich(ticker) {
  const lp = path.join(ENRICH_DIR, `${ticker.toLowerCase()}.json`);
  const up = path.join(ENRICH_DIR, `${ticker.toUpperCase()}.json`);
  if (fs.existsSync(lp)) {
    try { return { data: JSON.parse(fs.readFileSync(lp, 'utf8')), filePath: lp }; }
    catch { return null; }
  }
  if (fs.existsSync(up)) {
    try { return { data: JSON.parse(fs.readFileSync(up, 'utf8')), filePath: up }; }
    catch { return null; }
  }
  return null;
}

function loadPipeline(ticker) {
  const up = path.join(PIPELINE_DIR, `${ticker.toUpperCase()}.json`);
  const lp = path.join(PIPELINE_DIR, `${ticker.toLowerCase()}.json`);
  if (fs.existsSync(up)) {
    try { return JSON.parse(fs.readFileSync(up, 'utf8')); } catch { return null; }
  }
  if (fs.existsSync(lp)) {
    try { return JSON.parse(fs.readFileSync(lp, 'utf8')); } catch { return null; }
  }
  return null;
}

const tickers = JSON.parse(fs.readFileSync(TICKERS_FILE, 'utf8')).tickers;
console.log(`Loaded ${tickers.length} tickers V1.9.5`);

let processed = 0;
let updated = 0;
let skippedNoEnrich = 0;
let skippedNoInputs = 0;
let skippedAlreadyComplete = 0;
let addedRevenue = 0;
let addedOpIncome = 0;
let addedOpMargin = 0;
let flaggedUnavailable = 0;
const failures = [];

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

for (const ticker of tickers) {
  processed++;
  const pipeline = loadPipeline(ticker);
  const enrichLoad = loadEnrich(ticker);

  if (!pipeline) {
    skippedNoEnrich++;
    if (VERBOSE) console.log(`SKIP ${ticker} no pipeline`);
    continue;
  }
  if (!enrichLoad) {
    skippedNoEnrich++;
    if (VERBOSE) console.log(`SKIP ${ticker} no enrich file`);
    continue;
  }
  const enrich = enrichLoad.data;
  const enrichPath = enrichLoad.filePath;

  // Collect all kpis available across sources
  const allKpis = [
    ...(Array.isArray(pipeline.kpis) ? pipeline.kpis : []),
    ...(Array.isArray(enrich.kpis) ? enrich.kpis : []),
    ...(Array.isArray(enrich.kpis_supplementary) ? enrich.kpis_supplementary : []),
  ];

  const hasRevenue = !!findKpiInArray(allKpis, REVENUE_SHORTS);
  const hasMargin = !!findKpiInArray(allKpis, MARGIN_SHORTS);
  const hasOpIncome = !!findKpiInArray(allKpis, OPINC_SHORTS);
  const hasCapex = !!findKpiInArray(allKpis, CAPEX_SHORTS);

  if (hasRevenue && (hasMargin || hasOpIncome) && hasCapex) {
    skippedAlreadyComplete++;
    continue;
  }

  const skInputs = enrich._super_kpi_inputs;
  if (!skInputs) {
    skippedNoInputs++;
    // Flag unavailable if truly nothing usable
    if (!hasRevenue || (!hasMargin && !hasOpIncome)) {
      if (!DRY_RUN) {
        enrich._super_kpi_unavailable = {
          reason: "no_super_kpi_inputs_and_no_revenue_margin_in_kpis",
          checked_at: new Date().toISOString(),
          missing: {
            revenue: !hasRevenue,
            margin_or_op_income: !hasMargin && !hasOpIncome,
            capex: !hasCapex,
          },
        };
        fs.writeFileSync(enrichPath, JSON.stringify(enrich, null, 2));
      }
      flaggedUnavailable++;
    }
    if (VERBOSE) console.log(`SKIP ${ticker} no _super_kpi_inputs`);
    continue;
  }

  // Build virtual KPIs from _super_kpi_inputs
  const supplementary = Array.isArray(enrich.kpis_supplementary)
    ? [...enrich.kpis_supplementary]
    : [];
  const existingShorts = new Set(supplementary.map(k => k && k.short).filter(Boolean));
  // Also exclude shorts already present elsewhere
  for (const k of allKpis) {
    if (k && k.short) existingShorts.add(k.short);
  }

  let touched = false;

  // Revenue
  if (!hasRevenue && Array.isArray(skInputs.revenue_q) && skInputs.revenue_q.length >= 4) {
    const recon = reconstructAnnualFromQuarterly(skInputs.revenue_q, true);
    if (recon && recon.history.length >= 2) {
      const short = "Revenue";
      if (!existingShorts.has(short)) {
        const yoy = calcYoy(recon.history);
        const kpi = {
          short,
          name_fr: "Revenue",
          name_en: "Revenue",
          explanation: "Revenue total annuel reconstitué à partir des données trimestrielles SEC EDGAR XBRL.",
          value: parseFloat(recon.value.toFixed(2)),
          unit: skInputs.revenue_unit || "Mds $",
          yoy: formatYoyString(yoy, false),
          type: "Conjoncturel",
          nature: "Conjoncturel",
          comparable: "Yes",
          compare_key: "revenue",
          signal: "",
          description: "",
          history: recon.history.map(v => parseFloat(v.toFixed(2))),
          period_type: "year",
          _source: "super_kpi_inputs_virtual",
          _fy_years: recon.fyYears,
        };
        supplementary.push(kpi);
        existingShorts.add(short);
        touched = true;
        addedRevenue++;
      }
    }
  }

  // Op Income (if not present) → from op_income_q
  if (!hasOpIncome && Array.isArray(skInputs.op_income_q) && skInputs.op_income_q.length >= 4) {
    const recon = reconstructAnnualFromQuarterly(skInputs.op_income_q, true);
    if (recon && recon.history.length >= 2) {
      const short = "Op Income";
      if (!existingShorts.has(short)) {
        const yoy = calcYoy(recon.history);
        supplementary.push({
          short,
          name_fr: "Résultat opérationnel",
          name_en: "Operating Income",
          explanation: "Résultat opérationnel annuel reconstitué à partir des données trimestrielles SEC EDGAR XBRL.",
          value: parseFloat(recon.value.toFixed(2)),
          unit: skInputs.op_income_unit || "Mds $",
          yoy: formatYoyString(yoy, false),
          type: "Structurel",
          nature: "Structurel",
          comparable: "Yes",
          compare_key: "op_income",
          signal: "",
          description: "",
          history: recon.history.map(v => parseFloat(v.toFixed(2))),
          period_type: "year",
          _source: "super_kpi_inputs_virtual",
          _fy_years: recon.fyYears,
        });
        existingShorts.add(short);
        touched = true;
        addedOpIncome++;
      }
    }
  }

  // Op Margin (if not present and we have op_margin_q_pct OR computable from revenue+op_income)
  if (!hasMargin) {
    let marginRecon = null;
    if (Array.isArray(skInputs.op_margin_q_pct) && skInputs.op_margin_q_pct.length >= 4) {
      marginRecon = reconstructAnnualFromQuarterly(skInputs.op_margin_q_pct, false);
    }
    // If we just reconstructed Revenue + Op Income, compute margin from them
    if (!marginRecon && Array.isArray(skInputs.revenue_q) && Array.isArray(skInputs.op_income_q)) {
      const rev = reconstructAnnualFromQuarterly(skInputs.revenue_q, true);
      const op = reconstructAnnualFromQuarterly(skInputs.op_income_q, true);
      if (rev && op && rev.history.length === op.history.length) {
        const mhist = rev.history.map((r, i) => r === 0 ? 0 : (op.history[i] / r) * 100);
        if (mhist.length >= 2) {
          marginRecon = { value: mhist[mhist.length - 1], history: mhist, fyYears: rev.fyYears };
        }
      }
    }
    if (marginRecon && marginRecon.history.length >= 2) {
      const short = "Op Margin";
      if (!existingShorts.has(short)) {
        const yoy = calcYoy(marginRecon.history);
        supplementary.push({
          short,
          name_fr: "Marge opérationnelle",
          name_en: "Operating Margin",
          explanation: "Marge opérationnelle annuelle reconstituée à partir des données SEC EDGAR XBRL.",
          value: parseFloat(marginRecon.value.toFixed(2)),
          unit: "%",
          yoy: formatYoyString(yoy, true),
          type: "Structurel",
          nature: "Structurel",
          comparable: "Yes",
          compare_key: "op_margin",
          signal: "",
          description: "",
          history: marginRecon.history.map(v => parseFloat(v.toFixed(2))),
          period_type: "year",
          _source: "super_kpi_inputs_virtual",
          _fy_years: marginRecon.fyYears,
        });
        existingShorts.add(short);
        touched = true;
        addedOpMargin++;
      }
    }
  }

  if (touched) {
    enrich.kpis_supplementary = supplementary;
    enrich._super_kpi_virtuals_filled_at = new Date().toISOString();
    if (!DRY_RUN) {
      fs.writeFileSync(enrichPath, JSON.stringify(enrich, null, 2));
    }
    updated++;
    if (VERBOSE) console.log(`UPDATED ${ticker}`);
  }
}

console.log(`---`);
console.log(`Processed: ${processed}`);
console.log(`Updated: ${updated}`);
console.log(`  + Revenue added: ${addedRevenue}`);
console.log(`  + Op Income added: ${addedOpIncome}`);
console.log(`  + Op Margin added: ${addedOpMargin}`);
console.log(`Skipped (already complete): ${skippedAlreadyComplete}`);
console.log(`Skipped (no enrich/pipeline): ${skippedNoEnrich}`);
console.log(`Skipped (no _super_kpi_inputs): ${skippedNoInputs}`);
console.log(`Flagged _super_kpi_unavailable: ${flaggedUnavailable}`);
console.log(`Failures: ${failures.length}`);
if (DRY_RUN) console.log('DRY RUN - no files modified');
