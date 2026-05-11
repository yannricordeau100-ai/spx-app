/**
 * admin-types.ts — types TypeScript miroir du schéma SQL pricing_admin.
 *
 * Source de vérité : `supabase/migrations/20260508_pricing_admin.sql`
 * Gardes ce fichier en sync à la main quand le schéma évolue.
 */

export type Currency = "EUR" | "USD" | "GBP" | "CHF" | "SEK" | "DKK" | "CAD";
export const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "CHF", "SEK", "DKK", "CAD"];

export type Frequency = "monthly" | "annual";
export const FREQUENCIES: Frequency[] = ["monthly", "annual"];

export type PricingPlan = {
  id: string;
  code: string;
  name_fr: string;
  name_en: string | null;
  name_de: string | null;
  tagline_fr: string | null;
  tagline_en: string | null;
  tagline_de: string | null;
  audience_fr: string | null;
  audience_en: string | null;
  audience_de: string | null;
  cta_label_fr: string | null;
  cta_label_en: string | null;
  cta_label_de: string | null;
  /** Yann (11 mai 2026) : mention sous le prix, éditable par plan + langue.
   *  Ex pour plan gratuit : "À vie, sans carte bancaire". Si null, fallback
   *  auto (calcul "-X% vs mensuel" pour annuel, vide sinon). */
  price_caption_fr: string | null;
  price_caption_en: string | null;
  price_caption_de: string | null;
  tier_order: number;
  accent_color: string;
  is_highlight: boolean;
  is_active: boolean;
  is_api_only: boolean;
  api_contact_email: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingPrice = {
  id: string;
  plan_id: string;
  currency: Currency;
  frequency: Frequency;
  amount_decimal: number;
  annual_discount_pct: number | null;
  stripe_price_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingFeature = {
  id: string;
  code: string;
  category: string;
  category_order: number;
  feature_order: number;
  label_fr: string;
  label_en: string | null;
  label_de: string | null;
  help_fr: string | null;
  help_en: string | null;
  help_de: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingPlanFeature = {
  id: string;
  plan_id: string;
  feature_id: string;
  /** "true" = ✓, "false" = lock, autre = texte affiché */
  value_fr: string;
  value_en: string | null;
  value_de: string | null;
  highlight_color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PromoDiscountType = "percent" | "amount";

export type PricingPromoCode = {
  id: string;
  code: string;
  internal_label: string | null;
  discount_type: PromoDiscountType;
  discount_percent: number | null;
  discount_amount_decimal: number | null;
  discount_currency: Currency | null;
  max_redemptions: number | null;
  redemptions_count: number;
  max_per_user: number;
  starts_at: string | null;
  expires_at: string | null;
  recurring: boolean;
  applicable_plan_codes: string[] | null;
  applicable_currencies: string[] | null;
  applicable_frequency: Frequency | null;
  new_customers_only: boolean;
  is_active: boolean;
  stripe_coupon_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type PricingPromoRedemption = {
  id: string;
  promo_id: string;
  user_id: string;
  user_email: string | null;
  applied_to_subscription: string | null;
  amount_saved_decimal: number | null;
  amount_saved_currency: string | null;
  redeemed_at: string;
};

/**
 * Helper : différence numérique + % entre prix annuel et (mensuel × 12).
 * Yann 8 mai 2026 : afficher la diff en numéraire ET en %.
 */
export function annualSavings(monthly: number, annual: number) {
  const yearly_at_monthly = monthly * 12;
  if (yearly_at_monthly <= 0) return { amount: 0, pct: 0 };
  const amount = yearly_at_monthly - annual;
  const pct = (amount / yearly_at_monthly) * 100;
  return { amount: Math.round(amount * 100) / 100, pct: Math.round(pct * 10) / 10 };
}
