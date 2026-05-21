/**
 * V2 cat 2 data loader — sert UNIQUEMENT à la sandbox /sandbox/v2.
 *
 * Charge les datasets seed des 50 plus grosses sociétés étrangères cotées
 * US (FPI ADR), répartis sur 3 batches :
 *   - V2_COMPANIES (10) : top 10 raffinés (TSM, ASML, NVO + 7 du batch1)
 *   - V2_BATCH2 (11)    : pharma + banks + EU + China internet (raffinés moyens)
 *   - V2_BATCH3 (29)    : Asia tech, mining, EU consumer, Canada rail/energy (minimal)
 *
 * Live (V1 5 stés US) intacte.
 */

import { V2_COMPANIES as V2_BATCH1 } from "@/data/v2/datasets";
import { V2_BATCH2 } from "@/data/v2/datasets-extended";
import { V2_BATCH3 } from "@/data/v2/datasets-batch3";
import fs from "node:fs";
import path from "node:path";
import type { Company } from "@/lib/data";

/**
 * Yann 21 mai 2026 : `_merged.json` (45 MB) chargé via fs.readFile au
 * runtime au lieu d'`import static` qui bundle 45 MB dans toutes les
 * Serverless Functions consommatrices (dépassait 250 MB Vercel limit).
 */
let _v2PipelineMergedCache: Record<string, Company> | null = null;
function loadV2PipelineMerged(): Record<string, Company> {
  if (_v2PipelineMergedCache) return _v2PipelineMergedCache;
  try {
    const filePath = path.join(process.cwd(), "src/data/v2-pipeline/_merged.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    _v2PipelineMergedCache = JSON.parse(raw) as Record<string, Company>;
    return _v2PipelineMergedCache;
  } catch {
    _v2PipelineMergedCache = {};
    return _v2PipelineMergedCache;
  }
}

/**
 * Companies V2 = fusion des 4 sources, ordre de priorité (dernière gagne) :
 *   1. V2_BATCH1   : top 10 raffinés manuels (TSM/ASML/NVO + 7)
 *   2. V2_BATCH2   : 11 stés enrichies seed
 *   3. V2_BATCH3   : 29 stés minimales seed
 *   4. V2_PIPELINE : 32+ stés extraites par pipeline LLM (priorité absolue)
 */
function buildV2Companies(): Record<string, Company> {
  const V2_PIPELINE_TYPED = loadV2PipelineMerged();
  return {
    ...V2_BATCH1,
    ...V2_BATCH2,
    ...V2_BATCH3,
    ...V2_PIPELINE_TYPED,
  };
}

let _v2CompaniesCache: Record<string, Company> | null = null;
export function getV2Companies(): Record<string, Company> {
  if (!_v2CompaniesCache) _v2CompaniesCache = buildV2Companies();
  return _v2CompaniesCache;
}

// Backward compat exports — lazy getters
export const V2_COMPANIES: Record<string, Company> = new Proxy({} as Record<string, Company>, {
  get(_target, prop: string) {
    return getV2Companies()[prop];
  },
  ownKeys() {
    return Object.keys(getV2Companies());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const value = getV2Companies()[prop];
    if (value === undefined) return undefined;
    return { configurable: true, enumerable: true, value };
  },
  has(_target, prop: string) {
    return prop in getV2Companies();
  },
});

// V2_TICKERS = lazy computed property via Proxy on array index
export const V2_TICKERS: string[] = new Proxy([] as string[], {
  get(_target, prop) {
    const tickers = Object.keys(getV2Companies());
    if (prop === "length") return tickers.length;
    if (typeof prop === "string" && /^\d+$/.test(prop)) return tickers[Number(prop)];
    if (prop === Symbol.iterator) return tickers[Symbol.iterator].bind(tickers);
    const v = (tickers as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? v.bind(tickers) : v;
  },
});

export function getV2Company(ticker: string): Company | null {
  return getV2Companies()[ticker.toUpperCase()] ?? null;
}
