#!/usr/bin/env tsx
/**
 * Date is_short_history stories for SP500 tickers starting Q-Z.
 * Zero invention. Methods (priority order):
 *   1. via_signal_quarter: signal text contains Qn YYYY / Tn YYYY
 *   2. via_8k_match: accession match in data-lake/<T>/8K or most recent 8-K before last_data_date
 *   3. via_last_data: fallback to last_data_date month
 * Emits {stes_touched,stories_dated,stories_still_null,method_distribution:{via_last_data,via_8k_match,via_signal_quarter}}
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = '/Users/yann/spx-app';
const SP500: string[] = JSON.parse(fs.readFileSync(`${ROOT}/src/data/sp500-tickers.json`, 'utf8'));
const QZ = SP500.filter(t => /^[Q-Z]/i.test(t));

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
const ACCESSION_RE = /\d{10}-\d{2}-\d{6}/;
const QUARTER_RE = /\b([QT])\s?([1-4])[\s\-\/]{0,3}(20\d{2})\b|\b(20\d{2})[\s\-\/]{0,3}([QT])\s?([1-4])\b/i;
const QUARTER_END: Record<string, string> = {'1':'03','2':'06','3':'09','4':'12'};

function frMonth(iso: string): string | null {
  const m = DATE_RE.exec(iso);
  if (!m) return null;
  const y = m[1], mo = parseInt(m[2],10);
  if (mo < 1 || mo > 12) return null;
  return `${MOIS_FR[mo-1]} ${y}`;
}

function findLakeDir(ticker: string): string | null {
  for (const v of [ticker, ticker.toUpperCase(), ticker.replace(/\./g,'-'), ticker.replace(/\./g,'-').toUpperCase()]) {
    const p = `${ROOT}/data-lake/${v}`;
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  return null;
}

function list8kFiles(lakeDir: string): { iso: string; name: string }[] {
  const p = `${lakeDir}/8K`;
  if (!fs.existsSync(p)) return [];
  const out: { iso: string; name: string }[] = [];
  for (const f of fs.readdirSync(p)) {
    const m = DATE_RE.exec(f);
    if (m) out.push({ iso: m[0], name: f });
  }
  out.sort((a,b) => a.iso.localeCompare(b.iso));
  return out;
}

function findByAccession(lakeDir: string, accession: string): string | null {
  for (const sub of ['10K','10Q','8K']) {
    const p = `${lakeDir}/${sub}`;
    if (!fs.existsSync(p)) continue;
    for (const f of fs.readdirSync(p)) {
      if (f.includes(accession)) {
        const m = DATE_RE.exec(f);
        if (m) return m[0];
      }
    }
  }
  return null;
}

function mostRecent8kBefore(files: { iso: string }[], deadline: string | null): string | null {
  if (!files.length) return null;
  if (!deadline) return files[files.length-1].iso;
  let picked: string | null = null;
  for (const f of files) {
    if (f.iso <= deadline) picked = f.iso;
    else break;
  }
  return picked ?? files[0].iso;
}

function extractQuarter(text: string): string | null {
  // returns ISO YYYY-MM-01 corresponding to end-of-quarter month
  const m = QUARTER_RE.exec(text);
  if (!m) return null;
  let q: string, y: string;
  if (m[2]) { q = m[2]; y = m[3]; }
  else { q = m[6]; y = m[4]; }
  const mo = QUARTER_END[q];
  if (!mo) return null;
  return `${y}-${mo}-01`;
}

type Stats = { via_last_data: number; via_8k_match: number; via_signal_quarter: number; still_null: number };

function processTicker(ticker: string): Stats | null {
  const lc = ticker.toLowerCase();
  const candidates = [`${ROOT}/src/data/v2-pipeline/${lc}.json`, `${ROOT}/src/data/v2-pipeline/${lc.replace(/\./g,'-')}.json`];
  const pipePath = candidates.find(p => fs.existsSync(p));
  if (!pipePath) return null;
  const data = JSON.parse(fs.readFileSync(pipePath, 'utf8'));
  const lakeDir = findLakeDir(ticker);
  const stats: Stats = { via_last_data: 0, via_8k_match: 0, via_signal_quarter: 0, still_null: 0 };
  let changed = false;
  const files8k = lakeDir ? list8kFiles(lakeDir) : [];

  for (const arrName of ['kpis', 'stories_kpis'] as const) {
    const arr = data[arrName];
    if (!Array.isArray(arr)) continue;
    for (const kk of arr) {
      if (!kk || typeof kk !== 'object') continue;
      if (!kk.is_short_history) continue;
      if (kk._source_month) continue;

      let month: string | null = null;
      let reason: keyof Stats | null = null;

      // (1) via_signal_quarter: search signal text for Qn YYYY
      const signalTxt = [kk.signal, kk.description, kk.explanation, kk._source_file, kk._source].filter((x: any) => typeof x === 'string').join(' | ');
      const qIso = extractQuarter(signalTxt);
      if (qIso) {
        month = frMonth(qIso);
        if (month) reason = 'via_signal_quarter';
      }

      // (2) via_8k_match
      if (!month && lakeDir) {
        const src = String(kk._source ?? '');
        const acc = ACCESSION_RE.exec(src);
        let iso: string | null = null;
        if (acc) iso = findByAccession(lakeDir, acc[0]);
        if (!iso && files8k.length) {
          const deadline = typeof kk.last_data_date === 'string' && DATE_RE.test(kk.last_data_date) ? kk.last_data_date : null;
          iso = mostRecent8kBefore(files8k, deadline);
        }
        if (iso) {
          month = frMonth(iso);
          if (month) reason = 'via_8k_match';
        }
      }

      // (3) via_last_data
      if (!month) {
        const ldd = kk.last_data_date;
        if (typeof ldd === 'string') {
          month = frMonth(ldd);
          if (month) reason = 'via_last_data';
        }
      }

      if (month && reason) {
        kk._source_month = month;
        stats[reason] += 1;
        changed = true;
      } else {
        kk._source_month = null;
        kk._source_month_reason = 'Aucune source identifiable (Q-Z batch)';
        stats.still_null += 1;
        changed = true;
      }
    }
  }
  if (changed) fs.writeFileSync(pipePath, JSON.stringify(data, null, 2) + '\n');
  return stats;
}

function main() {
  let stes_touched = 0;
  const method_distribution = { via_last_data: 0, via_8k_match: 0, via_signal_quarter: 0 };
  let stories_still_null = 0;
  for (const t of QZ) {
    const r = processTicker(t);
    if (!r) continue;
    const touched = r.via_last_data + r.via_8k_match + r.via_signal_quarter + r.still_null;
    if (touched > 0) stes_touched += 1;
    method_distribution.via_last_data += r.via_last_data;
    method_distribution.via_8k_match += r.via_8k_match;
    method_distribution.via_signal_quarter += r.via_signal_quarter;
    stories_still_null += r.still_null;
  }
  const stories_dated = method_distribution.via_last_data + method_distribution.via_8k_match + method_distribution.via_signal_quarter;
  console.log(JSON.stringify({ stes_touched, stories_dated, stories_still_null, method_distribution }));
}

main();
