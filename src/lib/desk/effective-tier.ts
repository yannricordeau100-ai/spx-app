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
  // Faille corrigee le 2 sept 2026 (audit anti-triche) : le nom du cookie et
  // ses valeurs sont lisibles dans le bundle JS public. Sans ce garde-fou,
  // n importe quel compte inscrit pouvait se poser le cookie et obtenir le
  // palier max. Le cookie n est honore que pour le proprietaire et le compte
  // de test interne ; toute autre session qui le presente declenche une
  // alerte rouge par email.
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const email = user?.email?.toLowerCase() ?? "";
    const owner = process.env.DESK_OWNER_EMAIL?.toLowerCase() ?? "";
    if (email === owner || email.endsWith("@mettrik-internal.test")) {
      return value as EffectiveTier;
    }
    // 5 sept 2026 : sourdine quand la tentative vient du proprietaire lui-meme
    // (IP declaree dans IPS_PROPRIETAIRE, liste separee par des virgules) ou
    // d un environnement hors production (niveau2 : ce sont les tests).
    let ip = "";
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();
    } catch {
      /* hors requete */
    }
    const ipsProprietaire = (process.env.IPS_PROPRIETAIRE ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const horsProduction = (process.env.VERCEL_ENV ?? "development") !== "production";
    if (!horsProduction && !(ip && ipsProprietaire.includes(ip))) {
      const { signaleTricheSimulation } = await import("@/lib/security/alerte");
      signaleTricheSimulation(email || "anonyme", value, ip);
    }
    return null;
  } catch {
    return null;
  }
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
