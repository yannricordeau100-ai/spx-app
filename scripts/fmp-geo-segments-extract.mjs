#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const KEY = process.env.FMP2_API_KEY || process.env.FMP3_API_KEY;
if (!KEY) { console.error('Missing FMP2_API_KEY'); process.exit(1); }

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'src/data/v2-pipeline');
const tickers = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sp500-tickers.json'), 'utf8'));
const list = (Array.isArray(tickers) ? tickers : Object.keys(tickers))
  .map(x => typeof x === 'string' ? x : (x.ticker || x.symbol || x.t)).filter(Boolean);

const CONCURRENCY = 8;
const NOW = '2026-07-13T07:00:00Z';

const GEO_FR = {
  'Americas Segment': 'Amériques', 'Americas': 'Amériques',
  'Europe Segment': 'Europe', 'Europe': 'Europe',
  'Greater China Segment': 'Grande Chine', 'Greater China': 'Grande Chine',
  'Japan Segment': 'Japon', 'Japan': 'Japon',
  'Rest of Asia Pacific Segment': 'Reste Asie-Pacifique', 'Rest of Asia Pacific': 'Reste Asie-Pacifique',
  'United States': 'États-Unis', 'U.S.': 'États-Unis', 'US': 'États-Unis',
  'International': 'International', 'Non-US': 'Hors États-Unis',
  'Asia': 'Asie', 'Asia Pacific': 'Asie-Pacifique', 'APAC': 'Asie-Pacifique',
  'Canada': 'Canada', 'Mexico': 'Mexique', 'Brazil': 'Brésil',
  'United Kingdom': 'Royaume-Uni', 'UK': 'Royaume-Uni',
  'Germany': 'Allemagne', 'France': 'France', 'China': 'Chine',
  'India': 'Inde', 'EMEA': 'EMEA', 'LATAM': 'Amérique latine',
  'North America': 'Amérique du Nord', 'Latin America': 'Amérique latine',
  'Middle East and Africa': 'Moyen-Orient et Afrique',
  'Rest of World': 'Reste du monde', 'Other': 'Autres', 'Other Countries': 'Autres pays',
};

function frLabel(en){ return GEO_FR[en] || GEO_FR[en.replace(/ Segment$/,'')] || en; }

async function fetchFMP(endpoint, sym){
  const url = `https://financialmodelingprep.com/stable/${endpoint}?symbol=${sym}&apikey=${KEY}`;
  for (let i=0;i<2;i++){
    try{
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      if (j && j['Error Message']) return null;
      return Array.isArray(j) ? j : null;
    }catch(e){ if(i===1) return null; await new Promise(r=>setTimeout(r,1500)); }
  }
  return null;
}

function pickLatest(arr){
  if (!arr || !arr.length) return null;
  const sorted = [...arr].sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  return sorted[0];
}

function buildSlices(data, kindLabel){
  const entries = Object.entries(data).filter(([k,v]) => v!=null && !isNaN(+v) && +v>0);
  if (entries.length < 2) return null;
  const total = entries.reduce((s,[,v])=>s+ +v, 0);
  if (total <= 0) return null;
  const useBillions = total >= 5e9;
  const unit = useBillions ? 'Mds $' : 'M $';
  const div = useBillions ? 1e9 : 1e6;
  const slices = entries.map(([k,v])=>{
    const value = Math.round((+v/div)*1000)/1000;
    const share_pct = Math.round((+v/total)*1000)/10;
    return { name: frLabel(k), label: frLabel(k), label_en: k, value, share_pct, pct: share_pct, unit };
  }).sort((a,b)=>b.value-a.value);
  return { slices, unit, total };
}

async function processOne(t){
  const file = path.join(DIR, t.toLowerCase()+'.json');
  if (!fs.existsSync(file)) return { t, ok:false, reason:'no_file' };
  let doc;
  try{ doc = JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){ return { t, ok:false, reason:'parse' }; }

  const [geoArr, segArr] = await Promise.all([
    fetchFMP('revenue-geographic-segmentation', t),
    fetchFMP('revenue-product-segmentation', t),
  ]);

  let didGeo=false, didSeg=false, notes=[];

  const geoLatest = pickLatest(geoArr);
  if (geoLatest && geoLatest.data){
    const built = buildSlices(geoLatest.data, 'geo');
    if (built){
      doc.revenue_by_geography = {
        label: `Répartition géographique du chiffre d'affaires (FY${geoLatest.fiscalYear})`,
        slices: built.slices,
        fiscal_year: `FY${geoLatest.fiscalYear}`,
        currency: geoLatest.reportedCurrency || 'USD',
        _source: `FMP revenue-geographic-segmentation FY${geoLatest.fiscalYear} (${geoLatest.date}) - SEC 10-K`,
        _fmp_extracted_at: NOW,
      };
      didGeo=true;
    } else notes.push('geo_single');
  } else notes.push('geo_none');

  const segLatest = pickLatest(segArr);
  if (segLatest && segLatest.data){
    const built = buildSlices(segLatest.data, 'seg');
    if (built){
      doc.revenue_by_segment = {
        label: `Répartition du chiffre d'affaires par segment (FY${segLatest.fiscalYear})`,
        slices: built.slices,
        fiscal_year: `FY${segLatest.fiscalYear}`,
        currency: segLatest.reportedCurrency || 'USD',
        _source: `FMP revenue-product-segmentation FY${segLatest.fiscalYear} (${segLatest.date}) - SEC 10-K`,
        _fmp_extracted_at: NOW,
      };
      didSeg=true;
    } else notes.push('seg_single');
  } else notes.push('seg_none');

  if (didGeo || didSeg){
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  return { t, ok:(didGeo||didSeg), didGeo, didSeg, notes };
}

async function main(){
  console.log(`Start FMP extraction for ${list.length} tickers (concurrency ${CONCURRENCY})`);
  const results = [];
  let idx = 0;
  async function worker(){
    while (idx < list.length){
      const i = idx++;
      const t = list[i];
      const r = await processOne(t);
      results.push(r);
      if (r.ok) console.log(`[${i+1}/${list.length}] ${t} geo=${r.didGeo?'Y':'N'} seg=${r.didSeg?'Y':'N'}`);
      else console.log(`[${i+1}/${list.length}] ${t} KO ${r.reason||r.notes?.join(',')}`);
    }
  }
  await Promise.all(Array.from({length:CONCURRENCY},worker));
  const both = results.filter(r=>r.didGeo&&r.didSeg).length;
  const geoOnly = results.filter(r=>r.didGeo&&!r.didSeg).length;
  const segOnly = results.filter(r=>!r.didGeo&&r.didSeg).length;
  const none = results.filter(r=>!r.ok).length;
  console.log('\n=== Summary ===');
  console.log('Both geo+seg:', both);
  console.log('Geo only:', geoOnly);
  console.log('Seg only:', segOnly);
  console.log('Neither:', none);
  fs.writeFileSync('/tmp/fmp-extract-report.json', JSON.stringify(results,null,2));
  console.log('Report: /tmp/fmp-extract-report.json');
}
main().catch(e=>{ console.error(e); process.exit(1); });
