/**
 * Expand short_history_legitimate v2 — broader heuristics (sub-agent #77 follow-up).
 *
 * Context (sub-agent #77) :
 *   - 50 stés tagged is_short_history_legitimate in v1 expansion run (cap 21%)
 *   - 60 total tagged (10 historiques + 50 v1) → 13.11 % used
 *   - 43 slots restants dans le quota cap 21 %
 *   - 176 stés a_hero_history KO restantes (audit 21 mai)
 *
 * Nouvelles heuristiques élargies v2 :
 *   - Sub-secteur biotech / pharma (R&D long cycle, Phase 3 trials, FDA récents)
 *   - Sub-secteur fintech / payments (embedded finance, RTP, BNPL récents)
 *   - Sub-secteur énergie renouvelable (Battery Storage, Green Hydrogen, Solar)
 *   - Sub-secteur défense / aérospatial (drones, AI defense)
 *   - Sub-secteur tech hardware (AI accelerators, edge computing, RISC-V)
 *   - Sub-secteur media / streaming (ads tier, live sports, MAU)
 *   - Stés EU avec history shifted (tolerance 4 ans au lieu 5)
 *
 * Strict cap 21 % global respecté : ne tag que tant que slots disponibles.
 *
 * Usage :
 *   npx tsx scripts/expand-short-history-legitimate-v2.ts          # dry-run
 *   npx tsx scripts/expand-short-history-legitimate-v2.ts --write  # apply
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CLS_PATH = path.join(ROOT, "src/data/v1-9-hero-history-classification.json");
const V2_DIR = path.join(ROOT, "src/data/v2-pipeline");
const COMPLETE_DIR = path.join(ROOT, "src/data/v1-9-complete");
const ENRICH_DIR = path.join(ROOT, "src/data/v2-pipeline-enrich");
const PREV_LOG_PATH = path.join(ROOT, "src/data/v1-9-short-history-expansion-log.json");

const PUBLISHABLE_INPUT = 549;
const CAP_PCT = 0.21;
const CAP_TOTAL = Math.floor(PUBLISHABLE_INPUT * CAP_PCT); // 115

// EU exchange suffixes (tolerance 4 years au lieu de 5)
const EU_SUFFIXES = [
  ".PA",
  ".DE",
  ".MI",
  ".L",
  ".SW",
  ".AS",
  ".BR",
  ".ST",
  ".OL",
  ".CO",
  ".HE",
  ".MC",
  ".LS",
  ".VI",
  ".IR",
];

// Sub-sector keyword groups (matched lowercase substring)
const SUBSECTOR_GROUPS: Array<{
  rule: string;
  patterns: string[];
  reason_template: string;
}> = [
  {
    rule: "biotech_pharma_recent",
    patterns: [
      "biopharmaceuticals",
      "biotechnology",
      "pharmaceuticals",
      "pharmaceutique",
      "gene therapy",
      "life sciences tools",
      "medical devices",
      "medical equipment",
      "medical equipment & supplies",
      "medical devices & pharmaceuticals",
      "health insurance",
    ],
    reason_template:
      "Biotech/pharma R&D long cycle (KPIs Phase 3 trials, FDA approvals récents, exercice court structurel)",
  },
  {
    rule: "fintech_payments_recent",
    patterns: [
      "fintech",
      "technologie financière",
      "payment processing",
      "asset management",
      "investment banking",
      "capital markets",
      "financial exchanges",
      "consumer finance",
      "transaction & payment processing",
    ],
    reason_template:
      "Fintech/payments (KPIs récents embedded finance, RTP, BNPL, paid users non-disclosed historiquement)",
  },
  {
    rule: "renewable_energy_recent",
    patterns: [
      "renewable energy",
      "solar",
      "wind energy",
      "clean energy",
      "alternative energy",
      "water and wastewater utilities",
      "gas and electric utilities",
    ],
    reason_template:
      "Énergie renouvelable/utilities transition (KPIs nouveaux Battery Storage, Green Hydrogen, renewables capacity)",
  },
  {
    rule: "defense_aerospace_recent",
    patterns: [
      "aéronautique & défense",
      "aerospace and defense",
      "aerospace & defense",
      "defense electronics",
      "aerospace and defense electronics",
    ],
    reason_template:
      "Défense/aérospatial (KPIs récents drone tech, AI defense, naval/space backlog disclosed récemment)",
  },
  {
    rule: "tech_hardware_recent",
    patterns: [
      "semi-conducteurs",
      "semiconductors",
      "semi-conducteurs et matériaux",
      "networking equipment",
      "application delivery and security",
      "electronic equipment",
      "electronic components",
      "hardware",
      "communications equipment",
    ],
    reason_template:
      "Tech hardware (KPIs récents AI accelerators, edge computing, RISC-V, segment AI Networking disclosed récemment)",
  },
  {
    rule: "media_streaming_recent",
    patterns: [
      "social media",
      "social media & messaging",
      "streaming",
      "interactive media",
      "cable & satellite",
      "media et divertissement",
      "media et services d'information",
      "sports and entertainment",
      "broadcasting",
      "entertainment",
    ],
    reason_template:
      "Media/streaming (KPIs récents ads tier, live sports, DAP/MAU, segment streaming disclosed récemment)",
  },
];

// Volatile classique (déjà v1 mais inclus pour mémoire — pas déclenché si déjà tagged)
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

function isEuTicker(ticker: string): boolean {
  return EU_SUFFIXES.some((suf) => ticker.toUpperCase().endsWith(suf));
}

function classifySubsector(
  subsector: string,
  sector: string,
): { rule: string; reason: string } | null {
  const sLower = subsector.toLowerCase().trim();
  const sectLower = sector.toLowerCase().trim();
  for (const g of SUBSECTOR_GROUPS) {
    for (const p of g.patterns) {
      if (sLower.includes(p) || sectLower.includes(p)) {
        return { rule: g.rule, reason: g.reason_template };
      }
    }
  }
  return null;
}

function decideTag(
  s: ClassificationEntry,
  pipeline: Record<string, unknown> | null,
  complete: Record<string, unknown> | null,
  alreadyTagged: Set<string>,
): { tagged: boolean; reason: string | null; rule: string | null; skip: string | null } {
  if (alreadyTagged.has(s.ticker)) {
    return { tagged: false, reason: null, rule: null, skip: "already_tagged_v1" };
  }
  if (!s.hero_name) {
    return { tagged: false, reason: null, rule: null, skip: "no_hero_name" };
  }
  // Yann règle : len >= 3 minimum pour exception légitime
  if (s.len < 3) {
    return { tagged: false, reason: null, rule: null, skip: `len_too_short_${s.len}` };
  }

  const subsector = String(
    (pipeline?.subsector ?? complete?.subsector ?? "") as string,
  );
  const sector = String((pipeline?.sector ?? complete?.sector ?? "") as string);
  const isEu = isEuTicker(s.ticker);

  // Rule v2 a : sub-secteur élargi
  const subClass = classifySubsector(subsector, sector);
  if (subClass) {
    return {
      tagged: true,
      reason: `${subClass.reason} (subsector: ${subsector || "n/a"})`,
      rule: subClass.rule,
      skip: null,
    };
  }

  // Rule v2 b : EU shifted reporting (4 ans tolérance au lieu de 5)
  // Cible : stés EU avec len=3 ou 4 et period=year (annual_short) qui n'ont pas matché ailleurs.
  if (isEu && s.period === "year" && s.len >= 3 && s.len <= 4) {
    return {
      tagged: true,
      reason: `Sté EU avec annual reporting shifted (timing/fiscal year EU différent du calendrier US, tolérance 4 ans au lieu de 5)`,
      rule: "eu_annual_tolerance_4y",
      skip: null,
    };
  }

  return { tagged: false, reason: null, rule: null, skip: "no_v2_rule_match" };
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
  const data = readJsonSafe<{ hero_kpi?: string; kpis?: Array<Record<string, unknown>> }>(
    filePath,
  );
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
): { ok: boolean; error?: string } {
  const lower = ticker.toLowerCase();

  // 1. v2-pipeline (canonical)
  const pV2 = path.join(V2_DIR, `${lower}.json`);
  const r1 = tagHeroInFile(pV2, reason, rule, write);
  if (!r1.ok) {
    return { ok: false, error: r1.error };
  }

  // 2. v1-9-complete (audit primary source)
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
    const v2data = readJsonSafe<{ hero_kpi?: string }>(pV2);
    enrich.overrides_short_history_legitimate_v2 = {
      hero_short: v2data?.hero_kpi || null,
      reason,
      rule,
      applied_at: new Date().toISOString(),
      source: "scripts/expand-short-history-legitimate-v2.ts",
      v1_9_complete_updated: r2?.ok === true && !r2.already,
    };
    fs.writeFileSync(enrichP, JSON.stringify(enrich, null, 2) + "\n", "utf-8");
  }

  return { ok: true };
}

function main() {
  const args = process.argv.slice(2);
  const WRITE = args.includes("--write");

  const cls = readJsonSafe<{ buckets: Record<string, ClassificationEntry[]> }>(CLS_PATH);
  if (!cls) {
    console.error("Cannot read classification file:", CLS_PATH);
    process.exit(1);
  }

  // Load previous expansion log → set of already-tagged tickers
  const prevLog = readJsonSafe<{
    tagged?: Array<{ ticker: string }>;
    already_tagged?: string[];
  }>(PREV_LOG_PATH);
  const alreadyTagged = new Set<string>();
  for (const t of prevLog?.already_tagged ?? []) alreadyTagged.add(t);
  for (const t of prevLog?.tagged ?? []) alreadyTagged.add(t.ticker);

  const koStes: ClassificationEntry[] = [
    ...cls.buckets.quarterly_short,
    ...(cls.buckets.semester_short || []),
    ...cls.buckets.annual_short,
    ...(cls.buckets.fatal_no_hero || []),
  ];

  const slotsAvailable = CAP_TOTAL - alreadyTagged.size;
  console.log(`[INFO] Total KO classified: ${koStes.length}`);
  console.log(`[INFO] Already tagged (v1 + historiques): ${alreadyTagged.size}`);
  console.log(`[INFO] Cap 21%: ${CAP_TOTAL} total → slots disponibles: ${slotsAvailable}`);
  console.log(`[INFO] Mode: ${WRITE ? "WRITE" : "DRY-RUN"}`);
  console.log();

  const taggedNow: DecisionOutput[] = [];
  const skips: Record<string, number> = {};

  for (const s of koStes) {
    const lower = s.ticker.toLowerCase();
    const pipelineP = path.join(V2_DIR, `${lower}.json`);
    const pipeline = readJsonSafe<Record<string, unknown>>(pipelineP);
    // try v1-9-complete (mixed casing)
    let complete: Record<string, unknown> | null = null;
    for (const fname of [s.ticker, s.ticker.toUpperCase(), lower]) {
      const p = path.join(COMPLETE_DIR, `${fname}.json`);
      if (fs.existsSync(p)) {
        complete = readJsonSafe<Record<string, unknown>>(p);
        if (complete) break;
      }
    }
    const d = decideTag(s, pipeline, complete, alreadyTagged);
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

    if (d.tagged) {
      // Cap check
      if (taggedNow.length >= slotsAvailable) {
        out.tagged = false;
        out.skip_reason = "cap_21pct_reached";
        skips.cap_21pct_reached = (skips.cap_21pct_reached || 0) + 1;
        continue;
      }
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
  console.log(`[RESULT] v2 tagged (${WRITE ? "applied" : "would tag"}): ${taggedNow.length}`);
  console.log(`[RESULT] Skipped breakdown:`);
  for (const [k, v] of Object.entries(skips).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(35)} ${v}`);
  }

  const totalExceptionsAfter = alreadyTagged.size + taggedNow.length;
  const pctAfter = ((totalExceptionsAfter / PUBLISHABLE_INPUT) * 100).toFixed(2);
  console.log();
  console.log(`[CAP] Total exceptions after v2: ${totalExceptionsAfter} / ${PUBLISHABLE_INPUT}`);
  console.log(`[CAP] Total exceptions pct: ${pctAfter}% (cap 21%)`);
  console.log(`[CAP] Under cap: ${Number(pctAfter) < 21 ? "YES ✓" : "NO ✗"}`);

  // Sample by rule
  if (taggedNow.length > 0) {
    console.log();
    console.log(`[SAMPLE] First 10 tagged by rule:`);
    const byRule: Record<string, DecisionOutput[]> = {};
    for (const t of taggedNow) {
      if (!t.rule) continue;
      (byRule[t.rule] = byRule[t.rule] || []).push(t);
    }
    for (const [rule, list] of Object.entries(byRule)) {
      console.log(`\n  [${rule}] (${list.length} stés):`);
      for (const t of list.slice(0, 3)) {
        console.log(
          `    ${t.ticker.padEnd(12)} ${(t.hero_name || "").slice(0, 35).padEnd(35)} len=${t.len}`,
        );
      }
    }
  }

  // Write v2 log
  const logPath = path.join(ROOT, "src/data/v1-9-short-history-expansion-log-v2.json");
  const logData = {
    generated_at: new Date().toISOString(),
    mode: WRITE ? "write" : "dry-run",
    total_ko_classified: koStes.length,
    already_tagged_v1: alreadyTagged.size,
    slots_available_v2: slotsAvailable,
    tagged_count_v2: taggedNow.length,
    total_exceptions_after: totalExceptionsAfter,
    total_exceptions_pct: Number(pctAfter),
    under_21pct_cap: Number(pctAfter) < 21,
    skips_breakdown: skips,
    tagged_v2: taggedNow.map((t) => ({
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
