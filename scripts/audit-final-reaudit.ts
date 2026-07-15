/**
 * Ré-audit final via loadV17Company mode v18.
 * Sortie : {clef → {count, sample20}} JSON.
 */
import fs from "node:fs";
import path from "node:path";
import { loadV17Company } from "../src/lib/company-core/load-company";
import { hasStories, buildStories } from "../src/lib/kpi-stories-ordering";
import type { KPI } from "../src/lib/data";

const ROOT = process.cwd();
const EN_CITATION_RE = /("|«)\s*[a-zA-Z]/;

type Bucket = { count: number; sample20: string[] };
const KEYS = [
  "risks",
  "risks_no_en_citation",
  "stories",
  "AI",
  "geo",
  "events",
  "segments",
  "kpi_table",
  "gov",
  "hero",
  "profit_warning",
  "LOAD",
  "CRASH",
] as const;

function add(buckets: Record<string, Bucket>, key: string, ticker: string) {
  const b = buckets[key];
  b.count++;
  if (b.sample20.length < 20) b.sample20.push(ticker);
}

async function auditTicker(t: string, buckets: Record<string, Bucket>) {
  const outcome = await loadV17Company(t, { mode: "v18" });
  if (outcome.kind !== "ready") {
    add(buckets, "LOAD", `${t}:${outcome.kind}`);
    return;
  }
  const c: any = outcome.company;

  // risks
  const risks: any[] = Array.isArray(c.risks) ? c.risks : [];
  let risksBad = false;
  if (risks.length < 3) risksBad = true;
  else {
    const uiScores = risks.map((r) =>
      typeof r.score === "number" && r.score > 0
        ? r.score
        : typeof r.severity === "number" && r.severity > 0
          ? r.severity
          : 3
    );
    if (new Set(uiScores).size <= 1) risksBad = true;
    if (risks.some((r) => !((r.score_rationale ?? "").trim()))) risksBad = true;
  }
  if (risksBad) add(buckets, "risks", t);

  // risks_no_en_citation : au moins 1 risque sans citation EN.
  // La citation vit soit dans r.quote soit inline dans r.score_rationale
  // (motif "Citation: "..."" ou "«...»"). On teste les 2 champs concaténés.
  const badCite = risks.some((r) => {
    const q = typeof r.quote === "string" ? r.quote : "";
    const sr = typeof r.score_rationale === "string" ? r.score_rationale : "";
    return !EN_CITATION_RE.test(q + " " + sr);
  });
  if (badCite) add(buckets, "risks_no_en_citation", t);

  // KPI table
  const kpis: KPI[] = Array.isArray(c.kpis) ? c.kpis : [];
  const nonStory = kpis.filter((k: any) => !k.is_short_history);
  if (nonStory.length < 5) add(buckets, "kpi_table", t);

  // hero : unresolvable seulement (H1)
  const heroShort = (c.hero_kpi ?? "").toString().trim();
  const norm = (s: string) => s.trim().toLowerCase();
  const hero = nonStory.find((k: any) => norm(k.short ?? "") === norm(heroShort))
    ?? kpis.find((k: any) => norm((k as any).short ?? "") === norm(heroShort));
  if (!heroShort || !hero) add(buckets, "hero", t);

  // stories
  const mp = Array.isArray(c.market_positions) ? c.market_positions : undefined;
  let storiesBad = false;
  if (!hasStories(kpis, mp as any)) storiesBad = true;
  else {
    const st = buildStories(kpis, mp as any);
    const n = Array.isArray(st) ? st.length : 0;
    if (n < 2) storiesBad = true;
  }
  if (storiesBad) add(buckets, "stories", t);

  // AI
  const ai = c.ai_positioning;
  if (!ai || !ai.stance) add(buckets, "AI", t);

  // events
  const events = Array.isArray(c.events) ? c.events : [];
  if (events.length === 0) add(buckets, "events", t);

  // segments : slices ≥ 2 OU tag single accepté
  const seg = c.revenue_by_segment;
  const segSlices = seg && Array.isArray(seg.slices) ? seg.slices.length : 0;
  const segSingle = !!(
    seg &&
    (seg._single_segment ||
      seg.single_segment ||
      seg._single_segment_legitimate ||
      seg.single_segment_legitimate)
  );
  if (segSlices < 2 && !segSingle) add(buckets, "segments", t);

  // geo
  const geo = c.revenue_by_geography;
  const geoSlices = geo && Array.isArray(geo.slices) ? geo.slices.length : 0;
  const geoSingle = !!(
    geo &&
    (geo._single_geography ||
      geo.single_geography ||
      geo._geography_not_disclosed ||
      geo.geography_not_disclosed ||
      geo.single_region_legitimate ||
      geo._single_region_legitimate)
  );
  if (geoSlices < 2 && !geoSingle) add(buckets, "geo", t);

  // gov : CEO + top3 (voting OR capital)
  const gov = c.governance ?? {};
  if (!gov || !gov.ceo_name) add(buckets, "gov", t);

  // profit_warning
  if (!c.profit_warning) add(buckets, "profit_warning", t);
}

async function main() {
  const args = process.argv.slice(2);
  const list: string[] = args.length
    ? args
    : (JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/sp500-tickers.json"), "utf8")) as string[])
        .map((s) => s.toUpperCase());

  const buckets: Record<string, Bucket> = {};
  for (const k of KEYS) buckets[k] = { count: 0, sample20: [] };

  let done = 0;
  for (const t of list) {
    try {
      await auditTicker(t, buckets);
    } catch (e) {
      add(buckets, "CRASH", `${t}:${String(e).slice(0, 80)}`);
    }
    done++;
    if (done % 50 === 0) console.error(`...${done}/${list.length}`);
  }

  const out: Record<string, Bucket> = {};
  for (const k of KEYS) out[k] = buckets[k];
  fs.writeFileSync(
    path.join(ROOT, ".conv-state/audit-final-reaudit.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), audited: list.length, buckets: out }, null, 1)
  );
  console.log(JSON.stringify(out, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
