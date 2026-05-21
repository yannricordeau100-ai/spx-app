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
const ENRICH_DIR = path.join(ROOT, "src/data/v2-pipeline-enrich");
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

/**
 * Exception légitime single-region/single-segment (Yann 21 mai 2026 §5sexies)
 *
 * Pourquoi : 193 stés US-domestic (utilities régulées, REITs US-only, banques
 * régionales, retailers domestiques, healthcare US, etc.) ont legitimement
 * `slices=[]` car mono-pays / mono-segment. Le critère ≥2 slices les exclut
 * artificiellement de la publication alors qu'elles méritent leur fiche.
 *
 * Exemple canonique single-segment : NFLX (Netflix, 1 seul segment reportable
 * streaming consolidé per 10-K FY2025 Note 11). Tagué via sub-agent #17 :
 *   "revenue_by_segment": { "single_segment_legitimate": true, "source": "...",
 *     "reason": "Netflix n'a qu'un segment opérationnel (streaming)." }
 *
 * Règle d'acceptation (méthodologie HONNÊTE) :
 *   1. `revenue_by_geography.single_region_legitimate === true` → critère geo REMPLI
 *   2. `revenue_by_geography.single_region === true` → critère geo REMPLI (alias)
 *   3. `revenue_by_geography.slices = [{ label: "États-Unis"/"United States", value: 100, share_pct: 100 }]`
 *      (single-slice 100% US) → critère geo REMPLI
 *   4. `revenue_by_segment.single_segment_legitimate === true` → critère seg REMPLI
 *   5. `revenue_by_segment.single_segment === true` → critère seg REMPLI (alias)
 *   6. `revenue_by_segment.slices = [{ value: 100, share_pct: 100 }]` mono-segment
 *      → critère seg REMPLI
 *
 * Anti-cheat : ne JAMAIS tagger comme légitimes les multinationales (AAPL, KO,
 * MCD, etc. qui ont >5% revenue international). Seules les stés vraiment
 * mono-pays / mono-segment sont éligibles.
 */
function isLegitimateSingleRegion(block) {
  if (!block || typeof block !== "object") return false;
  // Flags explicites (sub-agent pipeline OU tagging manuel CONV-CONCEPTS)
  if (block.single_region_legitimate === true) return true;
  if (block.single_region === true) return true;
  const slices = getSlices(block);
  if (slices.length !== 1) return false;
  const only = slices[0];
  if (!only) return false;
  const share = Number(only.share_pct ?? only.value ?? 0);
  const label = String(only.label || "").toLowerCase();
  // Single-slice ≥95% US
  if (share >= 95 && (label.includes("états-unis") || label.includes("united states") || label.includes("u.s.") || label === "us")) {
    return true;
  }
  return false;
}

function isLegitimateSingleSegment(block) {
  if (!block || typeof block !== "object") return false;
  // Flags explicites
  if (block.single_segment_legitimate === true) return true;
  if (block.single_segment === true) return true;
  const slices = getSlices(block);
  if (slices.length !== 1) return false;
  const only = slices[0];
  if (!only) return false;
  const share = Number(only.share_pct ?? only.value ?? 0);
  return share >= 95;
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

  // v2-pipeline-enrich (peut contenir tags single_region_legitimate)
  const enrichPath = path.join(ENRICH_DIR, `${tLower}.json`);
  const enrich = readJsonSafe(enrichPath);

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

  // Segments - check 3 sources (complete, v2-pipeline, v2-pipeline-enrich)
  // + exception single_segment_legitimate
  const segSlices = Math.max(
    getSlices(src.revenue_by_segment).length,
    getSlices(srcAlt.revenue_by_segment).length,
    enrich ? getSlices(enrich.revenue_by_segment).length : 0,
  );
  const segmentsLegit =
    isLegitimateSingleSegment(src.revenue_by_segment) ||
    isLegitimateSingleSegment(srcAlt.revenue_by_segment) ||
    (enrich && isLegitimateSingleSegment(enrich.revenue_by_segment));
  const segmentsOk = segSlices >= 2 || segmentsLegit;

  // Geography - check 3 sources + exception single_region_legitimate
  const geoSlices = Math.max(
    getSlices(src.revenue_by_geography).length,
    getSlices(srcAlt.revenue_by_geography).length,
    enrich ? getSlices(enrich.revenue_by_geography).length : 0,
  );
  const geographyLegit =
    isLegitimateSingleRegion(src.revenue_by_geography) ||
    isLegitimateSingleRegion(srcAlt.revenue_by_geography) ||
    (enrich && isLegitimateSingleRegion(enrich.revenue_by_geography));
  const geographyOk = geoSlices >= 2 || geographyLegit;

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
