/**
 * audit-v19-13ok-visual.ts
 *
 * Audit visuel des 13 stés "vraiment publishable" V1.9 (0 KO a-f) :
 * TSLA, BAC, UPS, URI, TSN, CF, RS, BMRN, APTV, BALL, MMM, SMCI, SNPS.
 *
 * Pour chaque ticker :
 *   1. fetch /sandbox/v1-9/<t>?audit_token=... sur staging (HTTP status)
 *   2. lit src/data/v1-9-complete/<t>.json (dataset rendu côté SSR)
 *   3. vérifie présence des 9 blocs + interprétation 4-sous-blocs derivable
 *   4. flag issues : em-dash résiduels, ranks "≈ #1" hallucinés, dates stale,
 *      stories<5, kpis<5, etc.
 *
 * Output : src/data/v1-9-13-ok-visual-check.json + console table.
 *
 * Run : npx tsx scripts/audit-v19-13ok-visual.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://mettrik-staging.vercel.app";
const TOKEN = process.env.VISUAL_AUDIT_TOKEN || "phYUd19KP3T_apdLQmugGzF0yEEoAwM6C5JVp9-2z0Y";

const TICKERS = [
  "TSLA", "BAC", "UPS", "URI", "TSN",
  "CF", "RS", "BMRN", "APTV", "BALL",
  "MMM", "SMCI", "SNPS",
];

type BlockStatus = {
  present: boolean;
  detail?: string | number;
};

type StyAudit = {
  ticker: string;
  http_status: number | null;
  http_final_url: string | null;
  blocks: {
    hero_kpi: BlockStatus;
    hero_history: BlockStatus;
    interpretation_4sub: BlockStatus;
    kpi_table_5plus: BlockStatus;
    stories_5plus: BlockStatus;
    risks_3plus: BlockStatus;
    segments: BlockStatus;
    geography: BlockStatus;
    governance_ceo_top3: BlockStatus;
    ai_positioning: BlockStatus;
    events: BlockStatus;
    ranks: BlockStatus;
  };
  ok_count: number;
  total: number;
  issues: string[];
};

async function probeHttp(ticker: string): Promise<{ status: number | null; url: string | null }> {
  const u = `${BASE}/sandbox/v1-9/${ticker}?audit_token=${TOKEN}`;
  try {
    const r = await fetch(u, {
      method: "HEAD",
      redirect: "follow",
      headers: { "user-agent": "Mettrik-QA-Bot/2.0 visual-check-13ok" },
    });
    return { status: r.status, url: r.url };
  } catch (e) {
    return { status: null, url: null };
  }
}

function readDataset(ticker: string): any | null {
  const candidates = [
    path.resolve(`src/data/v1-9-complete/${ticker.toLowerCase()}.json`),
    path.resolve(`src/data/v1-9-complete/${ticker}.json`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function countEmDash(s: any): number {
  if (typeof s !== "string") return 0;
  return (s.match(/—/g) || []).length;
}

function deepEmDashCount(obj: any): number {
  let n = 0;
  if (typeof obj === "string") return countEmDash(obj);
  if (Array.isArray(obj)) {
    for (const v of obj) n += deepEmDashCount(v);
    return n;
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) n += deepEmDashCount(v);
    return n;
  }
  return 0;
}

function auditTicker(ticker: string, data: any, http: { status: number | null; url: string | null }): StyAudit {
  const blocks: StyAudit["blocks"] = {
    hero_kpi: { present: false },
    hero_history: { present: false },
    interpretation_4sub: { present: false },
    kpi_table_5plus: { present: false },
    stories_5plus: { present: false },
    risks_3plus: { present: false },
    segments: { present: false },
    geography: { present: false },
    governance_ceo_top3: { present: false },
    ai_positioning: { present: false },
    events: { present: false },
    ranks: { present: false },
  };
  const issues: string[] = [];

  if (!data) {
    issues.push("DATASET_NOT_FOUND");
    return {
      ticker,
      http_status: http.status,
      http_final_url: http.url,
      blocks,
      ok_count: 0,
      total: Object.keys(blocks).length,
      issues,
    };
  }

  // hero_kpi + history
  const hero = data.hero_kpi;
  blocks.hero_kpi = { present: !!hero, detail: hero || "n/a" };
  let heroKpi: any = null;
  if (Array.isArray(data.kpis)) {
    heroKpi = data.kpis.find(
      (k: any) => k && (k.short === hero || k.name_fr === hero || k.name_en === hero),
    );
  }
  const histLen = heroKpi && Array.isArray(heroKpi.history) ? heroKpi.history.length : 0;
  blocks.hero_history = { present: histLen >= 4, detail: histLen };
  if (histLen < 4) issues.push(`HERO_HISTORY_SHORT=${histLen}`);

  // Interpretation 4-sous-blocs : derivé via interpretStructured() côté UI.
  // On vérifie que le hero a value + history + signal pour permettre le rendu.
  const hasSignal =
    heroKpi && (heroKpi.signal || heroKpi.description_fr || heroKpi.description_en || heroKpi.description);
  const interpReady = !!heroKpi && heroKpi.value != null && histLen >= 3 && !!hasSignal;
  blocks.interpretation_4sub = { present: interpReady, detail: interpReady ? "derivable" : "missing input" };
  if (!interpReady) issues.push("INTERP_4SUB_INCOMPLETE");

  // KPI table 5+
  const kpiCount = Array.isArray(data.kpis) ? data.kpis.length : 0;
  blocks.kpi_table_5plus = { present: kpiCount >= 5, detail: kpiCount };
  if (kpiCount < 5) issues.push(`KPIS_LT_5=${kpiCount}`);

  // Stories
  const stories = Array.isArray(data.kpis_story) ? data.kpis_story : [];
  blocks.stories_5plus = { present: stories.length >= 5, detail: stories.length };
  if (stories.length < 5) issues.push(`STORIES_LT_5=${stories.length}`);

  // Risks
  const risks = Array.isArray(data.risks) ? data.risks : [];
  blocks.risks_3plus = { present: risks.length >= 3, detail: risks.length };
  if (risks.length < 3) issues.push(`RISKS_LT_3=${risks.length}`);

  // Segments
  const seg = data.revenue_by_segment;
  const segSlices = seg && Array.isArray(seg.slices) ? seg.slices.length : 0;
  blocks.segments = { present: segSlices >= 2, detail: segSlices };
  if (segSlices < 2) issues.push(`SEG_SLICES_LT_2=${segSlices}`);

  // Geography
  const geo = data.revenue_by_geography;
  const geoSlices = geo && Array.isArray(geo.slices) ? geo.slices.length : 0;
  blocks.geography = { present: geoSlices >= 2, detail: geoSlices };
  if (geoSlices < 2) issues.push(`GEO_SLICES_LT_2=${geoSlices}`);

  // Governance CEO + top 3
  const gov = data.governance || {};
  const topCap = Array.isArray(gov.top_capital) ? gov.top_capital : [];
  const topVot = Array.isArray(gov.top_voting) ? gov.top_voting : [];
  const govOk = !!gov.ceo_name && (topCap.length >= 3 || topVot.length >= 3);
  blocks.governance_ceo_top3 = {
    present: govOk,
    detail: `ceo=${gov.ceo_name ? "y" : "n"} top_cap=${topCap.length} top_vot=${topVot.length}`,
  };
  if (!gov.ceo_name) issues.push("GOV_CEO_MISSING");
  if (topCap.length < 3 && topVot.length < 3) issues.push("GOV_TOP3_INCOMPLETE");

  // AI positioning
  const ai = data.ai_positioning || {};
  blocks.ai_positioning = { present: !!ai.stance, detail: ai.stance || "n/a" };
  if (!ai.stance) issues.push("AI_STANCE_MISSING");

  // Events
  const events = Array.isArray(data.events) ? data.events : [];
  blocks.events = { present: events.length >= 1, detail: events.length };
  if (events.length === 0) issues.push("EVENTS_EMPTY");

  // Ranks - flag suspect "≈ #1" hallucinations
  const ranks = data.ranks || {};
  const ranksCount = Object.values(ranks).filter((v: any) => v && v !== "-" && v !== "").length;
  blocks.ranks = { present: ranksCount >= 2, detail: JSON.stringify(ranks) };
  if (ranksCount < 2) issues.push("RANKS_INCOMPLETE");
  // Detect "≈ #1" hallucination patterns
  for (const [k, v] of Object.entries(ranks)) {
    if (typeof v === "string" && /≈\s*#1\b/.test(v) && (k === "global_world" || k === "global_us")) {
      issues.push(`RANKS_SUSPECT_${k}=${v}`);
    }
  }

  // Em-dash residuals
  const emCount = deepEmDashCount(data);
  if (emCount > 0) issues.push(`EM_DASH_RESIDUAL=${emCount}`);

  // Stale freshness
  const lastDate = heroKpi?.last_data_date || data.publication_date;
  if (lastDate) {
    const d = new Date(lastDate);
    const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (age > 365) issues.push(`STALE_LAST_DATA=${Math.round(age)}d`);
  } else {
    issues.push("NO_LAST_DATA_DATE");
  }

  // HTTP non-200
  if (http.status !== 200) issues.push(`HTTP_${http.status}`);
  if (http.url && http.url.includes("auth=signin")) issues.push("HTTP_AUTH_REDIRECT");

  const ok_count = Object.values(blocks).filter((b) => b.present).length;
  const total = Object.keys(blocks).length;

  return { ticker, http_status: http.status, http_final_url: http.url, blocks, ok_count, total, issues };
}

async function main() {
  const results: StyAudit[] = [];
  for (const t of TICKERS) {
    process.stdout.write(`Auditing ${t}... `);
    const http = await probeHttp(t);
    const data = readDataset(t);
    const a = auditTicker(t, data, http);
    results.push(a);
    console.log(`${a.ok_count}/${a.total} blocks OK, ${a.issues.length} issues, HTTP ${http.status}`);
  }

  const out = {
    generated_at: new Date().toISOString(),
    base_url: BASE,
    tickers_total: TICKERS.length,
    tickers_full_ok: results.filter((r) => r.ok_count === r.total && r.issues.length === 0).length,
    tickers_with_issues: results.filter((r) => r.issues.length > 0).length,
    results,
  };

  const outPath = path.resolve("src/data/v1-9-13-ok-visual-check.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nOutput: ${outPath}`);

  // Console table summary
  console.log("\n=== Summary blocks-OK per sté ===");
  console.log("ticker   ok/total  issues_count");
  for (const r of results) {
    console.log(`${r.ticker.padEnd(8)} ${String(r.ok_count).padStart(2)}/${r.total}      ${r.issues.length}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
