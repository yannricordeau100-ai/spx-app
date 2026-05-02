import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/billing/stripe";
import type Stripe from "stripe";

/**
 * POST /api/billing/webhook
 * Endpoint que Stripe appelle pour notifier les événements (paiement OK,
 * abonnement annulé, renouvelé, etc.).
 *
 * Setup au matin :
 *   1. Dans Stripe Dashboard → Developers → Webhooks → Add endpoint
 *   2. URL : https://<ton-domaine>/api/billing/webhook
 *      (en dev local : utiliser `stripe listen --forward-to localhost:3000/api/billing/webhook`
 *       pour avoir un secret temporaire whsec_*)
 *   3. Events à écouter :
 *      - checkout.session.completed
 *      - customer.subscription.created
 *      - customer.subscription.updated
 *      - customer.subscription.deleted
 *      - invoice.payment_failed
 *   4. Copier le "Signing secret" et le coller dans .env.local
 *      sous STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * Sécurité : on vérifie OBLIGATOIREMENT la signature Stripe pour rejeter
 * les requêtes non autorisées (sinon n'importe qui peut faire passer un
 * user en premium en envoyant un faux POST).
 */

// Utilise le service role key pour bypasser RLS (le webhook n'a pas de session user).
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const runtime = "nodejs"; // Stripe SDK requires Node, not Edge

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });
  if (!secret || secret === "whsec_TODO_PASTE_AT_WAKE_UP") {
    // Webhook secret not yet set — accept but log warning so we don't fail
    // silently before Yann finishes the setup.
    return NextResponse.json({
      warning: "STRIPE_WEBHOOK_SECRET not yet configured (whsec_TODO_PASTE_AT_WAKE_UP). Voir HANDOFF-NIGHT.md.",
    }, { status: 200 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Audit log brut (idempotent via stripe_event_id UNIQUE).
  await admin.from("billing_events").upsert({
    stripe_event_id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed_ok: false,
  }, { onConflict: "stripe_event_id" });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.user_id;
        const email = session.customer_email ?? session.metadata?.email ?? "";
        const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (userId) {
          await admin.from("subscriptions").upsert({
            user_id: userId,
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
            status: "active",
            currency: (session.currency ?? "eur").toUpperCase(),
            plan: "premium_monthly", // affiné via subscription.updated juste après
          }, { onConflict: "user_id" });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = sub.items.data[0]?.price.id ?? null;
        const interval = sub.items.data[0]?.price.recurring?.interval; // "month" | "year"
        const plan = interval === "year" ? "premium_yearly" : "premium_monthly";
        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
        // Newer Stripe API : current_period_end vit sur l'item, pas sur la sub
        const periodEnd =
          (sub as unknown as { current_period_end?: number }).current_period_end ??
          sub.items.data[0]?.current_period_end ??
          null;
        await admin.from("subscriptions").update({
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          plan,
          status,
          currency: (sub.currency ?? "eur").toUpperCase(),
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
        }).eq("stripe_customer_id", stripeCustomerId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (stripeCustomerId) {
          await admin.from("subscriptions").update({ status: "past_due" }).eq("stripe_customer_id", stripeCustomerId);
        }
        break;
      }

      default:
        // Other events ignored for now.
        break;
    }

    await admin.from("billing_events").update({ processed_ok: true }).eq("stripe_event_id", event.id);
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("billing_events").update({ processed_ok: false, error: msg }).eq("stripe_event_id", event.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
