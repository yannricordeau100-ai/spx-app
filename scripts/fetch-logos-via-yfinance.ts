/**
 * fetch-logos-via-yfinance.ts — 2e passe logos pour les stés que
 * fetch-missing-logos.ts n'a pas pu résoudre via Clearbit / favicons /
 * domain heuristic.
 *
 * Stratégie : appelle l'API quoteSummary yfinance pour récupérer le champ
 * `assetProfile.website` (domaine officiel investor relations). Puis tente
 * Clearbit + Google favicons sur ce domaine.
 *
 * Pas de yfinance Python ici : on appelle directement l'endpoint JSON
 * publique `https://query2.finance.yahoo.com/v10/finance/quoteSummary/<ticker>`
 * pour rester en TS et pouvoir paralléliser facilement.
 *
 * Usage :
 *   npx tsx scripts/fetch-logos-via-yfinance.ts [--limit N]
 *
 * Idempotent : skip les tickers déjà résolus (fichier PNG existe).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const LOGOS_DIR = path.join(ROOT, "public/logos");
const V17_PATH = path.join(ROOT, "src/data/v1-7-public.json");
const HARDCODED = new Set(["GOOGL", "META", "MSCI", "SPGI", "CAT"]);
const PARALLEL = 6;
const FETCH_TIMEOUT_MS = 8000;

function safeFilename(ticker: string): string {
  return ticker.toUpperCase().replace(/\./g, "-");
}

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}): Promise<ArrayBuffer | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        ...headers,
      },
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYahooWebsite(ticker: string): Promise<string | null> {
  // Yahoo Finance quoteSummary endpoint (public, no key) — donne le
  // assetProfile.website pour la plupart des stés cotées.
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=assetProfile`;
  const buf = await fetchWithTimeout(url);
  if (!buf) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(buf));
    const profile = json?.quoteSummary?.result?.[0]?.assetProfile;
    const website = profile?.website as string | undefined;
    if (!website) return null;
    // Strip protocol + path
    const m = website.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function tryFetchLogo(domain: string): Promise<ArrayBuffer | null> {
  const clearbit = await fetchWithTimeout(`https://logo.clearbit.com/${domain}`);
  if (clearbit && clearbit.byteLength > 1000) return clearbit;
  const favicon = await fetchWithTimeout(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
  if (favicon && favicon.byteLength > 500) return favicon;
  return null;
}

async function main() {
  if (!existsSync(LOGOS_DIR)) mkdirSync(LOGOS_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

  if (!existsSync(V17_PATH)) {
    console.error(`❌ ${V17_PATH} introuvable`);
    process.exit(1);
  }
  const v17 = JSON.parse(readFileSync(V17_PATH, "utf-8")) as Record<string, { ticker: string; name?: string }>;
  const entries = Object.values(v17);
  const existing = new Set(readdirSync(LOGOS_DIR).map((f) => f.replace(".png", "").toUpperCase()));

  const missing = entries.filter((e) => {
    if (!e.ticker) return false;
    const tu = e.ticker.toUpperCase();
    if (HARDCODED.has(tu)) return false;
    return !existing.has(safeFilename(e.ticker));
  });

  const todo = missing.slice(0, LIMIT === Infinity ? missing.length : LIMIT);
  console.log(`📊 V1.7 ready : ${entries.length} stés · logos manquants : ${missing.length} · todo : ${todo.length}`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < todo.length; i += PARALLEL) {
    const batch = todo.slice(i, i + PARALLEL);
    await Promise.all(
      batch.map(async (e) => {
        const domain = await fetchYahooWebsite(e.ticker);
        if (!domain) {
          fail++;
          return;
        }
        const buf = await tryFetchLogo(domain);
        if (!buf) {
          fail++;
          return;
        }
        writeFileSync(path.join(LOGOS_DIR, `${safeFilename(e.ticker)}.png`), Buffer.from(buf));
        ok++;
      })
    );
    if ((i + PARALLEL) % 60 === 0) {
      console.log(`  …${i + batch.length}/${todo.length} (ok=${ok}, fail=${fail})`);
    }
    // Yahoo Finance n'aime pas trop les bursts → 300ms sleep entre batchs.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n✅ ${ok} logos téléchargés via yfinance website lookup, ❌ ${fail} échecs (fallback monogramme)`);
}

main().catch((e) => {
  console.error("❌ fetch-logos-via-yfinance crashed:", e);
  process.exit(1);
});
