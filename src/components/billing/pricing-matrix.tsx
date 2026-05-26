"use client";

import { Check, Lock, Info } from "lucide-react";
import { FEATURES as FALLBACK_FEATURES, PLANS as FALLBACK_PLANS, type FeatureRow, type PlanDisplay, type PlanTier } from "@/lib/billing/plans";
import type { LoadedPlan } from "@/lib/billing/load-pricing";
import { useT } from "@/lib/i18n/provider";

/** Plan accepté : PlanDisplay legacy ou LoadedPlan BDD avec prices map. */
type MatrixPlan = PlanDisplay & Partial<Pick<LoadedPlan, "code" | "prices">>;

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  SEK: "kr",
  DKK: "kr",
  CAD: "$",
};

/**
 * Matrice features × plans pour la page tarifs.
 *
 * Version simple et lisible : groupe les features par catégorie, affiche
 * `Check` pour booléen true, texte pour string, `Lock` pour false.
 *
 * Pas de hover state interactif : Yann veut une page qui charge bien sur
 * mobile et qui passe le ciseau d'un investisseur en 30 secondes.
 */
function renderCell(value: string | boolean, accent: string) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <Check className="size-4" style={{ color: accent }} strokeWidth={2.5} />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <Lock className="size-3.5 text-zinc-600" />
      </div>
    );
  }
  return (
    <div className="text-center text-[12px] text-zinc-300">{value}</div>
  );
}

function FeatureCellGroup({ feature, plans }: { feature: FeatureRow; plans: PlanDisplay[] }) {
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-3 border-b border-white/[0.04] py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-zinc-200">{feature.label}</span>
        {feature.help && (
          <span className="group/h relative">
            <Info className="size-3 cursor-help text-zinc-600" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden w-56 -translate-x-1/2 rounded-md border border-white/10 bg-[#0a0a0a] p-2 text-[11px] leading-relaxed text-zinc-300 shadow-xl group-hover/h:block">
              {feature.help}
            </span>
          </span>
        )}
      </div>
      {(["free", "premium", "max"] as const).map((tier) => {
        const plan = plans.find((p) => p.tier === tier);
        return (
          <div key={tier}>{renderCell(feature[tier], plan?.accent ?? "#a78bfa")}</div>
        );
      })}
    </div>
  );
}

export function PricingMatrix({
  plans: plansProp,
  features: featuresProp,
  currency = "EUR",
}: {
  /** Plans depuis la BDD via loadPricingCatalog. Fallback hardcoded si absent. */
  plans?: MatrixPlan[];
  features?: FeatureRow[];
  /** Yann 26 mai 2026 : devise unifiée page entière. Fix Bug 3 (matrix
   *  affichait toujours EUR même quand le picker était sur USD). */
  currency?: string;
} = {}) {
  const { t } = useT();
  const PLANS: MatrixPlan[] = plansProp && plansProp.length > 0 ? plansProp : FALLBACK_PLANS;
  const FEATURES = featuresProp && featuresProp.length > 0 ? featuresProp : FALLBACK_FEATURES;
  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? currency;

  // Group features by category
  const byCategory = FEATURES.reduce<Record<string, FeatureRow[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      {/* Header colonnes */}
      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 border-b border-white/[0.08] pb-3">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">{t("pricing.matrix.feature_col")}</div>
        {PLANS.map((p) => {
          // Yann 26 mai 2026 : lit le prix dans la devise courante depuis
          // p.prices (BDD avec auto-conversion), fallback sur le legacy
          // price_*_eur si pas de BDD.
          const currencyMonthly = p.prices?.[currency]?.monthly?.amount;
          const currencyAnnual = p.prices?.[currency]?.annual?.amount;
          const monthly = (currencyMonthly && currencyMonthly > 0)
            ? currencyMonthly
            : p.price_monthly_eur;
          const annual = (currencyAnnual && currencyAnnual > 0)
            ? currencyAnnual
            : p.price_annual_eur;
          const sym = (currencyMonthly && currencyMonthly > 0) || (currencyAnnual && currencyAnnual > 0)
            ? currencySymbol
            : "€"; // pas de prix dans la devise → fallback EUR
          return (
            <div key={p.tier} className="text-center">
              <div className="font-display text-[14px] font-bold tracking-tight text-zinc-100">{p.name}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: p.accent }}>
                {annual === 0
                  ? monthly === 0
                    ? t("pricing.matrix.free")
                    : `${monthly.toFixed(2).replace(".", ",")} ${sym}${t("pricing.unit.per_month")}`
                  : `${(annual / 12).toFixed(2).replace(".", ",")} ${sym}${t("pricing.unit.per_month")}`}
              </div>
              {annual > 0 && (
                <div className="mt-0.5 text-[9.5px] text-zinc-500">
                  {t("pricing.matrix.billed_annually_short")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.entries(byCategory).map(([category, rows]) => (
        <div key={category} className="mt-3">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{category}</div>
          {rows.map((f) => (
            <FeatureCellGroup key={f.id} feature={f} plans={PLANS} />
          ))}
        </div>
      ))}
    </div>
  );
}
