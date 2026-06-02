"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Circle } from "lucide-react";
import type { Company } from "@/lib/data";
import { brand } from "@/lib/brand";
import { CompanyLogo } from "@/components/logos";

/**
 * 3 propositions originales d'intégration du prix de l'action dans le bloc
 * société. Chaque variant rend un mini-hero complet (logo + nom + ticker +
 * tagline + placeholder KPI) afin que l'utilisateur projette le rendu final.
 *
 * Données stock simulées (plausibles, à câbler sur une vraie source plus tard).
 */

/**
 * shares = nombre d'actions en circulation (en milliards) — permet de
 * calculer la market cap = price × shares automatiquement raccord avec
 * la variation du prix.
 */
const FAKE = {
  GOOGL: { price: 198.42, delta: 1.83, deltaPct: 0.93, low: 195.1, high: 200.4, shares: 12.4 },
  META: { price: 725.34, delta: 6.82, deltaPct: 0.95, low: 718.1, high: 729.7, shares: 2.55 },
  MSCI: { price: 587.21, delta: -3.45, deltaPct: -0.58, low: 584.0, high: 593.8, shares: 0.078 },
  SPGI: { price: 521.88, delta: 2.14, deltaPct: 0.41, low: 517.5, high: 524.2, shares: 0.308 },
  CAT: { price: 401.73, delta: 5.61, deltaPct: 1.42, low: 395.2, high: 404.5, shares: 0.480 },
};

function getStockData(ticker: string) {
  const d = FAKE[ticker as keyof typeof FAKE] ?? FAKE.META;
  // Deterministic pseudo-random intraday sparkline (30 points)
  const spark: number[] = [];
  let v = d.low + (d.high - d.low) * 0.3;
  for (let i = 0; i < 30; i++) {
    const seed = ((ticker.charCodeAt(0) + i * 37) % 100) / 100;
    v += (seed - 0.5) * (d.high - d.low) * 0.18;
    v = Math.max(d.low, Math.min(d.high, v));
    spark.push(v);
  }
  spark[spark.length - 1] = d.price;
  // marketCap en Mds $ = prix × shares (en Mds)
  const marketCap = d.price * d.shares;
  return { ...d, spark, marketCap };
}

/** Format market cap : "2 461 Mds $", "46 Mds $", etc. (FR locale) */
function fmtMarketCap(mc: number): string {
  return `${Math.round(mc).toLocaleString("fr-FR")} Mds $`;
}

/**
 * Check si le marché US (NYSE / NASDAQ) est ouvert MAINTENANT.
 * Heures standard : Lundi-Vendredi 9:30 - 16:00 America/New_York.
 * Note : ne prend pas en compte les jours fériés US (Thanksgiving, July 4th,
 * Christmas, etc.). Pour le mode "encore plus simple" demandé.
 */
function isMarketOpen(): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const totalMin = hour * 60 + minute;
  return totalMin >= 9 * 60 + 30 && totalMin < 16 * 60;
}

/** Hook React qui suit l'état d'ouverture du marché (re-check chaque minute). */
function useMarketOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    setOpen(isMarketOpen());
    const id = setInterval(() => setOpen(isMarketOpen()), 60_000);
    return () => clearInterval(id);
  }, []);
  return open;
}

function MiniSpark({
  data,
  color,
  width = 80,
  height = 24,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const path = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height * 0.9 - height * 0.05;
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={(data.length - 1) * stepX} cy={height - ((data[data.length - 1] - min) / range) * height * 0.9 - height * 0.05} r="2" fill={color} />
    </svg>
  );
}

function MiniLogo({ ticker }: { ticker: string }) {
  return (
    <div className="size-12 shrink-0 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-1.5">
      <CompanyLogo ticker={ticker} />
    </div>
  );
}

function HeroPlaceholder({ accent }: { accent: string }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-[#1f1f1f] bg-[#0a0a0a]/50 p-5">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">
        Reste du bloc société (placeholder)
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold tabular-nums" style={{ color: accent }}>
          ###
        </span>
        <span className="text-zinc-500">Mds $</span>
      </div>
      <div className="mt-1 text-[12px] text-zinc-500">
        KPI principal · YoY · CAGR · Excellent · Top X% · etc.
      </div>
    </div>
  );
}

