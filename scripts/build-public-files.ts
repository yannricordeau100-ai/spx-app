/**
 * build-public-files.ts
 *
 * Régénère les datasets pré-filtrés utilisés par les hubs sandbox V1.6 et
 * V1.7 :
 *   - src/data/v1-7-public.json : 421 stés Pass 3 validées (champ
 *     _validation OU _validation_global non null), avec au moins 1 KPI.
 *   - src/data/v1-6-public.json : 1606 stés du pipeline (toutes), avec au
 *     moins 1 KPI (skip dataset corrompu / vide).
 *
 * Pourquoi : importer `_merged.json` (16 MB) directement dans une page
 * Next.js explose le bundle JS et ralentit le first paint. Les fichiers
 * pré-filtrés font ~300 KB (V1.7) et ~16 MB (V1.6) avec sérialisation
 * compacte. À terme, V1.6 devra basculer sur Supabase pour la 2.0.
 *
 * Usage :
 *   npx tsx scripts/build-public-files.ts
 *
 * Lancé automatiquement par le cron `mettrik-rebuild-merged` toutes les
 * heures, après le rebuild de `_merged.json` par CONV-DATA.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const MERGED_PATH = path.join(ROOT, "src/data/v2-pipeline/_merged.json");
const V17_OUT = path.join(ROOT, "src/data/v1-7-public.json");
const V16_OUT = path.join(ROOT, "src/data/v1-6-public.json");

type AnyRecord = Record<string, unknown>;

function isValidPipelineEntry(v: unknown): v is AnyRecord {
  if (!v || typeof v !== "object") return false;
  const obj = v as AnyRecord;
  return Array.isArray(obj.kpis) && (obj.kpis as unknown[]).length > 0;
}

function isPass3(v: AnyRecord): boolean {
  return !!(v._validation || v._validation_global);
}

function main() {
  const raw = readFileSync(MERGED_PATH, "utf-8");
  const merged = JSON.parse(raw) as Record<string, unknown>;

  const v17: Record<string, AnyRecord> = {};
  const v16: Record<string, AnyRecord> = {};

  for (const [ticker, entry] of Object.entries(merged)) {
    if (!isValidPipelineEntry(entry)) continue;
    v16[ticker] = entry;
    if (isPass3(entry)) v17[ticker] = entry;
  }

  writeFileSync(V17_OUT, JSON.stringify(v17), "utf-8");
  writeFileSync(V16_OUT, JSON.stringify(v16), "utf-8");

  const v17Size = (JSON.stringify(v17).length / 1024).toFixed(0);
  const v16Size = (JSON.stringify(v16).length / 1024).toFixed(0);
  console.log(`✅ V1.7 public : ${Object.keys(v17).length} stés (${v17Size} KB) → ${V17_OUT}`);
  console.log(`✅ V1.6 public : ${Object.keys(v16).length} stés (${v16Size} KB) → ${V16_OUT}`);
}

main();
