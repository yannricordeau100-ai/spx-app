// Re-date stories with _source_month: null for A-G tickers.
// ZERO INVENTION policy. Only sets a date if a source is found.

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = 'src/data/v2-pipeline';
const DATA_LAKE = 'data-lake';

const MOIS = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre'
];

function monthYearFR(y, m) {
  return `${MOIS[m-1]} ${y}`;
}

// Look for calendar-quarter markers with no "FY" attached.
// Q1/Q2/Q3/Q4 20XX or T1/T2/T3/T4 20XX or ordinal French trimestre.
function detectCalendarQuarter(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  // Pattern: Q1 2025 / Q2 20xx / T3 2026, but NOT "Q2 FY26"
  const m1 = t.match(/\b[qt]\s?([1-4])\s*(?:20(\d{2}))\b/);
  if (m1) {
    // ensure previous 2-3 chars don't say "FY"
    const idx = t.indexOf(m1[0]);
    const preContext = t.slice(Math.max(0, idx - 6), idx);
    if (!/fy|f\.y\.|exercice/.test(preContext)) {
      const q = parseInt(m1[1], 10);
      const yy = parseInt(m1[2], 10);
      const year = 2000 + yy;
      return { year, month: q * 3 };
    }
  }

  // Ordinal French: "premier trimestre 2026" "deuxième trimestre 2026" ...
  const ord = { 'premier': 1, 'deuxième': 2, 'deuxieme': 2, 'troisième': 3, 'troisieme': 3, 'quatrième': 4, 'quatrieme': 4 };
  for (const [w, q] of Object.entries(ord)) {
    const re = new RegExp(`\\b${w}\\s+trimestre\\s+(20\\d{2})\\b`);
    const mm = t.match(re);
    if (mm) return { year: parseInt(mm[1], 10), month: q * 3 };
  }
  return null;
}

// Look for explicit "Month YYYY" in French.
function detectFrenchMonth(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  for (let i = 0; i < MOIS.length; i++) {
    const raw = MOIS[i]
      .replace('é','[eé]').replace('û','[uû]');
    const re = new RegExp(`\\b${raw}\\s+(20\\d{2})\\b`);
    const m = t.match(re);
    if (m) return { year: parseInt(m[1], 10), month: i + 1 };
  }
  return null;
}

// Look for explicit YYYY-MM-DD.
function detectISO(text) {
  if (!text) return null;
  const m = String(text).match(/\b(20\d{2})-(\d{2})-\d{2}\b/);
  if (m) return { year: parseInt(m[1],10), month: parseInt(m[2],10) };
  return null;
}

// Look for "FY<YY>" or "exercice 20XX" combined with Q<N>/T<N>.
function detectFY(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const m = t.match(/\b[qt]\s?([1-4])\s*fy\s?(\d{2})\b/);
  if (m) return { qtr: parseInt(m[1],10), fyy: 2000 + parseInt(m[2],10) };
  return null;
}

// Cache latest 8-K date per ticker.
const eightKCache = new Map();
function latest8KDate(tickerRaw) {
  if (eightKCache.has(tickerRaw)) return eightKCache.get(tickerRaw);
  // Search data-lake dirs case-insensitively.
  const candidates = [
    tickerRaw,
    tickerRaw.toUpperCase(),
    tickerRaw.toLowerCase(),
    tickerRaw.replace(/-/g, '.').toUpperCase(),
    tickerRaw.replace(/\./g, '-').toUpperCase(),
  ];
  let dir = null;
  for (const c of candidates) {
    const p = path.join(DATA_LAKE, c, '8K');
    if (fs.existsSync(p)) { dir = p; break; }
  }
  if (!dir) { eightKCache.set(tickerRaw, null); return null; }
  let files;
  try { files = fs.readdirSync(dir); } catch { files = []; }
  const dated = files
    .map(f => {
      const m = f.match(/(\d{4})-(\d{2})-(\d{2})/);
      return m ? { file: f, y: +m[1], mo: +m[2], d: +m[3] } : null;
    })
    .filter(Boolean)
    .sort((a,b) => (b.y-a.y)||(b.mo-a.mo)||(b.d-a.d));
  const result = dated.length ? { year: dated[0].y, month: dated[0].mo, file: path.join(dir, dated[0].file) } : null;
  eightKCache.set(tickerRaw, result);
  return result;
}

