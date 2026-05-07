/**
 * /api/billing/portal — redirige vers le Stripe Customer Portal pour
 * que l'utilisateur connecté gère son abonnement (changer de plan,
 * annuler, mettre à jour la carte, télécharger les factures).
 *
 * Pré-requis : le Customer Portal doit être configuré dans le dashboard
 * Stripe (Settings > Customer Portal). Yann l'active une fois.
 *
 * Flow :
 *   1. Lit l'user Supabase (auth)
 *   2. Récupère le customer_id Stripe stocké dans la table `subscriptions`
 *   3. Crée une session portal qui retourne sur /account après gestion
 *   4. Redirige vers session.url
 *
 * Si l'user n'a jamais été client (pas d'abonnement payant) → redirige
 * sur /pricing pour qu'il choisisse un plan d'abord.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/?auth=signin&next=/account", req.url));
  }

  // Cherche le customer_id Stripe dans la table abonnements (si exist).
  // Si la table n'existe pas encore, on tombe en fallback /pricing.
  let customerId: string | null = null;
  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub && typeof (sub as { stripe_customer_id?: string }).stripe_customer_id === "string") {
      customerId = (sub as { stripe_customer_id: string }).stripe_customer_id;
    }
  } catch {
    // Table absente ou erreur RLS → fallback
  }

  if (!customerId) {
    // Pas de client Stripe = jamais abonné → renvoyer sur la page tarifs
    return NextResponse.redirect(new URL("/pricing", req.url));
  }

  const origin = new URL(req.url).origin;
  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("Stripe portal session error", e);
    return NextResponse.redirect(new URL("/account?error=portal_unavailable", req.url));
  }
}
