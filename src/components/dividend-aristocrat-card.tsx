"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Crown, TrendingUp } from "lucide-react";

/**
 * Card 1 du bloc Stories Dividendes : "Aristocrat Streak".
 *
 * Refonte 8 mai 2026 (Yann) :
 *  - "31 ans" en focal central qui s'agrandit au mount (effet "wow")
 *  - Mini-courbe SVG des 5 dernières valeurs DPS, animée au mount (le tracé
 *    se dessine de gauche à droite + dots qui apparaissent un par un)
 *  - NumberTicker sur les 3 mini-blocs DPS / Cap Return / Payout
 *  - Halo violet dynamique au hover (suit la souris)
 */

function NumberTicker({
  value,
  decimals = 0,
  suffix = "",
  duration = 1200,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-10%" });

  // CAGR 5 ans DPS
  const n = dpsHistory.length;
  const cagr =
    n >= 2
      ? (Math.pow(dpsHistory[n - 1] / dpsHistory[0], 1 / (n - 1)) - 1) * 100
      : 0;

  // Mini-courbe SVG : path normalisé + points
  const W = 280;
  const H = 56;
  const PAD = 6;
  const minV = Math.min(...dpsHistory);
  const maxV = Math.max(...dpsHistory);
  const range = maxV - minV || 1;
  const points = dpsHistory.map((v, i) => {
    const x = PAD + (i / (n - 1 || 1)) * (W - 2 * PAD);
    const y = H - PAD - ((v - minV) / range) * (H - 2 * PAD);
    return { x, y, v };
  });
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  // Halo qui suit la souris au hover
  const [halo, setHalo] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHalo({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setHalo(null)}
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
      {/* Halo dynamique qui suit la souris */}
      {halo && (
        <div
          aria-hidden
          className="pointer-events-none absolute size-48 rounded-full blur-3xl transition-opacity"
          style={{
            left: halo.x - 96,
            top: halo.y - 96,
            background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="relative flex h-full flex-col">
        {/* Badge catégorie en haut à droite */}
        <div
          className="ml-auto inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] opacity-90"
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
          Hausse continue depuis {2025 - yearsStreak + 1}
        </div>

        {/* Focal central : "31" qui grossit au mount, puis sous-titre */}
        <div className="mt-3 mb-2 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="font-display font-bold leading-none tracking-tight gradient-text"
            style={{ fontSize: "clamp(72px, 22vw, 120px)" }}
          >
            <NumberTicker value={yearsStreak} duration={1100} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-1 text-[14px] font-medium text-zinc-200"
          >
            années de hausse consécutive
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.9, duration: 0.4 }}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[13px] font-semibold text-emerald-200"
          >
            <TrendingUp className="size-3.5" />
            <span className="font-mono tabular-nums">
              CAGR <NumberTicker value={cagr} decimals={1} suffix=" % / an" duration={900} />
            </span>
            <span className="text-[10.5px] italic text-zinc-400">(5 ans)</span>
          </motion.div>
        </div>

        {/* Mini-courbe DPS history animée */}
        <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-2.5 backdrop-blur">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
              DPS · 5 dernières années
            </span>
            <span className="font-mono text-[9.5px] tabular-nums text-zinc-300">
              {dpsHistory[0].toFixed(2)} → {dpsHistory[n - 1].toFixed(2)} $
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <defs>
              <linearGradient id="dps-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
                <stop offset="100%" stopColor={accent} stopOpacity="1" />
              </linearGradient>
              <linearGradient id="dps-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Aire sous la courbe — clip animé */}
            <motion.path
              d={`${pathD} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`}
              fill="url(#dps-area)"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.7, duration: 0.6 }}
            />
            {/* Tracé qui se dessine */}
            <motion.path
              d={pathD}
              fill="none"
              stroke="url(#dps-grad)"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ delay: 0.5, duration: 1.1, ease: "easeOut" }}
            />
            {/* Dots */}
            {points.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill={i === n - 1 ? "#fff" : accent}
                stroke={accent}
                strokeWidth={1}
                initial={{ scale: 0, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{ delay: 0.7 + i * 0.12, duration: 0.3 }}
              />
            ))}
          </svg>
        </div>

        {/* Mini-blocs Cap Return / Payout (DPS déjà dans la courbe au-dessus) */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/12 bg-black/45 p-2.5 backdrop-blur">
            <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.10em] text-zinc-300">
              Capital rendu
            </div>
            <div className="mt-1 font-display text-[16px] font-bold leading-none tabular-nums text-zinc-50">
              <NumberTicker value={capReturn} decimals={1} duration={900} />
              <span className="ml-0.5 text-[11px] font-medium text-zinc-300">
                {capReturnUnit === "$B" ? "Mds $" : capReturnUnit}
              </span>
            </div>
            <div className="mt-0.5 text-[9.5px] italic text-zinc-400">div + rachats</div>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/45 p-2.5 backdrop-blur">
            <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.10em] text-zinc-300">
              Payout
            </div>
            <div className="mt-1 font-display text-[16px] font-bold leading-none tabular-nums text-zinc-50">
              <NumberTicker value={payoutRatio} decimals={0} duration={900} />
              <span className="ml-0.5 text-[11px] font-medium text-zinc-300">%</span>
            </div>
            <div className="mt-0.5 text-[9.5px] italic text-zinc-400">
              couvert {(100 / payoutRatio).toFixed(1)}×
            </div>
          </div>
        </div>

        {/* Tag YoY DPS — discret */}
        {dpsYoy && (
          <div className="mt-1.5 text-center text-[10px] italic text-zinc-500">
            DPS YoY <span className="font-mono not-italic text-emerald-300">{dpsYoy}</span>
          </div>
        )}
      </div>
    </div>
  );
}
