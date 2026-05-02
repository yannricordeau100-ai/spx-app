#!/usr/bin/env node
/**
 * Auto-calcule TTM (Trailing Twelve Months) pour tous les KPI de toutes
 * les sociétés V1 + V1.7 qui n'ont pas encore de valeur ttm explicite.
 *
 * Formule (approximation, sans Q1 2026 réelle) :
 *   ttm ≈ history[-1] × (1 + recent_growth_rate / 4)
 * où recent_growth_rate = (history[-1] - history[-2]) / history[-2]
 *
 * Cette formule représente "les 4 derniers trimestres dispos" en supposant
 * qu'un trimestre de croissance équivalente s'ajoute (Q1 N) au lieu du
 * 1er trimestre déjà compté (Q1 N-1).
 *
 * Skip pour :
 *   - KPI avec history vide ou < 2 points
 *   - KPI déjà ttm explicite (manuel pour V1)
 *   - KPI is_short_history (court historique = pas pertinent)
 *
 * Usage :
 *   node scripts/auto-ttm.mjs           # V1 + V1.7
 *   node scripts/auto-ttm.mjs --v1      # V1 only
 *   node scripts/auto-ttm.mjs --v1-7    # V1.7 only
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/yann/spx-app/src/data";
const V1_FILES = ["google.json", "meta.json", "msci.json", "spgi.json", "cat.json"];

function computeTTM(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (typeof last !== "number" || typeof prev !== "number") return null;
  if (prev === 0) return last; // évite division par zéro
  const yoy = (last - prev) / Math.abs(prev);
  // TTM = last × (1 + yoy/4) → estime Q1 N en ajoutant 1/4 du YoY
  const ttm = last * (1 + yoy / 4);
  // Arrondi à 2 décimales pour propreté
  return Math.round(ttm * 100) / 100;
}

function processFile(filePath, label) {
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (e) {
    return { added: 0, skipped: 0, error: e.message };
  }

  let added = 0;
  let skipped = 0;

  // Process kpis array
  for (const k of data.kpis ?? []) {
    if (k.ttm != null) { skipped++; continue; }
    if (k.is_short_history) { skipped++; continue; }
    const ttm = computeTTM(k.history);
    if (ttm == null) { skipped++; continue; }
    k.ttm = ttm;
    added++;
  }

  // Some V1.7 datasets have stories_kpis separately
  for (const k of data.stories_kpis ?? []) {
    if (k.ttm != null) { skipped++; continue; }
    const ttm = computeTTM(k.history);
    if (ttm == null) { skipped++; continue; }
    k.ttm = ttm;
    added++;
  }

  if (added > 0) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  }
  return { added, skipped };
}

const args = process.argv.slice(2);
const onlyV1 = args.includes("--v1");
const onlyV17 = args.includes("--v1-7");

let totalAdded = 0;
let totalSkipped = 0;

if (!onlyV17) {
  console.log("=== V1 (5 sociétés) ===");
  for (const f of V1_FILES) {
    const path = join(ROOT, f);
    const r = processFile(path, f);
    console.log(`  ${f.padEnd(15)} +${r.added} ttm  (${r.skipped} skipped${r.error ? `, error: ${r.error}` : ""})`);
    totalAdded += r.added;
    totalSkipped += r.skipped;
  }
}

if (!onlyV1) {
  console.log("\n=== V1.7 pipeline (per-ticker JSON) ===");
  const v17Dir = join(ROOT, "v2-pipeline");
  let v17Files = readdirSync(v17Dir)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !f.startsWith("_"))
    .filter((f) => !f.includes(".gemini")); // skip gemini-only test files
  let v17Added = 0;
  let v17Skipped = 0;
  let v17Filescount = 0;
  for (const f of v17Files) {
    const path = join(v17Dir, f);
    const r = processFile(path, f);
    v17Added += r.added;
    v17Skipped += r.skipped;
    if (r.added > 0) v17Filescount++;
  }
  console.log(`  ${v17Files.length} fichiers traités, ${v17Filescount} avec TTM ajouté`);
  console.log(`  Total : +${v17Added} ttm (${v17Skipped} skipped)`);
  totalAdded += v17Added;
  totalSkipped += v17Skipped;
}

console.log(`\n>>> Total : ${totalAdded} TTM ajoutés, ${totalSkipped} skipped <<<`);
console.log("Pour appliquer en V1.7 : npx tsx scripts/build-v2-pipeline-merged.ts");
