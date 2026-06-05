/**
 * hero-kpi-overrides.ts — accès à la table Supabase
 * `desk_hero_kpi_overrides`.
 *
 * Lit toutes les overrides du hero KPI sélectionnées par Yann via
 * `/admin/kpis-toggle`. Cache mémoire 60 s pour éviter de spammer Supabase
 * à chaque SSR de page société (plusieurs centaines de pages, plusieurs
 * milliers de requêtes/min en peak).
 *
 * Remplace l'ancienne écriture `fs.writeFile` dans
 * `src/data/v2-pipeline/<ticker>.json` qui était PERDUE à chaque deploy
 * Vercel (filesystem read-only en prod).
 *
 * - Lecture : utilise `createSupabaseAdminClient()` (service role) pour
 *   bypass RLS. Pas exposé au browser.
 * - Cache : `Map<ticker_upper, hero_kpi_short>` + `cachedAt`. Si > 60 s
 *   → refetch. Si refetch fail → réutilise le cache stale plutôt que
 *   casser le SSR.
 * - `invalidateHeroOverridesCache()` permet de forcer un refetch après
 *   un upsert (appelé depuis la route POST set-hero).
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type HeroOverridesMap = Map<string, string>;

let cache: HeroOverridesMap | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

async function fetchAll(): Promise<HeroOverridesMap> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desk_hero_kpi_overrides")
    .select("ticker, hero_kpi_short");
  if (error) throw error;
  const map: HeroOverridesMap = new Map();
  for (const row of data ?? []) {
    const t = String((row as { ticker?: unknown }).ticker ?? "").toUpperCase();
    const s = String((row as { hero_kpi_short?: unknown }).hero_kpi_short ?? "");
    if (t && s) map.set(t, s);
  }
  return map;
}

/**
 * Renvoie l'override hero_kpi_short pour un ticker donné, ou `null` si
 * aucune override. Le ticker est canonicalisé en uppercase avant lookup.
 *
 * Cache 60 s. Si Supabase fail, on retombe sur l'ancien cache (best-effort)
 * pour ne pas casser le SSR d'une page société.
 */
export async function getHeroKpiOverride(
  ticker: string,
): Promise<string | null> {
  const now = Date.now();
  if (!cache || now - cachedAt > CACHE_TTL_MS) {
    try {
      cache = await fetchAll();
      cachedAt = now;
    } catch (err) {
      // Cache stale OK plutôt que crash SSR. Log côté server uniquement.
      console.warn("[hero-kpi-overrides] refetch failed, using stale cache", err);
      if (!cache) cache = new Map();
    }
  }
  const upper = ticker.toUpperCase();
  return cache.get(upper) ?? null;
}

/**
 * Force un refetch au prochain `getHeroKpiOverride()`. À appeler depuis la
 * route POST `set-hero` après upsert pour que la nouvelle valeur soit
 * visible immédiatement sur les pages SSR.
 */
export function invalidateHeroOverridesCache(): void {
  cache = null;
  cachedAt = 0;
}
