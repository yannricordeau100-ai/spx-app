#!/usr/bin/env node
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

const KEYS = [
  process.env.CEREBRAS_API_KEY,
  process.env.CEREBRAS2_API_KEY,
  process.env.CEREBRAS3_API_KEY,
].filter(Boolean);
const GROQ = process.env.GROQ_API_KEY;

let keyIdx = 0;
let useGroq = false;

const ROOT = process.cwd();
const NOW = '2026-07-13T10:15:00Z';
const CONCURRENCY = 3;
const MODEL_CEREBRAS = 'gpt-oss-120b';
const MODEL_GROQ = 'llama-3.3-70b-versatile';

function rotateKey(){ keyIdx = (keyIdx+1) % KEYS.length; }

async function llm(prompt){
  for (let attempt=0; attempt<8; attempt++){
    const key = KEYS[keyIdx];
    try{
      const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body: JSON.stringify({
          model: MODEL_CEREBRAS,
          messages:[{role:'user',content:prompt}],
          temperature:0.1,
          max_completion_tokens: 8000,
          response_format:{type:'json_object'}
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (r.status === 429){
        rotateKey();
        await new Promise(rs=>setTimeout(rs, 3000 + attempt*2000));
        continue;
      }
      if (r.status === 401){ rotateKey(); continue; }
      if (!r.ok){
        const txt = await r.text();
        throw new Error('cerebras '+r.status+' '+txt.slice(0,100));
      }
      const j = await r.json();
      const content = j?.choices?.[0]?.message?.content;
      if (!content || content.length < 20){
        if (attempt < 3){ rotateKey(); await new Promise(rs=>setTimeout(rs,1500)); continue; }
        throw new Error('empty_content');
      }
      return content;
    }catch(e){
      if (attempt === 7) throw e;
      rotateKey();
      await new Promise(rs=>setTimeout(rs, 2000));
    }
  }
  throw new Error('exhausted');
}

function stripHtml(html){
  let t = html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'');
  t = t.replace(/<[^>]+>/g,' ');
  t = t.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#\d+;/g,' ');
  t = t.replace(/\s+/g,' ');
  return t;
}

function findLatestFiling(tickerLower){
  const T = tickerLower.toUpperCase().replace('.','-');
  for (const kind of ['10Q','10K']){
    const dir = path.join(ROOT, 'data-lake', T, kind);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f=>f.endsWith('.gz')).sort().reverse();
    if (files.length) return { path: path.join(dir, files[0]), kind, file: files[0] };
  }
  return null;
}

