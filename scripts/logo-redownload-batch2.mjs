import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_W = 512;
const TARGET_H = 140;
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/Users/yann/spx-app/public/logos';
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';

// 18 logos défectueux V1.9.5 batch 2 (positions 68-200 top 307 par market cap).
// Pour chaque ticker, candidats Wikimedia Commons (sans préfixe "File:").
// Premier rendu OK gagne. Fallback = recherche dynamique Commons.
const TARGETS = [
  // NG.L = National Grid plc (UK), pas Gresham House. Logo officiel via Commons.
  { ticker: 'ISP.MI',  candidates: ['Intesa Sanpaolo logo.svg', 'Intesa Sanpaolo logo 2024.svg'] },
  { ticker: 'NG.L',    candidates: ['National Grid plc.svg', 'National Grid logo.svg', 'National Grid (UK) logo.svg'] },
  { ticker: 'EMR',     candidates: ['Emerson Electric Company logo.svg', 'Emerson Electric logo.svg', 'Emerson logo (2023).svg'] },
  { ticker: 'WBD',     candidates: ['Warner Bros. Discovery logo.svg', 'Warner Bros Discovery Logo.svg'] },
  { ticker: 'BKR',     candidates: ['Baker Hughes logo.svg', 'Baker Hughes Company logo.svg'] },
  { ticker: 'TRV',     candidates: ['Travelers Companies logo.svg', 'The Travelers Companies logo.svg', 'Travelers logo.svg'] },
  { ticker: 'GWW',     candidates: ['W. W. Grainger logo.svg', 'Grainger logo.svg', 'W.W. Grainger logo.svg'] },
  { ticker: 'DAL',     candidates: ['Delta Air Lines logo.svg', 'Delta logo.svg'] },
  { ticker: 'EW',      candidates: ['Edwards Lifesciences logo.svg', 'Edwards Lifesciences Corporation logo.svg'] },
  { ticker: 'LONN.SW', candidates: ['Lonza Group logo.svg', 'Lonza Logo.svg', 'Lonza logo.svg'] },
  { ticker: 'EIX',     candidates: ['Edison International logo.svg', 'Edison International Logo.svg'] },
  { ticker: 'WRB',     candidates: ['W. R. Berkley Corporation logo.svg', 'W. R. Berkley logo.svg'] },
  { ticker: 'PHM',     candidates: ['PulteGroup logo.svg', 'PulteGroup Logo.svg', 'Pulte Group logo.svg'] },
  { ticker: 'ENTG',    candidates: ['Entegris logo.svg', 'Entegris Inc logo.svg'] },
  { ticker: 'STE',     candidates: ['STERIS logo.svg', 'Steris logo.svg', 'STERIS plc logo.svg'] },
  { ticker: 'DKS',     candidates: ["Dick's Sporting Goods logo.svg", "Dick's Sporting Goods Logo.svg", "Dick's Sporting Goods 2020 logo.svg"] },
  { ticker: 'CCH.L',   candidates: ['Coca-Cola HBC logo.svg', 'Coca Cola HBC logo.svg', 'CCHBC logo.svg'] },
  { ticker: 'RBA',     candidates: ['RB Global logo.svg', 'Ritchie Bros. Auctioneers logo.svg', 'RB Global Inc logo.svg'] },
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

// Convert ticker to filename: TTE.PA -> TTE-PA.png
function tickerToFilename(ticker) {
  return ticker.replace(/\./g, '-') + '.png';
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
    const fname = tickerToFilename(t.ticker);
    const outPath = path.join(OUTPUT_DIR, fname);
    await fs.writeFile(outPath, success.png);
    const meta = await sharp(success.png).metadata();
    report.push({
      ticker: t.ticker,
      filename: fname,
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
