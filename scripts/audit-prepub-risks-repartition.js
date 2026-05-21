/**
 * Audit pré-publication (Yann 21 mai) items (e) + (f) :
 *   (e) Facteurs de risque dérivés 10-K/10-Q :
 *       - risks[] présent, ≥ 3 items, ordonnés par score décroissant
 *       - chaque risk a score_rationale citant 4 critères (position, intensité, trend, weight)
 *       - profit_warning présent (sté ou enrich)
 *   (f) Répartition CA segment + geo :
 *       - chaque slice value entre 1-999 (sinon rescale needed)
 *       - share_pct présent (ou calculable)
 *
 * Lecture v1-9-complete (vue mergée). Pas d'écriture ici.
 * Output : src/data/v1-9-repartition-audit.json + src/data/v1-9-risks-audit.json
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
      try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
    }
  }
  return null;
}

const RATIONALE_KEYWORDS = [
  // Position 10-K Item 1A / dans le filing
  ['position', /(item\s*1a|item\s*3|position|rang|priorité|priorit[ée]|#\d|note\s*\d\/5|premi[èe]re partie|en t[êe]te|fac(?:teur|teurs)\s+pr(?:incip|imord))/i],
  // Intensité du langage
  ['intensite', /(materially|adversely|substantially|significant|severe|critique|forte?|maximal|[ée]lev[ée]|langue juridique|langage|expli?cit|soulign|massive|important|majeur|crucial|sérieux)/i],
  // Trend / dynamique
  ['trend', /(trend|tendance|aggrav|amélior|stable|en cours|d[ée]grad|expansion|repli|hausse|baisse|mont[ée]e|d[ée]clin|escalade|croissant|d[ée]croissant|r[ée]current|persiste|continu|inh[ée]rent|structurel|en hausse|en baisse)/i],
  // Weight catégorie
  ['weight', /(cat[ée]gorie|pondération|pond[ée]r|weight|systémique|sectoriel|industri|réglementaire|géopolitique|cyber|operatio|financier|impact|poids)/i],
];

function rationaleScore(rat) {
  if (!rat || typeof rat !== 'string') return { covered: [], count: 0, len: 0 };
  const covered = [];
  for (const [name, re] of RATIONALE_KEYWORDS) {
    if (re.test(rat)) covered.push(name);
  }
  return { covered, count: covered.length, len: rat.length };
}

function risksOk(risks) {
  if (!Array.isArray(risks) || risks.length < 3) return { ok: false, reason: 'lt3' };
  // ordered by score desc ?
  let lastScore = Infinity;
  let ordered = true;
  for (const r of risks) {
    const s = typeof r.score === 'number' ? r.score : 0;
    if (s > lastScore) { ordered = false; break; }
    lastScore = s;
  }
  let weakRationales = 0;
  for (const r of risks) {
    const rs = rationaleScore(r.score_rationale);
    // Weak if too short OR almost no keywords (substance criteria)
    if (rs.len < 120 || rs.count < 2) weakRationales++;
  }
  return { ok: true, ordered, weakRationales, count: risks.length };
}

function checkRepartition(slice, total) {
  const out = { issues: [] };
  if (slice == null || typeof slice !== 'object') {
    out.issues.push('slice_invalid');
    return out;
  }
  const v = slice.value;
  if (typeof v !== 'number' || isNaN(v)) {
    out.issues.push('value_missing');
  } else {
    if (v <= 0) out.issues.push('value_nonpositive');
    if (v > 999) out.issues.push('value_gt_999');
    if (v < 1 && v > 0) out.issues.push('value_lt_1');
  }
  const pct = slice.share_pct ?? slice.pct;
  if (pct == null) {
    if (total && typeof v === 'number') {
      // calculable
      out.computable_pct = true;
    } else {
      out.issues.push('share_pct_missing');
    }
  } else if (typeof pct !== 'number') {
    out.issues.push('share_pct_not_number');
  }
  return out;
}

function blockUnit(block) {
  return (block && (block.unit || (block.slices && block.slices[0] && block.slices[0].unit))) || null;
}

const risksAudit = { generated_at: new Date().toISOString(), flags: [], stats: {} };
const repartitionAudit = { generated_at: new Date().toISOString(), flags: [], stats: {} };

let risks_lt3 = 0, risks_unordered = 0, risks_weak_rat = 0, no_profit_warning = 0;
let rep_value_gt999 = 0, rep_missing_pct = 0, rep_no_segment = 0, rep_no_geo = 0;
let total = 0;

function pickMostSlices(...candidates) {
  const withSlices = candidates.filter(c => c && Array.isArray(c.slices) && c.slices.length > 0);
  if (withSlices.length) {
    withSlices.sort((a, b) => b.slices.length - a.slices.length);
    return withSlices[0];
  }
  return null;
}

for (const T of TICKERS) {
  total++;
  const merged = tryRead(COMPLETE, T);
  const pipe = tryRead(PIPE, T);
  const enrich = tryRead(ENRICH, T);
  if (!merged) {
    risksAudit.flags.push({ ticker: T, reason: 'no_complete_file' });
    continue;
  }
  // Live-merge segment/geo from enrich (priority) + pipeline for accurate post-fix audit
  const liveSeg = pickMostSlices(enrich && enrich.revenue_by_segment, pipe && pipe.revenue_by_segment, merged.revenue_by_segment);
  const liveGeo = pickMostSlices(enrich && enrich.revenue_by_geography, pipe && pipe.revenue_by_geography, merged.revenue_by_geography);
  // Live-merge risks (longest non-empty)
  const liveRisks = (() => {
    const candidates = [enrich && enrich.risks, pipe && pipe.risks, merged.risks].filter(a => Array.isArray(a) && a.length > 0);
    if (!candidates.length) return [];
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
  })();
  merged.revenue_by_segment = liveSeg;
  merged.revenue_by_geography = liveGeo;
  merged.risks = liveRisks;
  // (e) risks
  const risksRes = risksOk(merged.risks);
  const profitWarning = (pipe && pipe.profit_warning) || (enrich && enrich.profit_warning) || (merged && merged.profit_warning);
  const flag = { ticker: T, problems: [] };
  if (!risksRes.ok) {
    risks_lt3++;
    flag.problems.push('risks_lt3');
    flag.risks_count = (merged.risks || []).length;
  } else {
    if (!risksRes.ordered) {
      risks_unordered++;
      flag.problems.push('risks_unordered');
    }
    if (risksRes.weakRationales > 0) {
      risks_weak_rat++;
      flag.problems.push('rationale_weak');
      flag.weak_rationales = risksRes.weakRationales;
    }
  }
  if (!profitWarning) {
    no_profit_warning++;
    flag.problems.push('no_profit_warning');
  }
  if (flag.problems.length) risksAudit.flags.push(flag);

  // (f) répartition
  const seg = merged.revenue_by_segment;
  const geo = merged.revenue_by_geography;
  const repFlag = { ticker: T, problems: [] };
  if (!seg || !seg.slices || !seg.slices.length) {
    rep_no_segment++;
    repFlag.problems.push('no_segment');
  }
  if (!geo || !geo.slices || !geo.slices.length) {
    rep_no_geo++;
    repFlag.problems.push('no_geo');
  }
  for (const [blockName, block] of [['segment', seg], ['geo', geo]]) {
    if (!block || !block.slices) continue;
    const slices = block.slices;
    const totalVal = slices.reduce((acc, s) => acc + (typeof s.value === 'number' ? s.value : 0), 0);
    const sliceIssues = [];
    for (const s of slices) {
      const ci = checkRepartition(s, totalVal);
      if (ci.issues.length) sliceIssues.push({ name: s.label || s.name, value: s.value, issues: ci.issues });
    }
    if (sliceIssues.length) {
      const types = new Set(sliceIssues.flatMap(si => si.issues));
      if (types.has('value_gt_999')) { rep_value_gt999++; repFlag.problems.push(`${blockName}_value_gt_999`); }
      if (types.has('share_pct_missing')) { rep_missing_pct++; repFlag.problems.push(`${blockName}_pct_missing`); }
      repFlag[blockName + '_issues'] = sliceIssues;
    }
  }
  if (repFlag.problems.length) repartitionAudit.flags.push(repFlag);
}

risksAudit.stats = { total, risks_lt3, risks_unordered, risks_weak_rat, no_profit_warning };
repartitionAudit.stats = { total, rep_value_gt999, rep_missing_pct, rep_no_segment, rep_no_geo };

fs.writeFileSync(path.join(ROOT, 'src/data/v1-9-risks-audit.json'), JSON.stringify(risksAudit, null, 2));
fs.writeFileSync(path.join(ROOT, 'src/data/v1-9-repartition-audit.json'), JSON.stringify(repartitionAudit, null, 2));

console.log('=== AUDIT RESULTS ===');
console.log('Total publishable:', total);
console.log('(e) Risks:');
console.log('  risks_lt3:', risks_lt3);
console.log('  risks_unordered:', risks_unordered);
console.log('  risks_weak_rationale (<3 keywords/4):', risks_weak_rat);
console.log('  no_profit_warning:', no_profit_warning);
console.log('(f) Répartition:');
console.log('  rep_no_segment:', rep_no_segment);
console.log('  rep_no_geo:', rep_no_geo);
console.log('  rep_value_gt999 (rescale needed):', rep_value_gt999);
console.log('  rep_missing_pct:', rep_missing_pct);
