import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { resolvePriceId, type CurrencyCode } from "@/lib/billing/products";

/**
 * POST /api/billing/checkout
 *
 * Body :
 *   { plan: "premium_monthly" | "premium_annual",
 *     currency?: "eur" | "usd" | "gbp" | "chf" | "sek" | "dkk" | "cad" }
 *
 *   (Pour back-compat, accepte aussi { priceId } en direct.)
 *
 * Crée une Stripe Checkout Session pour un user authentifié et renvoie l'URL.
 * Devises supportées : EUR, USD, GBP, CHF, SEK, DKK, CAD (Yann 5 mai 2026).
 * Méthodes de paiement activées : carte (Visa/MC/Amex), PayPal, SEPA Direct
 * Debit (EUR), Klarna (DE/SE/etc), Apple Pay/Google Pay (auto via Stripe).
 *
 * La devise est :
 *   1. Celle passée en body si présente (préférence user explicite)
 *   2. Sinon dérivée du header `x-vercel-ip-country` côté Vercel Edge
 *   3. Fallback EUR
 */

// Mapping pays ISO → devise par défaut. Couvre les locales Mettrik AI.
const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  // EUR zone
  FR: "eur", BE: "eur", LU: "eur", MC: "eur", DE: "eur", AT: "eur",
  NL: "eur", IE: "eur", IT: "eur", ES: "eur", PT: "eur", FI: "eur", GR: "eur",
  // USD
  US: "usd",
  // GBP
  GB: "gbp",
  // CHF
  CH: "chf", LI: "chf",
  // SEK
  SE: "sek",
  // DKK
  DK: "dkk",
  // CAD
  CA: "cad",
};

function detectCurrency(req: NextRequest, explicit?: string): CurrencyCode {
  if (explicit && ["eur", "usd", "gbp", "chf", "sek", "dkk", "cad"].includes(explicit)) {
    return explicit as CurrencyCode;
  }
  const country = (req.headers.get("x-vercel-ip-country") ?? "").toUpperCase();
  return COUNTRY_TO_CURRENCY[country] ?? "eur";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
    }

    const body = await req.json();
    const explicitCurrency: string | undefined = body.currency;
    const currency = detectCurrency(req, explicitCurrency);

    // Résolution priceId : soit direct (back-compat), soit via plan + currency.
    let priceId: string | undefined = body.priceId;
    if (!priceId) {
      const plan = body.plan as "premium_monthly" | "premium_annual" | undefined;
      if (!plan) {
        return NextResponse.json(
          { error: "plan ou priceId required" },
          { status: 400 }
        );
      }
      priceId = resolvePriceId(plan, currency) ?? undefined;
      if (!priceId) {
        return NextResponse.json(
          { error: `Pas de price configuré pour ${plan}/${currency}. Run scripts/setup-stripe-products.ts.` },
          { status: 500 }
        );
      }
    }

    const stripe = getStripe();

    // Cherche un customer existant pour ne pas en créer 2.
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
    // Méthodes de paiement par devise : Stripe limite certaines selon currency.
    // Card + PayPal partout. SEPA + Klarna seulement sur EUR. Bancontact/iDEAL
    // auto-affichées par Stripe selon pays browser.
    const paymentMethods: ("card" | "paypal" | "sepa_debit" | "klarna")[] = ["card", "paypal"];
    if (currency === "eur") {
      paymentMethods.push("sepa_debit", "klarna");
    } else if (currency === "sek" || currency === "dkk") {
      paymentMethods.push("klarna");
    }

    const session = await stripe.checkout.sessions.create({
      mode: body.mode ?? "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: paymentMethods,
      // Stripe Tax gère TVA EU/UK/CH/CA automatiquement si activé dashboard.
      automatic_tax: { enabled: true },
      // Locale auto Stripe : se base sur Accept-Language du browser, fallback EN.
      locale: "auto",
      success_url: `${origin}/account?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?billing=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        user_id: user.id,
        email: user.email ?? "",
        currency,
        plan: body.plan ?? "custom",
      },
    });

    return NextResponse.json({ url: session.url, currency });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
