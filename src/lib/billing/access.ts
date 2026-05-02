/**
 * Règles d'accès freemium Mettrik.
 *
 *   FREE :
 *     - GOOGL, META : accès COMPLET (chiffres + textes + tout).
 *     - autres tickers (MSCI, SPGI, CAT, ...) : page accessible MAIS chiffres
 *       et textes "à valeur ajoutée" sont floutés via <Paywall mode="blur">.
 *
 *   PREMIUM (mensuel ou annuel) : accès complet à tout.
 *
 *   ENTERPRISE : pareil que premium pour V1.
 */

export type Plan = "free" | "premium_monthly" | "premium_yearly" | "enterprise";

/** Tickers accessibles en intégralité au plan FREE. */
export const FREE_TICKERS = new Set(["GOOGL", "META"]);

export function isPremium(plan: Plan | null | undefined): boolean {
  return plan === "premium_monthly" || plan === "premium_yearly" || plan === "enterprise";
}

export function isPaywalled(ticker: string, plan: Plan | null | undefined): boolean {
  if (isPremium(plan)) return false;
  return !FREE_TICKERS.has(ticker.toUpperCase());
}
