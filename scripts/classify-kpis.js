#!/usr/bin/env node
/**
 * Classify every KPI of every company in src/data/v2-pipeline/_merged.json
 * as either 'generic' (in src/data/kpi-generic-library.json) or 'specific'.
 *
 * Mirrors the logic of `isGenericKpi()` from `src/lib/kpi-generic.ts` so the
 * classification stays coherent with the UI helper.
 *
 * Outputs (idempotent):
 *   - src/data/kpi-classification.json    : full taxonomy + stats by_ticker
 *   - src/data/kpi-critical-stes.json     : companies with 0 specific KPI
 *
 * Usage: node scripts/classify-kpis.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MERGED_PATH = path.join(ROOT, "src/data/v2-pipeline/_merged.json");
const LIB_PATH = path.join(ROOT, "src/data/kpi-generic-library.json");
const OUT_CLASSIFICATION = path.join(ROOT, "src/data/kpi-classification.json");
const OUT_CRITICAL = path.join(ROOT, "src/data/kpi-critical-stes.json");

function normalize(s) {
  if (typeof s !== "string") return "";
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

const GENERIC_LIB = JSON.parse(fs.readFileSync(LIB_PATH, "utf8"));
const GENERIC_SHORTS = new Set(GENERIC_LIB.map((g) => normalize(g.short)));

/**
 * Mirror of isGenericKpi() in src/lib/kpi-generic.ts.
 * Keep in sync with that helper.
 */
function isGenericKpi(short) {
  if (!short) return false;
  const n = normalize(short);
  if (GENERIC_SHORTS.has(n)) return true;
  for (const g of GENERIC_SHORTS) {
    if (n === g) return true;
    if (g === "total revenue" && n === "revenue") return true;
    if (
      g === "operating income" &&
      (n === "op income" || n === "operating profit" || n === "ebit")
    )
      return true;
    if (
      g === "operating margin" &&
      (n === "op margin" || n === "operating margin %")
    )
      return true;
    if (g === "net income" && n === "net profit") return true;
    if (g === "net margin" && n === "net margin %") return true;
    if (g === "gross margin" && n === "gross margin %") return true;
    if (
      g === "free cash flow" &&
      (n === "fcf" || n === "free cashflow")
    )
      return true;
    if (
      g === "operating cash flow" &&
      (n === "ocf" || n === "operating cashflow")
    )
      return true;
    if (
      g === "eps" &&
      (n === "earnings per share" ||
        n === "eps diluted" ||
        n === "diluted eps")
    )
      return true;
    if (
      g === "dps" &&
      (n === "dividend per share" || n === "dividende par action")
    )
      return true;
    if (
      g === "cap return" &&
      (n === "capital return" || n === "capital returned")
    )
      return true;
    if (
      g === "buybacks" &&
      (n === "share buybacks" || n === "stock buybacks")
    )
      return true;
    if (
      g === "r&d" &&
      (n === "research and development" || n === "rd expense")
    )
      return true;
    if (
      g === "capex" &&
      (n === "capital expenditure" || n === "capital expenditures")
    )
      return true;
    if (
      g === "headcount" &&
      (n === "employees" || n === "employés" || n === "effectif")
    )
      return true;
    if (g === "total assets" && n === "assets") return true;
    if (g === "total debt" && n === "debt") return true;
    if (g === "net debt" && n === "netdebt") return true;
    if (
      g === "leverage ratio" &&
      (n === "debt to ebitda" || n === "leverage")
    )
      return true;
    if (
      g === "cash & equivalents" &&
      (n === "cash" || n === "cash and equivalents")
    )
      return true;
    if (g === "roe" && n === "return on equity") return true;
    if (g === "roic" && n === "return on invested capital") return true;
    if (g === "p/e ratio" && (n === "pe ratio" || n === "p/e")) return true;
    if (
      g === "market cap" &&
      (n === "market capitalization" || n === "market cap usd")
    )
      return true;
    if (g === "shares outstanding" && n === "shares") return true;
    if (
      g === "tax rate" &&
      (n === "effective tax rate" || n === "tax")
    )
      return true;
    if (g === "payout ratio" && n === "payout") return true;
  }
  return false;
}

