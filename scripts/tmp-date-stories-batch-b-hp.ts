#!/usr/bin/env tsx
/**
 * Batch B: date stories nulles pour sociétés H-P.
 * ZÉRO INVENTION. Ordre méthodes:
 *   1. via_signal_quarter : parse Qx 20XX / trimestre / month explicite dans signal/description/explanation
 *   2. via_8k_match       : 8-K data-lake dont date ~ last_data_date (±90j)
 *   3. via_last_data      : fallback via last_data_date (mois/année)
 * Sinon: laisser null.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/yann/spx-app';
const COMPANIES = path.join(ROOT, 'src/data/companies');
const LAKE = path.join(ROOT, 'data-lake');

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
// Qx 20XX or Qx-YY or "premier/second/troisième/quatrième trimestre 20XX"
const Q_PATTERNS: RegExp[] = [
  /\bQ([1-4])[\s\-\/]*20(\d{2})\b/i,
  /\b(?:1er|premier|1st|first)\s+trimestre\s+20(\d{2})/i,
  /\b(?:2[eè]|2nd|second|deuxi[eè]me)\s+trimestre\s+20(\d{2})/i,
  /\b(?:3[eè]|3rd|third|troisi[eè]me)\s+trimestre\s+20(\d{2})/i,
  /\b(?:4[eè]|4th|fourth|quatri[eè]me)\s+trimestre\s+20(\d{2})/i,
  /\b(FY|exercice|fiscal\s+year)\s+20(\d{2})/i,
];
const MONTH_TOKENS: [string, number][] = [
  ['janvier',1],['jan',1],['january',1],
  ['février',2],['fevrier',2],['feb',2],['february',2],
  ['mars',3],['mar',3],['march',3],
  ['avril',4],['apr',4],['april',4],
  ['mai',5],['may',5],
  ['juin',6],['jun',6],['june',6],
  ['juillet',7],['jul',7],['july',7],
  ['août',8],['aout',8],['aug',8],['august',8],
  ['septembre',9],['sep',9],['sept',9],['september',9],
  ['octobre',10],['oct',10],['october',10],
  ['novembre',11],['nov',11],['november',11],
  ['décembre',12],['decembre',12],['dec',12],['december',12],
];

function frMonth(y: number, m: number): string | null {
  if (m < 1 || m > 12) return null;
  return `${MOIS_FR[m-1]} ${y}`;
}

function parseIso(s: string): { y: number; m: number; d: number } | null {
  const mm = DATE_RE.exec(s);
  if (!mm) return null;
  return { y: +mm[1], m: +mm[2], d: +mm[3] };
}

function daysBetween(a: {y:number;m:number;d:number}, b: {y:number;m:number;d:number}): number {
  const da = Date.UTC(a.y, a.m-1, a.d);
  const db = Date.UTC(b.y, b.m-1, b.d);
  return Math.abs(da - db) / 86400000;
}

function fromSignalQuarter(text: string): string | null {
  if (!text) return null;
  // Qx 20XX
  let m = text.match(/\bQ([1-4])[\s\-\/]*20(\d{2})\b/i);
  if (m) {
    const q = +m[1]; const y = 2000 + +m[2];
    const monthEnd = [3, 6, 9, 12][q-1];
    return frMonth(y, monthEnd);
  }
  // Ordinal trimestre
  const ord: Array<[RegExp, number]> = [
    [/\b(?:1er|premier|1st|first)\s+trimestre\s+20(\d{2})/i, 3],
    [/\b(?:2[eè]|2nd|second|deuxi[eè]me)\s+trimestre\s+20(\d{2})/i, 6],
    [/\b(?:3[eè]|3rd|third|troisi[eè]me)\s+trimestre\s+20(\d{2})/i, 9],
    [/\b(?:4[eè]|4th|fourth|quatri[eè]me)\s+trimestre\s+20(\d{2})/i, 12],
  ];
  for (const [re, mo] of ord) {
    m = text.match(re);
    if (m) return frMonth(2000 + +m[1], mo);
  }
  // Month + year (e.g. "septembre 2024", "March 2023")
  const monRe = new RegExp(`\\b(${MONTH_TOKENS.map(([w])=>w).join('|')})\\s+(20\\d{2})\\b`, 'i');
  m = text.match(monRe);
  if (m) {
    const token = m[1].toLowerCase();
    const found = MONTH_TOKENS.find(([w])=>w===token);
    if (found) return frMonth(+m[2], found[1]);
  }
  return null;
}

function findLakeDir(ticker: string): string | null {
  const variants = [ticker, ticker.toUpperCase(), ticker.replace(/\./g,'-'), ticker.replace(/\./g,'-').toUpperCase()];
  for (const v of variants) {
    const p = path.join(LAKE, v);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  return null;
}

function list8kDates(lakeDir: string): {y:number;m:number;d:number}[] {
  const p = path.join(lakeDir, '8K');
  if (!fs.existsSync(p)) return [];
  const out: {y:number;m:number;d:number}[] = [];
  for (const f of fs.readdirSync(p)) {
    const iso = parseIso(f);
    if (iso) out.push(iso);
  }
  return out;
}

function match8k(dates8k: {y:number;m:number;d:number}[], anchor: {y:number;m:number;d:number} | null): {y:number;m:number;d:number} | null {
  if (!anchor || dates8k.length === 0) return null;
  let best: {y:number;m:number;d:number} | null = null;
  let bestDist = Infinity;
  for (const d of dates8k) {
    const dist = daysBetween(anchor, d);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  if (best && bestDist <= 90) return best;
  return null;
}

function processTicker(ticker: string) {
  const filePath = path.join(COMPANIES, `${ticker}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const lakeDir = findLakeDir(ticker);
  const dates8k = lakeDir ? list8kDates(lakeDir) : [];
  let changed = false;
  const stats = { via_last_data: 0, via_8k_match: 0, via_signal_quarter: 0, still_null: 0, touched: 0 };

  for (const key of Object.keys(data)) {
    const arr = data[key];
    if (!Array.isArray(arr)) continue;
    for (const s of arr) {
      if (!s || typeof s !== 'object') continue;
      if (!s.is_short_history && !s.story_category) continue;
      if (s._source_month) continue;
      stats.touched++;
      let month: string | null = null;
      let reason: 'via_signal_quarter'|'via_8k_match'|'via_last_data'|null = null;

      // 1) signal / description / explanation quarter
      const textFields = [s.signal, s.description, s.explanation, s.name_fr, s.name_en].filter(x=>typeof x==='string');
      for (const txt of textFields) {
        const cand = fromSignalQuarter(txt);
        if (cand) { month = cand; reason = 'via_signal_quarter'; break; }
      }

      // 2) 8-K match near last_data_date
      if (!month) {
        const anchor = typeof s.last_data_date === 'string' ? parseIso(s.last_data_date) : null;
        const hit = match8k(dates8k, anchor);
        if (hit) {
          month = frMonth(hit.y, hit.m);
          if (month) reason = 'via_8k_match';
        }
      }

      // 3) last_data_date fallback
      if (!month && typeof s.last_data_date === 'string') {
        const iso = parseIso(s.last_data_date);
        if (iso) {
          month = frMonth(iso.y, iso.m);
          if (month) reason = 'via_last_data';
        }
      }

      if (month && reason) {
        s._source_month = month;
        s._source_month_reason = reason;
        stats[reason]++;
        changed = true;
      } else {
        stats.still_null++;
      }
    }
  }
  if (changed) fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return stats;
}

function main() {
  const all = fs.readdirSync(COMPANIES).filter(f=>f.endsWith('.json') && !f.includes('.bak.') && !f.includes('.gemini.'));
  const tickers = all.map(f=>f.replace('.json','')).filter(t=>{
    const c = t[0].toLowerCase();
    return c >= 'h' && c <= 'p';
  });
  const totals = {
    stes_touched: 0,
    stories_dated: 0,
    stories_still_null: 0,
    method_distribution: { via_last_data: 0, via_8k_match: 0, via_signal_quarter: 0 },
  };
  for (const t of tickers) {
    const r = processTicker(t);
    if (!r || r.touched === 0) continue;
    totals.stes_touched++;
    totals.stories_dated += r.via_last_data + r.via_8k_match + r.via_signal_quarter;
    totals.stories_still_null += r.still_null;
    totals.method_distribution.via_last_data += r.via_last_data;
    totals.method_distribution.via_8k_match += r.via_8k_match;
    totals.method_distribution.via_signal_quarter += r.via_signal_quarter;
  }
  console.log(JSON.stringify(totals));
}

main();
