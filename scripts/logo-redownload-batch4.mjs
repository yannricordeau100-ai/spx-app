// Batch 4 logos audit & re-download (SP500 hors top 307 V1.9.5 = 366 stés, 73 défectueux).
// Critères défectueux : <128px width OU JPEG masqué en .png OU >500KB.
// Pattern : Commons search auto via API → fallback en.wiki search → sharp 512×140 transparent.
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_W = 512;
const TARGET_H = 140;
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/Users/yann/spx-app/public/logos';
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';

// Mapping ticker → fichier Wikipedia/Commons explicite (priorité absolue)
// Identifié via Commons srsearch + en.wiki page.images
const EXPLICIT_FIXES = [
  { ticker: 'ALL',    wiki: 'commons', title: 'Allstate logo.svg' },
  { ticker: 'ARE',    wiki: 'commons', title: 'Alexandria Real Estate Equities logo.svg' },
  { ticker: 'ATO',    wiki: 'en',      title: 'Atmos Energy logo.svg' },
  { ticker: 'BEN',    wiki: 'commons', title: 'Franklin Templeton logo.svg' },
  { ticker: 'BRK.B',  wiki: 'commons', title: 'Berkshire Hathaway logo.svg' },
  { ticker: 'CAG',    wiki: 'commons', title: 'Conagra Brands logo.svg' },
  { ticker: 'CAH',    wiki: 'commons', title: 'Cardinal Health Logo.svg' },
  { ticker: 'CASY',   wiki: 'commons', title: "Casey's General Stores logo.svg" },
  { ticker: 'CHD',    wiki: 'commons', title: 'Church and Dwight logo.svg' },
  { ticker: 'CI',     wiki: 'commons', title: 'Cigna Group logo.svg' },
  { ticker: 'CINF',   wiki: 'commons', title: 'Cincinnati Financial logo.svg' },
  { ticker: 'CPAY',   wiki: 'en',      title: 'Corpay logo.png' },
  { ticker: 'CPT',    wiki: 'commons', title: 'Camden Property Trust logo.svg' },
  { ticker: 'CRWD',   wiki: 'commons', title: 'CrowdStrike logo.svg' },
  { ticker: 'DE',     wiki: 'commons', title: 'John Deere logo.svg' },
  { ticker: 'DLR',    wiki: 'commons', title: 'Digital Realty logo.svg' },
  { ticker: 'DPZ',    wiki: 'commons', title: "Domino's pizza logo.svg" },
  { ticker: 'DRI',    wiki: 'commons', title: 'Darden Restaurants logo.svg' },
  { ticker: 'DVN',    wiki: 'commons', title: 'Devon Energy logo.svg' },
  { ticker: 'EOG',    wiki: 'commons', title: 'EOG Resources logo.svg' },
  { ticker: 'EQR',    wiki: 'commons', title: 'Equity Residential logo.svg' },
  { ticker: 'ES',     wiki: 'commons', title: 'Eversource logo.svg' },
  { ticker: 'EVRG',   wiki: 'commons', title: 'Evergy logo.svg' },
  { ticker: 'EXPD',   wiki: 'en',      title: 'Expeditors International logo.svg' },
  { ticker: 'FANG',   wiki: 'commons', title: 'Diamondback Energy logo.svg' },
  { ticker: 'FDS',    wiki: 'commons', title: 'FactSet logo.svg' },
  { ticker: 'FE',     wiki: 'commons', title: 'FirstEnergy logo.svg' },
  { ticker: 'FFIV',   wiki: 'commons', title: 'F5 Networks logo.svg' },
  { ticker: 'FTV',    wiki: 'commons', title: 'Fortive logo.svg' },
  { ticker: 'GNRC',   wiki: 'commons', title: 'Generac Power Systems logo.svg' },
  { ticker: 'HST',    wiki: 'en',      title: 'Host Hotels & Resorts logo.svg' },
  { ticker: 'IEX',    wiki: 'commons', title: 'IDEX Corporation logo.svg' },
  { ticker: 'INVH',   wiki: 'en',      title: 'Invitation Homes logo.svg' },
  { ticker: 'IP',     wiki: 'commons', title: 'International Paper logo.svg' },
  { ticker: 'ISRG',   wiki: 'commons', title: 'Intuitive Surgical logo.svg' },
  { ticker: 'J',      wiki: 'commons', title: 'Jacobs Solutions logo.svg' },
  { ticker: 'KMB',    wiki: 'commons', title: 'Kimberly-Clark logo.svg' },
  { ticker: 'LII',    wiki: 'commons', title: 'Lennox International logo.svg' },
  { ticker: 'LNT',    wiki: 'commons', title: 'Alliant Energy logo.svg' },
  { ticker: 'MGM',    wiki: 'commons', title: 'MGM Resorts International logo.svg' },
  { ticker: 'NSC',    wiki: 'commons', title: 'Norfolk Southern Railway logo.svg' },
  { ticker: 'ODFL',   wiki: 'commons', title: 'Old Dominion Freight Line logo.svg' },
  { ticker: 'ORLY',   wiki: 'commons', title: "O'Reilly Auto Parts logo.svg" },
  { ticker: 'PODD',   wiki: 'commons', title: 'Insulet Corporation logo.svg' },
  { ticker: 'POOL',   wiki: 'commons', title: 'Pool Corporation logo.svg' },
  { ticker: 'PRU',    wiki: 'commons', title: 'Prudential Financial logo.svg' },
  { ticker: 'PWR',    wiki: 'commons', title: 'Quanta Services logo.svg' },
  { ticker: 'Q',      wiki: 'en',      title: 'Qnity Electronics logo.svg' },
  { ticker: 'REGN',   wiki: 'commons', title: 'Regeneron Pharmaceuticals logo.svg' },
  { ticker: 'RJF',    wiki: 'commons', title: 'Raymond James Financial logo.svg' },
  { ticker: 'ROP',    wiki: 'commons', title: 'Roper Technologies logo.svg' },
  { ticker: 'RVTY',   wiki: 'commons', title: 'Revvity logo.svg' },
  { ticker: 'SNA',    wiki: 'commons', title: 'Snap-on Logo.svg' },
  { ticker: 'STZ',    wiki: 'commons', title: 'Constellation Brands logo.svg' },
  { ticker: 'SWK',    wiki: 'commons', title: 'Stanley Black & Decker Logo.svg' },
  { ticker: 'TDY',    wiki: 'commons', title: 'Teledyne logo.svg' },
  { ticker: 'TECH',   wiki: 'en',      title: 'Bio-Techne logo.svg' },
  { ticker: 'TER',    wiki: 'commons', title: 'Teradyne logo.svg' },
  { ticker: 'TFC',    wiki: 'commons', title: 'Truist Financial logo.svg' },
  { ticker: 'TJX',    wiki: 'commons', title: 'TJX Companies logo.svg' },
  { ticker: 'TMUS',   wiki: 'commons', title: 'T-Mobile US logo.svg' },
  { ticker: 'TXT',    wiki: 'commons', title: 'Textron logo.svg' },
  { ticker: 'TYL',    wiki: 'commons', title: 'Tyler Technologies logo.svg' },
  { ticker: 'UAL',    wiki: 'commons', title: 'United Airlines Holdings logo.svg' },
  { ticker: 'VEEV',   wiki: 'commons', title: 'Veeva Systems logo.svg' },
  { ticker: 'VRTX',   wiki: 'commons', title: 'Vertex Pharmaceuticals logo.svg' },
  { ticker: 'VTR',    wiki: 'commons', title: 'Ventas logo.svg' },
  { ticker: 'WAB',    wiki: 'commons', title: 'Wabtec logo.svg' },
  { ticker: 'WAT',    wiki: 'commons', title: 'Waters Corporation logo.svg' },
  { ticker: 'WEC',    wiki: 'commons', title: 'WEC Energy Group logo.svg' },
  { ticker: 'WM',     wiki: 'commons', title: 'Waste Management logo.svg' },
  { ticker: 'XEL',    wiki: 'commons', title: 'Xcel Energy logo.svg' },
  { ticker: 'ZBH',    wiki: 'commons', title: 'Zimmer Biomet logo.svg' },
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
for (const f of EXPLICIT_FIXES) {
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
