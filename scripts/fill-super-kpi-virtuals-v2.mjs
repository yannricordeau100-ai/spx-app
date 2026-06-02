#!/usr/bin/env node
/**
 * fill-super-kpi-virtuals-v2.mjs — v2 (Yann 2 juin 2026)
 *
 * Mission : compléter Super KPI sur TOUTES les stés V1.9.5 (cible 90%+).
 *
 * Améliorations vs v1 :
 *  - Support format scalaire `_super_kpi_inputs` (Q1 2026 isolé, sans
 *    array historique). Création de KPIs synthétisés avec history dérivée
 *    des KPIs annuels existants quand possible.
 *  - Détection plus large des KPIs Revenue/Op Margin/Op Income existants
 *    (incluant "Total Revenue" period_type undefined avec history ≥2).
 *  - Fallback Op Income/Op Margin via les KPIs annuels Net Income +
 *    Total Revenue quand ratio approximation acceptable (gain dispo
 *    sur les stés sans split précis comme AMZN, BAC, certains FPI).
 *  - Pour les stés vraiment sans inputs ET sans KPIs computable, on flag
 *    `_super_kpi_unavailable` avec raison claire.
 *
 * Scope strict :
 *   READS  : src/data/v2-pipeline/<t>.json (read-only)
 *   READS  : src/data/v2-pipeline-enrich/<t>.json (kpis_supplementary + _super_kpi_inputs)
 *   WRITES : src/data/v2-pipeline-enrich/<t>.json kpis_supplementary uniquement
 *
 * Anti-invention :
 *   Aucune valeur n'est inventée. Toutes les valeurs viennent soit du
 *   pipeline.kpis (extracted SEC EDGAR), soit du _super_kpi_inputs (XBRL),
 *   soit calculées comme ratios directs de ces sources.
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
const NETINC_SHORTS = ["Net Income","Net income","Net earnings","Net Earnings","Profit","Profit for the year"];

function findKpi(kpis, shorts) {
  if (!Array.isArray(kpis)) return null;
  for (const s of shorts) {
    const k = kpis.find(k => k && k.short === s);
    if (k) return k;
  }
  return null;
}
function findKpiAnnualHist(kpis, shorts, minHist = 2) {
  if (!Array.isArray(kpis)) return null;
  for (const s of shorts) {
    const k = kpis.find(k => k && k.short === s);
    if (!k || !Array.isArray(k.history)) continue;
    // Reject quarterly with explicit period_type
    if (k.period_type === 'quarter') continue;
    if (k.history.length >= minHist) return k;
  }
  return null;
}

function reconstructAnnualFromQuarterly(quartersArr, isFlow = true) {
  if (!Array.isArray(quartersArr) || quartersArr.length === 0) return null;
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
    if (isFlow && isCalc && v < 0) v = -v;
    fyRec[`Q${qNum}`] = v;
  }
  const annual = [];
  for (const [fy, rec] of byFy.entries()) {
    if (isFlow) {
      if (rec.Q1 == null || rec.Q2 == null || rec.Q3 == null || rec.Q4 == null) continue;
      annual.push({ fy, v: rec.Q1 + rec.Q2 + rec.Q3 + rec.Q4 });
    } else {
      const vals = [rec.Q1, rec.Q2, rec.Q3, rec.Q4].filter(v => v != null);
      if (vals.length === 0) continue;
      annual.push({ fy, v: vals.reduce((a, b) => a + b, 0) / vals.length });
    }
  }
  annual.sort((a, b) => a.fy - b.fy);
  if (annual.length === 0) return null;
  const last5 = annual.slice(-5);
  return {
    value: last5[last5.length - 1].v,
    history: last5.map(x => x.v),
    fyYears: last5.map(x => x.fy),
  };
}

function calcYoy(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const prev = history[history.length - 2];
  const last = history[history.length - 1];
  if (!prev) return null;
  return ((last - prev) / Math.abs(prev)) * 100;
}
function formatYoyString(pct, isPct = false) {
  if (pct == null || !Number.isFinite(pct)) return "";
  const sign = pct >= 0 ? "+" : "";
  const suffix = isPct ? " pts" : " %";
  return `${sign}${pct.toFixed(1).replace('.', ',')}${suffix}`;
}

function loadEnrich(ticker) {
  const lp = path.join(ENRICH_DIR, `${ticker.toLowerCase()}.json`);
  const up = path.join(ENRICH_DIR, `${ticker.toUpperCase()}.json`);
  if (fs.existsSync(lp)) {
    try { return { data: JSON.parse(fs.readFileSync(lp, 'utf8')), filePath: lp }; } catch { return null; }
  }
  if (fs.existsSync(up)) {
    try { return { data: JSON.parse(fs.readFileSync(up, 'utf8')), filePath: up }; } catch { return null; }
  }
  return null;
}
function loadPipeline(ticker) {
  const up = path.join(PIPELINE_DIR, `${ticker.toUpperCase()}.json`);
  const lp = path.join(PIPELINE_DIR, `${ticker.toLowerCase()}.json`);
  if (fs.existsSync(up)) { try { return JSON.parse(fs.readFileSync(up, 'utf8')); } catch { return null; } }
  if (fs.existsSync(lp)) { try { return JSON.parse(fs.readFileSync(lp, 'utf8')); } catch { return null; } }
  return null;
}

const tickers = JSON.parse(fs.readFileSync(TICKERS_FILE, 'utf8')).tickers;
console.log(`Loaded ${tickers.length} tickers V1.9.5`);

let processed = 0, updated = 0;
let addedRevenue = 0, addedOpIncome = 0, addedOpMargin = 0, addedCapex = 0;
let skippedNoFiles = 0;
let flaggedUnavailable = 0;
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

for (const ticker of tickers) {
  processed++;
  const pipeline = loadPipeline(ticker);
  const enrichLoad = loadEnrich(ticker);
  if (!pipeline || !enrichLoad) { skippedNoFiles++; continue; }
  const enrich = enrichLoad.data;
  const enrichPath = enrichLoad.filePath;

  const allKpis = [
    ...(Array.isArray(pipeline.kpis) ? pipeline.kpis : []),
    ...(Array.isArray(enrich.kpis) ? enrich.kpis : []),
    ...(Array.isArray(enrich.kpis_supplementary) ? enrich.kpis_supplementary : []),
  ];

  const skInputs = enrich._super_kpi_inputs;
  const skIsArray = skInputs && Array.isArray(skInputs.revenue_q);
  const skIsScalar = skInputs && typeof skInputs.revenue_q === 'number';

  // Existing detection (any format)
  const hasRevenue = !!findKpi(allKpis, REVENUE_SHORTS);
  const revenueKpi = findKpi(allKpis, REVENUE_SHORTS); // any
  const revenueAnnual = findKpiAnnualHist(allKpis, REVENUE_SHORTS, 2);
  const hasMargin = !!findKpi(allKpis, MARGIN_SHORTS);
  const hasOpIncome = !!findKpi(allKpis, OPINC_SHORTS);
  const hasCapex = !!findKpi(allKpis, CAPEX_SHORTS);
  const netIncomeAnnual = findKpiAnnualHist(allKpis, NETINC_SHORTS, 2);

  const supplementary = Array.isArray(enrich.kpis_supplementary) ? [...enrich.kpis_supplementary] : [];
  const existingShorts = new Set(supplementary.map(k => k && k.short).filter(Boolean));
  for (const k of allKpis) {
    if (k && k.short) existingShorts.add(k.short);
  }
  let touched = false;

  // ── Revenue synthèse ────────────────────────────────────────────
  if (!hasRevenue && skIsArray) {
    const recon = reconstructAnnualFromQuarterly(skInputs.revenue_q, true);
    if (recon && recon.history.length >= 2 && !existingShorts.has("Revenue")) {
      const yoy = calcYoy(recon.history);
      supplementary.push({
        short: "Revenue",
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
      });
      existingShorts.add("Revenue");
      addedRevenue++;
      touched = true;
    }
  }

  // ── Op Income synthèse (array) ──────────────────────────────────
  if (!hasOpIncome && skIsArray && Array.isArray(skInputs.op_income_q)) {
    const recon = reconstructAnnualFromQuarterly(skInputs.op_income_q, true);
    if (recon && recon.history.length >= 2 && !existingShorts.has("Op Income")) {
      const yoy = calcYoy(recon.history);
      supplementary.push({
        short: "Op Income",
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
      existingShorts.add("Op Income");
      addedOpIncome++;
      touched = true;
    }
  }

  // ── Op Margin synthèse (array) ─────────────────────────────────
  if (!hasMargin && skIsArray) {
    let marginRecon = null;
    if (Array.isArray(skInputs.op_margin_q_pct) && skInputs.op_margin_q_pct.length >= 4) {
      marginRecon = reconstructAnnualFromQuarterly(skInputs.op_margin_q_pct, false);
    }
    if (!marginRecon && Array.isArray(skInputs.revenue_q) && Array.isArray(skInputs.op_income_q)) {
      const rev = reconstructAnnualFromQuarterly(skInputs.revenue_q, true);
      const op = reconstructAnnualFromQuarterly(skInputs.op_income_q, true);
      if (rev && op && rev.history.length === op.history.length) {
        const mhist = rev.history.map((r, i) => r === 0 ? 0 : (op.history[i] / r) * 100);
        if (mhist.length >= 2) marginRecon = { value: mhist[mhist.length - 1], history: mhist, fyYears: rev.fyYears };
      }
    }
    if (marginRecon && marginRecon.history.length >= 2 && !existingShorts.has("Op Margin")) {
      const yoy = calcYoy(marginRecon.history);
      supplementary.push({
        short: "Op Margin",
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
      existingShorts.add("Op Margin");
      addedOpMargin++;
      touched = true;
    }
  }

  // ── Format scalaire : utiliser Revenue annuel existant + op_margin scalaire
  if (skIsScalar && !hasMargin && typeof skInputs.op_margin_q_pct === 'number' && revenueAnnual) {
    // We have an annual Revenue series in pipeline + a scalar op margin from
    // last quarter. We synthesize Op Margin by applying the scalar to the
    // history flat (only the last value is precise). We use the scalar as
    // current FY proxy and keep prior years NULL-equivalent by using the
    // KPI's existing yoy pattern — but that's invention.
    //
    // Honest approach: synth single-point Op Margin = scalar, history=[scalar],
    // length=1 which super-kpi won't accept (needs ≥2). So instead we try to
    // infer history from prior op_margin via Net Income / Revenue ratio
    // (proxy "net margin" not "op margin", but close enough as approximation).
    if (netIncomeAnnual && netIncomeAnnual.history.length >= 2 && revenueAnnual.history.length >= 2) {
      const niH = netIncomeAnnual.history;
      const revH = revenueAnnual.history;
      const minLen = Math.min(niH.length, revH.length);
      const ratio = [];
      for (let i = 0; i < minLen; i++) {
        const r = revH[revH.length - minLen + i];
        const n = niH[niH.length - minLen + i];
        if (typeof r === 'number' && typeof n === 'number' && r > 0) ratio.push((n / r) * 100);
      }
      if (ratio.length >= 2 && !existingShorts.has("Net Margin")) {
        const yoy = calcYoy(ratio);
        supplementary.push({
          short: "Net Margin",
          name_fr: "Marge nette",
          name_en: "Net Margin",
          explanation: "Marge nette = Net Income / Revenue (proxy de profitabilité quand Op Margin indisponible).",
          value: parseFloat(ratio[ratio.length - 1].toFixed(2)),
          unit: "%",
          yoy: formatYoyString(yoy, true),
          type: "Structurel",
          nature: "Structurel",
          comparable: "Yes",
          compare_key: "net_margin",
          signal: "",
          description: "",
          history: ratio.map(v => parseFloat(v.toFixed(2))),
          period_type: "year",
          _source: "super_kpi_inputs_scalar_fallback_netmargin",
        });
        existingShorts.add("Net Margin");
        addedOpMargin++;
        touched = true;
      }
    }
  }

  if (touched) {
    enrich.kpis_supplementary = supplementary;
    enrich._super_kpi_virtuals_filled_at = new Date().toISOString();
    if (!DRY_RUN) fs.writeFileSync(enrichPath, JSON.stringify(enrich, null, 2));
    updated++;
    if (VERBOSE) console.log(`UPDATED ${ticker}`);
  }

  // Vérifier final completeness pour eventuel flag unavailable
  const finalHasRevenue = hasRevenue || existingShorts.has("Revenue");
  const finalHasMargin = hasMargin || existingShorts.has("Op Margin") || existingShorts.has("Net Margin");
  const finalHasOpInc = hasOpIncome || existingShorts.has("Op Income");

  if (!finalHasRevenue || (!finalHasMargin && !finalHasOpInc)) {
    // Truly impossible without more data sources
    if (!enrich._super_kpi_unavailable) {
      enrich._super_kpi_unavailable = {
        reason: "no_revenue_or_no_profitability_kpi_after_synthesis",
        checked_at: new Date().toISOString(),
        missing: {
          revenue: !finalHasRevenue,
          margin_or_op_income: !finalHasMargin && !finalHasOpInc,
          capex: !hasCapex,
          super_kpi_inputs_format: skIsArray ? 'array' : skIsScalar ? 'scalar' : 'none',
        },
      };
      if (!DRY_RUN) fs.writeFileSync(enrichPath, JSON.stringify(enrich, null, 2));
      flaggedUnavailable++;
    }
  } else {
    // Remove unavailable flag if it was set and now we can compute
    if (enrich._super_kpi_unavailable) {
      delete enrich._super_kpi_unavailable;
      if (!DRY_RUN) fs.writeFileSync(enrichPath, JSON.stringify(enrich, null, 2));
    }
  }
}

console.log(`---`);
console.log(`Processed: ${processed}`);
console.log(`Updated (added virtuals): ${updated}`);
console.log(`  + Revenue: ${addedRevenue}`);
console.log(`  + Op Income: ${addedOpIncome}`);
console.log(`  + Op Margin / Net Margin proxy: ${addedOpMargin}`);
console.log(`Flagged _super_kpi_unavailable: ${flaggedUnavailable}`);
console.log(`Skipped (no files): ${skippedNoFiles}`);
if (DRY_RUN) console.log('DRY RUN - no files modified');
