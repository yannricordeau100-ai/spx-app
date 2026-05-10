/**
 * admin-queries.ts — wrappers Supabase pour le back-office pricing.
 *
 * Toutes les fonctions exigent `service_role` côté Supabase (RLS) → ces
 * helpers sont à appeler EXCLUSIVEMENT depuis :
 *  - Server Components du back-office (`/desk-mtk9x4kp/pricing`)
 *  - API routes back-office (`/api/billing/admin/*`)
 * Et ils requireDeskOwner() pour gate au niveau code.
 */
import { createClient } from "@supabase/supabase-js";
import type {
  PricingPlan,
  PricingPrice,
  PricingFeature,
  PricingPlanFeature,
  PricingPromoCode,
  Currency,
  Frequency,
} from "./admin-types";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role keys missing");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/* ─── Plans ─────────────────────────────────────────────────────────── */

export async function listPlans(): Promise<PricingPlan[]> {
  const { data, error } = await adminClient()
    .from("pricing_plans")
    .select("*")
    .order("tier_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PricingPlan[];
}

export async function getPlan(id: string): Promise<PricingPlan | null> {
  const { data, error } = await adminClient().from("pricing_plans").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as PricingPlan) ?? null;
}

export async function upsertPlan(plan: Partial<PricingPlan>): Promise<PricingPlan> {
  const { data, error } = await adminClient()
    .from("pricing_plans")
    .upsert(plan, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as PricingPlan;
}

/**
 * Update strict (par id) : utilisé pour les PATCH où id est dans l'URL et
 * non dans le body. Plus prévisible qu'upsert (qui peut INSERT silencieux
 * si la PK est interprétée bizarrement).
 */
export async function updatePlanById(id: string, partial: Partial<PricingPlan>): Promise<PricingPlan> {
  // Strip id du body pour éviter de se le faire imposer
  const { id: _ignored, ...rest } = partial as PricingPlan;
  const { data, error } = await adminClient()
    .from("pricing_plans")
    .update(rest)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as PricingPlan;
}

export async function duplicatePlan(sourceId: string, newCode: string, newNameFr: string): Promise<PricingPlan> {
  const src = await getPlan(sourceId);
  if (!src) throw new Error("Source plan introuvable");
  const { id: _ignored, created_at: _c, updated_at: _u, ...rest } = src;
  const newPlan = await upsertPlan({
    ...rest,
    code: newCode,
    name_fr: newNameFr,
    is_highlight: false,        // dup ne reprend pas le highlight
    tier_order: (src.tier_order ?? 0) + 1,
  });
  // Copier aussi les prix + features
  const prices = await listPricesForPlan(sourceId);
  for (const p of prices) {
    const { id: _i, plan_id: _p, created_at: _c2, updated_at: _u2, stripe_price_id: _s, ...priceRest } = p;
    await upsertPrice({ ...priceRest, plan_id: newPlan.id });
  }
  const planFeatures = await listPlanFeatures(sourceId);
  for (const pf of planFeatures) {
    const { id: _i, plan_id: _p, created_at: _c3, updated_at: _u3, ...pfRest } = pf;
    await upsertPlanFeature({ ...pfRest, plan_id: newPlan.id });
  }
  return newPlan;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await adminClient().from("pricing_plans").delete().eq("id", id);
  if (error) throw error;
}

/* ─── Prices ────────────────────────────────────────────────────────── */

export async function listPrices(): Promise<PricingPrice[]> {
  const { data, error } = await adminClient().from("pricing_prices").select("*");
  if (error) throw error;
  return (data ?? []) as PricingPrice[];
}

export async function listPricesForPlan(planId: string): Promise<PricingPrice[]> {
  const { data, error } = await adminClient()
    .from("pricing_prices")
    .select("*")
    .eq("plan_id", planId);
  if (error) throw error;
  return (data ?? []) as PricingPrice[];
}

export async function upsertPrice(price: Partial<PricingPrice>): Promise<PricingPrice> {
  // Yann 9 mai 2026 : bug "le prix revient à 0" → cause = upsert(price) sans
  // onConflict, qui partait sur INSERT puis silent-fail sur la contrainte
  // unique (plan_id, currency, frequency). Fix : si id présent → UPDATE
  // strict ; sinon → upsert avec onConflict explicite.
  const supa = adminClient();
  if (price.id) {
    const { id: _id, ...rest } = price;
    const { data, error } = await supa
      .from("pricing_prices")
      .update(rest)
      .eq("id", price.id)
      .select()
      .single();
    if (error) throw error;
    return data as PricingPrice;
  }
  const { data, error } = await supa
    .from("pricing_prices")
    .upsert(price, { onConflict: "plan_id,currency,frequency" })
    .select()
    .single();
  if (error) throw error;
  return data as PricingPrice;
}

export async function deletePrice(id: string): Promise<void> {
  const { error } = await adminClient().from("pricing_prices").delete().eq("id", id);
  if (error) throw error;
}

/* ─── Features (catalogue) ──────────────────────────────────────────── */

export async function listFeatures(): Promise<PricingFeature[]> {
  const { data, error } = await adminClient()
    .from("pricing_features")
    .select("*")
    .order("category_order", { ascending: true })
    .order("feature_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PricingFeature[];
}

export async function upsertFeature(feature: Partial<PricingFeature>): Promise<PricingFeature> {
  // Yann 9 mai 2026 : même bug que upsertPrice (le upsert sans onConflict
  // silently fail sur insert quand l'id existe déjà). Fix : update strict
  // si id présent, insert sinon.
  const supa = adminClient();
  if (feature.id) {
    const { id: _id, ...rest } = feature;
    const { data, error } = await supa
      .from("pricing_features")
      .update(rest)
      .eq("id", feature.id)
      .select()
      .single();
    if (error) throw error;
    return data as PricingFeature;
  }
  const { data, error } = await supa
    .from("pricing_features")
    .upsert(feature, { onConflict: "code" })
    .select()
    .single();
  if (error) throw error;
  return data as PricingFeature;
}

/** Swap feature_order entre 2 features (utilisé par les flèches up/down du back office). */
export async function swapFeatureOrders(idA: string, idB: string): Promise<void> {
  const supa = adminClient();
  const { data, error } = await supa
    .from("pricing_features")
    .select("id, feature_order")
    .in("id", [idA, idB]);
  if (error) throw error;
  if (!data || data.length !== 2) throw new Error("Features introuvables");
  const a = data.find((d) => d.id === idA)!;
  const b = data.find((d) => d.id === idB)!;
  // Update parallèle
  const [r1, r2] = await Promise.all([
    supa.from("pricing_features").update({ feature_order: b.feature_order }).eq("id", a.id),
    supa.from("pricing_features").update({ feature_order: a.feature_order }).eq("id", b.id),
  ]);
  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
}

export async function deleteFeature(id: string): Promise<void> {
  const { error } = await adminClient().from("pricing_features").delete().eq("id", id);
  if (error) throw error;
}

/* ─── Plan × Feature (valeur affichée par plan) ─────────────────────── */

export async function listPlanFeatures(planId: string): Promise<PricingPlanFeature[]> {
  const { data, error } = await adminClient()
    .from("pricing_plan_features")
    .select("*")
    .eq("plan_id", planId);
  if (error) throw error;
  return (data ?? []) as PricingPlanFeature[];
}

export async function listAllPlanFeatures(): Promise<PricingPlanFeature[]> {
  const { data, error } = await adminClient().from("pricing_plan_features").select("*");
  if (error) throw error;
  return (data ?? []) as PricingPlanFeature[];
}

export async function upsertPlanFeature(pf: Partial<PricingPlanFeature>): Promise<PricingPlanFeature> {
  const { data, error } = await adminClient()
    .from("pricing_plan_features")
    .upsert(pf, { onConflict: "plan_id,feature_id" })
    .select()
    .single();
  if (error) throw error;
  return data as PricingPlanFeature;
}

/**
 * Copie une feature de `sourcePlanId` vers `targetPlanIds`. Permet à Yann
 * de reproduire le texte affiché d'un plan vers un autre (ou tous) en
 * un clic, puis ajuster ensuite si besoin.
 */
export async function copyFeatureValueAcrossPlans(
  featureId: string,
  sourcePlanId: string,
  targetPlanIds: string[],
): Promise<void> {
  const src = await listPlanFeatures(sourcePlanId);
  const srcRow = src.find((r) => r.feature_id === featureId);
  if (!srcRow) throw new Error("Source plan_feature introuvable");
  for (const targetId of targetPlanIds) {
    if (targetId === sourcePlanId) continue;
    await upsertPlanFeature({
      plan_id: targetId,
      feature_id: featureId,
      value_fr: srcRow.value_fr,
      value_en: srcRow.value_en,
      value_de: srcRow.value_de,
      highlight_color: srcRow.highlight_color,
      is_active: true,
    });
  }
}

/* ─── Promo codes ───────────────────────────────────────────────────── */

export async function listPromoCodes(): Promise<PricingPromoCode[]> {
  const { data, error } = await adminClient()
    .from("pricing_promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PricingPromoCode[];
}

export async function upsertPromoCode(promo: Partial<PricingPromoCode>): Promise<PricingPromoCode> {
  const { data, error } = await adminClient()
    .from("pricing_promo_codes")
    .upsert(promo, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as PricingPromoCode;
}

export async function updatePromoCodeById(id: string, partial: Partial<PricingPromoCode>): Promise<PricingPromoCode> {
  const { id: _ignored, ...rest } = partial as PricingPromoCode;
  const { data, error } = await adminClient()
    .from("pricing_promo_codes")
    .update(rest)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as PricingPromoCode;
}

export async function deletePromoCode(id: string): Promise<void> {
  const { error } = await adminClient().from("pricing_promo_codes").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Validation côté serveur d'un code promo (pour le checkout).
 * Vérifie : actif, dates, max_redemptions global, plan/currency/freq compat.
 * Ne décrémente pas usage : c'est fait après le webhook Stripe payment.
 */
export async function validatePromoCode(
  code: string,
  ctx: { plan_code: string; currency: Currency; frequency: Frequency; user_id?: string },
): Promise<{ ok: true; promo: PricingPromoCode } | { ok: false; reason: string }> {
  const { data, error } = await adminClient()
    .from("pricing_promo_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return { ok: false, reason: "code_invalid" };
  const p = data as PricingPromoCode;
  const now = new Date();
  if (p.starts_at && new Date(p.starts_at) > now) return { ok: false, reason: "not_started" };
  if (p.expires_at && new Date(p.expires_at) < now) return { ok: false, reason: "expired" };
  if (p.max_redemptions !== null && p.redemptions_count >= p.max_redemptions) {
    return { ok: false, reason: "exhausted" };
  }
  if (p.applicable_plan_codes && !p.applicable_plan_codes.includes(ctx.plan_code)) {
    return { ok: false, reason: "plan_not_eligible" };
  }
  if (p.applicable_currencies && !p.applicable_currencies.includes(ctx.currency)) {
    return { ok: false, reason: "currency_not_eligible" };
  }
  if (p.applicable_frequency && p.applicable_frequency !== ctx.frequency) {
    return { ok: false, reason: "frequency_not_eligible" };
  }
  return { ok: true, promo: p };
}
