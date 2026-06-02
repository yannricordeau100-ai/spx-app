// Batch 4 pass 2 : retries pour les 53 fails initiaux + Q/Insulet/Digital Realty (recherche manuelle).
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_W = 512;
const TARGET_H = 140;
const OUTPUT_DIR = '/Users/yann/spx-app/public/logos';
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';

const FIXES = [
  { ticker: 'ALL',    wiki: 'commons', title: 'Allstate wordmark.svg' },
  { ticker: 'ARE',    wiki: 'commons', title: 'Alexandria Real Estate Equities logo.png' },
  { ticker: 'ATO',    wiki: 'commons', title: 'Atmos Energy Logo.svg' },
  { ticker: 'BEN',    wiki: 'commons', title: 'Franklin Templeton logo.png' },
  { ticker: 'BRK.B',  wiki: 'commons', title: 'Berkshire-Hathaway-Logo.svg' },
  { ticker: 'CAG',    wiki: 'commons', title: 'Conagra brands logo17.png' },
  { ticker: 'CASY',   wiki: 'commons', title: "Casey's logo.svg" },
  { ticker: 'CHD',    wiki: 'commons', title: 'Church & Dwight logo.svg' },
  { ticker: 'CI',     wiki: 'commons', title: 'Cigna logo.svg' },
  { ticker: 'CINF',   wiki: 'commons', title: 'Cincinnati Financial logo.svg' },
  { ticker: 'CPAY',   wiki: 'commons', title: 'Corpay Logo.svg' },
  { ticker: 'CPT',    wiki: 'commons', title: 'Camden Property Trust logo.png' },
  { ticker: 'DE',     wiki: 'commons', title: 'John Deere Logo – Flat 2 Color.svg' },
  { ticker: 'DLR',    wiki: 'commons', title: 'Digital Realty TM Brandmark RGB Black.svg' },
  { ticker: 'DRI',    wiki: 'commons', title: 'Darden logo.svg' },
  { ticker: 'DVN',    wiki: 'commons', title: 'Devon-Energy-Logo.svg' },
  { ticker: 'ES',     wiki: 'commons', title: 'Eversource Energy Logo.svg' },
  { ticker: 'FANG',   wiki: 'commons', title: 'Diamondback Energy, Logo 2022.svg' },
  { ticker: 'FDS',    wiki: 'commons', title: 'FactSet wordmark.svg' },
  { ticker: 'FE',     wiki: 'commons', title: 'FirstEnergy Logo.svg' },
  { ticker: 'FFIV',   wiki: 'commons', title: 'F5 Networks logo.svg' },
  { ticker: 'FTV',    wiki: 'commons', title: 'Fortive Logo.svg' },
  { ticker: 'GNRC',   wiki: 'commons', title: 'Generac Power Systems logo.png' },
  { ticker: 'HST',    wiki: 'commons', title: 'Logo Host Hotels & Resorts.svg' },
  { ticker: 'IEX',    wiki: 'commons', title: 'IDEX Corporation Logo.png' },
  { ticker: 'IP',     wiki: 'commons', title: 'InternationalPaper logo 2023.svg' },
  { ticker: 'J',      wiki: 'commons', title: 'Jacobs Engineering Group 2019 logo.svg' },
  { ticker: 'MGM',    wiki: 'en',      title: 'MGM Resorts logo.svg' },
  { ticker: 'NSC',    wiki: 'commons', title: 'Norfolk Southern (logo, horizontal).svg' },
  { ticker: 'ODFL',   wiki: 'commons', title: 'Old Dominion Freight Line, Inc. Logo.png' },
  { ticker: 'ORLY',   wiki: 'commons', title: "O'Reilly Auto Parts Logo.svg" },
  { ticker: 'PODD',   wiki: 'en',      title: 'Insulet Corporation logo.png' },
  { ticker: 'POOL',   wiki: 'commons', title: 'Pool Corporation Logo.svg' },
  { ticker: 'PRU',    wiki: 'en',      title: 'Prudential Financial logo.svg' },
  { ticker: 'PWR',    wiki: 'commons', title: 'Quanta Services inc logo.png' },
  { ticker: 'Q',      wiki: 'en',      title: 'Qnity logo.png' },
  { ticker: 'REGN',   wiki: 'commons', title: 'Regeneron logo.svg' },
  { ticker: 'RJF',    wiki: 'commons', title: 'Raymond James wordmark.svg' },
  { ticker: 'RVTY',   wiki: 'commons', title: 'Revvity Logo.svg' },
  { ticker: 'SNA',    wiki: 'commons', title: 'Snap-on logo.svg' },
  { ticker: 'STZ',    wiki: 'commons', title: 'Constellation Brands Logo.png' },
  { ticker: 'TECH',   wiki: 'commons', title: 'Bio-Techne logo.svg' },
  { ticker: 'TER',    wiki: 'commons', title: 'Teradyne logo 2014.svg' },
  { ticker: 'TJX',    wiki: 'commons', title: 'TJX Logo.svg' },
  { ticker: 'TMUS',   wiki: 'commons', title: 'T-Mobile US Logo 2022 RGB Magenta on Transparent.svg' },
  { ticker: 'TXT',    wiki: 'en',      title: 'Textron logo.svg' },
  { ticker: 'TYL',    wiki: 'commons', title: 'Tyler Technologies logo.svg' },
  { ticker: 'UAL',    wiki: 'en',      title: 'United Airlines Holdings logo.svg' },
  { ticker: 'VRTX',   wiki: 'commons', title: 'Vertex logo.svg' },
  { ticker: 'VTR',    wiki: 'commons', title: 'Ventas Logo.svg' },
  { ticker: 'WAT',    wiki: 'commons', title: 'Waters Corporation Logo.svg' },
  { ticker: 'WEC',    wiki: 'commons', title: 'WEC Energy Group Logo.svg' },
  { ticker: 'XEL',    wiki: 'commons', title: 'Xcel-energy.svg' },
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
