import Stripe from "stripe";

/**
 * Singleton Stripe côté serveur.
 *
 * `apiVersion` : on laisse Stripe utiliser la version par défaut du compte
 * (configurable dans le dashboard). Évite les "API mismatch" silencieux.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing in .env.local");
  _stripe = new Stripe(key, { typescript: true });
  return _stripe;
}

/** Plans canoniques de Mettrik. Doit matcher les Products dans Stripe Dashboard. */
export const PLANS = {
  free: {
    id: "free",
    label: "Free",
    price_eur_month: 0,
    price_eur_year: 0,
    features: [
      "Accès complet à GOOGL et META",
      "Comparaison entre GOOGL et META",
      "Lecture des autres sociétés (chiffres masqués)",
    ],
  },
  premium_monthly: {
    id: "premium_monthly",
    label: "Premium",
    price_eur_month: 24.90,
    price_chf_month: 24.90,
    price_usd_month: 29.90,
    features: [
      "Accès à toutes les sociétés couvertes",
      "Comparaison N-vs-N",
      "Watchlists illimitées",
      "Alertes par KPI",
      "Digest hebdomadaire",
    ],
  },
  premium_yearly: {
    id: "premium_yearly",
    label: "Premium (annuel)",
    price_eur_year: 189,
    price_chf_year: 189,
    price_usd_year: 249,
    discount_pct: Math.round((1 - 189 / (24.90 * 12)) * 100), // ~37% économie
    features: ["Identique à Premium mensuel, payé en une fois"],
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise / API",
    price_eur_month: null,
    features: ["Sur devis : nous contacter"],
  },
} as const;

export type PlanId = keyof typeof PLANS;
