/**
 * company-visibility.ts — filter d'affichage des sés selon le niveau
 * d'infrastructure + le tier effectif de l'user.
 *
 * Modèle CUMULATIF :
 *   - desk_curated_companies.min_plan = 'free'    : visible Free/Premium/Max
 *   - = 'premium'                                  : visible Premium/Max
 *   - = 'max'                                      : visible Max uniquement
 *   - = 'hidden' OU absente de la table           : invisible publiquement
 *
 * Niveau 2 et 3 : filter ignoré (toutes les sés visibles pour dev).
 *
 * Yann 18 mai 2026, bascule niveau 1.
 */

import { createClient } from "@supabase/supabase-js";

export type MinPlan = "free" | "premium" | "max" | "hidden";
export type EffectiveTier = "free" | "premium" | "max" | null;

/** Cache mémoire de la table curated_companies (revalidé toutes les 60s). */
let cache: { map: Map<string, MinPlan>; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadCurationMap(): Promise<Map<string, MinPlan>> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) return cache.map;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Pas de Supabase configurée → tout est hidden côté niveau 0/1
    return new Map();
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase
    .from("desk_curated_companies")
    .select("ticker, min_plan");
  const map = new Map<string, MinPlan>();
  for (const row of data ?? []) {
    if (row.ticker && row.min_plan) map.set(row.ticker.toUpperCase(), row.min_plan as MinPlan);
  }
  cache = { map, ts: now };
  return map;
}

/** Détermine si une sté est visible selon le tier effectif (cumulatif). */
export function isPlanReachable(minPlan: MinPlan, tier: EffectiveTier): boolean {
  if (minPlan === "hidden") return false;
  // tier null = visiteur anonyme (= "new")
  // Une sté min_plan=free n'est PAS visible pour un anonyme par défaut, sauf
  // si la stratégie produit veut afficher en teaser → ici on choisit la voie
  // stricte : seulement connectés voient les sés curated. À ajuster selon Yann.
  if (tier === null) return false;
  if (minPlan === "free") return true; // visible Free, Premium, Max
  if (minPlan === "premium") return tier === "premium" || tier === "max";
  if (minPlan === "max") return tier === "max";
  return false;
}

/**
 * Filter principal pour le frontend. À appeler côté Server Component / API
 * avant de rendre une page société ou une liste.
 *
 * @param ticker      Le ticker de la sté (case insensitive).
 * @param tier        Le tier effectif de l'user (computeEffectiveTier).
 * @param level       Le niveau infra (0/1/2/3) — voir effective-tier-shared.ts
 * @returns           true si la sté doit être affichée à cet user.
 */
export async function isCompanyVisible(
  ticker: string,
  tier: EffectiveTier,
  level: 0 | 1 | 2 | 3,
): Promise<boolean> {
  // Niveau 2 (preview) et niveau 3 (local) : toutes les sés visibles pour dev
  if (level === 2 || level === 3) return true;
  // Niveau 0 (prod) et niveau 1 (shadow prod) : filter curated
  const map = await loadCurationMap();
  const min = map.get(ticker.toUpperCase()) ?? "hidden";
  return isPlanReachable(min, tier);
}

/** Version sync sur cache déjà chargé (pour boucles serveur). */
export function isCompanyVisibleSync(
  ticker: string,
  tier: EffectiveTier,
  level: 0 | 1 | 2 | 3,
  curationMap: Map<string, MinPlan>,
): boolean {
  if (level === 2 || level === 3) return true;
  const min = curationMap.get(ticker.toUpperCase()) ?? "hidden";
  return isPlanReachable(min, tier);
}

/** Helper pour les list-pages (hub) : retourne la liste filtrée. */
export async function filterVisibleTickers(
  tickers: string[],
  tier: EffectiveTier,
  level: 0 | 1 | 2 | 3,
): Promise<string[]> {
  if (level === 2 || level === 3) return tickers;
  const map = await loadCurationMap();
  return tickers.filter((t) => {
    const min = map.get(t.toUpperCase()) ?? "hidden";
    return isPlanReachable(min, tier);
  });
}
