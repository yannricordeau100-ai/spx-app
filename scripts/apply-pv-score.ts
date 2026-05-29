/**
 * Applique le scoring PV (kpi-ordering-pv.ts) à tous les fichiers de
 * src/data/v2-pipeline-specific-kpis/. Ajoute le champ `pv_score`
 * (0-10) sur chaque KPI sans modifier l'ordre d'origine.
 *
 * MISSION 3 du prompt REEXTRACT-OPUS-29MAY.
 *
 * Usage : npx ts-node scripts/apply-pv-score.ts
 *         npx tsx scripts/apply-pv-score.ts
 */

import fs from "node:fs";
import path from "node:path";
import { annotateKpisWithPvScore, type ScorableKpi } from "../src/lib/kpi-ordering-pv";

const DIR = path.resolve(__dirname, "../src/data/v2-pipeline-specific-kpis");

type KpiFile = {
  ticker?: string;
  kpis?: ScorableKpi[];
  kpis_story?: ScorableKpi[];
  [k: string]: unknown;
};

function processFile(filename: string): {
  ticker: string;
  changed: boolean;
  kpi_count: number;
  story_count: number;
  max_score: number;
  avg_score: number;
} {
  const full = path.join(DIR, filename);
  const raw = fs.readFileSync(full, "utf-8");
  const data: KpiFile = JSON.parse(raw);
  const ticker = data.ticker ?? filename.replace(/\.json$/, "");

  let changed = false;
  let totalScored = 0;
  let scoreSum = 0;
  let maxScore = 0;

  const heroShort =
    (data.kpis ?? []).find(
      (k) => (k as { is_hero?: boolean }).is_hero === true,
    )?.short;

  if (Array.isArray(data.kpis) && data.kpis.length > 0) {
    const annotated = annotateKpisWithPvScore(data.kpis, { heroShort });
    for (let i = 0; i < annotated.length; i++) {
      const old = (data.kpis[i] as { pv_score?: number }).pv_score;
      const next = annotated[i].pv_score;
      if (old !== next) changed = true;
      data.kpis[i] = annotated[i];
      totalScored++;
      scoreSum += next;
      if (next > maxScore) maxScore = next;
    }
  }

  if (Array.isArray(data.kpis_story) && data.kpis_story.length > 0) {
    const annotated = annotateKpisWithPvScore(data.kpis_story, { heroShort });
    for (let i = 0; i < annotated.length; i++) {
      const old = (data.kpis_story[i] as { pv_score?: number }).pv_score;
      const next = annotated[i].pv_score;
      if (old !== next) changed = true;
      data.kpis_story[i] = annotated[i];
      totalScored++;
      scoreSum += next;
      if (next > maxScore) maxScore = next;
    }
  }

  if (changed) {
    data._pv_score_applied_at = new Date().toISOString();
    data._pv_score_signed_by = "REEXTRACT-OPUS-29MAY-residual";
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + "\n", "utf-8");
  }

  return {
    ticker,
    changed,
    kpi_count: Array.isArray(data.kpis) ? data.kpis.length : 0,
    story_count: Array.isArray(data.kpis_story) ? data.kpis_story.length : 0,
    max_score: maxScore,
    avg_score: totalScored > 0 ? Math.round((scoreSum / totalScored) * 10) / 10 : 0,
  };
}

function main(): void {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  let written = 0;
  let totalKpis = 0;
  let totalStories = 0;
  const sample: Array<ReturnType<typeof processFile>> = [];

  for (const f of files) {
    try {
      const r = processFile(f);
      if (r.changed) written++;
      totalKpis += r.kpi_count;
      totalStories += r.story_count;
      if (sample.length < 5) sample.push(r);
    } catch (e) {
      console.error(`[apply-pv-score] ERROR on ${f}:`, (e as Error).message);
    }
  }

  console.log(
    JSON.stringify(
      {
        files_total: files.length,
        files_written: written,
        kpis_scored: totalKpis,
        stories_scored: totalStories,
        sample,
      },
      null,
      2,
    ),
  );
}

main();
