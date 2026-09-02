/**
 * Palier reel d un utilisateur connecte (audit lancement, 2 sept 2026).
 *
 * Avant : toute personne connectee etait servie en palier "max" (les pages
 * societe faisaient `user ? "max" : "anon"`), donc payer ne changeait rien.
 * Maintenant : le palier vient de la table `subscriptions` alimentee par le
 * webhook Stripe. Sans abonnement actif : "free" (floutage des zones payantes).
 *
 * Exceptions : le compte proprietaire et les comptes de test internes sont
 * toujours "max".
 */
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { UserTier } from "./context";

const STATUTS_ACTIFS = new Set(["active", "trialing", "past_due"]);

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function estCompteInterne(email: string | null | undefined): boolean {
  const e = (email ?? "").toLowerCase();
  if (!e) return false;
  const owner = (process.env.DESK_OWNER_EMAIL ?? "").toLowerCase();
  return (owner !== "" && e === owner) || e.endsWith("@mettrik-internal.test");
}

export function tierDepuisPlan(plan: string | null | undefined, status: string | null | undefined): UserTier {
  if (!plan || !status || !STATUTS_ACTIFS.has(status)) return "free";
  const p = plan.toLowerCase();
  if (p.startsWith("max") || p === "enterprise") return "max";
  if (p.startsWith("premium")) return "premium";
  return "free";
}

/** Palier d un utilisateur connecte. Ne jette jamais : en cas d erreur base, "free". */
export async function tierDepuisAbonnement(user: Pick<User, "id" | "email">): Promise<UserTier> {
  if (estCompteInterne(user.email)) return "max";
  try {
    const { data } = await admin()
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", user.id)
      .maybeSingle();
    return tierDepuisPlan(data?.plan, data?.status);
  } catch {
    return "free";
  }
}
