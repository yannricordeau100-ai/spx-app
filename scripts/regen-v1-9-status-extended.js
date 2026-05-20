/**
 * Regen src/data/v1-9-status-extended.json depuis sources de vérité :
 * - v1-9-publishable.json (775 unique)
 * - v1-9-blocked.json (149 unique non publiables)
 * - v1-8-tickers-sorted.json[:307] (top 307)
 * - sp500-tickers.json (503)
 * - indices EU (CAC40 + FTSE100 + DAX40 + SMI + BEL20 + FTSEMIB + AEX + ATX)
 *
 * Règle de classification EXCLUSIVE (chaque sté comptée 1 seule fois) :
 *   top307 > sp500 > indices_eu
 * Yann (20 mai) signalait double-counting : 307+495+110=912 mais unique=775.
 *
 * Output : v1-9-status-extended.json avec scopes exclusifs + total_unique
 * pour que la page /sandbox/v1-9-status affiche les MÊMES chiffres que
 * le compteur global publishable.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8"));

const publishable = read("src/data/v1-9-publishable.json");
const blocked = read("src/data/v1-9-blocked.json");
const PUB = new Set((publishable.tickers || []).map((t) => t.toUpperCase()));
const BLK_MAP = new Map();
for (const b of blocked.blocked || []) {
  BLK_MAP.set(b.ticker.toUpperCase(), b);
}

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

function classify(ticker) {
  const T = ticker.toUpperCase();
  if (TOP307.has(T)) return "top307";
  if (SP500.has(T)) return "sp500";
  if (UNIVERSE_SET.has(T)) return "indices_eu";
  return null;
}

const scopes = {
  top307: { total: 0, publishable: 0, difficile: [], impossible: [] },
  sp500: { total: 0, publishable: 0, difficile: [], impossible: [] },
  indices_eu: { total: 0, publishable: 0, difficile: [], impossible: [] },
};

const allTickers = new Set([...TOP307, ...SP500, ...UNIVERSE_SET]);
for (const T of allTickers) {
  const scope = classify(T);
  if (!scope) continue;
  scopes[scope].total += 1;
  if (PUB.has(T)) {
    scopes[scope].publishable += 1;
  } else {
    const b = BLK_MAP.get(T);
    const reason = b ? (b.missing ? b.missing.join(",") : "unknown") : "missing";
    // "Difficile" = sources OK mais extraction à reprendre.
    // "Impossible" = vraiment bloqué (no_complete_file, sources insuffisantes confirmées).
    if (reason === "no_complete_file" || reason === "no_file") {
      scopes[scope].impossible.push(T);
    } else {
      scopes[scope].difficile.push(T);
    }
  }
}

const totalUnique = allTickers.size;
const publishableUnique = [...allTickers].filter((T) => PUB.has(T)).length;
const blockedUnique = totalUnique - publishableUnique;

const out = {
  generated_at: new Date().toISOString(),
  total_unique: totalUnique,
  publishable_unique: publishableUnique,
  blocked_unique: blockedUnique,
  classification_rule: "exclusif : top307 > sp500 > indices_eu (chaque sté comptée 1 seule fois)",
  ...scopes,
};

fs.writeFileSync(
  path.join(ROOT, "src/data/v1-9-status-extended.json"),
  JSON.stringify(out, null, 2),
);

console.log(`Total unique : ${totalUnique}`);
console.log(`Publishable unique : ${publishableUnique}`);
console.log(`Blocked unique : ${blockedUnique}`);
console.log(`\nPar scope (exclusif) :`);
for (const [k, v] of Object.entries(scopes)) {
  console.log(`  ${k}: ${v.publishable}/${v.total} publiables, ${v.difficile.length} difficiles, ${v.impossible.length} impossibles`);
}
console.log(`\nWrote src/data/v1-9-status-extended.json`);
