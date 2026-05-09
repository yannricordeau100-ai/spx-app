import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { listPlans, listPrices, upsertPrice } from "@/lib/billing/admin-queries";
import { getStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

/**
 * Synchronise les plans + prix locaux vers Stripe :
 *   - Crée un Stripe Product par plan (idempotent via metadata.code)
 *   - Crée un Stripe Price par (currency, frequency)
 *   - Stocke `stripe_price_id` dans la table pricing_prices
 *
 * En test mode (clé sk_test_*). Pour live, Yann passe les clés en
 * variables d'env et relance.
 */
export async function POST() {
  await requireDeskOwner();
  const stripe = getStripe();
  const plans = await listPlans();
  const prices = await listPrices();

  const productByCode = new Map<string, string>();
  // Récupère la liste des products Stripe pour matcher par metadata.code
  const existingProducts = await stripe.products.list({ limit: 100 });
  for (const p of existingProducts.data) {
    const code = p.metadata?.code;
    if (code) productByCode.set(code, p.id);
  }

  let created = 0;
  let updated = 0;

  for (const plan of plans.filter((p) => p.is_active && !p.is_api_only)) {
    let productId = productByCode.get(plan.code);
    if (!productId) {
      const product = await stripe.products.create({
        name: plan.name_fr,
        metadata: { code: plan.code, mettrik_admin: "1" },
        active: plan.is_active,
      });
      productId = product.id;
    } else {
      await stripe.products.update(productId, {
        name: plan.name_fr,
        active: plan.is_active,
      });
    }

    for (const pr of prices.filter((p) => p.plan_id === plan.id && p.is_active)) {
      if (pr.stripe_price_id) {
        // déjà sync, ignorer (Stripe ne permet pas d'updater un Price)
        continue;
      }
      // Stripe stocke en cents
      const unitAmount = Math.round(pr.amount_decimal * 100);
      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: unitAmount,
        currency: pr.currency.toLowerCase(),
        recurring: { interval: pr.frequency === "monthly" ? "month" : "year" },
        metadata: {
          plan_code: plan.code,
          frequency: pr.frequency,
          mettrik_price_local_id: pr.id,
        },
      });
      await upsertPrice({ id: pr.id, stripe_price_id: newPrice.id });
      created++;
    }
  }

  return NextResponse.json({ created, updated });
}
