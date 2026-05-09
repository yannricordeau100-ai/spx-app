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
import { PLANS as FALLBACK_PLANS, type PlanDisplay, type PlanTier } from "./plans";
import type { Currency, Frequency } from "./admin-types";

export type LoadedPlan = PlanDisplay & {
  /** Prix par devise + fréquence. EUR/monthly utilisé en display par défaut. */
  prices: Record<string, { monthly?: number; annual?: number }>;
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
      return FALLBACK_PLANS.map((p) => ({ ...p, prices: defaultPricesForTier(p.tier) }));
    }

    const { data: prices } = await supabase.from("pricing_prices").select("*").eq("is_active", true);
    const pricesByPlan = new Map<string, Record<string, { monthly?: number; annual?: number }>>();
    for (const pr of prices ?? []) {
      if (!pricesByPlan.has(pr.plan_id)) pricesByPlan.set(pr.plan_id, {});
      const byCurrency = pricesByPlan.get(pr.plan_id)!;
      if (!byCurrency[pr.currency]) byCurrency[pr.currency] = {};
      byCurrency[pr.currency][pr.frequency as "monthly" | "annual"] = Number(pr.amount_decimal);
    }

    return plans.map((dbPlan): LoadedPlan => {
      const tier = dbPlan.code as PlanTier;
      const tierPrices = pricesByPlan.get(dbPlan.id) ?? {};
      const eurMonthly = tierPrices.EUR?.monthly ?? 0;
      const eurAnnual = tierPrices.EUR?.annual ?? 0;
      return {
        tier,
        name: dbPlan.name_fr ?? "",
        tagline: dbPlan.tagline_fr ?? "",
        price_monthly_eur: eurMonthly,
        price_annual_eur: eurAnnual,
        annual_savings_label:
          eurAnnual > 0 && eurMonthly > 0
            ? `Soit −${Math.round(((eurMonthly * 12 - eurAnnual) / (eurMonthly * 12)) * 100)} % vs mensuel`
            : "À vie, sans carte bancaire",
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
    return FALLBACK_PLANS.map((p) => ({ ...p, prices: defaultPricesForTier(p.tier) }));
  }
}

/** Prix par défaut (sourcés du plans.ts hardcoded) si BDD vide. */
function defaultPricesForTier(tier: PlanTier): Record<string, { monthly?: number; annual?: number }> {
  const fallback = FALLBACK_PLANS.find((p) => p.tier === tier);
  if (!fallback) return {};
  return {
    EUR: { monthly: fallback.price_monthly_eur, annual: fallback.price_annual_eur },
  };
}

/** Helper : prix display pour une devise donnée, avec fallback EUR si absent. */
export function priceFor(plan: LoadedPlan, currency: Currency, frequency: Frequency): number | null {
  const v = plan.prices[currency]?.[frequency];
  if (typeof v === "number") return v;
  // Fallback : EUR
  const eur = plan.prices.EUR?.[frequency];
  return typeof eur === "number" ? eur : null;
}
