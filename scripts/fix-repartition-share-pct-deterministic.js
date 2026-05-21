/**
 * CONV-CONCEPTS · Fix déterministique massif (pas LLM) sur revenue_by_segment + revenue_by_geography
 *
 * Pour chaque fichier v2-pipeline/<t>.json + v2-pipeline-enrich/<t>.json contenant
 * revenue_by_segment OU revenue_by_geography :
 *   - Calculer total si manquant = sum(slices.value)
 *   - Pour chaque slice :
 *       * Si share_pct manquant ET total connu → share_pct = (value / total) * 100, 1 décimale
 *       * Si unit manquant sur la slice → hériter de unit du bloc parent
 *       * Cas spécial : si toutes slices sommées ≈ 100 et unit "%" → ce sont déjà des shares,
 *         copier value dans share_pct
 *   - Rescale auto si values > 999 et unit "M $" → "Mds $" (÷ 1000)
 *   - Si sum(share_pct) hors [98, 102] → flag _share_pct_check_failed
 *
 * Préserve TOUS les autres champs. JSON.parse validé. TS clean.
 */

const fs = require('fs');
const path = require('path');

const ROOT = '/Users/yann/spx-app';
const PIPE = path.join(ROOT, 'src/data/v2-pipeline');
const ENRICH = path.join(ROOT, 'src/data/v2-pipeline-enrich');
const COMPLETE = path.join(ROOT, 'src/data/v1-9-complete');

function isMillionUnit(unit) {
  if (typeof unit !== 'string') return false;
  const u = unit.trim();
  return /^M\s*[$€£¥]/.test(u) || /^M\s*[A-Z]{2,4}$/.test(u);
}

function toBillionUnit(unit) {
  if (typeof unit !== 'string') return unit;
  return unit.replace(/^M(\s*)/, 'Mds$1');
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }

/**
 * Fix un bloc repartition (segment OU geography). Mute le bloc directement.
 * Retourne stats {share_pct_added, unit_inherited, rescaled, total_added, special_pct, failed}.
 */
function fixBlock(block) {
  const stats = { share_pct_added: 0, unit_inherited: 0, rescaled: 0, total_added: 0, special_pct: 0, failed: false };
  if (!block || !Array.isArray(block.slices) || block.slices.length === 0) return stats;

  const slices = block.slices;
  const blockUnit = block.unit;

  // Étape 1 : rescale auto si values > 999 et unit "M $"
  const hasBig = slices.some(s => typeof s.value === 'number' && s.value > 999);
  const refUnit = blockUnit || (slices[0] && slices[0].unit);
  if (hasBig && isMillionUnit(refUnit)) {
    if (block.unit) block.unit = toBillionUnit(block.unit);
    for (const s of slices) {
      if (typeof s.value === 'number') {
        s.value = round2(s.value / 1000);
      }
      if (s.unit && isMillionUnit(s.unit)) {
        s.unit = toBillionUnit(s.unit);
      }
    }
    stats.rescaled = 1;
  }

  // Étape 2a : si block.unit manquant, remonter unit des slices si toutes pareilles
  if (!block.unit) {
    const sliceUnits = slices.map(s => s.unit).filter(Boolean);
    if (sliceUnits.length > 0) {
      const unique = [...new Set(sliceUnits)];
      if (unique.length === 1) {
        block.unit = unique[0];
        stats.unit_inherited++;
      }
    }
  }

  // Étape 2b : hériter unit du bloc parent sur slices manquantes
  const finalBlockUnit = block.unit;
  for (const s of slices) {
    if (!s.unit && finalBlockUnit) {
      s.unit = finalBlockUnit;
      stats.unit_inherited++;
    }
  }

  // Étape 3 : détection cas spécial "value = share déjà en %"
  // Si unit du bloc = "%" et sum(values) ≈ 100, alors values sont déjà des shares
  const sumValues = slices.reduce((acc, s) => acc + (typeof s.value === 'number' ? s.value : 0), 0);
  const blockUnitIsPct = typeof blockUnit === 'string' && blockUnit.trim() === '%';
  const valuesAreShares = blockUnitIsPct && sumValues > 98 && sumValues < 102;

  if (valuesAreShares) {
    for (const s of slices) {
      if (s.share_pct == null && typeof s.value === 'number') {
        s.share_pct = round1(s.value);
        stats.special_pct++;
      }
    }
  } else {
    // Étape 4 : calculer total si manquant
    let total = block.total;
    if (typeof total !== 'number' || total <= 0) {
      total = sumValues;
      if (total > 0) {
        block.total = round2(total);
        stats.total_added = 1;
      }
    }

    // Étape 5 : calculer share_pct manquants
    if (total > 0) {
      for (const s of slices) {
        // Cas existing share_pct → skip
        if (typeof s.share_pct === 'number') continue;
        // Cas legacy pct → mirror dans share_pct
        if (typeof s.pct === 'number') {
          s.share_pct = round1(s.pct);
          stats.share_pct_added++;
          continue;
        }
        // Cas value présent → calculer
        if (typeof s.value === 'number') {
          s.share_pct = round1((s.value / total) * 100);
          stats.share_pct_added++;
        }
      }
    }
  }

  // Étape 6 : vérification cohérence
  const sumShare = slices.reduce((acc, s) => acc + (typeof s.share_pct === 'number' ? s.share_pct : 0), 0);
  // Tolérance ±2% (98-102) — strict mais évite faux positifs sur arrondis
  if (sumShare > 0 && (sumShare < 98 || sumShare > 102)) {
    block._share_pct_check_failed = true;
    block._share_pct_sum = round1(sumShare);
    stats.failed = true;
  } else if (block._share_pct_check_failed) {
    // Nettoyer flag obsolète
    delete block._share_pct_check_failed;
    delete block._share_pct_sum;
  }

  return stats;
}

