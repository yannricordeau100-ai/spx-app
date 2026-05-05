/**
 * Products & Prices Stripe résolus via le fichier de config généré par
 * `scripts/setup-stripe-products.ts`.
 *
 * Contient les IDs Stripe (test mode) pour 3 products × 7 devises =
 * 14 prices total. À régénérer si on change un tarif ou ajoute une devise.
 *
 * Devises (Yann 5 mai 2026) : EUR, USD, GBP, CHF, SEK, DKK, CAD.
 */
import productsConfig from "@/lib/billing/stripe-products.json";

export type CurrencyCode = "eur" | "usd" | "gbp" | "chf" | "sek" | "dkk" | "cad";
export type PlanCode = "premium_monthly" | "premium_annual";

const PLAN_TO_META_ID: Record<PlanCode, string> = {
  premium_monthly: "mettrik_premium_monthly",
  premium_annual: "mettrik_premium_annual",
};

/**
 * Renvoie le Price ID Stripe pour un plan + devise. Null si pas configuré.
 */
export function resolvePriceId(plan: PlanCode, currency: CurrencyCode): string | null {
  const metaId = PLAN_TO_META_ID[plan];
  const prices = (productsConfig as { prices: Record<string, Record<string, string>> }).prices[metaId];
  if (!prices) return null;
  return prices[currency] ?? null;
}

/** Format un prix display selon la devise + locale. */
export function formatPrice(amount: number, currency: CurrencyCode, locale: string = "fr-FR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Tarifs canoniques par devise pour affichage côté pricing page. */
export const PRICING_DISPLAY: Record<CurrencyCode, { month: number; year: number }> = {
  eur: { month: 24.9, year: 189 },
  usd: { month: 29.9, year: 229 },
  gbp: { month: 21, year: 159 },
  chf: { month: 24.9, year: 189 },
  sek: { month: 279, year: 2099 },
  dkk: { month: 185, year: 1409 },
  cad: { month: 39.9, year: 309 },
};