// Find 8-K near a specific target (year, month).
function find8KNear(tickerRaw, targetYear, targetMonth) {
  const candidates = [tickerRaw, tickerRaw.toUpperCase(), tickerRaw.toLowerCase(),
    tickerRaw.replace(/-/g,'.').toUpperCase(), tickerRaw.replace(/\./g,'-').toUpperCase()];
  let dir = null;
  for (const c of candidates) {
    const p = path.join(DATA_LAKE, c, '8K');
    if (fs.existsSync(p)) { dir = p; break; }
  }
  if (!dir) return null;
  let files;
  try { files = fs.readdirSync(dir); } catch { files = []; }
  const dated = files
    .map(f => {
      const m = f.match(/(\d{4})-(\d{2})-(\d{2})/);
      return m ? { file: f, y: +m[1], mo: +m[2], d: +m[3] } : null;
    })
    .filter(Boolean);
  if (!dated.length) return null;
  // pick closest by absolute month distance (limit search to +/- 3 months)
  const targetIdx = targetYear * 12 + targetMonth;
  let best = null; let bestDiff = 999;
  for (const d of dated) {
    const idx = d.y * 12 + d.mo;
    const diff = Math.abs(idx - targetIdx);
    if (diff < bestDiff) { bestDiff = diff; best = d; }
  }
  if (best && bestDiff <= 3) {
    return { year: best.y, month: best.mo, file: path.join(dir, best.file) };
  }
  return null;
}

function processStory(story, tickerRaw) {
  // Only touch stories with _source_month === null (and property present).
  if (!('_source_month' in story) || story._source_month !== null) return null;

  const desc = story.description || '';
  const signal = story.signal || '';
  const nameFr = story.name_fr || '';
  const lastData = story.last_data_date || story.lastDataDate;
  const combined = `${desc} ${signal} ${nameFr}`;

  // 1) Explicit last_data_date field
  if (lastData) {
    const iso = detectISO(lastData);
    if (iso) return { method: 'via_last_data', year: iso.year, month: iso.month, file: null };
  }

  // 1b) ISO date inside description
  const iso = detectISO(combined);
  if (iso) return { method: 'via_last_data', year: iso.year, month: iso.month, file: null };

  // 2) French month YYYY explicit
  const fm = detectFrenchMonth(combined);
  if (fm) return { method: 'via_last_data', year: fm.year, month: fm.month, file: null };

  // 3) Calendar quarter Q<N> 20XX / T<N> 20XX / ordinal trimestre
  const cq = detectCalendarQuarter(combined);
  if (cq) return { method: 'via_signal_quarter', year: cq.year, month: cq.month, file: null };

  // 4) FY<YY> Q<N> pattern → find matching 8-K using latest as proxy for ER
  const fy = detectFY(combined);
  if (fy && story._source === 'ER') {
    const l8k = latest8KDate(tickerRaw);
    if (l8k) return { method: 'via_8k_match', year: l8k.year, month: l8k.month, file: l8k.file };
  }

  return null;
}

function processFile(fp, tickerRaw, stats) {
  let raw;
  try { raw = fs.readFileSync(fp, 'utf8'); } catch { return; }
  if (!raw.includes('"_source_month": null')) return;
  let d;
  try { d = JSON.parse(raw); } catch { return; }

  let touched = false;
  let dated = 0;
  let stillNull = 0;

  // Walk all objects.
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if ('_source_month' in n && n._source_month === null) {
      const r = processStory(n, tickerRaw);
      if (r) {
        n._source_month = monthYearFR(r.year, r.month);
        n._source_file = r.file || null;
        // If a reason field existed, clear it since we have a date now.
        if ('_source_month_reason' in n) delete n._source_month_reason;
        stats.method_distribution[r.method]++;
        dated++;
        touched = true;
      } else {
        stillNull++;
        // Ensure reason field records why we couldn't date.
        if (!n._source_month_reason) {
          n._source_month_reason = 'Aucun indice de date exploitable dans les champs de la story';
        }
      }
    }
    for (const k of Object.keys(n)) walk(n[k]);
  };
  walk(d);

  if (touched) {
    fs.writeFileSync(fp, JSON.stringify(d, null, 2));
    stats.stes_touched++;
  }
  stats.stories_dated += dated;
  stats.stories_still_null += stillNull;
}

function main() {
  const files = fs.readdirSync(PIPELINE_DIR)
    .filter(f => /^[a-g]/i.test(f) && f.endsWith('.json') && !f.includes('gemini') && !f.includes('.bak'));
  const stats = {
    stes_touched: 0,
    stories_dated: 0,
    stories_still_null: 0,
    method_distribution: { via_last_data: 0, via_8k_match: 0, via_signal_quarter: 0 },
  };
  for (const f of files) {
    // Derive ticker from filename: e.g. "atgl.json" -> "ATGL", "a2a.mi.json" -> "A2A.MI"
    const base = f.replace(/\.json$/, '');
    const tickerRaw = base.toUpperCase();
    processFile(path.join(PIPELINE_DIR, f), tickerRaw, stats);
  }
  process.stdout.write(JSON.stringify(stats));
}

main();
