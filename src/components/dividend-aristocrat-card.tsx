"use client";

import { Crown, TrendingUp } from "lucide-react";

/**
 * Card 1 du bloc Stories Dividendes : "Aristocrat Streak".
 * Met en scène les 3 piliers dividende de Caterpillar :
 *  - 31 ans de hausse consécutive (statut Dividend Aristocrat depuis 1993)
 *  - DPS et CAGR 5 ans
 *  - Capital Returned (dividendes + buybacks) + Payout Ratio
 *
 * Aucune dépendance data : valeurs CAT figées, à dériver V2 du fichier
 * dataset si on étend le bloc à d'autres sociétés.
 */
export function DividendAristocratCard({
  accent,
  glow,
  dps,
  dpsYoy,
  dpsHistory,
  capReturn,
  capReturnUnit,
  payoutRatio,
  yearsStreak = 31,
}: {
  accent: string;
  glow: string;
  dps: number;
  dpsYoy: string;
  dpsHistory: number[];
  capReturn: number;
  capReturnUnit: string;
  payoutRatio: number;
  yearsStreak?: number;
}) {
  // CAGR 5 ans DPS = (last/first)^(1/(n-1)) - 1
  const n = dpsHistory.length;
  const cagr =
    n >= 2
      ? (Math.pow(dpsHistory[n - 1] / dpsHistory[0], 1 / (n - 1)) - 1) * 100
      : 0;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-5 pt-12"
      style={{ boxShadow: `inset 0 0 120px ${glow}` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}55` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}33` }}
      />

      <div className="relative flex h-full flex-col">
        {/* Badge catégorie */}
        <div
          className="ml-auto inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] opacity-80"
          style={{ background: `${accent}14`, color: accent, borderColor: `${accent}40` }}
        >
          <Crown className="size-2.5" />
          Aristocrat
        </div>

        {/* Titre */}
        <div className="mt-3 text-[20px] font-bold leading-tight text-zinc-50">
          Dividend Aristocrat
        </div>
        <div className="text-[11.5px] italic text-zinc-400">
          Hausse continue depuis 1993
        </div>

        {/* Chiffre principal — années consécutives */}
        <div className="mt-5 mb-3 flex flex-col items-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text"
            style={{ fontSize: "clamp(72px, 22vw, 112px)" }}
          >
            {yearsStreak}
          </div>
          <div className="mt-1.5 text-[14px] font-medium text-zinc-200">
            années de hausse consécutive
          </div>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[13px] font-semibold text-emerald-200">
            <TrendingUp className="size-3.5" />
            <span className="font-mono tabular-nums">
              CAGR {cagr.toFixed(1)} % / an
            </span>
            <span className="text-[10.5px] italic text-zinc-400">(5 ans)</span>
          </div>
        </div>

        {/* Mini-blocs DPS / Cap Return / Payout */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/12 bg-black/45 p-2.5 backdrop-blur">
            <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.10em] text-zinc-300">
              DPS
            </div>
            <div className="mt-1 font-display text-[15px] font-bold leading-none tabular-nums text-zinc-50">
              {dps.toFixed(2)}
              <span className="ml-0.5 text-[10px] font-medium text-zinc-300">$</span>
            </div>
            <div className="mt-0.5 text-[9.5px] font-medium text-emerald-300">
              {dpsYoy}
            </div>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/45 p-2.5 backdrop-blur">
            <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.10em] text-zinc-300">
              Capital rendu
            </div>
            <div className="mt-1 font-display text-[15px] font-bold leading-none tabular-nums text-zinc-50">
              {capReturn.toFixed(1)}
              <span className="ml-0.5 text-[10px] font-medium text-zinc-300">
                {capReturnUnit === "$B" ? "Mds $" : capReturnUnit}
              </span>
            </div>
            <div className="mt-0.5 text-[9.5px] italic text-zinc-400">div + rachats</div>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/45 p-2.5 backdrop-blur">
            <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.10em] text-zinc-300">
              Payout
            </div>
            <div className="mt-1 font-display text-[15px] font-bold leading-none tabular-nums text-zinc-50">
              {payoutRatio}
              <span className="ml-0.5 text-[10px] font-medium text-zinc-300">%</span>
            </div>
            <div className="mt-0.5 text-[9.5px] italic text-zinc-400">
              couvert {(100 / payoutRatio).toFixed(1)}×
            </div>
          </div>
        </div>

        {/* Signal en bas */}
        <div className="mt-auto rounded-xl border border-white/10 bg-black/45 p-3 backdrop-blur">
          <div className="text-[13px] font-semibold leading-snug text-zinc-50">
            Politique de retour aux actionnaires constante
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-zinc-300">
            Objectif management : plus de 50 % du free cash flow ME&amp;T redistribué
            chaque année, marge de sécurité solide même en bas de cycle.
          </div>
        </div>
      </div>
    </div>
  );
}
