/**
 * Build src/data/companies/<ticker>.json — source unique par sté (Phase 3A).
 *
 * Lit `src/data/v2-pipeline/<ticker>.json` (base, scope CONV-DATA) +
 * `src/data/v2-pipeline-enrich/<ticker>.*.json` (enrichments séparés) et
 * produit un fichier unifié dans `src/data/companies/<ticker>.json`.
 *
 * IMPORTANT — Phase 3A migration prudente :
 *  - NE supprime PAS les sources (v2-pipeline/ et v2-pipeline-enrich/
 *    restent autoritaires pour les writes, scope CONV-DATA strict).
 *  - load-company.ts continue de fonctionner comme avant (fallback runtime).
 *  - Le but est de pré-calculer un artefact unifié pour simplifier les
 *    lectures futures (chart-lab, audits, multi-app).
 *
 * Strategy de merge :
 *  1. Base = contenu de v2-pipeline/<ticker>.json
 *  2. Pour chaque v2-pipeline-enrich/<ticker>.<subkey>.json :
 *      - Si subkey est un fichier "racine" (sans subkey = <ticker>.json) :
 *        merge shallow append-only sur les clés non déjà présentes côté base
 *        (préserve l'autorité CONV-DATA).
 *      - Sinon subkey = nom dédié (events, ranks, description, ai-pos,
 *        tam, hero_name_fr, i18n, quarterly-history, kpis-v3) :
 *        stocke sous une clé normalisée (`enrich_<subkey>`).
 *
 * Run : npx tsx scripts/build-companies-unified.ts
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";

const projectRoot = resolve(__dirname, "..");
const baseDir = join(projectRoot, "src/data/v2-pipeline");
const enrichDir = join(projectRoot, "src/data/v2-pipeline-enrich");
const outDir = join(projectRoot, "src/data/companies");

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

type AnyDataset = Record<string, unknown> & { ticker?: string };

// Enumère les tickers via le fichier index (source de vérité officielle).
const tickersIndexPath = join(baseDir, "_tickers-index.json");
const tickersIndex = JSON.parse(readFileSync(tickersIndexPath, "utf-8")) as Array<{
  ticker: string;
}>;
const tickers = tickersIndex.map((t) => t.ticker);

// Suffixes de place boursière : jamais des subkeys d'enrich. Sans ce garde-fou,
// le ticker US `rog` capturait `rog.sw.json` (Roche) comme subkey "sw".
const NON_US_SUFFIXES = new Set([
  "pa", "as", "de", "sw", "l", "mc", "mi", "br", "co", "st", "he", "ls", "vi", "ol",
]);

// Subkeys d'enrich connus (cf load-company.ts). Les fichiers
// `<ticker>.<subkey>.json` sont stockés sous `enrich_<subkey>` dans la sortie.
const KNOWN_SUBKEYS = new Set([
  "events",
  "ranks",
  "description",
  "ai-pos",
  "ai-positioning",
  "tam",
  "hero_name_fr",
  "i18n",
  "quarterly-history",
  "kpis-v3",
]);

function readJsonOrNull(p: string): unknown {
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function listEnrichSubkeyFiles(tickerLow: string): Map<string, string> {
  // Retourne map subkey → chemin absolu. Subkey "_root" pour
  // <ticker>.json (sans subkey nommé).
  const out = new Map<string, string>();
  const prefix = `${tickerLow}.`;
  let entries: string[];
  try {
    entries = readdirSync(enrichDir);
  } catch {
    return out;
  }
  for (const f of entries) {
    if (!f.endsWith(".json")) continue;
    if (!f.startsWith(prefix)) continue;
    // f = <ticker>.<rest>.json ; rest = subkey ou vide
    const rest = f.slice(prefix.length, -".json".length);
    if (!rest) {
      // <ticker>.json (le ticker contient déjà des points : bnp.pa)
      // Ne devrait pas arriver vu qu'on a ajouté le "." final dans prefix.
      continue;
    }
    // Heuristique : si le ticker contient un point (ex bnp.pa), le fichier
    // est nommé `bnp.pa.events.json`. On veut subkey = `events`.
    // Le ticker tickerLow est déjà incluant ses dots, donc tout ce qui
    // reste après est le subkey pur.
    // Cas particulier : fichier <ticker>.json (root) → rest = "json" non
    // détectable. On gère ça séparément ci-dessous.
    if (KNOWN_SUBKEYS.has(rest)) {
      out.set(rest, join(enrichDir, f));
    } else if (rest.indexOf(".") === -1 && !NON_US_SUFFIXES.has(rest)) {
      // Subkey inconnu mais pas de point résiduel → on l'inclut.
      // Sauf si `rest` est un suffixe de place boursière : `rog` + `sw.json`
      // donnait rest = "sw" et injectait tout Roche dans le fichier de
      // Rogers Corp (ticker US ROG). Même piège pour mc/pa, alv/de, ad/as.
      out.set(rest, join(enrichDir, f));
    }
    // Sinon (point résiduel) : c'est probablement un fichier d'un AUTRE
    // ticker qui partage le préfixe (ex : enrich/`bnp.json` vs
    // `bnp.pa.events.json`). On skip pour éviter cross-pollution.
  }
  // Fichier racine <ticker>.json
  const rootPath = join(enrichDir, `${tickerLow}.json`);
  if (existsSync(rootPath)) {
    out.set("_root", rootPath);
  }
  return out;
}

function mergeAppendOnly(base: AnyDataset, enrich: AnyDataset): void {
  // Append-only : ne touche pas aux clés déjà présentes côté base (CONV-DATA
  // gagne). Mais étend les arrays "kpis" / "events" si enrich en a plus
  // (logique alignée load-company.ts).
  for (const [k, v] of Object.entries(enrich)) {
    if (v === undefined || v === null) continue;
    if (k === "kpis" && Array.isArray(v) && Array.isArray(base.kpis)) {
      // Append KPIs avec shorts inédits
      const existing = new Set(
        (base.kpis as Array<Record<string, unknown>>)
          .map((x) => (x && typeof x === "object" ? x.short : undefined))
          .filter(Boolean) as string[],
      );
      const extra = (v as Array<Record<string, unknown>>).filter(
        (x) => x && typeof x === "object" && x.short && !existing.has(x.short as string),
      );
      if (extra.length > 0) {
        base.kpis = [...base.kpis, ...extra];
      }
      continue;
    }
    if (k === "events" && Array.isArray(v) && Array.isArray(base.events)) {
      // Append events avec dedup title+date
      const existing = new Set(
        (base.events as Array<Record<string, unknown>>).map(
          (x) =>
            `${String((x as { title?: string }).title ?? "").toLowerCase().slice(0, 60)}|${String(
              (x as { date?: string }).date ?? "",
            )}`,
        ),
      );
      const extra = (v as Array<Record<string, unknown>>).filter((x) => {
        if (!x || typeof x !== "object") return false;
        const key = `${String(x.title ?? "").toLowerCase().slice(0, 60)}|${String(x.date ?? "")}`;
        return !existing.has(key);
      });
      if (extra.length > 0) {
        base.events = [...(base.events as unknown[]), ...extra];
      }
      continue;
    }
    if (!(k in base)) {
      base[k] = v;
    }
  }
}

let okCount = 0;
let skipCount = 0;
let errCount = 0;
const startedAt = Date.now();

for (const ticker of tickers) {
  const tickerLow = ticker.toLowerCase();
  const basePath = join(baseDir, `${tickerLow}.json`);
  const base = readJsonOrNull(basePath) as AnyDataset | null;
  if (!base) {
    skipCount += 1;
    continue;
  }

  // Clone le base pour ne pas muter la source.
  const out: AnyDataset = JSON.parse(JSON.stringify(base));

  // Merge le fichier enrich racine s'il existe (events, ai_positioning,
  // governance, etc. mergés append-only).
  const enrichFiles = listEnrichSubkeyFiles(tickerLow);
  const rootEnrichPath = enrichFiles.get("_root");
  if (rootEnrichPath) {
    const rootEnrich = readJsonOrNull(rootEnrichPath) as AnyDataset | null;
    if (rootEnrich && typeof rootEnrich === "object") {
      mergeAppendOnly(out, rootEnrich);
    }
  }

  // Ajout des subkeys nommés sous `enrich_<subkey>`.
  for (const [subkey, path] of enrichFiles.entries()) {
    if (subkey === "_root") continue;
    const content = readJsonOrNull(path);
    if (content === null) continue;
    // Normalise le nom du champ : remplace `-` par `_` pour qu'il soit
    // lisible côté JS (`enrich_ai_pos`, `enrich_hero_name_fr`, etc.).
    const fieldName = `enrich_${subkey.replace(/-/g, "_")}`;
    out[fieldName] = content;
  }

  // Metadata Phase 3A
  out._companies_unified_built_at = new Date().toISOString();
  out._companies_unified_sources = {
    base: `v2-pipeline/${tickerLow}.json`,
    enrich_root: rootEnrichPath ? `v2-pipeline-enrich/${tickerLow}.json` : null,
    enrich_subkeys: [...enrichFiles.keys()].filter((k) => k !== "_root"),
  };

  try {
    const outPath = join(outDir, `${tickerLow}.json`);
    writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
    okCount += 1;
  } catch (e) {
    errCount += 1;
    console.warn(`[err] ${ticker}: ${(e as Error).message}`);
  }
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(
  `✅ companies-unified: ${okCount} OK · ${skipCount} skip (pas de base) · ${errCount} err · ${elapsed}s`,
);
console.log(`   Output : ${outDir}`);
