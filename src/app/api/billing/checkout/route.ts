import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";

/**
 * POST /api/billing/checkout
 * Body : { priceId: string, mode?: "subscription" | "payment" }
 *
 * Crée une Stripe Checkout Session pour un user authentifié et renvoie l'URL
 * vers laquelle rediriger.
 *
 * Le `priceId` est le Stripe Price ID (commence par `price_...`), à créer
 * d'abord dans le dashboard Stripe (Products → Add price).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
    }

    const { priceId, mode = "subscription" } = await req.json();
    if (!priceId) {
      return NextResponse.json({ error: "priceId required" }, { status: 400 });
    }

    const stripe = getStripe();

    // Cherche un customer existant pour cet email pour ne pas en créer 2.
    let customerId: string | undefined;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub?.stripe_customer_id) {
      customerId = sub.stripe_customer_id;
    }

    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      // Stripe gère la TVA française si Stripe Tax est activé dans le dashboard.
      automatic_tax: { enabled: true },
      success_url: `${origin}/account?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/sandbox/billing?billing=cancelled`,
      allow_promotion_codes: true,
      metadata: { user_id: user.id, email: user.email ?? "" },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
