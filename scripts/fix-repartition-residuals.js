/**
 * Fix heuristique des 73 stés f_repartition KO résiduelles (audit 21 mai).
 *
 * Stratégie :
 *   1. Pour chaque sté flagged, ouvrir enrich + pipeline.
 *   2. Pour chaque bloc (segment / geography), nettoyer les slices :
 *      - Si value=null ET share_pct=null → REMOVE la slice (donnée fantôme).
 *      - Si toutes les slices restantes du bloc ont value=null ET aucun pct → REMOVE le bloc entier (bidon).
 *      - Sinon, garder.
 *   3. Pour value_gt_999 + share_pct présent : laisser tel quel (faux positif audit, UI affiche pct%).
 *   4. Écrire dans enrich (scope strict).
 *
 * Pas d'écriture sur v2-pipeline/<t>.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/yann/spx-app';
const ENRICH = path.join(ROOT, 'src/data/v2-pipeline-enrich');
const PIPE = path.join(ROOT, 'src/data/v2-pipeline');
const COMPLETE = path.join(ROOT, 'src/data/v1-9-complete');
const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/v1-9-repartition-audit.json'), 'utf-8'));

function tryReadWithPath(dir, t) {
  for (const v of [t, t.toLowerCase(), t.toUpperCase()]) {
    const p = path.join(dir, v + '.json');
    if (fs.existsSync(p)) {
      try { return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf-8')) }; } catch { return null; }
    }
  }
  return null;
}

let removedSlices = 0;
let removedBlocks = 0;
let stesModified = 0;
const notifyDataExtraction = [];

for (const flag of audit.flags) {
  const t = flag.ticker;
  const probs = new Set(flag.problems);
  // Skip stes where issue is ONLY no_segment / no_geo (vraies données manquantes pour CONV-DATA)
  const onlyBlockMissing = flag.problems.every(p => p === 'no_segment' || p === 'no_geo');
  if (onlyBlockMissing) {
    notifyDataExtraction.push({ ticker: t, reason: flag.problems.join('+') });
    continue;
  }

  // Try to locate enrich for write
  let enrichEntry = tryReadWithPath(ENRICH, t);
  const pipeEntry = tryReadWithPath(PIPE, t);
  const completeEntry = tryReadWithPath(COMPLETE, t);

  // We will write to enrich. If enrich does not exist, create stub at lowercase.
  let enrichPath = enrichEntry ? enrichEntry.path : path.join(ENRICH, `${t.toLowerCase()}.json`);
  let enrichData = enrichEntry ? enrichEntry.data : {};

  let modified = false;

  for (const blockName of ['revenue_by_segment', 'revenue_by_geography']) {
    // Source for cleanup: enrich first, then pipe, then complete
    let block = enrichData[blockName] || (pipeEntry && pipeEntry.data[blockName]) || (completeEntry && completeEntry.data[blockName]);
    if (!block || !Array.isArray(block.slices) || block.slices.length === 0) continue;

    // Clean: remove slices with value=null AND no share_pct
    const before = block.slices.length;
    const cleaned = block.slices.filter(s => {
      const hasValue = typeof s.value === 'number' && !isNaN(s.value);
      const hasPct = (s.share_pct != null && typeof s.share_pct === 'number') || (s.pct != null && typeof s.pct === 'number');
      // Remove if no value AND no pct
      return hasValue || hasPct;
    });
    const removed = before - cleaned.length;

    if (removed > 0) {
      removedSlices += removed;
      modified = true;
    }

    if (cleaned.length === 0) {
      // Block is bogus → delete from enrich
      if (enrichData[blockName]) {
        delete enrichData[blockName];
        removedBlocks++;
        modified = true;
      }
      // Also tag for notify CONV-DATA (real data needed)
      notifyDataExtraction.push({ ticker: t, reason: `${blockName}_all_empty_after_cleanup` });
    } else if (removed > 0) {
      enrichData[blockName] = { ...block, slices: cleaned };
    }
  }

  if (modified) {
    fs.writeFileSync(enrichPath, JSON.stringify(enrichData, null, 2));
    stesModified++;
  }
}

console.log('=== FIX RESULTS ===');
console.log('Stes modified :', stesModified);
console.log('Slices removed (value=null + pct=null):', removedSlices);
console.log('Blocks removed (all empty after cleanup):', removedBlocks);
console.log('Stes to notify CONV-DATA (real extraction needed):', notifyDataExtraction.length);
console.log('\nNotify list:');
for (const n of notifyDataExtraction.slice(0, 50)) {
  console.log(`  ${n.ticker.padEnd(12)} ${n.reason}`);
}
if (notifyDataExtraction.length > 50) console.log(`  ... and ${notifyDataExtraction.length - 50} more`);

fs.writeFileSync(path.join(ROOT, 'src/data/v1-9-repartition-notify-data.json'), JSON.stringify(notifyDataExtraction, null, 2));
