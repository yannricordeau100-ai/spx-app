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

    // Yann (11 mai 2026) : on traite TOUS les prix du plan (actifs + inactifs)
    // pour pouvoir aussi archiver côté Stripe quand Yann désactive une devise.
    for (const pr of prices.filter((p) => p.plan_id === plan.id && p.amount_decimal > 0)) {
      if (pr.is_active && !pr.stripe_price_id) {
        // ACTIF + pas encore sync → créer dans Stripe
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
      } else if (!pr.is_active && pr.stripe_price_id) {
        // INACTIF + déjà sync → archiver côté Stripe (jamais delete)
        try {
          await stripe.prices.update(pr.stripe_price_id, { active: false });
          updated++;
        } catch {
          // ignore : Stripe peut refuser si déjà archivé
        }
      } else if (pr.is_active && pr.stripe_price_id) {
        // ACTIF + déjà sync → s'assurer que Stripe le considère actif
        try {
          await stripe.prices.update(pr.stripe_price_id, { active: true });
        } catch {
          // ignore
        }
      }
    }
  }

  return NextResponse.json({ created, updated });
}