/**
 * Process un fichier JSON. Retourne stats globales.
 */
function processFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    return { parse_error: true };
  }

  const stats = {
    share_pct_added: 0,
    unit_inherited: 0,
    rescaled: 0,
    total_added: 0,
    special_pct: 0,
    failed: 0,
    blocks_touched: 0,
  };

  let dirty = false;

  // Le fichier v2-pipeline a souvent une structure { ticker, data: {...} } ou plat
  const candidates = [data, data.data].filter(d => d && typeof d === 'object');

  for (const root of candidates) {
    for (const blockKey of ['revenue_by_segment', 'revenue_by_geography']) {
      const block = root[blockKey];
      if (!block || !Array.isArray(block.slices) || block.slices.length === 0) continue;

      // Snapshot pour diff
      const before = JSON.stringify(block);
      const blockStats = fixBlock(block);
      const after = JSON.stringify(block);
      if (before !== after) {
        dirty = true;
        stats.blocks_touched++;
        stats.share_pct_added += blockStats.share_pct_added;
        stats.unit_inherited += blockStats.unit_inherited;
        stats.rescaled += blockStats.rescaled;
        stats.total_added += blockStats.total_added;
        stats.special_pct += blockStats.special_pct;
        if (blockStats.failed) stats.failed++;
      }
    }
  }

  if (dirty) {
    // Validation JSON post-write
    const newContent = JSON.stringify(data, null, 2);
    try {
      JSON.parse(newContent);
    } catch (e) {
      return { write_error: true };
    }
    fs.writeFileSync(filePath, newContent);
  }

  return { ...stats, dirty };
}

// ============ Main ============
const dirs = [PIPE, ENRICH, COMPLETE];
const stats = {
  files_processed: 0,
  files_modified: 0,
  files_parse_error: 0,
  share_pct_added: 0,
  unit_inherited: 0,
  rescaled: 0,
  total_added: 0,
  special_pct: 0,
  failed_blocks: 0,
  blocks_touched: 0,
};
const samples = [];
const sampleTickers = new Set(['googl', 'aapl', 'msft', 'amzn', 'nvda', 'meta']);

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  for (const f of files) {
    const filePath = path.join(dir, f);
    const base = f.replace('.json', '').toLowerCase();

    // Pre-snapshot pour samples
    let before = null;
    if (sampleTickers.has(base)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const root = raw.data || raw;
        before = {
          seg: root.revenue_by_segment ? JSON.parse(JSON.stringify(root.revenue_by_segment)) : null,
          geo: root.revenue_by_geography ? JSON.parse(JSON.stringify(root.revenue_by_geography)) : null,
        };
      } catch {}
    }

    const r = processFile(filePath);
    if (!r) continue;
    stats.files_processed++;
    if (r.parse_error) { stats.files_parse_error++; continue; }
    if (r.dirty) {
      stats.files_modified++;
      stats.share_pct_added += r.share_pct_added;
      stats.unit_inherited += r.unit_inherited;
      stats.rescaled += r.rescaled;
      stats.total_added += r.total_added;
      stats.special_pct += r.special_pct;
      stats.failed_blocks += r.failed;
      stats.blocks_touched += r.blocks_touched;
    }

    // Post-snapshot pour samples
    if (sampleTickers.has(base) && before) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const root = raw.data || raw;
        samples.push({
          file: path.relative(ROOT, filePath),
          ticker: base.toUpperCase(),
          before,
          after: {
            seg: root.revenue_by_segment || null,
            geo: root.revenue_by_geography || null,
          },
        });
      } catch {}
    }
  }
}

console.log('=== FIX REPARTITION DETERMINISTIC ===');
console.log(JSON.stringify(stats, null, 2));
console.log('\nSAMPLES (avant/après) :');
for (const s of samples.slice(0, 3)) {
  console.log('---', s.ticker, s.file, '---');
  console.log('BEFORE seg:', JSON.stringify(s.before.seg && { unit: s.before.seg.unit, total: s.before.seg.total, slices: s.before.seg.slices && s.before.seg.slices.slice(0, 2) }, null, 2));
  console.log('AFTER  seg:', JSON.stringify(s.after.seg && { unit: s.after.seg.unit, total: s.after.seg.total, slices: s.after.seg.slices && s.after.seg.slices.slice(0, 2) }, null, 2));
}
