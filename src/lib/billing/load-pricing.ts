/**
 * load-pricing.ts — lecture du catalogue tarifaire pour le front public.
 *
 * Stratégie idempotente :
 *  1. Tente de lire depuis la BDD Supabase (tables `pricing_plans` +
 *     `pricing_prices`)
 *  2. Si la BDD est vide OU inaccessible (migration pas encore appliquée,
 *     pas de connexion, etc) → fallback sur `plans.ts` hardcodé
 *
 * Permet à la page front V1.8 pricing de marcher AVANT et APRÈS que
 * Yann applique la migration BDD. Quand il saisit les prix dans le
 * back-office, ils sont automatiquement reflétés sur le front. Pas de
 * gating, pas de "page en attente".
 *
 * Cache : la lecture côté Server Component est mise en cache via Next.js
 * `revalidate` au niveau de la page parente.
 */
import { createClient } from "@supabase/supabase-js";
import { PLANS as FALLBACK_PLANS, FEATURES as FALLBACK_FEATURES, type PlanDisplay, type PlanTier, type FeatureRow } from "./plans";
import type { Currency, Frequency } from "./admin-types";

/**
 * Normalise un code de plan BDD vers les tiers internes du code TS.
 * BDD : "Free" / "Premium" / "Max" (canonicaux).
 * Code TS : "free" / "premium" / "max" (lowercase).
 *
 * Note (Yann 18 mai 2026) : tous les anciens noms (decouverte / investisseur /
 * pro_plus / investor / pro+) ont été retirés. Le BO ne propose plus que
 * les 3 codes canoniques + la possibilité d'un "api" plan avec is_api_only.
 */
function normalizePlanCode(code: string): PlanTier {
  const c = (code ?? "").toLowerCase();
  if (c === "free" || c === "gratuit") return "free";
  if (c === "premium") return "premium";
  if (c === "max") return "max";
  // Fallback : si code inconnu (ex : futur plan "api"), retourne tel quel.
  return c as PlanTier;
}

/**
 * Yann (11 mai 2026) : enrichissement pour que pricing-cards lise
 * directement les stripe_price_id depuis la BDD (plus besoin du JSON
 * statique stripe-products.json). Inclut aussi `active` par devise ×
 * fréquence pour griser les CTAs des devises non encore activées.
 */
export type PriceEntry = {
  amount?: number;
  stripe_price_id?: string | null;
  active?: boolean;
};

export type LoadedPlan = PlanDisplay & {
  /** Code BDD canonique (free, premium, max, …). Utile pour le checkout. */
  code: string;
  /** Prix par devise + fréquence avec stripe ID + état actif. */
  prices: Record<string, { monthly?: PriceEntry; annual?: PriceEntry }>;
};

/**
 * Catalog complet : plans + features + valeurs par plan, prêt à consommer
 * par PricingMatrix et PricingCards.
 */
export type LoadedCatalog = {
  plans: LoadedPlan[];
  features: FeatureRow[];
};

export async function loadPricingForPublic(): Promise<LoadedPlan[]> {
  // Tente la lecture BDD
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase keys missing");

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: plans, error: plansErr } = await supabase
      .from("pricing_plans")
      .select("*")
      .eq("is_active", true)
      .order("tier_order", { ascending: true });

    if (plansErr || !plans || plans.length === 0) {
      // Migration pas appliquée OU BDD vide → fallback
      return FALLBACK_PLANS.map((p) => ({ ...p, code: p.tier, prices: defaultPricesForTier(p.tier) }));
    }

    // Yann (11 mai 2026) : on lit TOUS les prix (actifs ou pas) pour
    // pouvoir griser les CTAs des devises non encore activées au lieu
    // de les masquer. Le filtre is_active est appliqué côté front en
    // lisant `prices[currency].monthly.active`.
    const { data: prices } = await supabase.from("pricing_prices").select("*");
    const pricesByPlan = new Map<string, Record<string, { monthly?: PriceEntry; annual?: PriceEntry }>>();
    for (const pr of prices ?? []) {
      if (!pricesByPlan.has(pr.plan_id)) pricesByPlan.set(pr.plan_id, {});
      const byCurrency = pricesByPlan.get(pr.plan_id)!;
      if (!byCurrency[pr.currency]) byCurrency[pr.currency] = {};
      byCurrency[pr.currency][pr.frequency as "monthly" | "annual"] = {
        amount: Number(pr.amount_decimal),
        stripe_price_id: pr.stripe_price_id,
        active: !!pr.is_active,
      };
    }

    return plans.map((dbPlan): LoadedPlan => {
      const tier = normalizePlanCode(dbPlan.code);
      const tierPrices = pricesByPlan.get(dbPlan.id) ?? {} as Record<string, { monthly?: PriceEntry; annual?: PriceEntry }>;
      const eurMonthly = tierPrices.EUR?.monthly?.amount ?? 0;
      const eurAnnual = tierPrices.EUR?.annual?.amount ?? 0;
      // Yann (11 mai 2026) : si price_caption_fr est rempli côté admin,
      // on l'utilise tel quel (Yann maître du wording). Sinon fallback auto.
      const customCaption = (dbPlan as { price_caption_fr?: string | null }).price_caption_fr;
      const annualSavingsLabel = customCaption && customCaption.trim().length > 0
        ? customCaption
        : eurAnnual > 0 && eurMonthly > 0
          ? `Soit −${Math.round(((eurMonthly * 12 - eurAnnual) / (eurMonthly * 12)) * 100)} % vs mensuel`
          : "À vie, sans carte bancaire";
      return {
        tier,
        code: dbPlan.code,
        name: dbPlan.name_fr ?? "",
        tagline: dbPlan.tagline_fr ?? "",
        price_monthly_eur: eurMonthly,
        price_annual_eur: eurAnnual,
        annual_savings_label: annualSavingsLabel,
        accent: dbPlan.accent_color ?? "#a78bfa",
        highlight: !!dbPlan.is_highlight,
        cta_label: dbPlan.cta_label_fr ?? "Choisir",
        audience: dbPlan.audience_fr ?? "",
        prices: tierPrices,
      };
    });
  } catch {
    // Toute erreur → fallback silencieux (la page front doit toujours
    // marcher, même si la BDD est down).
    return FALLBACK_PLANS.map((p) => ({ ...p, code: p.tier, prices: defaultPricesForTier(p.tier) }));
  }
}

