/**
 * fetch-missing-logos.ts
 *
 * Récupère les logos PNG manquants pour toutes les stés V1.7 publiables et
 * les stocke dans `public/logos/<TICKER>.png`. Idempotent : skip les fichiers
 * déjà présents.
 *
 * Source : Google s2 favicons API (`https://www.google.com/s2/favicons?domain=<X>&sz=128`).
 * Fallback : Clearbit logo API (`https://logo.clearbit.com/<domain>`) qui
 * renvoie des PNG plus haute résolution quand dispo.
 *
 * Domaine devine : (1) `domain` champ explicite si présent, sinon (2)
 * heuristique `<ticker-without-suffix>.com` → `<slug-name>.com`. Si tout
 * échoue → on laisse le fichier absent → fallback `LogoMonogram` côté UI.
 *
 * Convention fichier : `public/logos/<TICKER>.png`. Tickers avec `.` (ex
 * BRK.B, ABB.ST) sont stockés avec `-` (BRK-B.png, ABB-ST.png) — convention
 * déjà appliquée par `CompanyLogo` dans `logos.tsx`.
 *
 * Usage :
 *   npx tsx scripts/fetch-missing-logos.ts            # fetch all missing
 *   npx tsx scripts/fetch-missing-logos.ts --limit=50 # fetch only 50 (rapide)
 *
 * Auto-run : appelé en post-build par `build-public-files.ts` avec
 * `--limit=50` pour ne pas saturer le Mac. Yann peut lancer le script
 * complet manuellement si besoin de tout rattraper d'un coup.
 *
 * Anti-RAM : 8 fetch parallèles max, sleep 200ms entre batchs, 5s timeout par
 * fetch. Total estimé : ~3-5 min pour 50 logos, ~1h pour 1100 logos.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const LOGOS_DIR = path.join(ROOT, "public/logos");
const V17_PATH = path.join(ROOT, "src/data/v1-7-public.json");
const DOMAIN_OVERRIDES_PATH = path.join(ROOT, "src/data/logo-domain-overrides.json");

const HARDCODED = new Set(["GOOGL", "META", "MSCI", "SPGI", "CAT"]);

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const VERBOSE = args.includes("--verbose");
const PARALLEL = 8;
const FETCH_TIMEOUT_MS = 5000;

type Entry = { ticker: string; name?: string; domain?: string };

function safeFilename(ticker: string): string {
  return ticker.toUpperCase().replace(/\./g, "-");
}

/**
 * Devine un domaine probable pour un ticker, en s'appuyant sur :
 *  1. Override manuel dans `src/data/logo-domain-overrides.json` (top stés
 *     curatées par Yann / convs).
 *  2. Le ticker lui-même : `nflx.com`, `aapl.com` (rare mais existe).
 *  3. Le nom slugifié : "Netflix, Inc." → `netflix.com`.
 *
 * Renvoie une liste de candidats à tester dans l'ordre.
 */
// Mapping suffixe ticker → TLD localisé. Ex : "ABF.L" → essayer aussi
// `abf.co.uk`. Ces stés européennes / asiatiques manquaient sinon.
const TLD_BY_SUFFIX: Record<string, string[]> = {
  L: ["co.uk", "com"],
  DE: ["de", "com"],
  PA: ["fr", "com"],
  MI: ["it", "com"],
  ST: ["se", "com"],
  OL: ["no", "com"],
  CO: ["dk", "com"],
  HE: ["fi", "com"],
  AS: ["com", "nl"],
  BR: ["be", "com"],
  SW: ["ch", "com"],
  MC: ["es", "com"],
  LS: ["pt", "com"],
  HK: ["com.hk", "com"],
  T: ["co.jp", "com"],
  TO: ["ca", "com"],
  AX: ["com.au", "com"],
};

