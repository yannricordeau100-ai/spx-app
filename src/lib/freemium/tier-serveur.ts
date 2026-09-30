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

/**
 * Comptes de reglage (Yann 13 sept 2026) : le proprietaire, le compte de
 * marque et les comptes internes de test ont TOUS les acces (palier Max),
 * quel que soit leur abonnement. Sans cela, Yann connecte avec son compte de
 * marque voyait le site comme un visiteur gratuit (menus et blocs caches).
 */
const COMPTES_REGLAGE = ["yannricordeau100@gmail.com", "mettrikai@gmail.com"];

export function estCompteInterne(email: string | null | undefined): boolean {
  const e = (email ?? "").toLowerCase();
  if (!e) return false;
  const owner = (process.env.DESK_OWNER_EMAIL ?? "").toLowerCase();
  if (owner !== "" && e === owner) return true;
  if (e.endsWith("@mettrik-internal.test")) return true;
  return COMPTES_REGLAGE.includes(e);
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

/** Societes vitrine (Yann 3 sept 2026) : servies SANS floutage aux paliers
 *  non payants, pour juger la profondeur avant de payer.
 *  Yann 30 sept 2026 : la liste n est plus en dur, elle vient de la base
 *  (chargeVisiblesGratuit, outil /sandbox/admin/floutage-selector) et vaut
 *  pour les paliers gratuit ET anonyme. */
export function tierPourFiche(tier: UserTier, ticker: string, visibles: ReadonlySet<string>): UserTier {
  if ((tier === "free" || tier === "anon") && visibles.has(ticker.toUpperCase())) return "max";
  return tier;
}
