/**
 * Build src/data/v1-9-complete/<ticker>.json
 *
 * Fusionne v2-pipeline + enrich + specific-kpis en UN fichier par sté
 * qui contient TOUTE l'info nécessaire pour remplir une page sté V1.9.
 *
 * Audit en parallèle : pour chaque sté, identifie les blocs MANQUANTS
 * (gov/seg/geo/risks/ai_pos/market_positions) → écrit dans
 * src/data/v1-9-missing-blocks.json pour dispatch agents.
 *
 * Yann 19 mai 2026 ~17h — alimentation directe V1.9 sans intermédiaire.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const V19_UNIVERSE = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/v1-9-universe.json"), "utf-8"));
const MERGED = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/v2-pipeline/_merged.json"), "utf-8"));

const OUT_DIR = path.join(ROOT, "src/data/v1-9-complete");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function readJsonOrNull(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function loadAllEnrichFor(ticker) {
  const lower = ticker.toLowerCase();
  const dir = path.join(ROOT, "src/data/v2-pipeline-enrich");
  const out = {};
  // Main enrich
  out.main = readJsonOrNull(path.join(dir, `${lower}.json`));
  // Side files
  for (const suffix of ["ranks", "events", "ai-pos", "tam", "description", "quarterly-history"]) {
    out[suffix] = readJsonOrNull(path.join(dir, `${lower}.${suffix}.json`));
  }
  return out;
}

const stats = {
  total: 0,
  written: 0,
  missing_blocks: { governance: 0, segment: 0, geography: 0, risks: 0, ai_positioning: 0, market_positions: 0, events: 0 },
};
const missingByTicker = {};

for (const entry of V19_UNIVERSE) {
  stats.total++;
  const ticker = entry.ticker;
  const T = ticker.toUpperCase();
  const v2 = MERGED[ticker] || MERGED[T] || MERGED[ticker.toLowerCase()];
  if (!v2) continue;
  const enrich = loadAllEnrichFor(ticker);
  const specific = readJsonOrNull(path.join(ROOT, "src/data/v2-pipeline-specific-kpis", `${ticker.toLowerCase()}.json`));

  // Build consolidated
  const complete = {
    ticker: T,
    name: v2.name || entry.name,
    sector: v2.sector,
    subsector: v2.subsector,
    country: v2.country || entry.country,
    sources: entry.sources,
    founded: v2.founded,
    ipo: v2.ipo,
    tagline: v2.tagline,
    hero_kpi: v2.hero_kpi,
    hero_kpi_rationale: v2.hero_kpi_rationale,
    kpis: [
      ...(Array.isArray(v2.kpis) ? v2.kpis : []),
      ...(Array.isArray(specific?.kpis) ? specific.kpis : []),
    ],
    kpis_story: Array.isArray(specific?.kpis_story) ? specific.kpis_story : [],
    governance: v2.governance || enrich.main?.governance || null,
    revenue_by_segment: v2.revenue_by_segment || enrich.main?.revenue_by_segment || null,
    revenue_by_geography: v2.revenue_by_geography || enrich.main?.revenue_by_geography || null,
    risks: Array.isArray(v2.risks) && v2.risks.length > 0 ? v2.risks : (Array.isArray(enrich.main?.risks) ? enrich.main.risks : []),
    ai_positioning: v2.ai_positioning || enrich.main?.ai_positioning || enrich["ai-pos"] || null,
    market_positions: v2.market_positions || enrich.tam?.market_positions || [],
    events: Array.isArray(v2.events) ? v2.events : (enrich.events?.events || []),
    ranks: v2.ranks || enrich.ranks?.ranks || {},
    latest_filing: v2.latest_filing || null,
    next_earnings_date: v2.next_earnings_date || null,
    publication_date: v2.publication_date || null,
    company_description: v2.company_description || enrich.description?.simple || null,
    _specific_fit_for_site: specific?._fit_for_site,
    _built_at: new Date().toISOString(),
  };

  // Audit missing blocks
  const missing = [];
  if (!complete.governance) { missing.push("governance"); stats.missing_blocks.governance++; }
  if (!complete.revenue_by_segment || (Array.isArray(complete.revenue_by_segment?.slices) && complete.revenue_by_segment.slices.length === 0)) {
    missing.push("revenue_by_segment"); stats.missing_blocks.segment++;
  }
  if (!complete.revenue_by_geography || (Array.isArray(complete.revenue_by_geography?.slices) && complete.revenue_by_geography.slices.length === 0)) {
    missing.push("revenue_by_geography"); stats.missing_blocks.geography++;
  }
  if (!Array.isArray(complete.risks) || complete.risks.length === 0) { missing.push("risks"); stats.missing_blocks.risks++; }
  if (!complete.ai_positioning) { missing.push("ai_positioning"); stats.missing_blocks.ai_positioning++; }
  if (!Array.isArray(complete.events) || complete.events.length === 0) { missing.push("events"); stats.missing_blocks.events++; }

  if (missing.length > 0) missingByTicker[T] = missing;
  complete._missing_blocks = missing;

  fs.writeFileSync(path.join(OUT_DIR, `${T}.json`), JSON.stringify(complete, null, 2));
  stats.written++;
}

fs.writeFileSync(path.join(ROOT, "src/data/v1-9-missing-blocks.json"), JSON.stringify({ generated_at: new Date().toISOString(), stats, missingByTicker }, null, 2));

console.log("Build v1-9-complete terminé :");
console.log("  Stés processed :", stats.total);
console.log("  Fichiers écrits :", stats.written);
console.log("  Blocs manquants par catégorie :");
for (const [k, v] of Object.entries(stats.missing_blocks)) console.log("    " + k + ": " + v);
