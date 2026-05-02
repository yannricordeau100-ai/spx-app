"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

type Plan = {
  id: string;
  label: string;
  price_eur_month?: number | null;
  price_eur_year?: number | null;
  price_chf_month?: number | null;
  price_chf_year?: number | null;
  price_usd_month?: number | null;
  price_usd_year?: number | null;
  features: readonly string[];
  discount_pct?: number;
};

export function BillingTestClient({ plan }: { plan: Plan }) {
  const [loading, setLoading] = useState(false);
  const [priceId, setPriceId] = useState("");
  const isFree = plan.price_eur_month === 0 && !plan.price_eur_year;
  const isCustom = plan.price_eur_month === null;

  async function startCheckout() {
    if (!priceId) {
      alert("Colle d'abord le Stripe Price ID (price_...) à tester.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await r.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(`Erreur : ${data.error ?? "checkout failed"}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const isHighlight = plan.id === "premium_yearly";

  return (
    <div className={`rounded-2xl border p-5 ${isHighlight ? "border-violet-500/40 bg-violet-500/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[18px] font-bold text-zinc-50">{plan.label}</h3>
        {plan.discount_pct && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
            -{plan.discount_pct}%
          </span>
        )}
      </div>

      <div className="mt-3">
        {isFree && (
          <div className="font-display text-[28px] font-bold text-zinc-50">Gratuit</div>
        )}
        {isCustom && (
          <div className="font-display text-[18px] font-medium text-zinc-300">Sur devis</div>
        )}
        {!isFree && !isCustom && (
          <>
            <div className="font-display text-[28px] font-bold tabular-nums text-zinc-50">
              {plan.price_eur_month ? `${plan.price_eur_month.toFixed(2).replace(".", ",")} € / mois` :
               plan.price_eur_year ? `${plan.price_eur_year} € / an` : ""}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              CHF : {plan.price_chf_month ?? plan.price_chf_year} · USD : {plan.price_usd_month ?? plan.price_usd_year}
            </div>
          </>
        )}
      </div>

      <ul className="mt-4 space-y-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12.5px] text-zinc-300">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {!isFree && !isCustom && (
        <div className="mt-4 space-y-2">
          <input
            placeholder="Stripe Price ID (price_...)"
            value={priceId}
            onChange={(e) => setPriceId(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 font-mono text-[11px] text-zinc-100 placeholder-zinc-500 outline-none"
          />
          <button
            onClick={startCheckout}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-[12.5px] font-medium text-violet-100 transition-colors hover:border-violet-500/60 hover:bg-violet-500/25 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Tester le checkout
          </button>
        </div>
      )}

      {isFree && (
        <div className="mt-4 text-[11px] text-zinc-500">Plan par défaut. Aucun checkout.</div>
      )}
      {isCustom && (
        <div className="mt-4 text-[11px] text-zinc-500">Contact direct, pas de checkout Stripe.</div>
      )}
    </div>
  );
}