function extractMDA(text){
  const start = text.search(/Management['s’]* Discussion and Analysis/i);
  if (start < 0) return text.slice(0, 60000);
  const rest = text.slice(start);
  const end = rest.search(/Item\s*[34]\b|Quantitative and Qualitative|Controls and Procedures/i);
  const seg = end > 0 ? rest.slice(0, end) : rest.slice(0, 60000);
  return seg.slice(0, 60000);
}

function buildPrompt(ticker, name, kind, month, dateStr, mdaText){
  return `Tu es analyste financier. Extrait EXACTEMENT 6 stories opérationnelles distinctives (KPIs propres à la sté) du ${kind} de ${name} (${ticker}), période ${month}.

CONTRAINTES OBLIGATOIRES ZÉRO INVENTION :
- Chaque story = un fait VERBATIM du texte fourni (chiffres, %, unités).
- Si un chiffre n'est pas explicite dans le texte, ne le mets pas.
- Cible métriques opérationnelles distinctives (comparable sales, occupancy, users, subscribers, backlog, orders, MW, load factor, etc.). Pas Revenue/Net Income/EPS de base (déjà couverts ailleurs).

FORMAT SORTIE - JSON strict, exactement :
{"stories":[
  {"short":"SNAKE_CASE_KEY","name_fr":"...","name_en":"...","value":<number|string>,"unit":"M $"|"Mds $"|"%"|"K"|"unités","yoy":"+12,3 %"|"-4,8 %"|null,"type":"quarter","nature":"operational"|"financial","signal":"positive"|"neutral"|"negative","description":"Phrase FR expliquant la story, mentionne source (${kind})","story_category":"Innovation"|"Marché"|"Adoption"|"Capacité"|"Croissance","is_short_history":true,"_source":"${kind} ${month}","_source_month":"${month}","last_data_date":"${dateStr}"}
]}

Règles format :
- unit avec espaces : "M $", "Mds $", jamais "M$" ni "M USD".
- yoy avec virgule décimale FR et signe : "+12,3 %" ou "-4,8 %".
- Description FR concise, pas de jargon anglais.

TEXTE MD&A À ANALYSER :
${mdaText}

Réponds UNIQUEMENT le JSON, rien d'autre.`;
}

function extractDateFromFilename(f){
  const m = f.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function monthFr(date){
  const [y,m] = (date||'').split('-');
  if (!y || !m) return 'N/A';
  return MONTHS_FR[parseInt(m,10)-1] + ' ' + y;
}

async function processOne(ticker){
  const tickerLc = ticker.toLowerCase().replace('.','-');
  const filing = findLatestFiling(tickerLc);
  if (!filing) return { ticker, ok:false, reason:'no_filing' };

  let text;
  try{
    const buf = fs.readFileSync(filing.path);
    const raw = zlib.gunzipSync(buf).toString('utf8');
    text = stripHtml(raw);
  }catch(e){ return { ticker, ok:false, reason:'decompress' }; }

  const mda = extractMDA(text);
  const dateStr = extractDateFromFilename(filing.file) || 'N/A';
  const month = monthFr(dateStr);

  const filePath = path.join(ROOT, 'src/data/v2-pipeline', tickerLc + '.json');
  if (!fs.existsSync(filePath)) return { ticker, ok:false, reason:'no_pipeline_file' };
  let doc;
  try{ doc = JSON.parse(fs.readFileSync(filePath,'utf8')); }catch(e){ return { ticker, ok:false, reason:'parse_pipeline' }; }
  const name = doc.name || ticker;

  const prompt = buildPrompt(ticker, name, filing.kind, month, dateStr, mda);
  let jsonStr;
  try{ jsonStr = await llm(prompt); }catch(e){ return { ticker, ok:false, reason:'llm_'+e.message.slice(0,30) }; }

  let parsed;
  try{ parsed = JSON.parse(jsonStr); }catch(e){
    const m = jsonStr.match(/\{[\s\S]*\}/);
    if (m) try{ parsed = JSON.parse(m[0]); }catch(e2){}
  }
  if (!parsed || !Array.isArray(parsed.stories) || !parsed.stories.length) return { ticker, ok:false, reason:'bad_json' };

  const stories = parsed.stories.map(s => ({
    ...s,
    type: 'quarter',
    is_short_history: true,
    _source_file: filing.path.replace(ROOT + '/', ''),
    _new_extraction_at: NOW,
  }));

  doc.kpis = [...(doc.kpis || []), ...stories];
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2));
  return { ticker, ok:true, added: stories.length, filing: filing.file };
}

async function main(){
  const args = process.argv.slice(2);
  let todo;
  if (args[0] && fs.existsSync(args[0])){
    todo = JSON.parse(fs.readFileSync(args[0],'utf8'));
  } else {
    const list = JSON.parse(fs.readFileSync('src/data/sp500-tickers.json','utf8'));
    const tickers = (Array.isArray(list)?list:Object.keys(list)).map(x=>typeof x==='string'?x:(x.ticker||x.symbol||x.t)).filter(Boolean);
    todo = tickers.filter(t=>{
      const p = 'src/data/v2-pipeline/'+t.toLowerCase().replace('.','-')+'.json';
      if (!fs.existsSync(p)) return false;
      const d = JSON.parse(fs.readFileSync(p,'utf8'));
      const stories = (d.kpis||[]).filter(k=>k.story_category);
      return !stories.some(k=>k._new_extraction_at);
    });
  }
  console.log(`Todo: ${todo.length}, providers: ${KEYS.length} Cerebras + Groq fallback`);

  const results = [];
  const needsManual = [];
  let idx = 0;
  async function worker(){
    while (idx < todo.length){
      const i = idx++;
      const t = todo[i];
      const r = await processOne(t);
      results.push(r);
      if (r.ok) console.log(`[${i+1}/${todo.length}] ${t} +${r.added} stories (${r.filing})`);
      else { console.log(`[${i+1}/${todo.length}] ${t} FAIL ${r.reason}`); needsManual.push(t); }
    }
  }
  await Promise.all(Array.from({length:CONCURRENCY},worker));
  console.log(`\nOK: ${results.filter(r=>r.ok).length} | FAIL: ${needsManual.length}`);
  fs.writeFileSync('/tmp/stories-needs-manual.json', JSON.stringify(needsManual, null, 2));
  console.log('Failed list: /tmp/stories-needs-manual.json');
}
main().catch(e=>{ console.error(e); process.exit(1); });