/** Prix par défaut (sourcés du plans.ts hardcoded) si BDD vide. */
function defaultPricesForTier(tier: PlanTier): Record<string, { monthly?: PriceEntry; annual?: PriceEntry }> {
  const fallback = FALLBACK_PLANS.find((p) => p.tier === tier);
  if (!fallback) return {};
  return {
    EUR: {
      monthly: { amount: fallback.price_monthly_eur, active: true },
      annual: { amount: fallback.price_annual_eur, active: true },
    },
  };
}

/** Helper : prix display pour une devise donnée, avec fallback EUR si absent. */
export function priceFor(plan: LoadedPlan, currency: Currency, frequency: Frequency): number | null {
  const v = plan.prices[currency]?.[frequency]?.amount;
  if (typeof v === "number" && v > 0) return v;
  // Fallback : EUR
  const eur = plan.prices.EUR?.[frequency]?.amount;
  return typeof eur === "number" ? eur : null;
}

/**
 * Renvoie les infos checkout pour un plan + devise + fréquence :
 * - stripe_price_id pour passer au /api/billing/checkout
 * - active : true si la devise est activée par Yann pour ce plan
 * Si null → pas de checkout possible (CTA grisé "bientôt dispo").
 */
export function checkoutInfoFor(
  plan: LoadedPlan,
  currency: Currency,
  frequency: Frequency,
): { stripe_price_id: string; active: boolean } | null {
  const entry = plan.prices[currency]?.[frequency];
  if (!entry?.stripe_price_id) return null;
  return { stripe_price_id: entry.stripe_price_id, active: !!entry.active };
}

/**
 * Charge le catalogue complet (plans + features + valeurs) pour le front.
 * Idempotent : fallback sur plans.ts hardcoded si BDD vide / inaccessible.
 */
export async function loadPricingCatalog(): Promise<LoadedCatalog> {
  const plans = await loadPricingForPublic();

  // Charge features + plan_features depuis la BDD
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase keys missing");
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const [featRes, pfRes] = await Promise.all([
      // Yann 25 mai 2026 : sort UNIQUEMENT par feature_order (== ordre BO).
      // Avant : (category_order, feature_order) ce qui réordonnait
      // silencieusement quand 2 features avaient le même category_order et
      // que l'utilisateur déplaçait via flèches/drag (qui ne touchent QUE
      // feature_order). Résultat : ordre BO ≠ ordre app. La matrice reste
      // groupée par category (logique côté composant).
      supabase.from("pricing_features").select("*").eq("is_active", true).order("feature_order"),
      supabase.from("pricing_plan_features").select("*").eq("is_active", true),
    ]);

    if (featRes.error || !featRes.data || featRes.data.length === 0) {
      // BDD vide → fallback
      return { plans, features: FALLBACK_FEATURES };
    }

    // Mapping {plan_id → tier interne normalisé}
    const tierByPlanId = new Map<string, PlanTier>();
    const { data: dbPlans } = await supabase.from("pricing_plans").select("id, code");
    if (dbPlans) {
      for (const p of dbPlans) tierByPlanId.set(p.id, normalizePlanCode(p.code));
    }

    // featureCode → tier (free/premium/max) → value_fr
    const valuesByCode = new Map<string, Map<PlanTier, string>>();
    const featById = new Map<string, string>();
    for (const f of featRes.data) featById.set(f.id, f.code);

    for (const pf of pfRes.data ?? []) {
      const featCode = featById.get(pf.feature_id);
      const tier = tierByPlanId.get(pf.plan_id);
      if (!featCode || !tier) continue;
      if (!valuesByCode.has(featCode)) valuesByCode.set(featCode, new Map());
      valuesByCode.get(featCode)!.set(tier, pf.value_fr ?? "");
    }

    // Construit FeatureRow[] depuis la BDD
    const features: FeatureRow[] = featRes.data.map((f) => {
      const vals = valuesByCode.get(f.code) ?? new Map<PlanTier, string>();
      const get = (tier: PlanTier): string | boolean => {
        const v = vals.get(tier);
        if (v === "true") return true;
        if (v === "false") return false;
        if (v === undefined || v === null || v === "") return false;
        return v;
      };
      return {
        id: f.code,
        category: f.category as FeatureRow["category"],
        label: f.label_fr,
        help: f.help_fr ?? undefined,
        free: get("free"),
        premium: get("premium"),
        max: get("max"),
        show_in_card: !!f.show_in_card,
      };
    });

    return { plans, features };
  } catch {
    return { plans, features: FALLBACK_FEATURES };
  }
}
