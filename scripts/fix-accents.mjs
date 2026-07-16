#!/usr/bin/env node
// T11 : ré-accentuation des textes FR générés sans accents.
// Cible : ai_positioning.summary, descriptions de stories, name_fr de KPI.
// Détection : texte avec stopwords FR mais zéro caractère accentué alors
// qu'il contient des mots qui en exigent. Correction via Cerebras (ré-accentuation
// stricte : AUCUN mot ajouté/supprimé, uniquement les accents).
import fs from 'fs';

const KEYS = [process.env.CEREBRAS_API_KEY, process.env.CEREBRAS2_API_KEY, process.env.CEREBRAS3_API_KEY].filter(Boolean);
let ki = 0;

const FR_HINT = /\b(des|les|dans|avec|pour|sur|une|aux|du|au|est|sont|par)\b/;
const NEEDS_ACCENT = /\b(resultat|integre|ameliore|amelioration|experience|operationn|strategi|reglement|genere|revele|reduit|croissanc|activite|societe|marche|beneficie|premiere|derniere|annee|developpe|region|complementaire|treso|numerique|independant|evenement|echelle|degrade|eleve|superieur|inferieur|prevision|periode|revenus recurrents|deploie|generation|telecom)\w*/i;
const HAS_ACCENT = /[àâäéèêëîïôöùûüçÀÂÉÈÊËÎÏÔÖÙÛÜÇ]/;

function needsFix(s){
  if (typeof s !== 'string' || s.length < 25) return false;
  // Passe 2 (15 juil) : un texte FR de plus de 25 caractères sans AUCUN accent
  // est quasi certainement de l'ASCII dégradé. On exige 2 stopwords FR pour
  // éviter les textes EN.
  const frHits = (s.match(/\b(des|les|dans|avec|pour|sur|une|aux|du|au|est|sont|par|ce|cette|qui|plus)\b/g) || []).length;
  return frHits >= 2 && !HAS_ACCENT.test(s);
}

async function llm(texts){
  const prompt = `Ré-accentue ces textes français écrits sans accents. RÈGLE ABSOLUE : ne change AUCUN mot, AUCUN chiffre, AUCUNE ponctuation. Ajoute uniquement les accents français manquants. Réponds en JSON strict: {"fixed": ["texte 1 corrigé", "texte 2 corrigé", ...]} dans le même ordre.\n${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  for (let a = 0; a < 6; a++){
    try{
      const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEYS[ki] },
        body: JSON.stringify({ model: 'gpt-oss-120b', messages: [{ role: 'user', content: prompt }], temperature: 0, max_completion_tokens: 6000, response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(90000),
      });
      if ([429, 402, 401].includes(r.status)){ ki = (ki + 1) % KEYS.length; await new Promise(rs => setTimeout(rs, 2000)); continue; }
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const c = j?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed.fixed) && parsed.fixed.length === texts.length) return parsed.fixed;
      throw new Error('shape');
    }catch(e){ ki = (ki + 1) % KEYS.length; await new Promise(rs => setTimeout(rs, 1500)); }
  }
  return null;
}

// mots identiques hors accents ? (garde-fou anti-réécriture)
function sameSkeleton(a, b){
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  return strip(a) === strip(b);
}

const tickers = JSON.parse(fs.readFileSync('src/data/sp500-tickers.json', 'utf8')).map(x => typeof x === 'string' ? x : (x.ticker || x.symbol || x.t));
const jobs = []; // {file, path:[...], text}
for (const T of tickers){
  const base = T.toLowerCase();
  for (const dir of ['src/data/v2-pipeline', 'src/data/v2-pipeline-enrich']){
    const p = dir + '/' + base + '.json', p2 = dir + '/' + base.replace('.', '-') + '.json';
    const fp = fs.existsSync(p) ? p : (fs.existsSync(p2) ? p2 : null);
    if (!fp) continue;
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (d.ai_positioning?.summary && needsFix(d.ai_positioning.summary)) jobs.push({ file: fp, path: ['ai_positioning', 'summary'], text: d.ai_positioning.summary });
    (d.kpis || []).forEach((k, i) => {
      if (k.description && needsFix(k.description)) jobs.push({ file: fp, path: ['kpis', i, 'description'], text: k.description });
      if (k.name_fr && needsFix(k.name_fr)) jobs.push({ file: fp, path: ['kpis', i, 'name_fr'], text: k.name_fr });
      if (k.signal && needsFix(k.signal)) jobs.push({ file: fp, path: ['kpis', i, 'signal'], text: k.signal });
    });
    (d.risks || []).forEach((r, i) => {
      if (r.summary && needsFix(r.summary)) jobs.push({ file: fp, path: ['risks', i, 'summary'], text: r.summary });
      if (r.title && needsFix(r.title)) jobs.push({ file: fp, path: ['risks', i, 'title'], text: r.title });
    });
  }
}
console.log('textes sans accents détectés:', jobs.length);

const results = new Map();
const uniqTexts = [...new Set(jobs.map(j => j.text))];
console.log('uniques:', uniqTexts.length);
for (let i = 0; i < uniqTexts.length; i += 15){
  const batch = uniqTexts.slice(i, i + 15);
  const out = await llm(batch);
  if (!out){ console.log('batch', i, 'fail'); continue; }
  batch.forEach((t, k) => {
    if (out[k] && sameSkeleton(t, out[k]) && HAS_ACCENT.test(out[k])) results.set(t, out[k]);
  });
  if ((i / 15) % 10 === 0) console.log(`... ${i + batch.length}/${uniqTexts.length}`);
}
console.log('corrections valides:', results.size);

const byFile = {};
for (const j of jobs){ (byFile[j.file] ||= []).push(j); }
let applied = 0, files = 0;
for (const [file, list] of Object.entries(byFile)){
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  let dirty = false;
  for (const j of list){
    const fx = results.get(j.text);
    if (!fx) continue;
    let obj = d;
    for (let i = 0; i < j.path.length - 1; i++) obj = obj?.[j.path[i]];
    const last = j.path[j.path.length - 1];
    if (obj && obj[last] === j.text){ obj[last] = fx; applied++; dirty = true; }
  }
  if (dirty){ fs.writeFileSync(file, JSON.stringify(d, null, 2)); files++; }
}
console.log('appliqués:', applied, 'fichiers:', files);
