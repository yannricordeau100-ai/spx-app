"use client";

import { useMemo, useState } from "react";
import { Snowflake } from "lucide-react";

/**
 * Card 3 du bloc Stories Dividendes : "Boule de neige composée" (DRIP).
 *
 * Visualise l'effet de réinvestissement systématique des dividendes :
 *  - Capital initial X
 *  - Durée N années
 *  - Rendement total annuel attendu r (yield + appréciation cours)
 *
 *  Capital final = X * (1 + r)^N
 *  Revenu annuel à terme = capital final * yield actuel
 *
 * Visualisation : courbe SVG de croissance (snowball) avec marqueurs annuels.
 */

export function DividendSnowballCard({
  accent,
  glow,
  yieldPct,
}: {
  accent: string;
  glow: string;
  /** Yield dividende actuel (%) — sert au calcul revenu annuel terminal. */
  yieldPct: number;
}) {
  const [initial, setInitial] = useState<number>(1000);
  const [years, setYears] = useState<number>(20);
  const [totalReturn, setTotalReturn] = useState<number>(8); // % annuel total

  const series = useMemo(() => {
    const r = totalReturn / 100;
    const arr: { year: number; value: number }[] = [];
    for (let i = 0; i <= years; i++) {
      arr.push({ year: i, value: initial * Math.pow(1 + r, i) });
    }
    return arr;
  }, [initial, years, totalReturn]);

  const finalValue = series[series.length - 1].value;
  const finalIncome = (finalValue * yieldPct) / 100;
  const multiplier = finalValue / initial;

  // SVG dimensions
  const W = 320;
  const H = 80;
  const PAD = 4;
  const max = Math.max(...series.map((s) => s.value));
  const path = series
    .map((s, i) => {
      const x = PAD + (i / (series.length - 1)) * (W - 2 * PAD);
      const y = H - PAD - (s.value / max) * (H - 2 * PAD);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`;

  const fmtMoney = (n: number) =>
    n.toLocaleString("fr-FR", {
      maximumFractionDigits: n >= 1000 ? 0 : 1,
      minimumFractionDigits: 0,
    });

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
        <div
          className="ml-auto inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] opacity-80"
          style={{ background: `${accent}14`, color: accent, borderColor: `${accent}40` }}
        >
          <Snowflake className="size-2.5" />
          Boule de neige
        </div>

        <div className="mt-3 text-[18px] font-bold leading-tight text-zinc-50">
          Réinvestir tes dividendes (DRIP)
        </div>
        <div className="text-[11px] italic text-zinc-400">
          Effet boule de neige sur {years} ans
        </div>

        {/* Sortie principale — multiplicateur + capital final */}
        <div className="mt-3 flex flex-col items-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text tabular-nums"
            style={{ fontSize: "clamp(38px, 13vw, 56px)" }}
          >
            ×{multiplier.toFixed(1)}
          </div>
          <div className="mt-1 text-[12.5px] font-medium text-zinc-200">
            {fmtMoney(initial)} $ → {fmtMoney(finalValue)} $
          </div>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
            <span className="font-mono tabular-nums">
              + {fmtMoney(finalIncome)} $ / an
            </span>
            <span className="text-[9.5px] italic text-zinc-400">de revenu à terme</span>
          </div>
        </div>

        {/* Courbe snowball — SVG simple */}
        <div className="mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <defs>
              <linearGradient id="snow-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#snow-area)" />
            <path
              d={path}
              fill="none"
              stroke={accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Marqueur final */}
            <circle
              cx={W - PAD}
              cy={H - PAD - (finalValue / max) * (H - 2 * PAD)}
              r={4}
              fill={accent}
              stroke="#fff"
              strokeWidth={1.5}
            />
          </svg>
        </div>

        {/* Sliders — 3 inputs compacts */}
        <div className="mt-2 space-y-1.5 text-[11px]">
          <div className="rounded-lg border border-white/10 bg-black/30 p-1.5 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                Mise initiale
              </span>
              <span className="font-mono tabular-nums text-zinc-100">
                {fmtMoney(initial)} $
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={50000}
              step={100}
              value={initial}
              onChange={(e) => setInitial(Number(e.target.value))}
              className="mt-0.5 h-1 w-full cursor-pointer accent-[var(--accent-color)]"
              style={{ ["--accent-color" as string]: accent }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-white/10 bg-black/30 p-1.5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                  Durée
                </span>
                <span className="font-mono tabular-nums text-zinc-100">{years} ans</span>
              </div>
              <input
                type="range"
                min={5}
                max={40}
                step={1}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="mt-0.5 h-1 w-full cursor-pointer accent-[var(--accent-color)]"
                style={{ ["--accent-color" as string]: accent }}
              />
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-1.5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                  Rendement
                </span>
                <span className="font-mono tabular-nums text-zinc-100">
                  {totalReturn}% / an
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={15}
                step={0.5}
                value={totalReturn}
                onChange={(e) => setTotalReturn(Number(e.target.value))}
                className="mt-0.5 h-1 w-full cursor-pointer accent-[var(--accent-color)]"
                style={{ ["--accent-color" as string]: accent }}
              />
            </div>
          </div>
        </div>

        <div className="mt-2 text-[9.5px] italic leading-relaxed text-zinc-400">
          Hypothèse : tu réinvestis chaque dividende reçu. Le rendement combine
          yield + appréciation du cours, supposé stable. Indicatif.
        </div>
      </div>
    </div>
  );
}
