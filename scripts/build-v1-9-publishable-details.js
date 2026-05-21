/**
 * Build v1-9-publishable-details.json
 *
 * Pour chaque ticker publishable (775 stés), récupère { ticker, name, country, scope }
 * classé par scope EXCLUSIF (top307 > sp500 > indices_eu).
 * Même dédup que regen-v1-9-status-extended.js.
 *
 * Output : src/data/v1-9-publishable-details.json
 *   { scopes: { top307: [...], sp500: [...], indices_eu: [...] } }
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8"));

const publishable = read("src/data/v1-9-publishable.json");
const PUB = new Set((publishable.tickers || []).map((t) => t.toUpperCase()));

const top307Source = read("src/data/v1-8-tickers-sorted.json").slice(0, 307);
const sp500 = read("src/data/sp500-tickers.json");
let universe;
try {
  universe = read("src/data/v1-9-universe.json");
} catch {
  universe = [];
}

const TOP307 = new Set(top307Source.map((t) => (typeof t === "string" ? t : t.ticker).toUpperCase()));
const SP500 = new Set(sp500.map((t) => (typeof t === "string" ? t : t.ticker).toUpperCase()));
const UNIVERSE_SET = new Set(universe.map((u) => u.ticker.toUpperCase()));

// Map ticker -> universe meta (name + country)
const UNIV_META = new Map();
for (const u of universe) {
  UNIV_META.set(u.ticker.toUpperCase(), { name: u.name || null, country: u.country || null });
}

function classify(T) {
  if (TOP307.has(T)) return "top307";
  if (SP500.has(T)) return "sp500";
  if (UNIVERSE_SET.has(T)) return "indices_eu";
  return null;
}

const COMPLETE_DIR = path.join(ROOT, "src/data/v1-9-complete");
const V2_DIR = path.join(ROOT, "src/data/v2-pipeline");

function lookupNameCountry(T) {
  // 1) v1-9-universe.json (richest)
  const meta = UNIV_META.get(T);
  let name = meta?.name || null;
  let country = meta?.country || null;

  // 2) v1-9-complete/<T>.json
  if (!name || !country) {
    const fp = path.join(COMPLETE_DIR, `${T}.json`);
    if (fs.existsSync(fp)) {
      try {
        const d = JSON.parse(fs.readFileSync(fp, "utf-8"));
        if (!name && d.name) name = d.name;
        if (!country && d.country) country = d.country;
      } catch {}
    }
  }

  // 3) v2-pipeline/<t>.json (lowercase)
  if (!name) {
    const fp2 = path.join(V2_DIR, `${T.toLowerCase()}.json`);
    if (fs.existsSync(fp2)) {
      try {
        const d = JSON.parse(fs.readFileSync(fp2, "utf-8"));
        if (!name && d.name) name = d.name;
        if (!country && d.country) country = d.country;
      } catch {}
    }
  }
  return { name: name || null, country: country || null };
}

const scopes = { top307: [], sp500: [], indices_eu: [] };

for (const T of PUB) {
  const scope = classify(T);
  if (!scope) continue;
  const { name, country } = lookupNameCountry(T);
  scopes[scope].push({ ticker: T, name, country, scope });
}

// Sort each scope alphabetically by ticker
for (const k of Object.keys(scopes)) {
  scopes[k].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

const out = {
  generated_at: new Date().toISOString(),
  counts: {
    top307: scopes.top307.length,
    sp500: scopes.sp500.length,
    indices_eu: scopes.indices_eu.length,
    total: scopes.top307.length + scopes.sp500.length + scopes.indices_eu.length,
  },
  scopes,
};

const outPath = path.join(ROOT, "src/data/v1-9-publishable-details.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`Wrote ${outPath}`);
console.log(`Counts: top307=${out.counts.top307}, sp500=${out.counts.sp500}, indices_eu=${out.counts.indices_eu}, total=${out.counts.total}`);
