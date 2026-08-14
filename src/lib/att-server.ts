/**
 * att-server.ts — chargement SERVER-ONLY du bloc "Anti-thèse d'investissement".
 *
 * Ordre de résolution (Yann 14 août 2026, même pattern que
 * `disabled-blocks-server.ts` / `hero-kpi-overrides.ts`) :
 *   1. Supabase table `desk_att` (ticker text pk, payload jsonb, updated_at) :
 *      si une ligne existe pour le ticker, son payload REMPLACE le JSON local.
 *   2. Fallback local silencieux : `src/data/att/<ticker minuscule>.json`
 *      (casse minuscule stricte, compatible FS Linux Vercel).
 *
 * ⚠️ SERVER-ONLY : importe `createSupabaseAdminClient` (service role).
 * Ne JAMAIS importer depuis un composant "use client".
 *
 * Cache mémoire 60 s par ticker pour ne pas spammer Supabase à chaque SSR.
 * Si Supabase down / env absente → fallback local sans erreur visible.
 */
import { promises as fs } from "fs";
import path from "path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { coerceAtt, type CompanyAtt } from "@/lib/att";

type CacheEntry = { att: CompanyAtt | null; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

async function readLocalAtt(ticker: string): Promise<CompanyAtt | null> {
  try {
    const fp = path.join(
      process.cwd(),
      "src/data/att",
      `${ticker.toLowerCase()}.json`,
    );
    const raw = await fs.readFile(fp, "utf-8");
    return coerceAtt(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function readSupabaseAtt(ticker: string): Promise<CompanyAtt | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("desk_att")
      .select("payload")
      .eq("ticker", ticker.toUpperCase())
      .maybeSingle();
    if (error || !data) return null;
    return coerceAtt((data as { payload?: unknown }).payload);
  } catch {
    // Env vars absentes / table absente / réseau : fallback local silencieux.
    return null;
  }
}

/**
 * Renvoie l'ATT effective pour un ticker (Supabase prioritaire, sinon local),
 * ou null si aucune ATT n'existe. Jamais de throw.
 */
export async function loadAttForTicker(
  ticker: string,
): Promise<CompanyAtt | null> {
  const key = ticker.toUpperCase();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.att;

  const att = (await readSupabaseAtt(key)) ?? (await readLocalAtt(key));
  cache.set(key, { att, at: now });
  return att;
}

/** Invalide le cache (appelé après un write desk). */
export function invalidateAttCache(ticker?: string): void {
  if (ticker) cache.delete(ticker.toUpperCase());
  else cache.clear();
}
