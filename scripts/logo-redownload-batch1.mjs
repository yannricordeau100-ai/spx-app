import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_W = 512;
const TARGET_H = 140;
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/Users/yann/spx-app/public/logos';
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';

// Each target lists candidate Wikimedia Commons file titles (without "File:").
// Order = preference. First successful render wins. Fallback = Commons search.
const TARGETS = [
  { ticker: 'META', candidates: ['Meta Platforms Inc. logo.svg', 'Meta Platforms Inc. logo (cropped).svg'] },
  { ticker: 'MU',   candidates: ['Micron Technology logo.svg'] },
  { ticker: 'PLTR', candidates: ['Palantir Technologies logo.svg'] },
  { ticker: 'KLAC', candidates: ['KLA logo (2019).svg', 'KLA logo.svg'] },
  { ticker: 'STX',  candidates: ['Seagate logo.svg'] },
  { ticker: 'TMO',  candidates: ['Thermo Fisher Scientific logo.svg'] },
  { ticker: 'PH',   candidates: ['Parker Hannifin logo.svg'] },
  { ticker: 'CEG',  candidates: ['Constellation Energy logo.svg'] },
  { ticker: 'HCA',  candidates: ['HCA Healthcare logo.svg'] },
];

async function fetchBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function resolveCommonsUrl(title) {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cmime&titles=${encodeURIComponent('File:' + title)}`;
  const r = await fetch(apiUrl, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j = await r.json();
  const pages = j?.query?.pages || {};
  for (const pid of Object.keys(pages)) {
    if (pid === '-1') return null;
    const info = pages[pid]?.imageinfo?.[0];
    if (info?.url) return { url: info.url, mime: info.mime || '' };
  }
  return null;
}

async function searchCommons(query, limit = 8) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.query?.search || []).map(s => s.title.replace(/^File:/, ''));
}

async function renderToPng(buf, isSvg) {
  const pipeline = isSvg ? sharp(buf, { density: 400 }) : sharp(buf);
  return pipeline
    .resize({
      width: TARGET_W,
      height: TARGET_H,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function tryTitle(title) {
  try {
    const meta = await resolveCommonsUrl(title);
    if (!meta) return null;
    const buf = await fetchBuf(meta.url);
    const isSvg = meta.url.toLowerCase().endsWith('.svg') || (meta.mime || '').includes('svg');
    const png = await renderToPng(buf, isSvg);
    return { png, sourceUrl: meta.url, title };
  } catch (e) {
    return { error: e.message, title };
  }
}

const report = [];
for (const t of TARGETS) {
  let success = null;
  const tried = [];

  for (const title of t.candidates) {
    const res = await tryTitle(title);
    tried.push({ title, ok: !!res?.png, error: res?.error });
    if (res?.png) { success = res; break; }
  }

  if (!success) {
    // Dynamic search fallback
    const queryBase = t.candidates[0].replace(/\.(svg|png)$/i, '').replace(/\blogo\b/i, '').trim();
    const found = await searchCommons(`${queryBase} logo`, 8);
    for (const title of found) {
      if (tried.some(x => x.title === title)) continue;
      if (!/\.(svg|png)$/i.test(title)) continue;
      const res = await tryTitle(title);
      tried.push({ title, ok: !!res?.png, error: res?.error, fromSearch: true });
      if (res?.png) { success = res; break; }
    }
  }

  if (success) {
    const outPath = path.join(OUTPUT_DIR, `${t.ticker}.png`);
    await fs.writeFile(outPath, success.png);
    const meta = await sharp(success.png).metadata();
    report.push({
      ticker: t.ticker,
      status: 'OK',
      title: success.title,
      sourceUrl: success.sourceUrl,
      width: meta.width,
      height: meta.height,
      bytes: success.png.length,
    });
  } else {
    report.push({ ticker: t.ticker, status: 'FAILED', tried });
  }
}

console.log(JSON.stringify(report, null, 2));
