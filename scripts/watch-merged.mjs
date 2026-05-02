#!/usr/bin/env node
// =============================================================================
// watch-merged.mjs · Détecteur de nouvelles sociétés dans _merged.json
// =============================================================================
// Usage : node scripts/watch-merged.mjs
//
// Surveille `src/data/v2-pipeline/_merged.json` et imprime un diff (tickers
// ajoutés / retirés) à chaque modification. Utile pour savoir quand
// CONV-DATA pousse de nouvelles sociétés et qu'on peut les tester sur
// /sandbox/v1-7/<ticker>.
//
// Affiche aussi un compteur global (total de tickers, breakdown par sector
// si dispo dans le data).
// =============================================================================

import { readFileSync, statSync, watchFile } from "node:fs";
import { resolve } from "node:path";

const MERGED = resolve("/Users/yann/spx-app/src/data/v2-pipeline/_merged.json");

let prevTickers = new Set();
let prevMtime = 0;

function readTickers() {
  try {
    const data = JSON.parse(readFileSync(MERGED, "utf-8"));
    return new Set(Object.keys(data));
  } catch {
    return new Set();
  }
}

function fmtTime() {
  return new Date().toISOString().slice(11, 19);
}

function diffAndReport() {
  const cur = readTickers();
  const added = [...cur].filter((t) => !prevTickers.has(t));
  const removed = [...prevTickers].filter((t) => !cur.has(t));
  if (added.length === 0 && removed.length === 0 && prevTickers.size > 0) return;

  console.log(`\n[${fmtTime()}] _merged.json updated`);
  console.log(`  Total : ${cur.size} tickers`);
  if (added.length > 0) console.log(`  Ajoutés (${added.length}) : ${added.sort().join(", ")}`);
  if (removed.length > 0) console.log(`  Retirés (${removed.length}) : ${removed.sort().join(", ")}`);
  prevTickers = cur;
}

// Initial read
prevTickers = readTickers();
prevMtime = statSync(MERGED).mtimeMs;
console.log(`Watching ${MERGED}`);
console.log(`Initial : ${prevTickers.size} tickers à ${fmtTime()}`);

watchFile(MERGED, { interval: 5000 }, (curr) => {
  if (curr.mtimeMs === prevMtime) return;
  prevMtime = curr.mtimeMs;
  diffAndReport();
});
