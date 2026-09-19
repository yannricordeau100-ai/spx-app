/**
 * these-server.ts — chargement SERVER-ONLY du bloc « Thèse d'investissement ».
 *
 * Même pattern que att-server.ts : override Supabase `desk_these` si la table
 * existe (ticker text pk, payload jsonb), sinon `src/data/these/<t>.json`.
 * Cache mémoire 60 s par ticker. Jamais de throw.
 */
import { promises as fs } from "fs";
import path from "path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { coerceThese, type CompanyThese } from "@/lib/these";

type CacheEntry = { these: CompanyThese | null; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

async function readLocal(ticker: string): Promise<CompanyThese | null> {
  try {
    const fp = path.join(process.cwd(), "src/data/these", `${ticker.toLowerCase()}.json`);
    return coerceThese(JSON.parse(await fs.readFile(fp, "utf-8")));
  } catch {
    return null;
  }
}

async function readSupabase(ticker: string): Promise<CompanyThese | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("desk_these").select("payload").eq("ticker", ticker.toUpperCase()).maybeSingle();
    if (error || !data) return null;
    return coerceThese((data as { payload?: unknown }).payload);
  } catch {
    return null;
  }
}

export async function loadTheseForTicker(ticker: string): Promise<CompanyThese | null> {
  const key = ticker.toUpperCase();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.these;
  const these = (await readSupabase(key)) ?? (await readLocal(key));
  cache.set(key, { these, at: now });
  return these;
}

export function invalidateTheseCache(ticker?: string): void {
  if (ticker) cache.delete(ticker.toUpperCase());
  else cache.clear();
}
