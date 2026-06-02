// Batch 3 logos audit & re-download (positions 200-307 V1.9.5 top market cap).
// Critères défectueux : <128px width OU JPEG masqué en .png OU >500KB.
// Suit le pattern de batch2-fix : Wikipedia/Commons API → SVG/PNG → sharp 512×140 transparent.
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_W = 512;
const TARGET_H = 140;
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/Users/yann/spx-app/public/logos';
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';

// Mapping ticker → fichier Commons (préférer SVG) ou en.wiki (fair use)
// Identifié via Commons srsearch + en.wiki page.images
const FIXES = [
  { ticker: 'FLTR.L', wiki: 'commons', title: 'Flutter Entertainment logo.svg' },
  { ticker: 'NVR',    wiki: 'en',      title: 'NVR Logo 2018.png' },
  { ticker: 'GRAB',   wiki: 'commons', title: 'Grab Logo.svg' },
  { ticker: 'NBIX',   wiki: 'en',      title: 'Neurocrine Biosciences logo.svg' },
  { ticker: 'ONTO',   wiki: 'commons', title: 'Onto Innovation logo.svg' },
  { ticker: 'JAZZ',   wiki: 'en',      title: 'Jazz Pharmaceuticals logo.png' },
  { ticker: 'GLPI',   wiki: 'en',      title: 'Gaming and Leisure Properties logo.png' },
  { ticker: 'MKC',    wiki: 'commons', title: 'Mccormick corporate logo.png' },
  { ticker: 'UNM',    wiki: 'commons', title: 'Unum Group logo.svg' },
  { ticker: 'DINO',   wiki: 'en',      title: 'HF Sinclair logo.png' },
  { ticker: 'ALGN',   wiki: 'commons', title: 'Align Technology logo.svg' },
  { ticker: 'ERF.PA', wiki: 'commons', title: 'Eurofins Scientific Logo.svg' },
  { ticker: 'BJ',     wiki: 'commons', title: 'BJs Wholesale Club Logo.svg' },
  { ticker: 'AIZ',    wiki: 'commons', title: 'Assurant logo.png' },
  { ticker: 'JEF',    wiki: 'commons', title: 'Jefferies Financial Group logo.svg' },
  { ticker: 'CAVA',   wiki: 'en',      title: 'CavaGroup2022.png' },
  { ticker: 'JKHY',   wiki: 'commons', title: 'Jack Henry & Associates logo.svg' },
  { ticker: 'HLI',    wiki: 'commons', title: 'Houlihan Lokey logo.svg' },
  { ticker: 'SPM.MI', wiki: 'commons', title: 'Saipem logo.svg' },
];

async function fetchBuf(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status === 429 && attempt < 3) {
      await new Promise((res) => setTimeout(res, 5000 * (attempt + 1)));
      continue;
    }
    throw new Error(`HTTP ${r.status}`);
  }
  throw new Error('fetchBuf retries exhausted');
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
  // Try several densities for SVGs (some have huge native viewBox triggering pixel limit)
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tickerToFilename(ticker) {
  return ticker.replace(/\./g, '-') + '.png';
}

const report = [];
for (const f of FIXES) {
  // Backoff between requests pour éviter 429 Wikimedia
  await sleep(1500);
  try {
    let meta = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        meta = await resolveUrl(f.title, f.wiki);
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await sleep(3000 * (attempt + 1));
      }
    }
    if (!meta) {
      report.push({ ticker: f.ticker, status: 'FAILED', reason: 'title not found', title: f.title, wiki: f.wiki });
      continue;
    }
    const buf = await fetchBuf(meta.url);
    const isSvg = meta.url.toLowerCase().endsWith('.svg') || (meta.mime || '').includes('svg');
    const png = await renderToPng(buf, isSvg);
    const fname = tickerToFilename(f.ticker);
    const outPath = path.join(OUTPUT_DIR, fname);
    // Backup ancien fichier
    try {
      const before = await fs.stat(outPath);
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
