/**
 * Audit v1-9 publishable criteria + regen publishable.json
 *
 * Critères relaxés (Yann 20 mai) :
 * - hero_kpi spécifique (pas générique Revenue/EBITDA/EPS/Net Income/Op Margin/FCF/Headcount/R&D/Capex/ROE)
 * - hero history ≥ 3 points
 * - 3+ KPI spécifiques (kpis_story.length ≥ 3 OU spec kpis ≥ 3)
 * - company_description ≥ 100 chars
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const COMPLETE_DIR = path.join(ROOT, "src/data/v1-9-complete");
const UNIVERSE = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/v1-9-universe.json"), "utf-8"));

const GENERIC_HERO = new Set([
  "Revenue", "EBITDA", "EPS", "Net Income", "Op Margin", "Operating Margin",
  "Free Cash Flow", "FCF", "Headcount", "Employees", "R&D", "Research & Development",
  "Capex", "Capital Expenditure", "ROE", "ROIC", "Gross Margin", "Gross Profit",
  "Total Revenue", "Total Revenues", "Net Revenue",
]);

function isGenericHero(name) {
  if (!name) return true;
  const n = String(name).trim();
  return [...GENERIC_HERO].some((g) => n.toLowerCase() === g.toLowerCase() || n.toLowerCase().startsWith(g.toLowerCase() + " "));
}

const publishable = [];
const unpublishable = [];

for (const entry of UNIVERSE) {
  const T = entry.ticker.toUpperCase();
  const p = path.join(COMPLETE_DIR, `${T}.json`);
  if (!fs.existsSync(p)) {
    unpublishable.push({ ticker: T, reason: "no_complete_file" });
    continue;
  }
  const d = JSON.parse(fs.readFileSync(p, "utf-8"));
  // Sub-agent #141 (CONV-CONCEPTS, 21 mai 2026) : load hero_kpi_override from
  // v2-pipeline-enrich/<lower>.hero_name_fr.json. Mirror logic of
  // scripts/audit-v1-9-pre-publication.js + src/lib/company-core/load-company.ts.
  // Sans ce merge, les fix sub-agent #141 (24 stés absentes) restent invisibles
  // au filtre publishable.
  let hero = d.hero_kpi;
  const heroFrPath = path.join(ROOT, "src/data/v2-pipeline-enrich", `${T.toLowerCase()}.hero_name_fr.json`);
  if (fs.existsSync(heroFrPath)) {
    try {
      const heroFr = JSON.parse(fs.readFileSync(heroFrPath, "utf-8"));
      if (heroFr && typeof heroFr.hero_kpi_override === "string" && heroFr.hero_kpi_override) {
        hero = heroFr.hero_kpi_override;
      }
    } catch {}
  }
  const heroSpec = hero && !isGenericHero(hero);
  const heroKpi = (d.kpis || []).find((k) => k && (k.short === hero || k.name_fr === hero || k.name_en === hero));
  const heroHistOk = heroKpi && Array.isArray(heroKpi.history) && heroKpi.history.length >= 3;
  // Check specific KPIs from v2-pipeline-specific-kpis (Yann 20 mai cascade)
  const specFile = path.join(ROOT, "src/data/v2-pipeline-specific-kpis", `${T.toLowerCase()}.json`);
  let specFromFile = 0;
  if (fs.existsSync(specFile)) {
    try {
      const sd = JSON.parse(fs.readFileSync(specFile, "utf-8"));
      specFromFile = Array.isArray(sd.kpis) ? sd.kpis.filter(k => k && k.short && !isGenericHero(k.short)).length : 0;
    } catch {}
  }
  const specKpis = (d.kpis || []).filter((k) => k && k._specific_to && !isGenericHero(k.short));
  const kpisStory = (d.kpis_story || []).filter((k) => k && k.short);
  const nonGenericKpis = (d.kpis || []).filter(k => k && k.short && !isGenericHero(k.short)).length;
  const specCount = Math.max(specKpis.length, kpisStory.length, specFromFile, nonGenericKpis);
  const descOk = typeof d.company_description === "string" && d.company_description.length >= 100;

  const checks = {
    hero_spec: heroSpec,
    hero_hist: heroHistOk,
    spec_3plus: specCount >= 3,
    desc_100: descOk,
  };
  const okCount = Object.values(checks).filter(Boolean).length;
  if (okCount === 4) {
    publishable.push(T);
  } else {
    const missing = Object.entries(checks).filter(([_, v]) => !v).map(([k]) => k);
    unpublishable.push({ ticker: T, missing, hero, specCount, descLen: typeof d.company_description === "string" ? d.company_description.length : 0 });
  }
}

console.log(`Publishable : ${publishable.length} / ${UNIVERSE.length}`);
console.log(`Unpublishable : ${unpublishable.length}`);
console.log(`\nTop 5 unpublishable reasons:`);
const reasonCounts = {};
for (const u of unpublishable) {
  const key = (u.missing || ["no_file"]).join(",");
  reasonCounts[key] = (reasonCounts[key] || 0) + 1;
}
for (const [k, v] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  console.log(`  ${k}: ${v}`);
}

// Write outputs
fs.writeFileSync(
  path.join(ROOT, "src/data/v1-9-publishable.json"),
  JSON.stringify({ generated_at: new Date().toISOString(), count: publishable.length, tickers: publishable.sort() }, null, 2),
);
fs.writeFileSync(
  path.join(ROOT, "src/data/v1-9-blocked.json"),
  JSON.stringify({ generated_at: new Date().toISOString(), count: unpublishable.length, blocked: unpublishable }, null, 2),
);
console.log(`\nWrote src/data/v1-9-publishable.json (${publishable.length}) + v1-9-blocked.json (${unpublishable.length})`);
