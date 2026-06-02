// Batch 4 pass 3 : retries pour les 26 stés restantes après correction wiki (en vs commons).
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_W = 512;
const TARGET_H = 140;
const OUTPUT_DIR = '/Users/yann/spx-app/public/logos';
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';

const FIXES = [
  { ticker: 'ARE',    wiki: 'en',      title: 'Alexandria Real Estate Equities logo.png' },
  { ticker: 'BEN',    wiki: 'en',      title: 'Franklin Resources Logo.svg' },
  { ticker: 'CAG',    wiki: 'en',      title: 'Conagra brands logo17.png' },
  { ticker: 'CHD',    wiki: 'en',      title: 'Church & Dwight logo.svg' },
  { ticker: 'CI',     wiki: 'en',      title: 'Cigna logo.svg' },
  { ticker: 'CINF',   wiki: 'en',      title: 'Cincinnati Financial logo.svg' },
  { ticker: 'CPT',    wiki: 'en',      title: 'Camden Property Trust logo.png' },
  { ticker: 'DE',     wiki: 'en',      title: 'John Deere Logo – Flat 2 Color.svg' },
  { ticker: 'DRI',    wiki: 'en',      title: 'Darden logo.svg' },
  { ticker: 'ES',     wiki: 'en',      title: 'Eversource Energy Logo.svg' },
  { ticker: 'FANG',   wiki: 'en',      title: 'Diamondback Energy, Logo 2022.svg' },
  { ticker: 'FFIV',   wiki: 'en',      title: 'F5 Networks logo.svg' },
  { ticker: 'IEX',    wiki: 'en',      title: 'IDEX Corporation Logo.png' },
  { ticker: 'MGM',    wiki: 'en',      title: 'MGM Resorts International logo.svg' },
  { ticker: 'NSC',    wiki: 'en',      title: 'Norfolk Southern (logo, horizontal).svg' },
  { ticker: 'ODFL',   wiki: 'en',      title: 'Old Dominion Freight Line, Inc. Logo.png' },
  { ticker: 'PODD',   wiki: 'en',      title: 'Insulet Corporation Logo.svg' },
  { ticker: 'POOL',   wiki: 'en',      title: 'Pool Corporation Logo.svg' },
  { ticker: 'PRU',    wiki: 'en',      title: 'Prudential Financial Logo.svg' },
  { ticker: 'PWR',    wiki: 'en',      title: 'Quanta Services inc logo.png' },
  { ticker: 'Q',      wiki: 'en',      title: 'Qnity Electronics logo.jpg' },
  { ticker: 'STZ',    wiki: 'en',      title: 'Constellation Brands Logo.png' },
  { ticker: 'TXT',    wiki: 'commons', title: 'Textron.svg' },
  { ticker: 'TYL',    wiki: 'en',      title: 'Tyler Technologies logo.svg' },
  { ticker: 'UAL',    wiki: 'en',      title: 'United Airlines Logo.svg' },
  { ticker: 'WEC',    wiki: 'en',      title: 'WEC Energy Group Logo.svg' },
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
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
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
      if (r.status === 429 && attempt < 3) {
        await sleep(8000 * (attempt + 1));
        continue;
      }
      return null;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}

async function renderToPng(buf, isSvg) {
  const densities = isSvg ? [400, 200, 150, 96, 72] : [null];
  let lastErr;
  for (const d of densities) {
    try {
      const pipeline = isSvg ? sharp(buf, { density: d, limitInputPixels: 268402689 }) : sharp(buf, { limitInputPixels: 268402689 });
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
  await sleep(1500);
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
      await fs.stat(outPath);
      await fs.copyFile(outPath, outPath + '.batch4-bak');
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