function main() {
  console.log(`[classify-kpis] loading ${MERGED_PATH} ...`);
  const raw = fs.readFileSync(MERGED_PATH, "utf8");
  const merged = JSON.parse(raw);

  // merged can be either { TICKER: {...}, ... } or { companies: [...] } or array.
  // Detect shape.
  let entries;
  if (Array.isArray(merged)) {
    entries = merged.map((c) => [c.ticker || c.symbol || c.id || "?", c]);
  } else if (merged && typeof merged === "object") {
    if (Array.isArray(merged.companies)) {
      entries = merged.companies.map((c) => [
        c.ticker || c.symbol || c.id || "?",
        c,
      ]);
    } else {
      entries = Object.entries(merged);
    }
  } else {
    throw new Error("Unrecognized _merged.json shape");
  }

  console.log(`[classify-kpis] companies loaded: ${entries.length}`);

  const by_ticker = {};
  const critical = [];
  let total_kpis = 0;
  let specific_count = 0;
  let generic_count = 0;
  let stes_with_only_generic = 0;
  let stes_zero_kpi_visible = 0;
  let stes_zero_kpi_extracted = 0;
  let stes_zero_specific = 0;
  let stes_1_3_specific = 0;
  let stes_ge_4_specific = 0;
  const critical_by_sector = {};

  for (const [ticker, company] of entries) {
    const kpis = Array.isArray(company?.kpis) ? company.kpis : [];
    const specific = [];
    const generic = [];

    for (const k of kpis) {
      if (!k || typeof k !== "object") continue;
      const short = k.short;
      if (!short || typeof short !== "string") continue;
      total_kpis += 1;
      if (isGenericKpi(short)) {
        generic.push(short);
        generic_count += 1;
      } else {
        specific.push(short);
        specific_count += 1;
      }
    }

    by_ticker[ticker] = { specific, generic };

    if (kpis.length === 0) stes_zero_kpi_extracted += 1;
    if (specific.length === 0 && generic.length > 0) {
      stes_with_only_generic += 1;
      stes_zero_kpi_visible += 1; // visible = specific only by new rule
    }
    if (specific.length === 0) stes_zero_specific += 1;
    else if (specific.length <= 3) stes_1_3_specific += 1;
    else stes_ge_4_specific += 1;

    if (specific.length === 0 && generic.length > 0) {
      const sector =
        company?.sector || company?.gics_sector || company?.industry || "Unknown";
      const subsector =
        company?.subsector ||
        company?.sub_sector ||
        company?.gics_subsector ||
        company?.industry_group ||
        "";
      critical.push({
        ticker,
        name: company?.name || company?.company_name || "",
        country: company?.country || company?.geography || "",
        sector,
        subsector,
        kpis_extracted: generic,
        all_generic: true,
      });
      critical_by_sector[sector] = (critical_by_sector[sector] || 0) + 1;
    }
  }

  const generated_at = new Date().toISOString();
  const classification = {
    _generated_at: generated_at,
    _stats: {
      total_companies: entries.length,
      total_kpis,
      specific_count,
      generic_count,
      stes_with_only_generic,
      stes_zero_kpi_visible,
      stes_zero_kpi_extracted,
      stes_zero_specific,
      stes_1_3_specific,
      stes_ge_4_specific,
    },
    by_ticker,
  };

  const sorted_sectors = Object.entries(critical_by_sector)
    .sort((a, b) => b[1] - a[1])
    .map(([sector, count]) => ({ sector, count }));

  const critical_out = {
    _generated_at: generated_at,
    _count: critical.length,
    _description:
      "Stés qui auront 0 KPI affichable après filtrage générique. Re-extraction CONV-DATA priorité 0.",
    _top_sectors: sorted_sectors.slice(0, 10),
    tickers: critical,
  };

  fs.writeFileSync(OUT_CLASSIFICATION, JSON.stringify(classification, null, 2));
  fs.writeFileSync(OUT_CRITICAL, JSON.stringify(critical_out, null, 2));

  console.log(`[classify-kpis] wrote ${OUT_CLASSIFICATION}`);
  console.log(`[classify-kpis] wrote ${OUT_CRITICAL}`);
  console.log("");
  console.log("=== STATS ===");
  console.log(`Total companies         : ${entries.length}`);
  console.log(`Total KPIs              : ${total_kpis}`);
  console.log(`  generic               : ${generic_count}`);
  console.log(`  specific              : ${specific_count}`);
  console.log("");
  console.log(`Zero KPI extracted      : ${stes_zero_kpi_extracted}`);
  console.log(`Zero specific KPI       : ${stes_zero_specific}  <- priority 0`);
  console.log(`1-3 specific KPI        : ${stes_1_3_specific}   <- priority 1`);
  console.log(`>=4 specific KPI        : ${stes_ge_4_specific}  <- OK`);
  console.log(`Stes only generic       : ${stes_with_only_generic}`);
  console.log("");
  console.log("Top 10 sectors with critical stes (specific=0, generic>0):");
  for (const { sector, count } of sorted_sectors.slice(0, 10)) {
    console.log(`  ${sector.padEnd(40)} ${count}`);
  }
}

main();
