#!/usr/bin/env node
// Fix 1 : ai_positioning.evidence objets sans champ `text` → ajouter text
//         (le composant ai-positioning-card lit e.text quand e est un objet).
// Fix 2 : labels FR manquants sur slices FMP (v2-pipeline).
// Fix 3 : enrich.revenue_by_geography/segment stale → remplacé par la version
//         v2 fraîche (_fmp_extracted_at) pour que le loader (priorité enrich)
//         affiche la donnée à jour.
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const V2 = path.join(ROOT, 'src/data/v2-pipeline');
const EN = path.join(ROOT, 'src/data/v2-pipeline-enrich');

const tickers = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sp500-tickers.json'), 'utf8'));
const list = (Array.isArray(tickers) ? tickers : Object.keys(tickers))
  .map(x => typeof x === 'string' ? x : (x.ticker || x.symbol || x.t)).filter(Boolean);

const FR = {
  'US & Canada': 'États-Unis & Canada', 'United States and Canada': 'États-Unis & Canada',
  'U.S. and Canada': 'États-Unis & Canada', 'United States And Canada': 'États-Unis & Canada',
  'UNITED STATES': 'États-Unis', 'United States': 'États-Unis', 'U.S.': 'États-Unis', 'US': 'États-Unis',
  'Asia-Pacific': 'Asie-Pacifique', 'Asia Pacific': 'Asie-Pacifique', 'APAC': 'Asie-Pacifique',
  'Rest of the World': 'Reste du monde', 'Rest of World': 'Reste du monde', 'REST OF WORLD': 'Reste du monde',
  'Rest of Asia Pacific': 'Reste Asie-Pacifique', 'Rest of Asia Pacific Segment': 'Reste Asie-Pacifique',
  'Europe, Middle East & Africa': 'EMEA', 'Europe, Middle East and Africa': 'EMEA',
  'Middle East and Africa': 'Moyen-Orient et Afrique', 'Latin America': 'Amérique latine', 'LATAM': 'Amérique latine',
  'North America': 'Amérique du Nord', 'International': 'International', 'Domestic': 'Domestique',
  'Greater China': 'Grande Chine', 'CHINA': 'Chine', 'China': 'Chine', 'Mainland China': 'Chine continentale',
  'JAPAN': 'Japon', 'Japan': 'Japon', 'GERMANY': 'Allemagne', 'Germany': 'Allemagne',
  'FRANCE': 'France', 'UNITED KINGDOM': 'Royaume-Uni', 'United Kingdom': 'Royaume-Uni', 'UK': 'Royaume-Uni',
  'CANADA': 'Canada', 'Canada': 'Canada', 'MEXICO': 'Mexique', 'Mexico': 'Mexique', 'Brazil': 'Brésil',
  'India': 'Inde', 'Australia': 'Australie', 'Italy': 'Italie', 'Spain': 'Espagne', 'Korea': 'Corée',
  'Netherlands': 'Pays-Bas', 'Switzerland': 'Suisse', 'Ireland': 'Irlande', 'Singapore': 'Singapour',
  'Taiwan': 'Taïwan', 'Other': 'Autres', 'OTHER': 'Autres', 'Other Countries': 'Autres pays',
  'Other countries': 'Autres pays', 'Other International': 'Autres international',
  'Europe Segment': 'Europe', 'Americas Segment': 'Amériques', 'Americas': 'Amériques',
  'Greater China Segment': 'Grande Chine', 'Japan Segment': 'Japon',
  'Worldwide': 'Monde entier', 'Global': 'Mondial',
};
function fr(label){
  if (!label) return label;
  const k = String(label).trim();
  if (FR[k]) return FR[k];
  const noSuffix = k.replace(/ (Segment|Region)$/,'');
  return FR[noSuffix] || label;
}

let statEvid=0, statLabels=0, statSync=0;

for (const T of list){
  const base = T.toLowerCase();
  const v2Path = fs.existsSync(path.join(V2, base + '.json'))
    ? path.join(V2, base + '.json')
    : path.join(V2, base.replace('.', '-') + '.json');
  if (!fs.existsSync(v2Path)) continue;
  const v2 = JSON.parse(fs.readFileSync(v2Path, 'utf8'));
  let v2Dirty = false;

  // Fix 1 : evidence text
  const ev = v2.ai_positioning?.evidence;
  if (Array.isArray(ev)){
    for (const e of ev){
      if (e && typeof e === 'object' && !('text' in e)){
        const title = e.title ? String(e.title).trim() : '';
        const desc = e.description_fr ? String(e.description_fr).trim() : (e.description ? String(e.description).trim() : '');
        const text = title && desc ? `${title} : ${desc}` : (desc || title);
        if (text){ e.text = text; v2Dirty = true; statEvid++; }
      }
    }
  }

  // Fix 2 : labels FR sur slices FMP
  for (const key of ['revenue_by_geography', 'revenue_by_segment']){
    const b = v2[key];
    if (b && b._fmp_extracted_at && Array.isArray(b.slices)){
      for (const s of b.slices){
        const cur = s.label || s.name;
        const translated = fr(s.label_en || cur);
        if (translated && translated !== cur){
          s.label = translated; s.name = translated; v2Dirty = true; statLabels++;
        }
      }
    }
  }

  if (v2Dirty) fs.writeFileSync(v2Path, JSON.stringify(v2, null, 2));

  // Fix 3 : sync enrich ← v2 (fmp fresh)
  const enPath = fs.existsSync(path.join(EN, base + '.json'))
    ? path.join(EN, base + '.json')
    : path.join(EN, base.replace('.', '-') + '.json');
  if (!fs.existsSync(enPath)) continue;
  let en;
  try{ en = JSON.parse(fs.readFileSync(enPath, 'utf8')); }catch(e){ continue; }
  let enDirty = false;
  for (const key of ['revenue_by_geography', 'revenue_by_segment']){
    if (v2[key] && v2[key]._fmp_extracted_at && en[key]){
      en[key] = v2[key];
      enDirty = true; statSync++;
    }
  }
  if (enDirty) fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
}

console.log(`evidence text ajoutés: ${statEvid} | labels FR corrigés: ${statLabels} | blocs enrich synchronisés: ${statSync}`);
