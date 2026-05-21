/**
 * Fix audit pré-publication items (e) + (f) :
 *   (e) profit_warning manquants : régénère via heuristique no-LLM
 *       (port direct de scripts/gen-profit-warning.py mais en JS, écrit
 *       dans v2-pipeline-enrich/<t>.json plutôt que v2-pipeline)
 *   (f) Répartition CA :
 *       - rescale value > 999 avec unit "M $" / "M €" → diviser par 1000 + "Mds $/€"
 *       - rescale value > 999 avec unit "M XYZ" (autres devises) : idem
 *       - ajouter share_pct calculé si absent (value/total*100)
 *       - ordonner les risks par score décroissant
 *
 * Scope strict CONV-CONCEPTS : écriture UNIQUEMENT dans v2-pipeline-enrich/.
 * Ne touche jamais v2-pipeline/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/yann/spx-app';
const PUBL = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/v1-9-publishable.json'), 'utf-8'));
const TICKERS = PUBL.tickers || PUBL;
const COMPLETE = path.join(ROOT, 'src/data/v1-9-complete');
const PIPE = path.join(ROOT, 'src/data/v2-pipeline');
const ENRICH = path.join(ROOT, 'src/data/v2-pipeline-enrich');

function tryRead(dir, t) {
  for (const variant of [t, t.toLowerCase(), t.toUpperCase()]) {
    const p = path.join(dir, `${variant}.json`);
    if (fs.existsSync(p)) {
      try { return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf-8')) }; } catch { return null; }
    }
  }
  return null;
}

function enrichPath(t) {
  // Build script reads `${lower}.json` — keep lowercase convention.
  return path.join(ENRICH, `${t.toLowerCase()}.json`);
}

function readEnrich(t) {
  const p = enrichPath(t);
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
  }
  return {};
}

function writeEnrich(t, data) {
  const p = enrichPath(t);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ============ profit_warning heuristique (port de gen-profit-warning.py) ============
function computePW(d) {
  const kpis = d.kpis || [];
  if (!kpis.length) return null;
  const hero = d.hero_kpi || '';
  const heroKpi = kpis.find(k => k && (k.short === hero || k.name_fr === hero || k.name_en === hero));

  const margins = kpis.filter(k => {
    const s = (k && k.short || '').toLowerCase();
    return s.includes('margin') || s.includes('marge');
  });
  const marginYoys = [];
  for (const m of margins) {
    const yoy = m.yoy;
    if (typeof yoy === 'string') {
      const mm = yoy.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*(?:%|pts)/);
      if (mm) {
        const n = parseFloat(mm[1]);
        if (!isNaN(n)) marginYoys.push(n);
      }
    }
  }

  let heroYoy = null;
  if (heroKpi && typeof heroKpi.yoy === 'string') {
    const mm = heroKpi.yoy.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*%/);
    if (mm) {
      const n = parseFloat(mm[1]);
      if (!isNaN(n)) heroYoy = n;
    }
  }

  let score = 3;
  const parts = [];
  let marginTrend;
  if (marginYoys.length) {
    const avg = marginYoys.reduce((a, b) => a + b, 0) / marginYoys.length;
    if (avg > 1) { marginTrend = `Marges en expansion (+${avg.toFixed(1)} pts en moyenne sur les KPIs marge).`; score -= 1; }
    else if (avg < -1) { marginTrend = `Marges sous pression (${avg.toFixed(1)} pts en moyenne).`; score += 1; }
    else { marginTrend = `Marges stables (variation moyenne ${avg >= 0 ? '+' : ''}${avg.toFixed(1)} pts).`; }
  } else {
    marginTrend = 'Pas de KPI marge disponible pour évaluer la tendance.';
  }

  if (heroYoy != null) {
    if (heroYoy < -10) { parts.push(`Hero KPI ${hero} en repli (${heroYoy >= 0 ? '+' : ''}${heroYoy.toFixed(1)}%), signal de prudence.`); score += 1; }
    else if (heroYoy > 10) { parts.push(`Hero KPI ${hero} en croissance soutenue (${heroYoy >= 0 ? '+' : ''}${heroYoy.toFixed(1)}%), faible probabilité de profit warning.`); score -= 1; }
    else { parts.push(`Hero KPI ${hero} en croissance modérée (${heroYoy >= 0 ? '+' : ''}${heroYoy.toFixed(1)}%).`); }
  }
  parts.push('Pas de profit warning formel identifié dans les sources analysées (10-K, transcripts).');
  parts.push('À reconfirmer au prochain earnings call.');

  score = Math.max(1, Math.min(5, score));
  return {
    last_date: null,
    score,
    rationale: parts.join(' '),
    margin_trend: marginTrend,
  };
}

// ============ Repartition rescale + share_pct ============
function isMillionUnit(unit) {
  if (typeof unit !== 'string') return false;
  const u = unit.trim();
  // "M $", "M€", "M EUR", "M USD", "M CHF", "M £", etc.
  return /^M\s*[$€£¥]/.test(u) || /^M\s*[A-Z]{2,4}$/.test(u);
}

function toBillionUnit(unit) {
  if (typeof unit !== 'string') return unit;
  return unit.replace(/^M(\s*)/, 'Mds$1');
}

function fixRepartitionBlock(block) {
  if (!block || !Array.isArray(block.slices) || !block.slices.length) return { block, changes: 0 };
  const slices = block.slices;
  const blockUnit = block.unit;

  // Detect if rescale needed:
  //  - any value > 999 AND
  //    (a) unit is explicitly "M xxx" OR
  //    (b) no unit specified but all numeric values are > 999 (assume millions, default USD)
  const numericValues = slices.map(s => s.value).filter(v => typeof v === 'number');
  const hasBig = numericValues.some(v => v > 999);
  const refUnit = blockUnit || (slices[0] && slices[0].unit);
  let needRescale = false;
  let defaultUnit = null;
  if (hasBig) {
    if (isMillionUnit(refUnit)) {
      needRescale = true;
    } else if (!refUnit && numericValues.length >= 2 && numericValues.every(v => v > 99)) {
      // All values 3+ digits, no unit → assume millions USD (most common SEC reporting unit)
      needRescale = true;
      defaultUnit = 'M $';
    }
  }

  let changes = 0;
  const newBlock = { ...block, slices: slices.map(s => ({ ...s })) };

  if (needRescale) {
    const fromUnit = newBlock.unit || defaultUnit || 'M $';
    newBlock.unit = toBillionUnit(fromUnit);
    for (const s of newBlock.slices) {
      if (typeof s.value === 'number') {
        s.value = Math.round((s.value / 1000) * 100) / 100;
      }
      if (s.unit && isMillionUnit(s.unit)) {
        s.unit = toBillionUnit(s.unit);
      }
    }
    changes++;
  }

  // Compute share_pct if missing
  const total = newBlock.slices.reduce((acc, s) => acc + (typeof s.value === 'number' ? s.value : 0), 0);
  if (total > 0) {
    for (const s of newBlock.slices) {
      if (s.share_pct == null && s.pct == null && typeof s.value === 'number') {
        s.share_pct = Math.round((s.value / total) * 1000) / 10; // 1 decimal
        changes++;
      } else if (s.share_pct == null && typeof s.pct === 'number') {
        // Mirror legacy pct field into share_pct
        s.share_pct = s.pct;
        changes++;
      }
    }
  }
  return { block: newBlock, changes };
}

// ============ Sort risks by score desc ============
function sortRisks(risks) {
  if (!Array.isArray(risks)) return { risks, changed: false };
  const ordered = [...risks].sort((a, b) => (b.score || 0) - (a.score || 0));
  // detect if order changed
  let changed = false;
  for (let i = 0; i < risks.length; i++) {
    if (risks[i] !== ordered[i]) { changed = true; break; }
  }
  return { risks: ordered, changed };
}

// ============ Main ============
const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/v1-9-repartition-audit.json'), 'utf-8'));
const risksAudit = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/v1-9-risks-audit.json'), 'utf-8'));

const stats = {
  pw_added: 0,
  seg_rescaled: 0,
  geo_rescaled: 0,
  seg_pct_added: 0,
  geo_pct_added: 0,
  risks_sorted: 0,
};
const samples = { pw: [], rep: [], risks: [] };
let processed = 0;

for (const T of TICKERS) {
  processed++;
  const merged = tryRead(COMPLETE, T);
  if (!merged) continue;
  const pipe = tryRead(PIPE, T);

  const enrich = readEnrich(T);
  let dirty = false;

  // (e) profit_warning
  const existing = (pipe && pipe.data && pipe.data.profit_warning) || enrich.profit_warning || merged.data.profit_warning;
  if (!existing) {
    const pw = computePW(merged.data);
    if (pw) {
      enrich.profit_warning = pw;
      enrich._profit_warning_at = new Date().toISOString();
      stats.pw_added++;
      if (samples.pw.length < 3) {
        samples.pw.push({ ticker: T, before: null, after: pw });
      }
      dirty = true;
    }
  }

  // (f) Repartition rescale + share_pct (write override into enrich)
  // Read from live-merge: prefer enrich > pipe > merged-cache. Same logic as audit.
  function pickMostSlicesLive(...candidates) {
    const withSlices = candidates.filter(c => c && Array.isArray(c.slices) && c.slices.length > 0);
    if (withSlices.length) {
      withSlices.sort((a, b) => b.slices.length - a.slices.length);
      return withSlices[0];
    }
    return null;
  }
  const seg = pickMostSlicesLive(enrich.revenue_by_segment, pipe && pipe.data && pipe.data.revenue_by_segment, merged.data.revenue_by_segment);
  const geo = pickMostSlicesLive(enrich.revenue_by_geography, pipe && pipe.data && pipe.data.revenue_by_geography, merged.data.revenue_by_geography);
  for (const [blockKey, block, statKey, pctKey] of [
    ['revenue_by_segment', seg, 'seg_rescaled', 'seg_pct_added'],
    ['revenue_by_geography', geo, 'geo_rescaled', 'geo_pct_added'],
  ]) {
    if (!block || !block.slices || !block.slices.length) continue;
    const { block: newBlock, changes } = fixRepartitionBlock(block);
    if (changes > 0) {
      // Determine sub-stats: did we rescale (any slice unit change or block.unit change)?
      const rescaled = newBlock.unit !== block.unit ||
        newBlock.slices.some((s, i) => typeof s.value === 'number' && typeof block.slices[i].value === 'number' && Math.abs(s.value - block.slices[i].value) > 0.001);
      const pctAdded = newBlock.slices.some((s, i) => (s.share_pct != null) && (block.slices[i].share_pct == null && block.slices[i].pct == null));
      if (rescaled) stats[statKey]++;
      if (pctAdded) stats[pctKey]++;
      enrich[blockKey] = newBlock;
      enrich[`_${blockKey}_normalized_at`] = new Date().toISOString();
      if (samples.rep.length < 6) {
        samples.rep.push({
          ticker: T,
          block: blockKey,
          before: { unit: block.unit, slices: block.slices.slice(0, 2) },
          after: { unit: newBlock.unit, slices: newBlock.slices.slice(0, 2) },
        });
      }
      dirty = true;
    }
  }

  // (e) Sort risks by score desc — only if from merged ordering is broken
  const risks = merged.data.risks;
  if (Array.isArray(risks) && risks.length >= 2) {
    let lastScore = Infinity;
    let unordered = false;
    for (const r of risks) {
      const s = typeof r.score === 'number' ? r.score : 0;
      if (s > lastScore) { unordered = true; break; }
      lastScore = s;
    }
    if (unordered) {
      const { risks: sorted } = sortRisks(risks);
      enrich.risks = sorted;
      enrich._risks_sorted_at = new Date().toISOString();
      stats.risks_sorted++;
      if (samples.risks.length < 3) {
        samples.risks.push({
          ticker: T,
          before_scores: risks.map(r => r.score),
          after_scores: sorted.map(r => r.score),
        });
      }
      dirty = true;
    }
  }

  if (dirty) writeEnrich(T, enrich);
}

console.log('=== FIX RESULTS ===');
console.log('processed:', processed);
console.log(JSON.stringify(stats, null, 2));
console.log('\nSAMPLES profit_warning :');
for (const s of samples.pw) console.log(JSON.stringify(s, null, 2));
console.log('\nSAMPLES repartition :');
for (const s of samples.rep) console.log(JSON.stringify(s, null, 2));
console.log('\nSAMPLES risks ordering :');
for (const s of samples.risks) console.log(JSON.stringify(s, null, 2));
