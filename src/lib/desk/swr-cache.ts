/**
 * Stale-While-Revalidate cache localStorage pour les listes desk.
 *
 * Pattern :
 *   1. Au mount, on lit localStorage (instantané) → affichage immédiat
 *   2. En parallèle, fetch BDD → update du state quand arrive
 *   3. Le 2e mount, l'utilisateur voit data DIRECT (cached), puis update à ~500ms
 *
 * Résultat : 1er load = même latence qu'avant (cold), mais ensuite
 * affichage instantané. Si l'app a été visitée avant, le cache est chaud.
 *
 * Clé de stockage : `mettrik.desk.cache.v1.<endpoint>` (versionnée pour
 * pouvoir invalider plus tard).
 *
 * TTL effectif : aucun (toujours frais via revalidation). On garde la data
 * jusqu'à update suivant. Si l'API échoue, on conserve la dernière donnée
 * connue (graceful degradation).
 */

const PREFIX = "mettrik.desk.cache.v1.";

/** Lit le cache pour une clé. Retourne null si vide ou corrompu. */
export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Écrit le cache pour une clé. */
export function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage plein ou indisponible → silencieux, on continue sans cache
  }
}

/** Invalide une clé du cache. */
export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {}
}