/* ============================================================ */
/* A — LIVE TICKER TAPE (bandeau horizontal type ticker premium)  */
/* ============================================================ */
export function StockPriceBlockA({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      {/* THE TAPE — full width across the top */}
      <div
        className="relative -mx-6 -mt-6 mb-5 flex items-center gap-5 overflow-hidden border-b px-6 py-4"
        style={{
          borderColor: `${tone}33`,
          background: `linear-gradient(90deg, ${tone}10 0%, transparent 50%, ${tone}08 100%)`,
        }}
      >
        {/* market state */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="size-1.5 rounded-full bg-emerald-400"
          />
          marché ouvert
        </span>

        {/* ticker */}
        <span className="font-mono text-[14px] font-bold tracking-wider" style={{ color: accent }}>
          {company.ticker}
        </span>

        {/* huge price + delta */}
        <div className="ml-auto flex items-baseline gap-3">
          <span
            className="font-mono text-[34px] font-bold tabular-nums leading-none text-zinc-50"
            style={{ textShadow: `0 0 20px ${tone}55` }}
          >
            {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="ml-1 text-base font-medium text-zinc-400">$</span>
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[13px] font-bold tabular-nums"
            style={{ background: `${tone}1f`, color: tone, border: `1px solid ${tone}55` }}
          >
            {isUp ? "+" : ""}
            {s.delta.toFixed(2)} ({isUp ? "+" : ""}
            {s.deltaPct.toFixed(2)} %)
          </span>
        </div>

        {/* sparkline */}
        <MiniSpark data={s.spark} color={tone} width={100} height={28} />

        {/* day range */}
        <div className="hidden font-mono text-[10.5px] text-zinc-400 lg:block">
          <div>jour bas {s.low.toFixed(2)}</div>
          <div>jour haut {s.high.toFixed(2)}</div>
        </div>
      </div>

      {/* Company header below the tape */}
      <div className="flex items-center gap-3">
        <MiniLogo ticker={company.ticker} />
        <div>
          <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
          <div className="text-[12px] text-zinc-400">
            {company.sector} · {company.subsector}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* B — FLOATING ORB (sphère lumineuse à côté du nom)              */
/* ============================================================ */
export function StockPriceBlockB({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      {/* Header row : logo + name + ORB on the right */}
      <div className="flex items-start gap-4">
        <MiniLogo ticker={company.ticker} />
        <div className="flex-1">
          <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
          <div className="text-[12px] text-zinc-400">
            {company.sector} · {company.subsector}
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>

        {/* THE ORB */}
        <div className="relative shrink-0">
          {/* halo */}
          <motion.div
            animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.75, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full blur-xl"
            style={{ background: tone }}
          />
          {/* orb body */}
          <div
            className="relative flex size-32 flex-col items-center justify-center rounded-full"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${tone}aa, ${tone}33 65%, #050505 100%)`,
              border: `1px solid ${tone}88`,
              boxShadow: `inset 0 4px 12px rgba(255,255,255,0.15), 0 0 24px ${tone}55`,
            }}
          >
            {/* highlight */}
            <div
              className="absolute left-3 top-3 size-8 rounded-full opacity-40 blur-sm"
              style={{ background: "white" }}
            />
            {/* market dot */}
            <span className="absolute right-3 top-3 size-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.9)]" />

            <span
              className="font-mono text-[26px] font-bold tabular-nums leading-none text-white"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
            >
              {s.price.toFixed(2)}
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wider text-white/70">$ usd</span>
            <span
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10.5px] font-semibold backdrop-blur"
              style={{ color: isUp ? "#bbf7d0" : "#fecaca" }}
            >
              {isUp ? "+" : ""}
              {s.deltaPct.toFixed(2)} %
            </span>
          </div>

          {/* mini-spark below orb */}
          <div className="mt-2 flex items-center justify-center">
            <MiniSpark data={s.spark} color={tone} width={110} height={20} />
          </div>
        </div>
      </div>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* D — GRADIENT BLEED (rectangle horizontal, dégradé bg→ton)      */
/* Inline price + delta sur la droite colorée, fade soft.         */
/* ============================================================ */
export function StockPriceBlockD({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      {/* GRADIENT BAR — pas de bord, fade depuis bg app vers ton */}
      <div
        className="relative -mx-6 -mt-6 mb-5 flex h-[72px] items-center px-6"
        style={{
          background: `linear-gradient(90deg, #0a0a0a 0%, #0a0a0a 30%, ${tone}aa 85%, ${tone} 100%)`,
        }}
      >
        {/* ticker (gauche, dim) */}
        <span className="font-mono text-[13px] font-bold tracking-wider text-zinc-500">
          {company.ticker}
        </span>

        {/* prix + delta (droite, blanc sur ton) */}
        <div className="ml-auto flex items-baseline gap-3">
          <span className="font-mono text-[32px] font-bold tabular-nums leading-none text-white">
            {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="ml-1 text-base font-medium text-white/80">$</span>
          </span>
          <span className="font-mono text-[14px] font-bold tabular-nums text-white">
            {isUp ? "+" : ""}
            {s.delta.toFixed(2)} ({isUp ? "+" : ""}
            {s.deltaPct.toFixed(2)} %)
          </span>
        </div>
      </div>

      {/* Company header */}
      <div className="flex items-center gap-3">
        <MiniLogo ticker={company.ticker} />
        <div>
          <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
          <div className="text-[12px] text-zinc-400">
            {company.sector} · {company.subsector}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* E — STACKED ON COLOR (prix empilé, delta en dessous)           */
/* Dégradé plus marqué, transition plus tôt, prix XL stacké.      */
/* ============================================================ */
export function StockPriceBlockE({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      {/* GRADIENT BAR — transition plus marquée, prix stacké à droite */}
      <div
        className="relative -mx-6 -mt-6 mb-5 flex h-[88px] items-center px-6"
        style={{
          background: `linear-gradient(90deg, #050505 0%, #050505 25%, ${tone}cc 70%, ${tone} 100%)`,
        }}
      >
        {/* libellé gauche (très dim) */}
        <div className="flex flex-col">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-zinc-600">
            cours
          </span>
          <span className="font-mono text-[12.5px] font-semibold text-zinc-400">
            {company.ticker} · NASDAQ
          </span>
        </div>

        {/* prix stack (droite) */}
        <div className="ml-auto flex flex-col items-end leading-none">
          <span className="font-mono text-[34px] font-bold tabular-nums text-white">
            {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-lg font-medium text-white/85">$</span>
          </span>
          <span className="mt-1.5 font-mono text-[13px] font-semibold tabular-nums text-white/95">
            {isUp ? "+" : ""}
            {s.delta.toFixed(2)} ({isUp ? "+" : ""}
            {s.deltaPct.toFixed(2)} %)
            <span className="ml-1.5 text-[10.5px] font-normal text-white/70">aujourd'hui</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <MiniLogo ticker={company.ticker} />
        <div>
          <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
          <div className="text-[12px] text-zinc-400">
            {company.sector} · {company.subsector}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* F : SOFT WASH inline (rectangle aligné à droite du header)     */
/* Variation = élément dominant, prix inline secondaire, marché   */
/* ouvert en coin haut-droit du rectangle.                        */
/* ============================================================ */
export function StockPriceBlockF({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      {/* HEADER ROW : société à gauche + rectangle gradient à droite */}
      <div className="flex items-stretch gap-5">
        {/* Société (gauche) */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">
                {company.sector} · {company.subsector}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>

        {/* Rectangle gradient (droite) */}
        <div
          className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{
            background: `linear-gradient(90deg, #0a0a0a 0%, ${tone}22 38%, ${tone}99 78%, ${tone} 100%)`,
          }}
        >
          {/* glow radial à droite */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{
              background: `radial-gradient(ellipse at right center, ${tone}55 0%, transparent 70%)`,
            }}
          />

          {/* GAUCHE : capitalisation boursière (le plus à gauche) + marché ouvert + variation */}
          <div className="relative flex items-stretch gap-4">
            {/* Capitalisation boursière (column la plus à gauche).
                Chiffre agrandi (24 px) pour rester dominant face au libellé
                FR plus long ("Capitalisation Boursière") qui prend plus de
                place horizontalement que l'ancien "market cap". */}
            <div className="flex flex-col justify-center border-r border-white/10 pr-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">
                Capitalisation Boursière
              </span>
              <span className="mt-1 font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
                {fmtMarketCap(s.marketCap)}
              </span>
            </div>

            {/* Marché ouvert + variation */}
            <div className="flex flex-col justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-300">
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.9)]"
                />
                marché ouvert
              </span>
              <span
                className="font-display text-[16px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: isUp ? "#86efac" : "#fca5a5" }}
              >
                {isUp ? "+" : ""}
                {s.deltaPct.toFixed(2)} %
              </span>
            </div>
          </div>

          {/* DROITE : prix très gros, font display Bricolage pour le branding */}
          <div className="relative ml-auto">
            <span
              className="font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}
            >
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* G (S7) — gradient ULTRA SMOOTH : transition très étalée,       */
/* jamais full tone à droite. Variation % réduite.                */
/* ============================================================ */
export function StockPriceBlockG({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      <div className="flex items-stretch gap-5">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">
                {company.sector} · {company.subsector}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>

        <div
          className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{
            background: `linear-gradient(90deg, #0a0a0a 0%, ${tone}11 30%, ${tone}44 70%, ${tone}99 100%)`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{
              background: `radial-gradient(ellipse at right center, ${tone}33 0%, transparent 70%)`,
            }}
          />

          <div className="relative flex items-stretch gap-4">
            <div className="flex flex-col justify-center border-r border-white/10 pr-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">
                Capitalisation Boursière
              </span>
              <span className="mt-1 font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
                {fmtMarketCap(s.marketCap)}
              </span>
            </div>

            <div className="flex flex-col justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-300">
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.9)]"
                />
                marché ouvert
              </span>
              <span
                className="font-display text-[12px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: isUp ? "#86efac" : "#fca5a5" }}
              >
                {isUp ? "+" : ""}
                {s.deltaPct.toFixed(2)} %
              </span>
            </div>
          </div>

          <div className="relative ml-auto">
            <span
              className="font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}
            >
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* H (S8) — gradient SHARP CUT : reste neutre 55% puis coupe      */
/* nette vers le tone. Variation % réduite.                       */
/* ============================================================ */
export function StockPriceBlockH({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      <div className="flex items-stretch gap-5">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">
                {company.sector} · {company.subsector}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>

        <div
          className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{
            background: `linear-gradient(90deg, #0a0a0a 0%, #0a0a0a 50%, ${tone}66 70%, ${tone} 100%)`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{
              background: `radial-gradient(ellipse at right center, ${tone}55 0%, transparent 70%)`,
            }}
          />

          <div className="relative flex items-stretch gap-4">
            <div className="flex flex-col justify-center border-r border-white/10 pr-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">
                Capitalisation Boursière
              </span>
              <span className="mt-1 font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
                {fmtMarketCap(s.marketCap)}
              </span>
            </div>

            <div className="flex flex-col justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-300">
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.9)]"
                />
                marché ouvert
              </span>
              <span
                className="font-display text-[12px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: isUp ? "#86efac" : "#fca5a5" }}
              >
                {isUp ? "+" : ""}
                {s.deltaPct.toFixed(2)} %
              </span>
            </div>
          </div>

          <div className="relative ml-auto">
            <span
              className="font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}
            >
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* I (S9) — gradient ACCENT (couleur société) très progressif,    */
/* mini gradient accent→tone sur le séparateur, dot marché        */
/* fonctionnel top-right (NYSE hours US-ET).                      */
/* Capitalisation Boursière centrée comme dans le real           */
/* StockPriceBlock.                                                */
/* ============================================================ */
export function StockPriceBlockI({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#22c55e" : "#ef4444";
  const marketOpen = useMarketOpen();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      <div className="flex items-stretch gap-5">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">
                {company.sector} · {company.subsector}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>

        {/* Rectangle gradient — couleur de marque, transition très progressive */}
        <div
          className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{
            background: `linear-gradient(90deg, #0a0a0a 0%, ${accent}0d 6%, ${accent}1f 14%, ${accent}33 25%, ${accent}4d 38%, ${accent}66 52%, ${accent}80 66%, ${accent}99 80%, ${accent}b3 92%, ${accent} 100%)`,
          }}
        >
          {/* Glow radial discret à droite */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{
              background: `radial-gradient(ellipse at right center, ${accent}44 0%, transparent 70%)`,
            }}
          />

          {/* DOT MARCHÉ OUVERT/FERMÉ — top-right, fonctionnel, hover tooltip */}
          <div className="group absolute right-2 top-2 z-10">
            <motion.span
              aria-hidden
              animate={marketOpen ? { opacity: [1, 0.5, 1] } : undefined}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="block size-2 rounded-full"
              style={{
                background: marketOpen === false ? "#ef4444" : "#22c55e",
                boxShadow:
                  marketOpen === false
                    ? "0 0 4px #ef4444, 0 0 10px #ef4444aa"
                    : "0 0 4px #22c55e, 0 0 10px #22c55eaa",
              }}
            />
            <div className="pointer-events-none invisible absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-md border border-white/15 bg-black/85 px-2 py-1 font-mono text-[10px] text-zinc-100 backdrop-blur group-hover:visible">
              {marketOpen === null
                ? "Vérification…"
                : marketOpen
                ? "Marché ouvert (NYSE)"
                : "Marché fermé (NYSE)"}
            </div>
          </div>

          {/* COL 1 — Capitalisation Boursière CENTRÉE (label + valeur) */}
          <div className="relative flex flex-col items-center justify-center pr-3">
            <span className="text-center font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-100">
              Capitalisation Boursière
            </span>
            <span className="mt-1 text-center font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
              {fmtMarketCap(s.marketCap)}
            </span>
          </div>

          {/* SÉPARATEUR vertical — mini dégradé accent (gauche) → tone (droite) */}
          <div
            aria-hidden
            className="relative h-12 w-[3px] shrink-0 self-center rounded-full"
            style={{
              background: `linear-gradient(90deg, ${accent} 0%, ${tone} 100%)`,
              boxShadow: `0 0 6px ${tone}66`,
            }}
          />

          {/* COL 2 — Variation % petite + Prix grand */}
          <div className="relative ml-auto flex flex-col items-end">
            <span
              className="font-display text-[10px] font-bold leading-none tabular-nums tracking-tight"
              style={{
                color: isUp ? "#bbf7d0" : "#fecaca",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {isUp ? "+" : ""}
              {s.deltaPct.toFixed(2)} %
            </span>
            <span
              className="mt-1 font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}
            >
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* J (S10) — gradient DIAGONAL 135deg : du coin haut-gauche       */
/* sombre vers le coin bas-droit tone. Variation % réduite.       */
/* ============================================================ */
export function StockPriceBlockJ({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      <div className="flex items-stretch gap-5">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">
                {company.sector} · {company.subsector}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>

        <div
          className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{
            background: `linear-gradient(135deg, #0a0a0a 0%, ${tone}33 50%, ${tone} 100%)`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{
              background: `radial-gradient(ellipse at right center, ${tone}55 0%, transparent 70%)`,
            }}
          />

          <div className="relative flex items-stretch gap-4">
            <div className="flex flex-col justify-center border-r border-white/10 pr-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">
                Capitalisation Boursière
              </span>
              <span className="mt-1 font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
                {fmtMarketCap(s.marketCap)}
              </span>
            </div>

            <div className="flex flex-col justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-300">
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.9)]"
                />
                marché ouvert
              </span>
              <span
                className="font-display text-[12px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: isUp ? "#86efac" : "#fca5a5" }}
              >
                {isUp ? "+" : ""}
                {s.deltaPct.toFixed(2)} %
              </span>
            </div>
          </div>

          <div className="relative ml-auto">
            <span
              className="font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}
            >
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* K (S11) — gradient ULTRA SPREAD : démarre à 10%, 5 stops,      */
/* finit à ~88% opacité (jamais full tone). Variation % 10px.     */
/* ============================================================ */
export function StockPriceBlockK({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      <div className="flex items-stretch gap-5">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">{company.sector} · {company.subsector}</div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>
        <div className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{ background: `linear-gradient(90deg, #0a0a0a 0%, ${tone}0a 10%, ${tone}22 30%, ${tone}44 55%, ${tone}66 80%, ${tone}88 100%)` }}>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{ background: `radial-gradient(ellipse at right center, ${tone}33 0%, transparent 70%)` }} />
          <div className="relative flex items-stretch gap-4">
            <div className="flex flex-col justify-center border-r border-white/10 pr-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">Capitalisation Boursière</span>
              <span className="mt-1 font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">{fmtMarketCap(s.marketCap)}</span>
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-300">
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.9)]" />
                marché ouvert
              </span>
              <span className="font-display text-[10px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: isUp ? "#86efac" : "#fca5a5" }}>
                {isUp ? "+" : ""}{s.deltaPct.toFixed(2)} %
              </span>
            </div>
          </div>
          <div className="relative ml-auto">
            <span className="font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}>
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>
      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* L (S12) — gradient WHISPER : très subtil, jamais au-dessus    */
/* de ~50% opacité. Variation % 10px.                            */
/* ============================================================ */
export function StockPriceBlockL({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      <div className="flex items-stretch gap-5">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">{company.sector} · {company.subsector}</div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>
        <div className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{ background: `linear-gradient(90deg, #0a0a0a 0%, ${tone}08 25%, ${tone}1f 55%, ${tone}33 80%, ${tone}55 100%)` }}>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{ background: `radial-gradient(ellipse at right center, ${tone}1a 0%, transparent 70%)` }} />
          <div className="relative flex items-stretch gap-4">
            <div className="flex flex-col justify-center border-r border-white/10 pr-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">Capitalisation Boursière</span>
              <span className="mt-1 font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">{fmtMarketCap(s.marketCap)}</span>
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-300">
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.9)]" />
                marché ouvert
              </span>
              <span className="font-display text-[10px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: isUp ? "#86efac" : "#fca5a5" }}>
                {isUp ? "+" : ""}{s.deltaPct.toFixed(2)} %
              </span>
            </div>
          </div>
          <div className="relative ml-auto">
            <span className="font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}>
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>
      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* M (S13) — gradient CONTINUOUS FLOW : 7 stops pour transition  */
/* ultra-smooth. Variation % 10px.                                */
/* ============================================================ */
export function StockPriceBlockM({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      <div className="flex items-stretch gap-5">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">{company.sector} · {company.subsector}</div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>
        <div className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{ background: `linear-gradient(90deg, #0a0a0a 0%, ${tone}05 8%, ${tone}11 22%, ${tone}1f 38%, ${tone}33 55%, ${tone}55 75%, ${tone}77 90%, ${tone} 100%)` }}>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{ background: `radial-gradient(ellipse at right center, ${tone}55 0%, transparent 70%)` }} />
          <div className="relative flex items-stretch gap-4">
            <div className="flex flex-col justify-center border-r border-white/10 pr-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">Capitalisation Boursière</span>
              <span className="mt-1 font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">{fmtMarketCap(s.marketCap)}</span>
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-300">
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.9)]" />
                marché ouvert
              </span>
              <span className="font-display text-[10px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: isUp ? "#86efac" : "#fca5a5" }}>
                {isUp ? "+" : ""}{s.deltaPct.toFixed(2)} %
              </span>
            </div>
          </div>
          <div className="relative ml-auto">
            <span className="font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}>
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>
      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* N (S14) — gradient SLOW BUILD : tone très léger dès 0%, monte */
/* en pente régulière jusqu'à ~80%. Variation % 10px.            */
/* ============================================================ */
export function StockPriceBlockN({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      <div className="flex items-stretch gap-5">
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3">
            <MiniLogo ticker={company.ticker} />
            <div>
              <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
              <div className="text-[12px] text-zinc-400">{company.sector} · {company.subsector}</div>
            </div>
          </div>
          <p className="mt-2 text-[13px] italic text-zinc-400">"{company.tagline}"</p>
        </div>
        <div className="relative flex w-[520px] shrink-0 items-center overflow-hidden rounded-xl px-5 py-3"
          style={{ background: `linear-gradient(90deg, ${tone}05 0%, ${tone}15 25%, ${tone}30 50%, ${tone}50 75%, ${tone}77 100%)` }}>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{ background: `radial-gradient(ellipse at right center, ${tone}33 0%, transparent 70%)` }} />
          <div className="relative flex items-stretch gap-4">
            <div className="flex flex-col justify-center border-r border-white/10 pr-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">Capitalisation Boursière</span>
              <span className="mt-1 font-display text-[24px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">{fmtMarketCap(s.marketCap)}</span>
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-300">
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,231,183,0.9)]" />
                marché ouvert
              </span>
              <span className="font-display text-[10px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: isUp ? "#86efac" : "#fca5a5" }}>
                {isUp ? "+" : ""}{s.deltaPct.toFixed(2)} %
              </span>
            </div>
          </div>
          <div className="relative ml-auto">
            <span className="font-display text-[48px] font-bold leading-none tracking-tight text-white tabular-nums"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}>
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1.5 font-display text-[24px] font-semibold text-white/85">$</span>
            </span>
          </div>
        </div>
      </div>
      <HeroPlaceholder accent={accent} />
    </div>
  );
}

/* ============================================================ */
/* C — EMBEDDED CARD (carte premium top-right, "Bloomberg-cleaned")*/
/* ============================================================ */
export function StockPriceBlockC({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const s = getStockData(company.ticker);
  const isUp = s.delta >= 0;
  const tone = isUp ? "#10b981" : "#f43f5e";
  const range = s.high - s.low || 1;
  const cursorPct = ((s.price - s.low) / range) * 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6">
      {/* Header row : company info + STOCK CARD top-right */}
      <div className="flex items-start gap-4">
        <MiniLogo ticker={company.ticker} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[20px] font-bold text-zinc-50">{company.name}</h3>
          <div className="text-[12px] text-zinc-400">
            {company.sector} · {company.subsector}
          </div>
          <p className="mt-2 max-w-[60ch] text-[13px] italic text-zinc-400">
            "{company.tagline}"
          </p>
        </div>

        {/* THE EMBEDDED STOCK CARD */}
        <div
          className="relative w-[240px] shrink-0 overflow-hidden rounded-xl border bg-gradient-to-b p-4"
          style={{
            borderColor: `${tone}40`,
            background: `linear-gradient(180deg, ${tone}0c 0%, #0a0a0a 100%)`,
            boxShadow: `0 8px 24px -8px ${tone}33`,
          }}
        >
          {/* Top row : market state + ticker */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
              <Circle className="size-1.5 fill-emerald-400 text-emerald-400" />
              ouvert
            </span>
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider" style={{ color: accent }}>
              {company.ticker}
            </span>
          </div>

          {/* Price */}
          <div className="mt-2.5 flex items-baseline gap-1">
            <span
              className="font-mono text-[28px] font-bold tabular-nums leading-none text-zinc-50"
            >
              {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[13px] font-medium text-zinc-400">$</span>
          </div>

          {/* Delta */}
          <div
            className="mt-1 inline-flex items-center gap-1 font-mono text-[12.5px] font-bold tabular-nums"
            style={{ color: tone }}
          >
            <ArrowUpRight className={`size-3.5 ${isUp ? "" : "rotate-90"}`} />
            {isUp ? "+" : ""}
            {s.delta.toFixed(2)} ({isUp ? "+" : ""}
            {s.deltaPct.toFixed(2)} %)
            <span className="ml-1 text-[10px] font-normal text-zinc-400">aujourd'hui</span>
          </div>

          {/* Sparkline */}
          <div className="mt-3 flex items-center justify-center">
            <MiniSpark data={s.spark} color={tone} width={210} height={28} />
          </div>

          {/* Day range bar */}
          <div className="mt-3">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: "100%",
                  background: `linear-gradient(90deg, ${tone}33, ${tone}88, ${tone}33)`,
                }}
              />
              <div
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.7)]"
                style={{ left: `${cursorPct}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] tabular-nums text-zinc-400">
              <span>{s.low.toFixed(2)}</span>
              <span className="text-zinc-500">jour</span>
              <span>{s.high.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <HeroPlaceholder accent={accent} />
    </div>
  );
}
