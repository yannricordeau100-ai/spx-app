// Batch 3 retry uniquement sur les 8 fails initiaux.
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_W = 512;
const TARGET_H = 140;
const OUTPUT_DIR = '/Users/yann/spx-app/public/logos';
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';

const FIXES = [
  { ticker: 'NBIX',   wiki: 'en',      title: 'Neurocrine Biosciences logo.svg' },
  { ticker: 'ALGN',   wiki: 'commons', title: 'Align Technology logo.svg' },
  { ticker: 'AIZ',    wiki: 'commons', title: 'Assurant logo.png' },
  { ticker: 'JEF',    wiki: 'commons', title: 'Jefferies Financial Group logo.svg' },
  { ticker: 'CAVA',   wiki: 'en',      title: 'CavaGroup2022.png' },
  { ticker: 'JKHY',   wiki: 'commons', title: 'Jack Henry & Associates logo.svg' },
  { ticker: 'HLI',    wiki: 'commons', title: 'Houlihan Lokey logo.svg' },
  { ticker: 'SPM.MI', wiki: 'commons', title: 'Saipem logo.svg' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status === 429 && attempt < 4) {
      await sleep(8000 * (attempt + 1));
      continue;
    }
    throw new Error(`HTTP ${r.status}`);
  }
  throw new Error('fetchBuf retries exhausted');
}

async function resolveUrl(title, wiki = 'commons') {
  const host = wiki === 'en' ? 'en.wikipedia.org' : 'commons.wikimedia.org';
  const apiUrl = `https://${host}/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cmime&titles=${encodeURIComponent('File:' + title)}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(apiUrl, { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const j = await r.json();
      const pages = j?.query?.pages || {};
      for (const pid of Object.keys(pages)) {
        if (pid === '-1') return null;
        const info = pages[pid]?.imageinfo?.[0];
        if (info?.url) return { url: info.url, mime: info.mime || '' };
      }
      return null;
    }
    if (r.status === 429 && attempt < 4) {
      await sleep(8000 * (attempt + 1));
      continue;
    }
    return null;
  }
  return null;
}

async function renderToPng(buf, isSvg) {
  const densities = isSvg ? [400, 200, 150, 96, 72, 48] : [null];
  let lastErr;
  for (const d of densities) {
    try {
      const pipeline = isSvg
        ? sharp(buf, { density: d, limitInputPixels: 1073741824 })
        : sharp(buf, { limitInputPixels: 1073741824 });
      return await pipeline
        .resize({
          width: TARGET_W,
          height: TARGET_H,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function tickerToFilename(ticker) {
  return ticker.replace(/\./g, '-') + '.png';
}

const report = [];
for (const f of FIXES) {
  await sleep(3000); // backoff entre stés
  try {
    const meta = await resolveUrl(f.title, f.wiki);
    if (!meta) {
      report.push({ ticker: f.ticker, status: 'FAILED', reason: 'title not found', title: f.title, wiki: f.wiki });
      continue;
    }
    const buf = await fetchBuf(meta.url);
    const isSvg = meta.url.toLowerCase().endsWith('.svg') || (meta.mime || '').includes('svg');
    const png = await renderToPng(buf, isSvg);
    const fname = tickerToFilename(f.ticker);
    const outPath = path.join(OUTPUT_DIR, fname);
    try {
      await fs.copyFile(outPath, outPath + '.batch3-bak');
    } catch {}
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
    report.push({ ticker: f.ticker, status: 'FAILED', error: e.message, title: f.title, wiki: f.wiki });
  }
}

console.log(JSON.stringify(report, null, 2));
