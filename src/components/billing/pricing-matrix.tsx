import { Check, Lock, Info } from "lucide-react";
import { FEATURES, PLANS, type FeatureRow, type PlanTier } from "@/lib/billing/plans";

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

function FeatureCellGroup({ feature }: { feature: FeatureRow }) {
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
      {(["free", "investisseur", "pro_plus"] as const).map((tier) => {
        const plan = PLANS.find((p) => p.tier === tier)!;
        return (
          <div key={tier}>{renderCell(feature[tier], plan.accent)}</div>
        );
      })}
    </div>
  );
}

export function PricingMatrix() {
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
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">Fonctionnalité</div>
        {PLANS.map((p) => (
          <div key={p.tier} className="text-center">
            <div className="font-display text-[14px] font-bold tracking-tight text-zinc-100">{p.name}</div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: p.accent }}>
              {p.price_monthly_eur === 0 ? "Gratuit" : `${p.price_monthly_eur.toFixed(2).replace(".", ",")} €/mois`}
            </div>
          </div>
        ))}
      </div>

      {Object.entries(byCategory).map(([category, rows]) => (
        <div key={category} className="mt-3">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{category}</div>
          {rows.map((f) => (
            <FeatureCellGroup key={f.id} feature={f} />
          ))}
        </div>
      ))}
    </div>
  );
}
