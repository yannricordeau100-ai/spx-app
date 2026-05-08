#!/usr/bin/env npx tsx
/**
 * preview-ui-fixes.ts · CONV-MODULE-UI-AUDIT
 *
 * Lit `src/data/v1-8-ui-audit.json` et imprime un avant/après pour CHAQUE
 * sample texte des défauts qui ont un fix template applicable
 * (UI_BAD_UNIT_NARRATIVE, UI_BAD_UNIT_BS, UI_PCT_NO_NBSP, UI_LABEL_EN).
 *
 * Démontre concrètement ce que `normalizeNarrative` / `translateChipLabel`
 * vont produire sur les vraies données, sans modifier l'app.
 *
 * Usage : npx tsx scripts/preview-ui-fixes.ts [v1-7|v1-8]
 *         (default = v1-8)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeNarrative,
  normalizeBToMds,
  normalizeUnitSpacing,
  addNbspBeforePct,
  translateChipLabel,
} from "../src/lib/ui-fix-templates";

const ROOT = resolve(__dirname, "..");
const version = process.argv[2] ?? "v1-8";
const path = resolve(ROOT, `src/data/${version}-ui-audit.json`);

interface AuditOutput {
  generated_at: string;
  total_audited: number;
  results: Array<{
    ticker: string;
    defects: Array<{ code: string; samples: string[] }>;
  }>;
}

const data: AuditOutput = JSON.parse(readFileSync(path, "utf-8"));

interface Bucket {
  count: number;
  examples: Array<{ ticker: string; before: string; after: string }>;
}

const buckets: Record<string, Bucket> = {
  UI_BAD_UNIT_NARRATIVE: { count: 0, examples: [] },
  UI_BAD_UNIT_BS: { count: 0, examples: [] },
  UI_PCT_NO_NBSP: { count: 0, examples: [] },
  UI_LABEL_EN: { count: 0, examples: [] },
};

for (const r of data.results) {
  for (const d of r.defects) {
    if (!buckets[d.code]) continue;
    buckets[d.code].count++;
    if (buckets[d.code].examples.length >= 3) continue;
    for (const sample of d.samples) {
      let after: string;
      if (d.code === "UI_BAD_UNIT_NARRATIVE") after = normalizeUnitSpacing(sample);
      else if (d.code === "UI_BAD_UNIT_BS") after = normalizeBToMds(sample);
      else if (d.code === "UI_PCT_NO_NBSP") after = addNbspBeforePct(sample);
      else if (d.code === "UI_LABEL_EN") {
        // Sample format : "Sector×N", on ne traduit pas le sample tel quel,
        // on indique l'effet attendu.
        const m = sample.match(/^([A-Za-z-]+)/);
        after = m ? `${translateChipLabel(m[1])} (label chip remplacé partout)` : sample;
      } else after = sample;

      if (after !== sample) {
        buckets[d.code].examples.push({ ticker: r.ticker, before: sample, after });
        break;
      }
    }
  }
}

console.log(`=== Preview UI fixes · ${version} · ${data.total_audited} stés auditées ===\n`);

for (const [code, b] of Object.entries(buckets)) {
  console.log(`▸ ${code} (${b.count} stés concernées)`);
  for (const ex of b.examples) {
    const safeBefore = ex.before.length > 110 ? ex.before.slice(0, 110) + "…" : ex.before;
    const safeAfter = ex.after.length > 110 ? ex.after.slice(0, 110) + "…" : ex.after;
    console.log(`   [${ex.ticker.padEnd(10)}]`);
    console.log(`     avant : ${JSON.stringify(safeBefore)}`);
    console.log(`     après : ${JSON.stringify(safeAfter)}`);
  }
  console.log();
}

console.log("Helpers utilisés depuis src/lib/ui-fix-templates.ts :");
console.log("  normalizeNarrative · normalizeUnitSpacing · normalizeBToMds");
console.log("  addNbspBeforePct · translateChipLabel · ACRONYM_GLOSSARY (18 entrées)");
console.log("\nApplication concrète :");
console.log("  - Importer dans le composant qui rend la string narrative");
console.log("  - Wrapper : `<p>{normalizeNarrative(description)}</p>`");
console.log("  - Idempotent : appliquer 2x ne change rien après la 1re passe.");
