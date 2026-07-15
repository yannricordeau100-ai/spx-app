#!/usr/bin/env node
// Validation des blocs revenue_by_* issus de FMP : la somme des slices doit
// être ≈ au CA total FMP (income-statement) du même exercice. Sinon revert
// du bloc (v2 + enrich) vers l'état pré-FMP (git 2629e117a3^ pour v2,
// 2629e117a3 pour enrich) et ajout à une liste manual-fix.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const KEY = process.env.FMP2_API_KEY;
const ROOT = process.cwd();
const V2 = 'src/data/v2-pipeline';
const EN = 'src/data/v2-pipeline-enrich';
const PRE_FMP_COMMIT = '2629e117a3^';   // v2 avant extraction FMP
const PRE_SYNC_COMMIT = '2629e117a3';   // enrich avant sync (commit FMP v2-only)
const TOL = 0.08; // 8% (éliminations inter-segments, corporate)

const tickers = JSON.parse(fs.readFileSync('src/data/sp500-tickers.json', 'utf8'));
const list = (Array.isArray(tickers) ? tickers : Object.keys(tickers))
  .map(x => typeof x === 'string' ? x : (x.ticker || x.symbol || x.t)).filter(Boolean);

function toUsd(v, unit){
  if (unit === 'Mds $') return v * 1e9;
  if (unit === 'M $') return v * 1e6;
  return v; // déjà brut
}

async function revenueFor(sym){
  for (let i = 0; i < 4; i++){
    try{
      const r = await fetch(`https://financialmodelingprep.com/stable/income-statement?symbol=${encodeURIComponent(sym)}&limit=1&apikey=${KEY}`, { signal: AbortSignal.timeout(30000) });
      if (r.status === 429){ await new Promise(rs=>setTimeout(rs, 2500)); continue; }
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const row = Array.isArray(j) ? j[0] : null;
      return row ? { revenue: row.revenue, fy: row.fiscalYear, date: row.date } : null;
    }catch(e){ await new Promise(rs=>setTimeout(rs, 1500)); }
  }
  return null;
}

function gitShow(commit, file){
  try{
    return JSON.parse(execSync(`git show ${commit}:${file}`, { maxBuffer: 64 * 1024 * 1024 }).toString());
  }catch(e){ return null; }
}

const rejected = [];
const kept = [];
let idx = 0;
const CONC = 3;

async function worker(){
  while (idx < list.length){
    const T = list[idx++];
    const base = T.toLowerCase();
    const v2File = fs.existsSync(path.join(V2, base + '.json')) ? `${V2}/${base}.json` : `${V2}/${base.replace('.', '-')}.json`;
    if (!fs.existsSync(v2File)) continue;
    const v2 = JSON.parse(fs.readFileSync(v2File, 'utf8'));
    const fmpBlocks = ['revenue_by_geography', 'revenue_by_segment'].filter(k => v2[k]?._fmp_extracted_at);
    if (!fmpBlocks.length) continue;

    const ref = await revenueFor(T);
    if (!ref || !ref.revenue){ kept.push({ T, note: 'no_revenue_ref' }); continue; }

    const enFile = fs.existsSync(path.join(EN, base + '.json')) ? `${EN}/${base}.json` : `${EN}/${base.replace('.', '-')}.json`;
    let en = fs.existsSync(enFile) ? JSON.parse(fs.readFileSync(enFile, 'utf8')) : null;
    let v2Dirty = false, enDirty = false;

    for (const k of fmpBlocks){
      const b = v2[k];
      const sum = b.slices.reduce((a, s) => a + toUsd(s.value, s.unit || b.unit), 0);
      const dev = Math.abs(sum - ref.revenue) / ref.revenue;
      if (dev > TOL){
        // revert v2
        const oldV2 = gitShow(PRE_FMP_COMMIT, v2File);
        if (oldV2 && oldV2[k] !== undefined) v2[k] = oldV2[k]; else delete v2[k];
        v2Dirty = true;
        // revert enrich
        if (en && en[k]?._fmp_extracted_at){
          const oldEn = gitShow(PRE_SYNC_COMMIT, enFile);
          if (oldEn && oldEn[k] !== undefined) en[k] = oldEn[k]; else delete en[k];
          enDirty = true;
        }
        rejected.push({ T, block: k, sum: Math.round(sum / 1e6), revenue: Math.round(ref.revenue / 1e6), dev: Math.round(dev * 1000) / 10 });
      }
    }
    if (v2Dirty) fs.writeFileSync(v2File, JSON.stringify(v2, null, 2));
    if (enDirty && en) fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
    if (!v2Dirty) kept.push({ T });
    if ((kept.length + rejected.length) % 50 === 0) console.log(`... ${kept.length + rejected.length} traités`);
  }
}

await Promise.all(Array.from({ length: CONC }, worker));
console.log(`\nOK gardés: ${kept.length} | REJETÉS (revert): ${rejected.length}`);
for (const r of rejected) console.log(` REVERT ${r.T} ${r.block}: somme ${r.sum}M vs CA ${r.revenue}M (écart ${r.dev}%)`);
fs.writeFileSync('/tmp/fmp-validation-report.json', JSON.stringify({ kept, rejected }, null, 2));
