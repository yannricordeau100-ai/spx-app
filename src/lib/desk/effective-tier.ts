/**
 * effective-tier.ts — système "view as" admin (Yann 18 mai 2026).
 * Côté SERVER ONLY (utilise next/headers + next/server). Les types et
 * constantes shared sont dans `effective-tier-shared.ts`.
 *
 * Sécurité :
 *   - La simulation n'est active QU'EN NIVEAU 1/2/3 (jamais en niveau 0
 *     prod). Le helper retourne null sur niveau 0 même si cookie posé.
 *   - Le cookie est posé via UI dans /desk-mtk9x4kp (admin only).
 */

import type { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import {
  SIMULATE_COOKIE,
  VALID_SIMULATE_VALUES,
  detectLevelFromHost,
  type EffectiveTier,
} from "./effective-tier-shared";

// Re-exports pour usage server-side simple
export { SIMULATE_COOKIE, computeEffectiveTier } from "./effective-tier-shared";
export type { EffectiveTier } from "./effective-tier-shared";

function detectLevel(host: string | null | undefined): 0 | 1 | 2 | 3 {
  const envLevel = process.env.NEXT_PUBLIC_NIVEAU;
  if (envLevel === "0") return 0;
  if (envLevel === "1") return 1;
  if (envLevel === "2") return 2;
  if (envLevel === "3") return 3;
  return detectLevelFromHost(host);
}

/**
 * Server Component / route handler : retourne la valeur de simulation si
 * applicable (niveau ≠ 0 + cookie valide), sinon null.
 */
export async function readSimulateTier(): Promise<EffectiveTier | null> {
  const c = await cookies();
  const value = c.get(SIMULATE_COOKIE)?.value;
  if (!value || !VALID_SIMULATE_VALUES.has(value as EffectiveTier)) return null;
  const h = await headers();
  const host = h.get("host");
  const level = detectLevel(host);
  if (level === 0) return null;
  return value as EffectiveTier;
}

/** Variante avec NextRequest (proxy.ts, route handlers Edge). */
export function readSimulateTierFromRequest(req: NextRequest): EffectiveTier | null {
  const value = req.cookies.get(SIMULATE_COOKIE)?.value;
  if (!value || !VALID_SIMULATE_VALUES.has(value as EffectiveTier)) return null;
  const host = req.headers.get("host");
  const level = detectLevel(host);
  if (level === 0) return null;
  return value as EffectiveTier;
}
