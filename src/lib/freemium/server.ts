/**
 * server.ts — helper SSR pour déterminer le tier effectif de l'utilisateur
 * sur les pages V1.9 / V1.9.5 société.
 *
 * Logique :
 *   1. Cookie SIMULATE_COOKIE actif (admin "view as Free/Premium/Max") → priorité
 *   2. User connecté = DESK_OWNER_EMAIL → tier "max" (admin réel)
 *   3. Sinon → "anon" (déclenche floutage)
 *
 * Pour V2 : remplacer la branche (2) par lecture subscription Supabase
 * (`user_subscriptions` ou metadata stripe). Pour l'instant, single-tenant
 * Yann = admin = max.
 */

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import {
  SIMULATE_COOKIE,
  VALID_SIMULATE_VALUES,
  type EffectiveTier,
} from "@/lib/desk/effective-tier-shared";
import type { UserTier } from "./context";
import { tierDepuisAbonnement } from "./tier-serveur";

export async function getServerFreemiumTier(): Promise<UserTier> {
  // 1. Cookie simulate (override admin)
  try {
    const c = await cookies();
    const sim = c.get(SIMULATE_COOKIE)?.value as EffectiveTier | undefined;
    if (sim && VALID_SIMULATE_VALUES.has(sim)) {
      if (sim === "anonymous") return "anon";
      return sim as UserTier;
    }
  } catch {
    // ignore
  }

  // 2. Real tier via session
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user?.email === DESK_OWNER_EMAIL) return "max";
    if (user) return await tierDepuisAbonnement(user); // palier reel (abonnement Stripe), sinon free
  } catch {
    // ignore
  }

  return "anon";
}
