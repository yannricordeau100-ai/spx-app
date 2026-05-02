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
import V2_PIPELINE_MERGED from "@/data/v2-pipeline/_merged.json";
import type { Company } from "@/lib/data";

/**
 * Companies V2 = fusion des 4 sources, ordre de priorité (dernière gagne) :
 *   1. V2_BATCH1   : top 10 raffinés manuels (TSM/ASML/NVO + 7)
 *   2. V2_BATCH2   : 11 stés enrichies seed
 *   3. V2_BATCH3   : 29 stés minimales seed
 *   4. V2_PIPELINE : 32+ stés extraites par pipeline LLM (priorité absolue)
 */
const V2_PIPELINE_TYPED = V2_PIPELINE_MERGED as unknown as Record<string, Company>;

export const V2_COMPANIES: Record<string, Company> = {
  ...V2_BATCH1,
  ...V2_BATCH2,
  ...V2_BATCH3,
  ...V2_PIPELINE_TYPED,
};

export const V2_TICKERS = Object.keys(V2_COMPANIES);

export function getV2Company(ticker: string): Company | null {
  return V2_COMPANIES[ticker.toUpperCase()] ?? null;
}
