import fs from "fs/promises";
import path from "path";
import { loadV17Company } from "../src/lib/company-core/load-company";

type Row = {
  ticker: string;
  stance: string | null;
  evidence_count: number;
  source_date: string | null;
  needs_regen: boolean;
  missing: boolean;
};

async function readJson(p: string): Promise<any | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8"));
  } catch {
    return null;
  }
}

function extractDateFromString(s: string): string | null {
  if (!s) return null;
  // ISO: 2026-05-07
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Compact: 20260125 → 2026-01-25
  const compact = s.match(/(\d{4})(\d{2})(\d{2})/);
  if (compact) {
    const [_, y, m, d] = compact;
    if (+y >= 2015 && +y <= 2030 && +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) {
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

async function main() {
  const ROOT = "/Users/yann/spx-app";
  process.chdir(ROOT);
  const tickList = JSON.parse(
    await fs.readFile(path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json"), "utf-8")
  ).tickers as string[];

  const rows: Row[] = [];
  let idx = 0;
  for (const t of tickList) {
    idx++;
    if (idx % 50 === 0) process.stderr.write(`[${idx}/${tickList.length}]\n`);
    const row: Row = {
      ticker: t,
      stance: null,
      evidence_count: 0,
      source_date: null,
      needs_regen: false,
      missing: true,
    };
    try {
      const out = await loadV17Company(t, { mode: "v18" });
      if (out.kind === "ready") {
        const ai = (out.company as any).ai_positioning;
        if (ai && ai.stance) {
          row.missing = false;
          row.stance = ai.stance;
          row.evidence_count = Array.isArray(ai.evidence) ? ai.evidence.length : 0;
        }
      }
    } catch (e) {
      // count as missing
    }

    // Read enrich ai-pos file for _generated_at + needs_regen
    const lower = t.toLowerCase();
    const posPath = path.join(ROOT, "src/data/v2-pipeline-enrich", `${lower}.ai-pos.json`);
    const pos = await readJson(posPath);
    if (pos) {
      if (pos._needs_regeneration === true) row.needs_regen = true;
      // date sources: _generated_at, or embedded in source_note/source
      const candidates: string[] = [];
      if (typeof pos._generated_at === "string") candidates.push(pos._generated_at);
      if (typeof pos.source_note === "string") candidates.push(pos.source_note);
      if (typeof pos.source === "string") candidates.push(pos.source);
      // Also check evidence[].date if evidence is object array (unlikely)
      if (Array.isArray(pos.evidence)) {
        for (const ev of pos.evidence) {
          if (ev && typeof ev === "object" && typeof ev.date === "string") {
            candidates.push(ev.date);
          }
        }
      }
      let best: string | null = null;
      for (const c of candidates) {
        const d = extractDateFromString(c);
        if (d && (!best || d < best)) best = d;
      }
      row.source_date = best;
    }

    // Also check v2-pipeline for _needs_regeneration
    const pipePath = path.join(ROOT, "src/data/v2-pipeline", `${lower}.json`);
    const pipe = await readJson(pipePath);
    if (pipe) {
      const aiPip = pipe.ai_positioning;
      if (aiPip && aiPip._needs_regeneration === true) row.needs_regen = true;
      if (pipe._needs_regeneration === true) row.needs_regen = true;
    }

    rows.push(row);
  }

  // Stats
  const stances = { leader: 0, integrator: 0, cautious: 0, absent: 0 } as Record<string, number>;
  let needs_regen = 0;
  let missing = 0;
  let oldest_date: string | null = null;
  let oldest_ste: string | null = null;
  const dates: string[] = [];
  const dist = { "<6mo": 0, "6-12mo": 0, "12-24mo": 0, ">24mo": 0 };
  // Reference date: today per env = 2026-07-13
  const REF = new Date("2026-07-13");

  for (const r of rows) {
    if (r.missing) missing++;
    else if (r.stance && stances[r.stance] !== undefined) stances[r.stance]++;
    if (r.needs_regen) needs_regen++;
    if (r.source_date) {
      dates.push(r.source_date);
      if (!oldest_date || r.source_date < oldest_date) {
        oldest_date = r.source_date;
        oldest_ste = r.ticker;
      }
      const d = new Date(r.source_date);
      const ageDays = (REF.getTime() - d.getTime()) / 86400000;
      if (ageDays < 180) dist["<6mo"]++;
      else if (ageDays < 365) dist["6-12mo"]++;
      else if (ageDays < 730) dist["12-24mo"]++;
      else dist[">24mo"]++;
    }
  }

  const ages = dates.map((d) => (REF.getTime() - new Date(d).getTime()) / 86400000);
  const avg_age_days = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

  const result = {
    stances,
    needs_regen,
    missing,
    oldest_date,
    oldest_ste,
    avg_age_days,
    distribution: dist,
  };
  console.log(JSON.stringify(result));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
