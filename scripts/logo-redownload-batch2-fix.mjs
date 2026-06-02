// Round 2 : retries pour les logos batch 2 mal identifiés via fallback search Commons.
// Utilise en.wikipedia API pour les fair-use (Wikimedia Commons n'a pas tous les logos US).
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_W = 512;
const TARGET_H = 140;
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/Users/yann/spx-app/public/logos';
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';

// Corrections explicites (URL directe verifiée) pour les fallbacks erronés.
// EMR a pris "1945 logo", TRV a pris "Federal Motor Truck", EIX a pris "Community College",
// DKS et RBA ont pris "Burger King" / "HOS-lockup", WRB et ENTG ont échoué.
// + NG.L pour s'assurer du logo correct (Nattygridlogo.svg = National Grid plc).
const FIXES = [
  { ticker: 'EMR',     wiki: 'en', title: 'Emerson Electric Company.svg' },
  { ticker: 'TRV',     wiki: 'en', title: 'The Travelers Companies.svg' },
  { ticker: 'EIX',     wiki: 'en', title: 'Edison International Logo.svg' },
  { ticker: 'DKS',     wiki: 'en', title: "New Dick's Sporting Goods logo.svg" },
  { ticker: 'RBA',     wiki: 'en', title: 'Ritchie Bros Auctioneers logo.svg' },
  { ticker: 'WRB',     wiki: 'en', title: 'W. R. Berkley Corporation logo.svg' },
  { ticker: 'ENTG',    wiki: 'en', title: 'Entegris Logo.png' },
  // NG.L : déjà OK avec National Grid logo.svg mais on retombe sur Nattygridlogo.svg
  // qui est la version officielle du wiki anglais. On garde ce qu'on a (déjà OK).
];

async function fetchBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function resolveUrl(title, wiki = 'commons') {
  const host = wiki === 'en' ? 'en.wikipedia.org' : 'commons.wikimedia.org';
  const apiUrl = `https://${host}/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cmime&titles=${encodeURIComponent('File:' + title)}`;
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

function tickerToFilename(ticker) {
  return ticker.replace(/\./g, '-') + '.png';
}

const report = [];
for (const f of FIXES) {
  try {
    const meta = await resolveUrl(f.title, f.wiki);
    if (!meta) {
      report.push({ ticker: f.ticker, status: 'FAILED', reason: 'title not found', title: f.title });
      continue;
    }
    const buf = await fetchBuf(meta.url);
    const isSvg = meta.url.toLowerCase().endsWith('.svg') || (meta.mime || '').includes('svg');
    const png = await renderToPng(buf, isSvg);
    const fname = tickerToFilename(f.ticker);
    const outPath = path.join(OUTPUT_DIR, fname);
    await fs.writeFile(outPath, png);
    const m = await sharp(png).metadata();
    report.push({
      ticker: f.ticker,
      filename: fname,
      status: 'OK',
      title: f.title,
      sourceUrl: meta.url,
      width: m.width,
      height: m.height,
      bytes: png.length,
    });
  } catch (e) {
    report.push({ ticker: f.ticker, status: 'FAILED', error: e.message, title: f.title });
  }
}

console.log(JSON.stringify(report, null, 2));
