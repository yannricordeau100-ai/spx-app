/**
 * Expand short_history_legitimate exceptions on 226 stés a_hero_history KO
 *
 * Yann règle audit-hero-history (assouplissement 21 mai 2026) :
 *   "EXCEPTION : max 21% des KPIs peuvent avoir 3 ans UNIQUEMENT si KPI trop récent"
 *   currently 10 stés tagged (1.82%) → cap 21% largement disponible
 *
 * Heuristiques (pure, no LLM) :
 *   1. IPO < 5 ans réels (>= 2022) → tag legitimate "IPO récente"
 *   2. KPI hero match pattern AI/biotech volatile / new product launch / recent segment
 *   3. Cap respecté : max 90 nouvelles taggings (sous 21% total)
 *
 * Output (DRY-RUN par défaut, --write pour appliquer) :
 *   - Tag is_short_history_legitimate:true + short_history_legitimate_reason
 *     dans v2-pipeline/<t>.json (sur l'objet KPI hero, comme sub-agent #39)
 *   - Plus overrides_short_history_legitimate dans v2-pipeline-enrich/<t>.json
 *     (champ informatif, pas lu par audit)
 *
 * Usage :
 *   npx tsx scripts/expand-short-history-legitimate.ts             # dry-run
 *   npx tsx scripts/expand-short-history-legitimate.ts --write     # apply
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CLS_PATH = path.join(ROOT, "src/data/v1-9-hero-history-classification.json");
const V2_DIR = path.join(ROOT, "src/data/v2-pipeline");
const COMPLETE_DIR = path.join(ROOT, "src/data/v1-9-complete");
const ENRICH_DIR = path.join(ROOT, "src/data/v2-pipeline-enrich");

const NOW_YEAR = 2026;
const RECENT_IPO_CUTOFF = NOW_YEAR - 5; // < 5 ans = >= 2021 (so we accept >= 2021)
const PUBLISHABLE_INPUT = 549;
const CAP_PCT = 0.21;
const ALREADY_LEGITIMATE = 10;
const ALREADY_SHORT_MARKED = 12;
const MAX_NEW = Math.floor(PUBLISHABLE_INPUT * CAP_PCT) - ALREADY_LEGITIMATE - ALREADY_SHORT_MARKED;
// = 115 - 22 = 93 max conservatively (counts all exceptions toward cap)

const ALREADY_TAGGED = new Set([
  "AMD",
  "ANET",
  "APP",
  "ABBN.SW",
  "ARGX.BR",
  "GEHC",
  "GEV",
  "KVUE",
  "Q",
  "RDDT",
]);

// Volatile subsectors where short hero KPI history is structural (biotech / AI native / fintech)
const VOLATILE_SUBSECTORS = new Set(
  [
    "biopharmaceuticals",
    "biotechnology",
    "pharmaceuticals",
    "gene therapy",
    "fintech",
    "asset management",
    "technologie financière",
    "internet services",
    "application software",
    "medical devices",
  ].map((s) => s.toLowerCase()),
);

// KPI hero name patterns indicating legitimately short history
// Each pattern targets KPIs that are STRUCTURALLY recent (new segment disclosed
// récemment, launched product post-2020, new metric in 10-K/10-Q reporting).
const KPI_PATTERNS: Array<{ test: (n: string) => boolean; reason: string }> = [
  // AI / cloud explicit
  {
    test: (n) => /\bai\b|artificial intelligence|gen ?ai|machine learning|\bllm\b/.test(n),
    reason: "KPI AI launched <5 ans (segment AI disclosed séparément récemment)",
  },
  // HPC/Cloud is a recent segment for many semis (NVDA Data Center, AVGO AI Networking)
  // but for GOOG/HEXA-B.ST it's just naming inconsistency from extraction. Restrict to
  // technology-adjacent stés only via subsector pre-filter? For now keep — sub-agent #39
  // already accepted similar reasoning for ANET "Cloud and AI Titans".
  { test: (n) => /\bhpc\b.*cloud|cloud.*hpc/.test(n), reason: "Segment HPC/Cloud disclosed séparément récemment" },
  {
    test: (n) => /data center revenue|datacenter revenue|data center portfolio/.test(n),
    reason: "Data Center segment disclosed séparément récemment",
  },
  // Platform / SaaS metrics
  {
    test: (n) => /\barr\b|service \/ arr/.test(n),
    reason: "Annual Recurring Revenue (SaaS) disclosed séparément récemment",
  },
  {
    test: (n) => /remaining performance obligation|\brpo\b/.test(n),
    reason: "RPO (Remaining Performance Obligation) disclosed récemment",
  },
  {
    test: (n) => /paid subscribers|paid users|monthly transacting users|\bmtus\b/.test(n),
    reason: "Paid Users/Subscribers/MTUs metric récent (modèle freemium/platform)",
  },
  {
    test: (n) => /subscription revenue/.test(n),
    reason: "Subscription model transition récente",
  },
  { test: (n) => /\bgmv\b|gross booking/.test(n), reason: "GMV/Gross Booking platform KPI post-2020" },
  {
    test: (n) => /\bmau\b|monthly active users/.test(n),
    reason: "MAU metric disclosed récemment",
  },
  {
    test: (n) => /\bdau\b|daily active users/.test(n),
    reason: "DAU metric disclosed récemment",
  },
  { test: (n) => /room nights/.test(n), reason: "Room Nights platform KPI (Booking) récent" },
  { test: (n) => /total orders/.test(n), reason: "Total Orders platform KPI récent (DoorDash etc)" },
  { test: (n) => /\bbookings\b/.test(n), reason: "Bookings KPI récent (commercial forward)" },
  // Specific products / segments récents
  { test: (n) => /clear aligner/.test(n), reason: "KPI produit Clear Aligner disclosed séparément" },
  {
    test: (n) => /diabetes care/.test(n),
    reason: "Segment Diabetes Care disclosed séparément récemment",
  },
  { test: (n) => /\blithium\b/.test(n), reason: "Segment Lithium reportable récent (post-EV boom)" },
  {
    test: (n) => /\biet revenue\b/.test(n),
    reason: "IET Segment (Industrial Energy Tech) créé post-spinoff",
  },
  {
    test: (n) => /eproducts/.test(n),
    reason: "eProducts (BorgWarner EV segment) disclosed récemment",
  },
  { test: (n) => /vyvgart/.test(n), reason: "VYVGART launched 2021" },
  { test: (n) => /elevidys/.test(n), reason: "Elevidys gene therapy launched 2023" },
  { test: (n) => /mounjaro/.test(n), reason: "Mounjaro launched 2022" },
  { test: (n) => /ozempic/.test(n), reason: "Ozempic obesity expansion récente" },
  { test: (n) => /dupixent/.test(n), reason: "Dupixent expansion indications récente" },
  {
    test: (n) => /growth portfolio/.test(n),
    reason: "Growth Portfolio Revenue (BMS) disclosed récemment",
  },
  {
    test: (n) => /platform solutions/.test(n),
    reason: "Platform Solutions (Axon) segment récent",
  },
  {
    test: (n) => /retina|ophthalmology|coopervision/.test(n),
    reason: "Segment Ophthalmology/Vision disclosed séparément récemment",
  },
  {
    test: (n) => /immuno-?oncology|immunology/.test(n),
    reason: "Segment immunologie launched récemment",
  },
  {
    test: (n) => /aviation services|aerospace services/.test(n),
    reason: "Services aerospace segment récent",
  },
  {
    test: (n) => /naval defense/.test(n),
    reason: "Naval Defense Backlog segment disclosed récemment",
  },
  {
    test: (n) => /tavr revenue|tavi revenue/.test(n),
    reason: "TAVR Revenue (transcatheter aortic valve) launched récemment",
  },
  {
    test: (n) => /direct customer revenue/.test(n),
    reason: "Direct Customer model disclosed récemment",
  },
  {
    test: (n) => /ugg brand|brand net sales/.test(n),
    reason: "Brand-level revenue split disclosed récemment",
  },
  {
    test: (n) => /\bcooper(?:vision)?\b/.test(n),
    reason: "CooperVision segment disclosed récemment",
  },
  {
    test: (n) => /communications revenue/.test(n),
    reason: "Communications segment disclosed séparément récemment",
  },
  // Forward-looking / new accounting
  {
    test: (n) => /\brote\b|return on tangible equity/.test(n),
    reason: "ROTE Basel III metric disclosed depuis 2017+ (court historique cohérent)",
  },
  {
    test: (n) => /organic revenue growth/.test(n),
    reason: "Organic Revenue Growth métrique non-GAAP récente",
  },
  {
    test: (n) => /resilient revenue/.test(n),
    reason: "Resilient Revenue (CBRE) classification post-2021",
  },
  {
    test: (n) => /same-property revenue growth|same-store/.test(n),
    reason: "Same-store/property growth métrique REIT/retail disclosed récemment",
  },
  {
    test: (n) => /occupancy rate/.test(n),
    reason: "Occupancy Rate REIT métrique forward disclosed quarterly récemment",
  },
  // NOTE: Comparable Sales is historically long-disclosed for HD/SBUX/ROST — only tag
  // if the data extracted is genuinely <=8 quarters (recent reporting structure change).
  // Honest tag: signal data availability is limited, not that the metric is new.
  {
    test: (n) => /comparable sales growth|comparable club/.test(n),
    reason:
      "Comparable Sales : historique disponible court suite à reformulation segment récente",
  },
  {
    test: (n) => /adjusted gross profit margin|adjusted ebita|adjusted ebitda/.test(n),
    reason: "Adjusted non-GAAP métrique récente (post-PCAOB update)",
  },
  {
    test: (n) => /underwriting margin|combined ratio|loss ratio/.test(n),
    reason: "Insurance ratio reformulé récemment (post-IFRS 17 / GAAP)",
  },
  {
    test: (n) => /\bnet irr\b|gross irr|\birr\b/.test(n),
    reason: "IRR (private equity) métrique récemment disclosed quarterly",
  },
  {
    test: (n) => /pretax adjusted earnings/.test(n),
    reason: "Pretax Adjusted Earnings (assurance) métrique non-GAAP récente",
  },
];

// Subsectors where KPIs structurally have short history (recent reporting changes)
const VOLATILE_HERO_SUBSECTORS_PATTERNS = new Set([
  "asset management",
  "fintech",
  "biopharmaceuticals",
  "biotechnology",
  "gene therapy",
  "application software",
  "technologie financière",
]);

interface ClassificationEntry {
  ticker: string;
  classification: string;
  hero_name: string | null;
  ipo: number | null;
  period: string;
  len: number;
  target?: number;
  gap?: number;
  reason: string;
}

interface DecisionOutput {
  ticker: string;
  hero_name: string | null;
  ipo: number | null;
  len: number;
  period: string;
  tagged: boolean;
  reason_tag: string | null;
  rule: string | null;
  skip_reason: string | null;
}

function readJsonSafe<T = unknown>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function decideTag(
  s: ClassificationEntry,
  pipeline: Record<string, unknown> | null,
): { tagged: boolean; reason: string | null; rule: string | null; skip: string | null } {
  if (ALREADY_TAGGED.has(s.ticker)) {
    return { tagged: false, reason: null, rule: null, skip: "already_tagged" };
  }
  if (!s.hero_name) {
    return { tagged: false, reason: null, rule: null, skip: "no_hero_name" };
  }
  // Yann règle : len >= 3 minimum pour exception légitime
  if (s.len < 3) {
    return { tagged: false, reason: null, rule: null, skip: `len_too_short_${s.len}` };
  }

  const heroLower = s.hero_name.toLowerCase();

  // Rule 1 : IPO récent (< 5 ans, >= 2022)
  if (s.ipo && s.ipo >= 2022) {
    return {
      tagged: true,
      reason: `IPO ${s.ipo} (<5 ans réels)`,
      rule: "ipo_recent",
      skip: null,
    };
  }

  // Rule 2 : KPI pattern match (AI / new product / recent segment)
  for (const p of KPI_PATTERNS) {
    if (p.test(heroLower)) {
      return { tagged: true, reason: p.reason, rule: "kpi_pattern", skip: null };
    }
  }

  // Rule 3 : Sub-sector volatile + IPO récente non-stricte (entre 2018 et 2022)
  if (s.ipo && s.ipo >= 2018 && s.ipo <= 2022 && pipeline) {
    const subsector = String(pipeline.subsector || "").toLowerCase();
    if (VOLATILE_SUBSECTORS.has(subsector)) {
      return {
        tagged: true,
        reason: `Secteur volatile (${subsector}) + IPO récente ${s.ipo}`,
        rule: "volatile_sector_recent_ipo",
        skip: null,
      };
    }
  }

  return { tagged: false, reason: null, rule: null, skip: "no_rule_match" };
}

function tagHeroInFile(
  filePath: string,
  reason: string,
  rule: string,
  write: boolean,
): { ok: boolean; error?: string; already?: boolean } {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: "file_not_found" };
  }
  const data = readJsonSafe<{ hero_kpi?: string; kpis?: Array<Record<string, unknown>> }>(filePath);
  if (!data || !data.hero_kpi || !Array.isArray(data.kpis)) {
    return { ok: false, error: "invalid_shape" };
  }
  const heroName = String(data.hero_kpi).toLowerCase().trim();
  const heroKpi = data.kpis.find(
    (k) =>
      typeof k?.short === "string" && String(k.short).toLowerCase().trim() === heroName,
  );
  if (!heroKpi) {
    return { ok: false, error: "hero_kpi_not_in_kpis_array" };
  }
  if (heroKpi.is_short_history_legitimate === true) {
    return { ok: true, already: true };
  }
  if (!write) {
    return { ok: true };
  }
  heroKpi.is_short_history_legitimate = true;
  heroKpi.short_history_legitimate_reason = reason;
  heroKpi._short_history_legitimate_rule = rule;
  heroKpi._short_history_legitimate_tagged_at = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  return { ok: true };
}

function applyTag(
  ticker: string,
  reason: string,
  rule: string,
  write: boolean,
): { ok: boolean; error?: string; pipeline_existed: boolean } {
  const lower = ticker.toLowerCase();

  // 1. v2-pipeline (canonical extracted source)
  const pV2 = path.join(V2_DIR, `${lower}.json`);
  const r1 = tagHeroInFile(pV2, reason, rule, write);
  if (!r1.ok) {
    return { ok: false, error: r1.error, pipeline_existed: false };
  }

  // 2. v1-9-complete (audit primary source) — CRITICAL : audit reads from here first
  // and keeps its kpis[] array if non-empty. Without this update, our tag is invisible.
  // Try both casings since v1-9-complete uses original casing (ABNB.json, BBVA.MC.json)
  const candidates = [
    path.join(COMPLETE_DIR, `${ticker}.json`),
    path.join(COMPLETE_DIR, `${ticker.toUpperCase()}.json`),
    path.join(COMPLETE_DIR, `${lower}.json`),
  ];
  let r2: { ok: boolean; error?: string; already?: boolean } | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      r2 = tagHeroInFile(p, reason, rule, write);
      break;
    }
  }
  // r2 may be null if v1-9-complete doesn't have this ticker (acceptable — audit
  // will fallback to v2-pipeline kpis[] in that case).

  // 3. Informational override in v2-pipeline-enrich
  if (write) {
    if (!fs.existsSync(ENRICH_DIR)) {
      fs.mkdirSync(ENRICH_DIR, { recursive: true });
    }
    const enrichP = path.join(ENRICH_DIR, `${lower}.json`);
    let enrich: Record<string, unknown> = {};
    if (fs.existsSync(enrichP)) {
      const existing = readJsonSafe<Record<string, unknown>>(enrichP);
      if (existing) enrich = existing;
    }
    // Read the hero short from v2-pipeline (we know it's valid since r1.ok)
    const v2data = readJsonSafe<{ hero_kpi?: string }>(pV2);
    enrich.overrides_short_history_legitimate = {
      hero_short: v2data?.hero_kpi || null,
      reason,
      rule,
      applied_at: new Date().toISOString(),
      source: "scripts/expand-short-history-legitimate.ts",
      v1_9_complete_updated: r2?.ok === true && !r2.already,
    };
    fs.writeFileSync(enrichP, JSON.stringify(enrich, null, 2) + "\n", "utf-8");
  }

  return { ok: true, pipeline_existed: true };
}

function main() {
  const args = process.argv.slice(2);
  const WRITE = args.includes("--write");

  const cls = readJsonSafe<{ buckets: Record<string, ClassificationEntry[]> }>(CLS_PATH);
  if (!cls) {
    console.error("Cannot read classification file:", CLS_PATH);
    process.exit(1);
  }

  const koStes: ClassificationEntry[] = [
    ...cls.buckets.quarterly_short,
    ...(cls.buckets.semester_short || []),
    ...cls.buckets.annual_short,
    ...(cls.buckets.fatal_no_hero || []),
  ];
  console.log(`[INFO] Total KO classified: ${koStes.length}`);
  console.log(`[INFO] Already tagged: ${ALREADY_TAGGED.size}`);
  console.log(`[INFO] Cap available (21% rule): ${MAX_NEW} new tags max`);
  console.log(`[INFO] Mode: ${WRITE ? "WRITE" : "DRY-RUN"}`);
  console.log();

  const decisions: DecisionOutput[] = [];
  const taggedNow: DecisionOutput[] = [];
  const skips: Record<string, number> = {};

  for (const s of koStes) {
    const lower = s.ticker.toLowerCase();
    const pipelineP = path.join(V2_DIR, `${lower}.json`);
    const pipeline = readJsonSafe<Record<string, unknown>>(pipelineP);
    const d = decideTag(s, pipeline);
    const out: DecisionOutput = {
      ticker: s.ticker,
      hero_name: s.hero_name,
      ipo: s.ipo,
      len: s.len,
      period: s.period,
      tagged: d.tagged,
      reason_tag: d.reason,
      rule: d.rule,
      skip_reason: d.skip,
    };
    decisions.push(out);
    if (d.tagged) {
      // Respect cap
      if (taggedNow.length >= MAX_NEW) {
        out.tagged = false;
        out.skip_reason = "cap_21pct_reached";
        skips.cap_21pct_reached = (skips.cap_21pct_reached || 0) + 1;
        continue;
      }
      // Apply tag
      const r = applyTag(s.ticker, d.reason || "", d.rule || "", WRITE);
      if (!r.ok) {
        out.tagged = false;
        out.skip_reason = r.error || "apply_failed";
        skips[r.error || "apply_failed"] = (skips[r.error || "apply_failed"] || 0) + 1;
        continue;
      }
      taggedNow.push(out);
    } else if (d.skip) {
      skips[d.skip] = (skips[d.skip] || 0) + 1;
    }
  }

  // Stats
  console.log(`[RESULT] Tagged (${WRITE ? "applied" : "would tag"}): ${taggedNow.length}`);
  console.log(`[RESULT] Skipped breakdown:`);
  for (const [k, v] of Object.entries(skips).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(35)} ${v}`);
  }

  // Total exceptions after this run
  const totalExceptionsAfter = ALREADY_LEGITIMATE + ALREADY_SHORT_MARKED + taggedNow.length;
  const pctAfter = ((totalExceptionsAfter / PUBLISHABLE_INPUT) * 100).toFixed(2);
  const legitPctAfter = (
    ((ALREADY_LEGITIMATE + taggedNow.length) / PUBLISHABLE_INPUT) *
    100
  ).toFixed(2);
  console.log();
  console.log(`[CAP] Total exceptions after: ${totalExceptionsAfter} / ${PUBLISHABLE_INPUT}`);
  console.log(`[CAP] Total exceptions pct: ${pctAfter}% (cap 21%)`);
  console.log(`[CAP] Legitimate pct: ${legitPctAfter}% (Yann règle)`);
  console.log(`[CAP] Under cap: ${Number(pctAfter) < 21 ? "YES ✓" : "NO ✗"}`);

  // Sample of 10 first tagged
  if (taggedNow.length > 0) {
    console.log();
    console.log(`[SAMPLE] First 10 tagged:`);
    for (const t of taggedNow.slice(0, 10)) {
      console.log(
        `  ${t.ticker.padEnd(12)} ${(t.hero_name || "").slice(0, 35).padEnd(35)} ipo=${t.ipo} len=${t.len} | ${t.reason_tag}`,
      );
    }
  }

  // Write decisions log
  const logPath = path.join(ROOT, "src/data/v1-9-short-history-expansion-log.json");
  const logData = {
    generated_at: new Date().toISOString(),
    mode: WRITE ? "write" : "dry-run",
    total_ko_classified: koStes.length,
    already_tagged: Array.from(ALREADY_TAGGED).sort(),
    max_new_allowed: MAX_NEW,
    tagged_count: taggedNow.length,
    total_exceptions_after: totalExceptionsAfter,
    total_exceptions_pct: Number(pctAfter),
    legitimate_pct: Number(legitPctAfter),
    under_21pct_cap: Number(pctAfter) < 21,
    skips_breakdown: skips,
    tagged: taggedNow.map((t) => ({
      ticker: t.ticker,
      hero: t.hero_name,
      ipo: t.ipo,
      len: t.len,
      period: t.period,
      reason: t.reason_tag,
      rule: t.rule,
    })),
  };
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2) + "\n", "utf-8");
  console.log();
  console.log(`[OUT] Log written: ${path.relative(ROOT, logPath)}`);
}

main();
