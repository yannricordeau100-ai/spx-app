/**
 * disabled-blocks-server.ts — accès SERVER-ONLY à la table Supabase
 * `desk_disabled_blocks` (toggle ON/OFF des blocs page société).
 *
 * ⚠️ SERVER-ONLY : ce module importe `createSupabaseAdminClient()`
 * (service role). NE JAMAIS l'importer depuis un composant client
 * ("use client") sinon le build casse. Les composants client utilisent
 * `src/lib/disabled-blocks.ts` (JSON only, client-safe) en fallback.
 *
 * Remplace l'ancienne écriture `fs.writeFile` dans
 * `src/data/disabled-blocks.json` + `disabled-blocks-per-ste.json` qui
 * plantait en 500 sur /admin/blocks (filesystem read-only en prod Vercel
 * → EROFS). Même raison que la migration hero overrides.
 *
 * Schéma table (cf supabase/migrations/20260609_desk_disabled_blocks.sql) :
 *   - scope text PK : '__global__' = blocs désactivés globalement,
 *     '<TICKER>' (majuscules) = blocs désactivés pour cette sté.
 *   - blocks jsonb : tableau des clés de bloc désactivées.
 *   - updated_at timestamptz.
 *
 * Lecture : `createSupabaseAdminClient()` (service role, bypass RLS).
 * Cache mémoire 60 s pour éviter de spammer Supabase à chaque SSR de page
 * société. Si Supabase fail / table absente → fallback sur les JSON
 * actuels (zéro régression). Mirror de `hero-kpi-overrides.ts`.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  loadDisabledBlocks,
  loadDisabledBlocksPerSte,
} from "@/lib/disabled-blocks";

const GLOBAL_SCOPE = "__global__";

export type DisabledBlocksState = {
  global: string[];
  perSte: Record<string, string[]>;
};

let cache: DisabledBlocksState | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

/** Lit les 2 JSON actuels (seed / fallback). Client-safe (JSON only). */
function seedFromJson(): DisabledBlocksState {
  const global = loadDisabledBlocks().disabled;
  const perSte = loadDisabledBlocksPerSte().overrides;
  return { global, perSte };
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Fetch toutes les lignes de `desk_disabled_blocks` et reconstruit l'état
 * { global, perSte }. Si la table est vide → seed depuis les 2 JSON
 * (migration douce : on garde l'état actuel tant que rien n'a été écrit
 * en Supabase).
 */
async function fetchAll(): Promise<DisabledBlocksState> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desk_disabled_blocks")
    .select("scope, blocks");
  if (error) throw error;

  const rows = data ?? [];
  // Table absente de facto (0 ligne) → on seed depuis les JSON pour ne pas
  // perdre l'état figé actuel.
  if (rows.length === 0) return seedFromJson();

  let global: string[] = [];
  const perSte: Record<string, string[]> = {};
  for (const row of rows) {
    const scope = String((row as { scope?: unknown }).scope ?? "");
    const blocks = asStringArray((row as { blocks?: unknown }).blocks);
    if (!scope) continue;
    if (scope === GLOBAL_SCOPE) {
      global = blocks;
    } else {
      perSte[scope.toUpperCase()] = blocks;
    }
  }
  return { global, perSte };
}

/**
 * Renvoie l'état complet { global, perSte } des blocs désactivés. Cache
 * 60 s. Si Supabase fail (table absente, réseau, erreur) → fallback sur le
 * cache stale, sinon sur les 2 JSON actuels. ZÉRO régression si table
 * absente.
 */
export async function getDisabledBlocksState(): Promise<DisabledBlocksState> {
  const now = Date.now();
  if (!cache || now - cachedAt > CACHE_TTL_MS) {
    try {
      cache = await fetchAll();
      cachedAt = now;
    } catch (err) {
      // Cache stale OK plutôt que crash SSR. Si pas de cache → seed JSON.
      console.warn(
        "[disabled-blocks-server] refetch failed, falling back",
        err,
      );
      if (!cache) cache = seedFromJson();
    }
  }
  return cache;
}

/**
 * Résout la liste des blocs désactivés pour un ticker : union(global,
 * perSte[TICKER]) avec expansion legacy. Si 'gouvernance_top3' est présent
 * (global ou per-sté), on ajoute aussi 'gouvernance_top3_votes' +
 * 'gouvernance_top3_capital' (rétro-compat avec l'ancienne clé unique).
 *
 * C'est ce que la page société passe en prop `disabledBlocks` à
 * <CompanyView>.
 */
export async function resolveDisabledForTicker(
  ticker: string,
): Promise<string[]> {
  const state = await getDisabledBlocksState();
  const upper = ticker.toUpperCase();
  const merged = new Set<string>(state.global);
  for (const b of state.perSte[upper] ?? []) merged.add(b);
  // Expansion legacy : gouvernance_top3 → votes + capital.
  if (merged.has("gouvernance_top3")) {
    merged.add("gouvernance_top3_votes");
    merged.add("gouvernance_top3_capital");
  }
  return Array.from(merged);
}

/**
 * Définit la liste des blocs désactivés globalement. Upsert sur scope
 * '__global__' + invalidate cache.
 */
export async function setGlobalDisabled(blocks: string[]): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("desk_disabled_blocks")
    .upsert(
      {
        scope: GLOBAL_SCOPE,
        blocks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope" },
    );
  if (error) throw error;
  invalidateDisabledBlocksCache();
}

/**
 * Définit la liste des blocs désactivés pour une sté précise. Si la liste
 * est vide → supprime l'override (delete) plutôt que de garder une ligne
 * vide. Invalide le cache.
 */
export async function setPerSteDisabled(
  ticker: string,
  blocks: string[],
): Promise<void> {
  const scope = ticker.toUpperCase();
  const supabase = createSupabaseAdminClient();
  if (blocks.length === 0) {
    await removePerSteOverrideSb(ticker);
    return;
  }
  const { error } = await supabase
    .from("desk_disabled_blocks")
    .upsert(
      {
        scope,
        blocks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope" },
    );
  if (error) throw error;
  invalidateDisabledBlocksCache();
}

/**
 * Supprime l'override per-sté pour un ticker (delete sur scope = TICKER).
 * Invalide le cache.
 */
export async function removePerSteOverrideSb(ticker: string): Promise<void> {
  const scope = ticker.toUpperCase();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("desk_disabled_blocks")
    .delete()
    .eq("scope", scope);
  if (error) throw error;
  invalidateDisabledBlocksCache();
}

/**
 * Force un refetch au prochain `getDisabledBlocksState()`. Appelé après
 * chaque write pour que l'état soit visible immédiatement.
 */
export function invalidateDisabledBlocksCache(): void {
  cache = null;
  cachedAt = 0;
}
