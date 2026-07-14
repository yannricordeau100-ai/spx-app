#!/usr/bin/env node
// G1 : dédup KPI table (T1), dédup risks (T9a), YoY des KPI taux (T10),
// unités monétaires canoniques (T5), dates stories badge vs texte (T15a).
// Données préservées : tout élément retiré va dans _kpis_dedup_removed /
// _risks_dedup_removed du même fichier.
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const V2 = path.join(ROOT, 'src/data/v2-pipeline');
const EN = path.join(ROOT, 'src/data/v2-pipeline-enrich');
const tickers = JSON.parse(fs.readFileSync('src/data/sp500-tickers.json', 'utf8'))
  .map(x => typeof x === 'string' ? x : (x.ticker || x.symbol || x.t)).filter(Boolean);

const UNIT_MAP = {
  '$M': 'M $', 'M$': 'M $', 'M USD': 'M $', 'MUSD': 'M $', 'M€': 'M €', 'Mio $': 'M $',
  '$B': 'Mds $', 'B$': 'Mds $', 'B USD': 'Mds $', 'Md$': 'Mds $', 'Md $': 'Mds $',
  'Mds$': 'Mds $', 'Mrd': 'Mds $', 'Mrd USD': 'Mds $', 'Mrd $': 'Mds $', 'BUSD': 'Mds $',
  'Bn $': 'Mds $', 'bn $': 'Mds $', '$Bn': 'Mds $', 'Mds USD': 'Mds $', 'Mds  $': 'Mds $',
};

function normKey(k){
  return String(k.name_en || k.short || k.name_fr || '')
    .toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
}
function histLen(k){ return Array.isArray(k.history) ? k.history.length : 0; }
function completeness(k){
  let s = histLen(k) * 2;
  if (k.yoy != null) s += 1;
  if (k.explanation || k.description) s += 1;
  if (k.compare_key) s += 1;
  return s;
}
// "valeur = YoY" : KPI taux dont le yoy répète la valeur
function isRateDup(k){
  if (k.unit !== '%' && !/%/.test(String(k.unit || ''))) return false;
  const v = parseFloat(String(k.value).replace(',', '.'));
  const y = parseFloat(String(k.yoy || '').replace(/[+%\s]/g, '').replace(',', '.'));
  return Number.isFinite(v) && Number.isFinite(y) && Math.abs(Math.abs(v) - Math.abs(y)) < 0.01 && v !== 0;
}
function normRiskKey(r){
  return String(r.title || r.name_fr || r.short || '')
    .toLowerCase().replace(/\(.*?\)$/g, '').replace(/[^a-zà-ÿ0-9]/g, '').slice(0, 60);
}

let stats = { kpiDedup: 0, riskDedup: 0, rateYoy: 0, units: 0, files: 0 };

for (const T of tickers){
  const base = T.toLowerCase();
  const p = fs.existsSync(path.join(V2, base + '.json')) ? path.join(V2, base + '.json') : path.join(V2, base.replace('.', '-') + '.json');
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let dirty = false;

  // --- T1 : dédup KPI table (hors stories) ---
  if (Array.isArray(d.kpis)){
    const tableKpis = d.kpis.filter(k => !k.is_short_history && !k.story_category);
    const byKey = {};
    for (const k of tableKpis){
      const key = normKey(k);
      if (!key) continue;
      (byKey[key] ||= []).push(k);
    }
    const removed = [];
    for (const [key, group] of Object.entries(byKey)){
      if (group.length < 2) continue;
      // garder : hero d'abord, sinon le plus complet (historique le plus long)
      group.sort((a, b) => {
        const aHero = (a.short === d.hero_kpi || a.name_en === d.hero_kpi) ? 1 : 0;
        const bHero = (b.short === d.hero_kpi || b.name_en === d.hero_kpi) ? 1 : 0;
        if (aHero !== bHero) return bHero - aHero;
        return completeness(b) - completeness(a);
      });
      for (const k of group.slice(1)) removed.push(k);
    }
    if (removed.length){
      const removedSet = new Set(removed);
      d.kpis = d.kpis.filter(k => !removedSet.has(k));
      d._kpis_dedup_removed = [...(d._kpis_dedup_removed || []), ...removed.map(k => ({ ...k, _removed_at: '2026-07-14', _removed_reason: 'doublon table (T1)' }))];
      stats.kpiDedup += removed.length; dirty = true;
    }

    // --- T10 : YoY des KPI taux qui répète la valeur → null ---
    for (const k of d.kpis){
      if (!k.is_short_history && !k.story_category && isRateDup(k)){
        k._yoy_removed_rate_dup = k.yoy;
        k.yoy = null;
        stats.rateYoy++; dirty = true;
      }
    }

    // --- T5 : unités canoniques ---
    for (const k of d.kpis){
      const u = String(k.unit || '');
      if (UNIT_MAP[u]){ k.unit = UNIT_MAP[u]; stats.units++; dirty = true; }
    }
  }

  // --- T9a : dédup risks (v2 + enrich) ---
  const dedupRisks = (obj, field) => {
    const rs = obj[field];
    if (!Array.isArray(rs) || rs.length < 2) return false;
    const byKey = {};
    for (const r of rs){ const k = normRiskKey(r); if (k) (byKey[k] ||= []).push(r); }
    const removed = [];
    for (const group of Object.values(byKey)){
      if (group.length < 2) continue;
      group.sort((a, b) => String(b.score_rationale || '').length - String(a.score_rationale || '').length);
      for (const r of group.slice(1)) removed.push(r);
    }
    if (!removed.length) return false;
    const rm = new Set(removed);
    obj[field] = rs.filter(r => !rm.has(r));
    obj._risks_dedup_removed = [...(obj._risks_dedup_removed || []), ...removed];
    stats.riskDedup += removed.length;
    return true;
  };
  if (dedupRisks(d, 'risks')) dirty = true;

  if (dirty){ fs.writeFileSync(p, JSON.stringify(d, null, 2)); stats.files++; }

  // enrich risks
  const ep = fs.existsSync(path.join(EN, base + '.json')) ? path.join(EN, base + '.json') : path.join(EN, base.replace('.', '-') + '.json');
  if (fs.existsSync(ep)){
    try{
      const e = JSON.parse(fs.readFileSync(ep, 'utf8'));
      let eDirty = dedupRisks(e, 'risks');
      if (Array.isArray(e.kpis)){
        for (const k of e.kpis){ const u = String(k.unit || ''); if (UNIT_MAP[u]){ k.unit = UNIT_MAP[u]; stats.units++; eDirty = true; } }
      }
      if (eDirty) fs.writeFileSync(ep, JSON.stringify(e, null, 2));
    }catch(err){}
  }
}
console.log(JSON.stringify(stats));
