#!/usr/bin/env tsx
/**
 * build-v18-tickers.ts — pré-calcule la liste des tickers V1.8 (top 308
 * hors Chine) triée par market_cap décroissant + la liste V1.7 triée
 * par market_cap d'abord puis alphabétique pour les sés sans market_cap
 * connu.
 *
 * Pourquoi : sur Vercel le runtime serverless ne lit pas les fichiers
 * `src/data/v2-pipeline-enrich/*.json` (pas inclus dans le bundle par
 * défaut → fs.existsSync renvoie false). On précalcule donc les listes
 * triées et on les commit en JSON pour qu'elles soient bundlées.
 *
 * Sortie :
 *   - src/data/v1-7-tickers-sorted.json : array de tickers V1.7 triés
 *   - src/data/v1-8-tickers-sorted.json : array de tickers V1.8 triés
 *
 * Yann 8 mai 2026 : "le hub doit afficher les top 308 par market_cap
 * décroissant, V1.8 hors Chine = 306 stés".
 *
 * À relancer à chaque rebuild de v1-7-public.json ou rafraîchissement
 * des market_caps via enrich-company-profile-yfinance.py.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const V17 = path.join(ROOT, "src/data/v1-7-public.json");
const ENR = path.join(ROOT, "src/data/v2-pipeline-enrich");

const HIDDEN_DUPLICATES = new Set(["GOOG", "BRK-A", "BRK.A", "BRK.B", "FOX", "NWSA", "UAA"]);

const CHINESE_TICKERS = new Set([
  "BABA", "JD", "BIDU", "NIO", "PDD", "BEKE", "TME", "LI", "XPEV", "TCOM",
  "VIPS", "YMM", "BILI", "HUYA", "DOYU", "EDU", "TAL", "GOTU", "LU", "RLX",
  "DIDIY", "TCEHY", "005930.KS",
]);

function getMarketCap(ticker: string): number {
  const enrPath = path.join(ENR, `${ticker.toLowerCase()}.json`);
  if (!existsSync(enrPath)) return 0;
  try {
    const data = JSON.parse(readFileSync(enrPath, "utf-8"));
    const mc = data?.financial_snapshot?.market_cap_usd;
    return typeof mc === "number" ? mc : 0;
  } catch {
    return 0;
  }
}

const v17 = JSON.parse(readFileSync(V17, "utf-8")) as Record<string, unknown>;
const allTickers = Object.keys(v17);

// Filter doublons + Chine pour V1.8 ; doublons seulement pour V1.7
const v18Filter = (t: string) =>
  !HIDDEN_DUPLICATES.has(t.toUpperCase()) && !CHINESE_TICKERS.has(t.toUpperCase());
const v17Filter = (t: string) => !HIDDEN_DUPLICATES.has(t.toUpperCase());

const ranked = allTickers.map((t) => ({ ticker: t, mc: getMarketCap(t) }));
const withMc = ranked.filter((x) => x.mc > 0).sort((a, b) => b.mc - a.mc);
const withoutMc = ranked.filter((x) => x.mc === 0).sort((a, b) => a.ticker.localeCompare(b.ticker));

// V1.8 : prendre les top 308 par market_cap GLOBAL d'abord (chinoises
// incluses), puis RETIRER les chinoises et les doublons. Donne 306 stés
// effectives (top 308 - BABA - NIO qui sont dans le top 308 global).
// Yann 8 mai 2026 : "top 308 (hors Chine, indique combien de stés sans
// la Chine)". Lecture stricte.
const top308 = withMc.slice(0, 308);
const v18 = top308.filter((x) => v18Filter(x.ticker)).map((x) => x.ticker);

// V1.7 : top 308 d'abord (toutes sés avec market_cap, hors doublons),
// puis le reste sans market_cap connu en alphabétique
const v17List = [
  ...withMc.filter((x) => v17Filter(x.ticker)).map((x) => x.ticker),
  ...withoutMc.filter((x) => v17Filter(x.ticker)).map((x) => x.ticker),
];

writeFileSync(path.join(ROOT, "src/data/v1-7-tickers-sorted.json"), JSON.stringify(v17List, null, 0));
writeFileSync(path.join(ROOT, "src/data/v1-8-tickers-sorted.json"), JSON.stringify(v18, null, 0));

console.log(`✅ V1.7 sorted: ${v17List.length} stés (${withMc.filter((x) => v17Filter(x.ticker)).length} avec MC, ${withoutMc.filter((x) => v17Filter(x.ticker)).length} sans)`);
console.log(`✅ V1.8 sorted: ${v18.length} stés (top 308 hors Chine, par market_cap)`);
