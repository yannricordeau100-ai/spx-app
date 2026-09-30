/**
 * Règles d'accès freemium Mettrik.
 *
 *   FREE :
 *     - sociétés de la liste « 100 % visibles en gratuit » : accès COMPLET.
 *     - autres tickers (MSCI, SPGI, CAT, ...) : page accessible MAIS chiffres
 *       et textes "à valeur ajoutée" sont floutés via <Paywall mode="blur">.
 *
 *   PREMIUM (mensuel ou annuel) : accès complet à tout.
 *
 *   ENTERPRISE : pareil que premium pour V1.
 */

export type Plan = "free" | "premium_monthly" | "premium_yearly" | "enterprise";

// Yann 30 sept 2026 : la liste des societes accessibles en integralite au
// plan FREE n est plus en dur ; elle vient de la base (chargeVisiblesGratuit
// cote serveur, useVisiblesGratuit cote client) et se passe en parametre.

export function isPremium(plan: Plan | null | undefined): boolean {
  return plan === "premium_monthly" || plan === "premium_yearly" || plan === "enterprise";
}

export function isPaywalled(ticker: string, plan: Plan | null | undefined, visibles: ReadonlySet<string>): boolean {
  if (isPremium(plan)) return false;
  return !visibles.has(ticker.toUpperCase());
}
