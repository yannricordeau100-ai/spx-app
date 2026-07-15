#!/usr/bin/env node
// T9b : traduit en FR les titres de risques restés en anglais.
// LLM Cerebras gpt-oss-120b (quota reset), batch de 20 titres par appel.
import fs from 'fs';

const KEYS = [process.env.CEREBRAS_API_KEY, process.env.CEREBRAS2_API_KEY, process.env.CEREBRAS3_API_KEY].filter(Boolean);
let ki = 0;
const EN = /\b(and|of|the|our|risks?|business|regulatory|liquidity|operational|litigation|competition|supply|cybersecurity|changes|could|may)\b/i;
const FRWORDS = /\b(risque|réglementaire|chaîne|marché|données|concurrence|cybersécurité|juridique|opérationnel)/i;

const tickers = JSON.parse(fs.readFileSync('src/data/sp500-tickers.json', 'utf8')).map(x => typeof x === 'string' ? x : (x.ticker || x.symbol || x.t));

async function llm(prompt){
  for (let a = 0; a < 8; a++){
    try{
      const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEYS[ki] },
        body: JSON.stringify({ model: 'gpt-oss-120b', messages: [{ role: 'user', content: prompt }], temperature: 0, max_completion_tokens: 4000, response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(60000),
      });
      if (r.status === 429 || r.status === 402 || r.status === 401){ ki = (ki + 1) % KEYS.length; await new Promise(rs => setTimeout(rs, 2000)); continue; }
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const c = j?.choices?.[0]?.message?.content;
      if (!c) throw new Error('empty');
      return c;
    }catch(e){ ki = (ki + 1) % KEYS.length; await new Promise(rs => setTimeout(rs, 1500)); }
  }
  return null;
}

// 1. Collecte
const items = []; // {file, idx, title}
for (const T of tickers){
  const base = T.toLowerCase();
  for (const dir of ['src/data/v2-pipeline', 'src/data/v2-pipeline-enrich']){
    const p = dir + '/' + base + '.json', p2 = dir + '/' + base.replace('.', '-') + '.json';
    const fp = fs.existsSync(p) ? p : (fs.existsSync(p2) ? p2 : null);
    if (!fp) continue;
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    (d.risks || []).forEach((r, i) => {
      const t = String(r.title || r.name_fr || '');
      if (t && EN.test(t) && !FRWORDS.test(t)) items.push({ file: fp, idx: i, title: t });
    });
  }
}
console.log('à traduire:', items.length);

// 2. Traduction par lots de 25 (dédupliqués)
const uniq = [...new Set(items.map(i => i.title))];
console.log('titres uniques:', uniq.length);
const dict = {};
for (let i = 0; i < uniq.length; i += 25){
  const batch = uniq.slice(i, i + 25);
  const prompt = `Traduis ces titres de facteurs de risque financiers en français concis et naturel (style app investisseurs, pas de traduction mot à mot lourde, majuscule initiale seulement). Réponds en JSON strict: {"translations": {"<titre EN>": "<titre FR>", ...}}.\nTitres:\n${batch.map(t => '- ' + t).join('\n')}`;
  const out = await llm(prompt);
  if (!out) { console.log('batch', i, 'LLM fail'); continue; }
  try{
    const j = JSON.parse(out);
    Object.assign(dict, j.translations || j);
    console.log(`batch ${i / 25 + 1}/${Math.ceil(uniq.length / 25)} ok (${Object.keys(j.translations || j).length})`);
  }catch(e){ console.log('batch', i, 'parse fail'); }
}

// 3. Application
const byFile = {};
for (const it of items){ (byFile[it.file] ||= []).push(it); }
let applied = 0, files = 0;
for (const [file, list] of Object.entries(byFile)){
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  let dirty = false;
  for (const it of list){
    const fr = dict[it.title];
    if (fr && typeof fr === 'string' && fr.length > 3 && fr !== it.title){
      const r = d.risks[it.idx];
      if (r && String(r.title || r.name_fr) === it.title){
        if (r.title !== undefined){ r.title_en = it.title; r.title = fr; }
        if (r.name_fr !== undefined && (r.name_fr === it.title || !r.title)) r.name_fr = fr;
        applied++; dirty = true;
      }
    }
  }
  if (dirty){ fs.writeFileSync(file, JSON.stringify(d, null, 2)); files++; }
}
console.log('appliqués:', applied, 'fichiers:', files);
