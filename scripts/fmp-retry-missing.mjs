#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const KEY = process.env.FMP2_API_KEY;
if (!KEY) { console.error('Missing FMP2_API_KEY'); process.exit(1); }

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'src/data/v2-pipeline');
const NOW = '2026-07-13T09:00:00Z';
const CONCURRENCY = 3;
const TIMEOUT_MS = 45000;
const MAX_RETRIES = 5;

const report = JSON.parse(fs.readFileSync('/tmp/fmp-extract-report.json', 'utf8'));
const targets = report.filter(r => !r.ok || !r.didGeo || !r.didSeg).map(r => r.t).filter(t => t !== 'BRK.B');
console.log(`Targets to retry: ${targets.length}`);

const GEO_FR = {
  'Americas Segment': 'Amériques', 'Americas': 'Amériques',
  'Europe Segment': 'Europe', 'Europe': 'Europe',
  'Greater China Segment': 'Grande Chine', 'Greater China': 'Grande Chine',
  'Japan Segment': 'Japon', 'Japan': 'Japon', 'JAPAN': 'Japon',
  'Rest of Asia Pacific Segment': 'Reste Asie-Pacifique', 'Rest of Asia Pacific': 'Reste Asie-Pacifique',
  'United States': 'États-Unis', 'UNITED STATES': 'États-Unis', 'U.S.': 'États-Unis', 'US': 'États-Unis',
  'International': 'International', 'Non-US': 'Hors États-Unis',
  'Asia': 'Asie', 'Asia Pacific': 'Asie-Pacifique', 'APAC': 'Asie-Pacifique',
  'Canada': 'Canada', 'CANADA': 'Canada', 'Mexico': 'Mexique', 'MEXICO': 'Mexique', 'Brazil': 'Brésil',
  'United Kingdom': 'Royaume-Uni', 'UNITED KINGDOM': 'Royaume-Uni', 'UK': 'Royaume-Uni',
  'Germany': 'Allemagne', 'GERMANY': 'Allemagne', 'France': 'France', 'FRANCE': 'France',
  'China': 'Chine', 'CHINA': 'Chine', 'India': 'Inde', 'INDIA': 'Inde',
  'EMEA': 'EMEA', 'LATAM': 'Amérique latine',
  'North America': 'Amérique du Nord', 'Latin America': 'Amérique latine',
  'Middle East and Africa': 'Moyen-Orient et Afrique',
  'Rest of World': 'Reste du monde', 'REST OF WORLD': 'Reste du monde',
  'Other': 'Autres', 'Other Countries': 'Autres pays', 'OTHER': 'Autres',
  'Australia': 'Australie', 'Italy': 'Italie', 'Spain': 'Espagne',
  'Netherlands': 'Pays-Bas', 'Switzerland': 'Suisse', 'Ireland': 'Irlande',
  'Singapore': 'Singapour', 'Hong Kong': 'Hong Kong', 'Korea': 'Corée',
  'Taiwan': 'Taïwan', 'Russia': 'Russie', 'Poland': 'Pologne',
};

function frLabel(en){
  if (GEO_FR[en]) return GEO_FR[en];
  const clean = en.replace(/ Segment$/,'').replace(/ Region$/,'').trim();
  return GEO_FR[clean] || clean;
}

async function fetchFMP(endpoint, sym){
  const url = `https://financialmodelingprep.com/stable/${endpoint}?symbol=${encodeURIComponent(sym)}&apikey=${KEY}`;
  for (let i=0;i<MAX_RETRIES;i++){
    try{
      const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (r.status === 429){
        const wait = 2000 + i*3000;
        await new Promise(rs=>setTimeout(rs,wait));
        continue;
      }
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      if (j && j['Error Message']){
        if (String(j['Error Message']).includes('Legacy')) return { legacy:true };
        return null;
      }
      return Array.isArray(j) ? j : null;
    }catch(e){
      if (i===MAX_RETRIES-1) return null;
      await new Promise(rs=>setTimeout(rs, 1500 + i*1500));
    }
  }
  return null;
}

function pickLatest(arr){
  if (!arr || !Array.isArray(arr) || !arr.length) return null;
  return [...arr].sort((a,b)=> (b.date||'').localeCompare(a.date||''))[0];
}

function buildSlices(data){
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
  return { slices, unit };
}

async function processOne(t){
  const file = path.join(DIR, t.toLowerCase()+'.json');
  if (!fs.existsSync(file)) return { t, ok:false, reason:'no_file' };
  let doc;
  try{ doc = JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){ return { t, ok:false, reason:'parse' }; }

  const alreadyGeoFresh = doc.revenue_by_geography?._fmp_extracted_at;
  const alreadySegFresh = doc.revenue_by_segment?._fmp_extracted_at;

  const [geoArr, segArr] = await Promise.all([
    alreadyGeoFresh ? Promise.resolve(null) : fetchFMP('revenue-geographic-segmentation', t),
    alreadySegFresh ? Promise.resolve(null) : fetchFMP('revenue-product-segmentation', t),
  ]);

  let didGeo=false, didSeg=false, notes=[];

  const geoLatest = pickLatest(geoArr);
  if (geoLatest && geoLatest.data){
    const built = buildSlices(geoLatest.data);
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
  } else if (!alreadyGeoFresh) notes.push('geo_none');

  const segLatest = pickLatest(segArr);
  if (segLatest && segLatest.data){
    const built = buildSlices(segLatest.data);
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
  } else if (!alreadySegFresh) notes.push('seg_none');

  if (didGeo || didSeg){
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  return { t, ok:(didGeo||didSeg||alreadyGeoFresh||alreadySegFresh), didGeo, didSeg, notes };
}

async function main(){
  const results = [];
  let idx = 0;
  async function worker(){
    while (idx < targets.length){
      const i = idx++;
      const t = targets[i];
      const r = await processOne(t);
      results.push(r);
      console.log(`[${i+1}/${targets.length}] ${t} geo=${r.didGeo?'Y':'.'} seg=${r.didSeg?'Y':'.'} ${(r.notes||[]).join(',')}`);
    }
  }
  await Promise.all(Array.from({length:CONCURRENCY},worker));
  const both = results.filter(r=>r.didGeo&&r.didSeg).length;
  const geoOnly = results.filter(r=>r.didGeo&&!r.didSeg).length;
  const segOnly = results.filter(r=>!r.didGeo&&r.didSeg).length;
  const still = results.filter(r=>!r.didGeo&&!r.didSeg);
  console.log('\n=== Retry Summary ===');
  console.log('Both geo+seg found:', both);
  console.log('Geo only:', geoOnly);
  console.log('Seg only:', segOnly);
  console.log('Still empty:', still.length);
  console.log('Still empty tickers:', still.map(r=>r.t).join(','));
  fs.writeFileSync('/tmp/fmp-retry-report.json', JSON.stringify(results,null,2));
}
main().catch(e=>{ console.error(e); process.exit(1); });