function guessDomains(entry: Entry, overrides: Record<string, string>): string[] {
  const candidates: string[] = [];
  const tu = entry.ticker.toUpperCase();
  if (overrides[tu]) candidates.push(overrides[tu]);

  // Strip suffix (.PA, .L, .DE, .MI, .ST, .SW, .CO, .AS, .BR, etc.)
  const parts = entry.ticker.split(".");
  const baseTicker = parts[0].toLowerCase();
  const suffix = parts[1]?.toUpperCase();
  const tlds = suffix && TLD_BY_SUFFIX[suffix] ? TLD_BY_SUFFIX[suffix] : ["com"];

  // 1. Slug nom de société → différents TLD
  if (entry.name) {
    let slug = entry.name
      .toLowerCase()
      .replace(/\b(inc|corp|corporation|company|co|sa|nv|ag|plc|llc|holdings?|group|s\.?p\.?a\.?|s\.?a\.?|ltd|limited|the|gmbh|kgaa)\b\.?/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
    if (slug.length >= 3) {
      for (const tld of tlds) candidates.push(`${slug}.${tld}`);
      // Variantes communes : <slug>group / <slug>corp si court
      if (slug.length <= 6) {
        candidates.push(`${slug}group.com`);
        candidates.push(`${slug}corp.com`);
      }
    }
  }

  // 2. Ticker base → différents TLD
  if (baseTicker.length >= 3) {
    for (const tld of tlds) candidates.push(`${baseTicker}.${tld}`);
  }

  return Array.from(new Set(candidates));
}

async function fetchWithTimeout(url: string): Promise<ArrayBuffer | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mettrik-AI/1.0" } });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tente plusieurs sources/domaines dans l'ordre. Renvoie le buffer du PNG
 * trouvé, ou null si aucune source ne répond.
 */
async function fetchLogo(entry: Entry, overrides: Record<string, string>): Promise<ArrayBuffer | null> {
  const domains = guessDomains(entry, overrides);
  for (const d of domains) {
    // Clearbit était primaire mais l'API est devenue instable / morte
    // (API.clearbit retire ses logos en 2024+). On essaie quand même mais
    // on ne s'attarde pas si elle bug.
    const clearbit = await fetchWithTimeout(`https://logo.clearbit.com/${d}`);
    if (clearbit && clearbit.byteLength > 2000) return clearbit;

    // Google s2 favicons (gratuit, illimité, fallback robuste). Suit les
    // redirects automatiquement (fetch follows par défaut).
    const favicon = await fetchWithTimeout(`https://www.google.com/s2/favicons?domain=${d}&sz=128`);
    if (favicon && favicon.byteLength > 400) return favicon;

    // DuckDuckGo icons (autre alternative gratuite).
    const ddg = await fetchWithTimeout(`https://icons.duckduckgo.com/ip3/${d}.ico`);
    if (ddg && ddg.byteLength > 400) return ddg;
  }
  return null;
}

async function main() {
  if (!existsSync(LOGOS_DIR)) mkdirSync(LOGOS_DIR, { recursive: true });

  const overrides: Record<string, string> = existsSync(DOMAIN_OVERRIDES_PATH)
    ? JSON.parse(readFileSync(DOMAIN_OVERRIDES_PATH, "utf-8"))
    : {};

  if (!existsSync(V17_PATH)) {
    console.error(`❌ ${V17_PATH} introuvable. Lancer d'abord build-public-files.ts.`);
    process.exit(1);
  }

  const v17Raw = JSON.parse(readFileSync(V17_PATH, "utf-8")) as
    | Record<string, Entry>
    | Entry[];
  const entries: Entry[] = Array.isArray(v17Raw) ? v17Raw : Object.values(v17Raw);

  const missing: Entry[] = entries.filter((e) => {
    if (!e.ticker) return false;
    const tu = e.ticker.toUpperCase();
    if (HARDCODED.has(tu)) return false;
    const file = path.join(LOGOS_DIR, `${safeFilename(e.ticker)}.png`);
    return !existsSync(file);
  });

  console.log(`📊 V1.7 ready : ${entries.length} stés · logos manquants : ${missing.length}`);

  const todo = missing.slice(0, LIMIT);
  console.log(`🚀 Fetch ${todo.length} logos (parallel=${PARALLEL})…`);

  let ok = 0;
  let fail = 0;
  const failedTickers: string[] = [];

  for (let i = 0; i < todo.length; i += PARALLEL) {
    const batch = todo.slice(i, i + PARALLEL);
    const results = await Promise.all(
      batch.map(async (e) => {
        const buf = await fetchLogo(e, overrides);
        if (!buf) return { ticker: e.ticker, ok: false };
        const file = path.join(LOGOS_DIR, `${safeFilename(e.ticker)}.png`);
        writeFileSync(file, Buffer.from(buf));
        return { ticker: e.ticker, ok: true, size: buf.byteLength };
      })
    );

    for (const r of results) {
      if (r.ok) {
        ok++;
        if (VERBOSE) console.log(`  ✅ ${r.ticker} (${r.size} B)`);
      } else {
        fail++;
        failedTickers.push(r.ticker);
        if (VERBOSE) console.log(`  ❌ ${r.ticker}`);
      }
    }

    // Sleep doux entre batchs pour pas saturer Mac / rate-limit.
    await new Promise((r) => setTimeout(r, 200));

    if ((i + PARALLEL) % 80 === 0) {
      console.log(`  …${i + batch.length}/${todo.length} (ok=${ok}, fail=${fail})`);
    }
  }

  console.log(`\n✅ ${ok} logos téléchargés, ❌ ${fail} échecs (fallback monogramme automatique)`);
  if (fail > 0 && VERBOSE) {
    console.log(`Tickers échoués : ${failedTickers.slice(0, 50).join(", ")}${failedTickers.length > 50 ? "…" : ""}`);
  }
}

main().catch((e) => {
  console.error("❌ fetch-missing-logos crashed:", e);
  process.exit(1);
});
