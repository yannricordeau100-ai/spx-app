/**
 * Audit v1-9 publishable STRICT 6/6 criteria (Yann 21 mai 2026)
 *
 * Vs audit 4/4 ancien :
 *  + segments ≥ 2 slices (NOUVEAU, rédhibitoire toutes stés)
 *  + geography ≥ 2 slices (NOUVEAU, rédhibitoire toutes stés)
 *  + risks ≥ 3 (rédhibitoire US ONLY, non rédhibitoire EU)
 *
 * Critères 6/6 :
 *  1. hero_spec       : hero_kpi spécifique (pas générique)
 *  2. hero_hist       : hero history ≥ 3 points
 *  3. spec_3plus      : 3+ KPIs spécifiques
 *  4. desc_100        : company_description ≥ 100 chars
 *  5. segments_2plus  : revenue_by_segment.slices ≥ 2
 *  6. geography_2plus : revenue_by_geography.slices ≥ 2
 *
 * Bonus US :
 *  7. risks_3plus_us  : si country == "US", risks ≥ 3
 *
 * Sources : v1-9-complete/<T>.json (déjà mergé) puis fallback v2-pipeline/<t>.json
 * Output  : v1-9-publishable-strict.json + v1-9-missing-by-criterion.json (read-only)
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const COMPLETE_DIR = path.join(ROOT, "src/data/v1-9-complete");
const V2_DIR = path.join(ROOT, "src/data/v2-pipeline");
const UNIVERSE = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/data/v1-9-universe.json"), "utf-8"),
);

const GENERIC_HERO = new Set([
  "Revenue", "EBITDA", "EPS", "Net Income", "Op Margin", "Operating Margin",
  "Free Cash Flow", "FCF", "Headcount", "Employees", "R&D", "Research & Development",
  "Capex", "Capital Expenditure", "ROE", "ROIC", "Gross Margin", "Gross Profit",
  "Total Revenue", "Total Revenues", "Net Revenue",
]);

function isGenericHero(name) {
  if (!name) return true;
  const n = String(name).trim();
  return [...GENERIC_HERO].some(
    (g) =>
      n.toLowerCase() === g.toLowerCase() ||
      n.toLowerCase().startsWith(g.toLowerCase() + " "),
  );
}

function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function getSlices(block) {
  if (!block || typeof block !== "object") return [];
  if (Array.isArray(block.slices)) return block.slices.filter(Boolean);
  return [];
}

const publishable = [];
const blocked = [];
const missingByCriterion = {
  hero_spec: [],
  hero_hist: [],
  spec_3plus: [],
  desc_100: [],
  segments_2plus: [],
  geography_2plus: [],
  risks_3plus_us: [],
  no_complete_file: [],
};

for (const entry of UNIVERSE) {
  const T = entry.ticker.toUpperCase();
  const tLower = T.toLowerCase();

  // Source primaire : v1-9-complete
  const completePath = path.join(COMPLETE_DIR, `${T}.json`);
  const d = readJsonSafe(completePath);

  // Fallback v2-pipeline pour ce qui manque
  const v2Path = path.join(V2_DIR, `${tLower}.json`);
  const v2 = readJsonSafe(v2Path);

  if (!d && !v2) {
    blocked.push({ ticker: T, reason: "no_complete_file" });
    missingByCriterion.no_complete_file.push(T);
    continue;
  }

  const src = d || v2 || {};
  const srcAlt = v2 || {};

  // Country
  const country = src.country || srcAlt.country || null;

  // Hero
  const hero = src.hero_kpi || srcAlt.hero_kpi;
  const heroSpec = !!hero && !isGenericHero(hero);

  // Hero history
  const kpis = Array.isArray(src.kpis) ? src.kpis : [];
  const heroKpi = kpis.find(
    (k) => k && (k.short === hero || k.name_fr === hero || k.name_en === hero),
  );
  const heroHistOk =
    heroKpi && Array.isArray(heroKpi.history) && heroKpi.history.length >= 3;

  // Spec KPIs count (multi-source cascade comme l'audit existant)
  const specFile = path.join(
    ROOT,
    "src/data/v2-pipeline-specific-kpis",
    `${tLower}.json`,
  );
  let specFromFile = 0;
  const sd = readJsonSafe(specFile);
  if (sd && Array.isArray(sd.kpis)) {
    specFromFile = sd.kpis.filter(
      (k) => k && k.short && !isGenericHero(k.short),
    ).length;
  }
  const specKpis = kpis.filter(
    (k) => k && k._specific_to && !isGenericHero(k.short),
  );
  const kpisStory = (src.kpis_story || []).filter((k) => k && k.short);
  const nonGenericKpis = kpis.filter(
    (k) => k && k.short && !isGenericHero(k.short),
  ).length;
  const specCount = Math.max(
    specKpis.length,
    kpisStory.length,
    specFromFile,
    nonGenericKpis,
  );

  // Description
  const desc = src.company_description || srcAlt.company_description || "";
  const descOk = typeof desc === "string" && desc.length >= 100;

  // Segments (NEW) - check both sources
  const segSlices =
    getSlices(src.revenue_by_segment).length ||
    getSlices(srcAlt.revenue_by_segment).length;
  const segmentsOk = segSlices >= 2;

  // Geography (NEW)
  const geoSlices =
    getSlices(src.revenue_by_geography).length ||
    getSlices(srcAlt.revenue_by_geography).length;
  const geographyOk = geoSlices >= 2;

  // Risks (US only, rédhibitoire)
  const risks = Array.isArray(src.risks)
    ? src.risks
    : Array.isArray(srcAlt.risks)
      ? srcAlt.risks
      : [];
  const isUS = country === "US";
  const risksOkUs = isUS ? risks.length >= 3 : true;

  const checks = {
    hero_spec: heroSpec,
    hero_hist: heroHistOk,
    spec_3plus: specCount >= 3,
    desc_100: descOk,
    segments_2plus: segmentsOk,
    geography_2plus: geographyOk,
  };

  // Risks_us is conditional : only enforced if US
  const risksCheck = isUS ? risksOkUs : true;

  const baseOk = Object.values(checks).every(Boolean);
  const allOk = baseOk && risksCheck;

  // Track per-criterion misses
  const missing = [];
  for (const [k, v] of Object.entries(checks)) {
    if (!v) {
      missing.push(k);
      missingByCriterion[k].push(T);
    }
  }
  if (isUS && !risksOkUs) {
    missing.push("risks_3plus_us");
    missingByCriterion.risks_3plus_us.push(T);
  }

  if (allOk) {
    publishable.push(T);
  } else {
    blocked.push({
      ticker: T,
      country,
      missing,
      hero,
      specCount,
      descLen: desc.length,
      segSlices,
      geoSlices,
      risksLen: risks.length,
    });
  }
}

// Top 20 stés "à backfill rapide" = 1 seul critère manquant
const oneMiss = blocked
  .filter((b) => Array.isArray(b.missing) && b.missing.length === 1)
  .sort((a, b) => a.ticker.localeCompare(b.ticker));

const top20Backfill = oneMiss.slice(0, 20);

// Console report
console.log("");
console.log("=== Audit v1-9 STRICT 6/6 (+ risks US) ===");
console.log(`Univers     : ${UNIVERSE.length}`);
console.log(`Publishable : ${publishable.length} (ancien 4/4 = 775)`);
console.log(`Blocked     : ${blocked.length}`);
console.log("");
console.log("Counts par critère manquant (parmi blocked) :");
for (const [k, list] of Object.entries(missingByCriterion)) {
  console.log(`  ${k.padEnd(20)} : ${list.length}`);
}
console.log("");
console.log("Distribution N missing critères dans blocked :");
const distMissing = {};
for (const b of blocked) {
  const n = (b.missing || []).length || 99;
  distMissing[n] = (distMissing[n] || 0) + 1;
}
for (const [n, c] of Object.entries(distMissing).sort(
  (a, b) => Number(a[0]) - Number(b[0]),
)) {
  console.log(`  ${n} critère(s) manquant(s) : ${c} stés`);
}
console.log("");
console.log("Top 20 stés à backfill rapide (1 seul critère manquant) :");
for (const b of top20Backfill) {
  console.log(`  ${b.ticker.padEnd(12)} [${b.country || "??"}]  missing: ${b.missing.join(", ")}`);
}

// Write outputs
const strictOut = {
  generated_at: new Date().toISOString(),
  criteria: [
    "hero_spec",
    "hero_hist",
    "spec_3plus",
    "desc_100",
    "segments_2plus",
    "geography_2plus",
    "risks_3plus_us (US only)",
  ],
  count: publishable.length,
  previous_4_4_count: 775,
  delta: publishable.length - 775,
  tickers: publishable.sort(),
};
fs.writeFileSync(
  path.join(ROOT, "src/data/v1-9-publishable-strict.json"),
  JSON.stringify(strictOut, null, 2),
);

const missingOut = {
  generated_at: new Date().toISOString(),
  criteria_counts: Object.fromEntries(
    Object.entries(missingByCriterion).map(([k, v]) => [k, v.length]),
  ),
  missing_by_criterion: missingByCriterion,
  blocked_details: blocked,
  top20_backfill_1_missing: top20Backfill,
};
fs.writeFileSync(
  path.join(ROOT, "src/data/v1-9-missing-by-criterion.json"),
  JSON.stringify(missingOut, null, 2),
);

console.log("");
console.log(`Wrote src/data/v1-9-publishable-strict.json (${publishable.length})`);
console.log(`Wrote src/data/v1-9-missing-by-criterion.json (${blocked.length} blocked)`);
