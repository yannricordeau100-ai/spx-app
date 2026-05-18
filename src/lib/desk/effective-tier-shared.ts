/**
 * effective-tier-shared.ts — types + constantes + helpers PURS pour le
 * système "view as" admin. Safe à importer depuis client ET server
 * components (aucune dépendance Next-specific).
 *
 * Les fonctions server (cookies(), headers()) sont dans
 * `effective-tier.ts` qui réexporte ces symboles + ajoute readSimulateTier.
 */

export type EffectiveTier = "anonymous" | "free" | "premium" | "max";

export const SIMULATE_COOKIE = "mettrik:simulate-as";

export const VALID_SIMULATE_VALUES: ReadonlySet<EffectiveTier> = new Set([
  "anonymous",
  "free",
  "premium",
  "max",
]);

/**
 * Combine la simulation + le tier réel.
 *   null = anonyme (non connecté ou simulé anonymous)
 *   "free" | "premium" | "max" = tier connecté
 */
export function computeEffectiveTier(
  realTier: "free" | "premium" | "max" | null,
  simulate: EffectiveTier | null,
): "free" | "premium" | "max" | null {
  if (simulate === null) return realTier;
  if (simulate === "anonymous") return null;
  return simulate;
}

/** Détermine le niveau d'infrastructure à partir du hostname. */
export function detectLevelFromHost(host: string | null | undefined): 0 | 1 | 2 | 3 {
  const h = (host ?? "").toLowerCase();
  if (!h) return 0;
  if (h.startsWith("localhost") || h.startsWith("127.0.0.1") || h.endsWith(".local")) return 3;
  if (h === "mettrik.ai" || h === "www.mettrik.ai") return 0;
  if (h.startsWith("mettrik-niveau1") || h.startsWith("niveau1.")) return 1;
  if (h.endsWith(".vercel.app")) return 2;
  return 0;
}
