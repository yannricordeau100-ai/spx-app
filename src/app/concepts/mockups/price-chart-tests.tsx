"use client";

/**
 * Mockup : tests de mini-charts du prix de l'action, placés près de
 * la barre header existante SANS modifier les éléments en place.
 *
 * 4 emplacements différents :
 *   v1 : Sparkline en background derrière le prix (très subtil)
 *   v2 : Mini sparkline juste sous le bloc header (full-width)
 *   v3 : Sparkline compacte à gauche de la variation %
 *   v4 : Sparkline en bandeau floating au-dessus du header
 *
 * Référence "Actuel" affichée en haut comme baseline.
 */

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Company } from "@/lib/data";
import { TICKER_ALIASES } from "@/lib/data";
import { brand } from "@/lib/brand";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";

const FAKE = {
  GOOGL: { price: 198.42, deltaPct: 0.93, shares: 12.4 },
  META: { price: 725.34, deltaPct: 0.95, shares: 2.55 },
  MSCI: { price: 587.21, deltaPct: -0.58, shares: 0.078 },
  SPGI: { price: 521.88, deltaPct: 0.41, shares: 0.308 },
  CAT: { price: 401.73, deltaPct: 1.42, shares: 0.48 },
} as const;

type LivePrice = { price: number; deltaPct: number; marketCap: number; marketState: string | null };
type ApiResp = {
  prices: Array<{ symbol: string; price: number | null; deltaPct: number | null; marketCap: number | null; marketState: string | null }>;
};

function useLivePrice(ticker: string): LivePrice {
  const seed = FAKE[ticker as keyof typeof FAKE] ?? FAKE.META;
  const [data, setData] = useState<LivePrice>({
    price: seed.price,
    deltaPct: seed.deltaPct,
    marketCap: seed.price * seed.shares,
    marketState: null,
  });
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`/api/stock-prices?symbols=${ticker}`, { cache: "no-store" });
        if (r.ok) {
          const d: ApiResp = await r.json();
          const item = d.prices?.[0];
          if (mounted && item && item.price != null) {
            setData({
              price: item.price,
              deltaPct: item.deltaPct ?? 0,
              marketCap: item.marketCap != null ? item.marketCap / 1_000_000_000 : 0,
              marketState: item.marketState,
            });
          }
        }
      } catch { /* fallback */ }
      timer = setTimeout(tick, 60_000);
    };
    tick();
    return () => { mounted = false; if (timer) clearTimeout(timer); };
  }, [ticker]);
  return data;
}

function fmtMarketCap(mc: number): string {
  return `${Math.round(mc).toLocaleString("fr-FR")} Mds $`;
}

const GREEN_PURE = "#22c55e";
const RED_PURE = "#ef4444";
const GREEN_LIGHT = "#bbf7d0";
const RED_LIGHT = "#fecaca";
const GREEN_LED = "#86ff5c";
const RED_LED = "#ff3355";

/* ─────────────────────────────────────────────────────────────────── */
/* Génère une fake intraday curve cohérente avec deltaPct              */
/* ─────────────────────────────────────────────────────────────────── */
function fakeIntraday(price: number, deltaPct: number, n = 28, seed = 1): number[] {
  // Reconstitue une marche aléatoire : start = price - delta, end = price.
  const start = price / (1 + deltaPct / 100);
  const out: number[] = [];
  let rnd = seed;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const trend = start + (price - start) * t;
    rnd = (rnd * 9301 + 49297) % 233280;
    const noise = ((rnd / 233280) - 0.5) * (Math.abs(price - start) * 0.6);
    out.push(trend + noise);
  }
  out[0] = start;
  out[n - 1] = price;
  return out;
}

/* Sparkline SVG path */
function sparklinePath(data: number[], W: number, H: number): string {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function sparklineAreaPath(data: number[], W: number, H: number): string {
  const line = sparklinePath(data, W, H);
  return `${line} L ${W} ${H} L 0 ${H} Z`;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Logo + Nom (copie isolée)                                            */
/* ─────────────────────────────────────────────────────────────────── */
function LogoTilt({ ticker }: { ticker: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, scale: 1 });
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -y * 18, y: x * 18, scale: 1.06 });
  };
  const onLeave = () => setTilt({ x: 0, y: 0, scale: 1 });
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`h-16 w-24 shrink-0 rounded-2xl border p-2 transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] sm:h-20 sm:w-28 ${
        logoNeedsLightBg(ticker) ? "border-[#e5e5e5] bg-[#fafafa]" : "border-[#1f1f1f] bg-[#0a0a0a]"
      }`}
      style={{
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.scale})`,
        transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms",
        transformStyle: "preserve-3d",
      }}
    >
      <CompanyLogo ticker={ticker} />
    </div>
  );
}

function CompanyName({ name, ticker, accent }: { name: string; ticker: string; accent: string }) {
  const aliases = Object.entries(TICKER_ALIASES).filter(([, target]) => target === ticker).map(([alias]) => alias);
  return (
    <div className="group/name inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="relative text-[2.1rem] font-bold tracking-tight text-zinc-50 sm:text-[2.6rem]" style={{ lineHeight: 1.05 }}>
        <span className="relative inline-block">
          {name}
          <span
            className="pointer-events-none absolute -bottom-1 left-0 h-[3px] w-0 rounded-full transition-[width] duration-500 ease-out group-hover/name:w-full"
            style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88, transparent)` }}
          />
        </span>
      </h1>
      <span className="font-mono text-lg font-semibold sm:text-xl" style={{ color: accent }}>
        {ticker}
        {aliases.length > 0 && <span className="ml-1 text-[0.75em] font-medium text-zinc-400">{" / "}{aliases.join(" / ")}</span>}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* StockPriceBlock paramétrable avec emplacement de chart              */
/* ─────────────────────────────────────────────────────────────────── */
type ChartPlacement = "v0-none" | "v1-bg" | "v2-below-bar" | "v3-left-of-delta" | "v4-floating-above";

function ConceptPriceBlockWithChart({ company, placement }: { company: Company; placement: ChartPlacement }) {
  const live = useLivePrice(company.ticker);
  const isUp = live.deltaPct >= 0;
  const tone = isUp ? GREEN_PURE : RED_PURE;
  const toneLight = isUp ? GREEN_LIGHT : RED_LIGHT;
  const ledColor = isUp ? GREEN_LED : RED_LED;
  const intraday = fakeIntraday(live.price, live.deltaPct, 28, company.ticker.charCodeAt(0));

  return (
    <div className="relative w-full sm:w-[520px] sm:shrink-0">
      {placement === "v4-floating-above" && (
        <div className="mb-2 h-8 w-full overflow-hidden rounded-lg border border-white/8 bg-[#080808]/80 px-2 py-1">
          <svg viewBox="0 0 500 24" preserveAspectRatio="none" className="h-full w-full">
            <path d={sparklineAreaPath(intraday, 500, 24)} fill={tone} fillOpacity="0.12" />
            <path d={sparklinePath(intraday, 500, 24)} fill="none" stroke={tone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div
        className="relative flex w-full items-center overflow-hidden rounded-xl px-5 py-3"
        style={{
          background: `linear-gradient(90deg, #0a0a0a 0%, ${tone}10 4%, ${tone}22 10%, ${tone}38 18%, ${tone}50 28%, ${tone}68 38%, ${tone}80 48%, ${tone}96 58%, ${tone}ac 68%, ${tone}c2 78%, ${tone}d8 88%, ${tone}ec 95%, ${tone} 100%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
          style={{ background: `radial-gradient(ellipse at right center, ${tone}66 0%, transparent 70%)` }}
        />

        {/* v1 : sparkline en background sous le prix entier */}
        {placement === "v1-bg" && (
          <svg
            viewBox="0 0 520 60"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 w-full opacity-50"
          >
            <path d={sparklineAreaPath(intraday, 520, 60)} fill="#fff" fillOpacity="0.08" />
            <path d={sparklinePath(intraday, 520, 60)} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" />
          </svg>
        )}

        {/* COL 1 — Capitalisation */}
        <div className="relative flex flex-col items-center justify-center border-r border-white/15 pr-4">
          <span className="text-center font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-100">
            Capitalisation
          </span>
          <span className="mt-1 text-center font-display text-[22px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums sm:text-[24px]">
            {fmtMarketCap(live.marketCap)}
          </span>
        </div>

        {/* COL 2 — (option v3) sparkline + variation %, ou variation seule */}
        <div className="relative flex flex-1 items-center justify-center gap-2 px-3">
          {placement === "v3-left-of-delta" && (
            <svg viewBox="0 0 60 28" className="h-6 w-12 shrink-0">
              <path d={sparklinePath(intraday, 60, 28)} fill="none" stroke={toneLight} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span
            className="font-display text-[24px] font-bold leading-none tabular-nums tracking-tight sm:text-[26px]"
            style={{ color: toneLight, textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
          >
            {isUp ? "+" : ""}{live.deltaPct.toFixed(2)} %
          </span>
        </div>

        {/* COL 3 — Prix */}
        <div className="relative shrink-0">
          <motion.span
            aria-hidden
            animate={{ opacity: [1, 0.55, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-1 -top-1 size-2.5 rounded-full"
            style={{
              background: ledColor,
              boxShadow: `0 0 4px ${ledColor}, 0 0 10px ${ledColor}, 0 0 18px ${ledColor}aa`,
            }}
          />
          <span
            className="block whitespace-nowrap text-[40px] leading-none tracking-[-0.02em] text-white tabular-nums sm:text-[46px]"
            style={{
              fontFamily: "var(--font-sora), ui-sans-serif, sans-serif",
              fontWeight: 200,
              textShadow: "0 2px 12px rgba(0,0,0,0.55)",
            }}
          >
            {live.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span
              className="ml-1.5 text-[20px] text-white/85 sm:text-[22px]"
              style={{ fontFamily: "var(--font-sora), ui-sans-serif, sans-serif", fontWeight: 300 }}
            >
              $
            </span>
          </span>
        </div>
      </div>

      {placement === "v2-below-bar" && (
        <div className="mt-1.5 h-9 w-full overflow-hidden rounded-lg border border-white/6 bg-[#080808]/60 px-2 py-1">
          <svg viewBox="0 0 500 28" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id={`pct-${company.ticker}-grad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tone} stopOpacity="0.45" />
                <stop offset="100%" stopColor={tone} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={sparklineAreaPath(intraday, 500, 28)} fill={`url(#pct-${company.ticker}-grad)`} />
            <path d={sparklinePath(intraday, 500, 28)} fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Header bar wrapper                                                   */
/* ─────────────────────────────────────────────────────────────────── */
function HeaderRow({ company, placement }: { company: Company; placement: ChartPlacement }) {
  const accent = brand(company.ticker).primary;
  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
      <LogoTilt ticker={company.ticker} />
      <div className="min-w-0 flex-1">
        <CompanyName name={company.name} ticker={company.ticker} accent={accent} />
        <div className="mt-1.5 text-[14px] text-zinc-400">
          {company.sector} <span className="text-zinc-700">·</span> {company.subsector}
        </div>
        <p className="mt-2 max-w-2xl text-[14.5px] italic leading-relaxed text-zinc-400">
          “{company.tagline}”
        </p>
      </div>
      <ConceptPriceBlockWithChart company={company} placement={placement} />
    </div>
  );
}

const TESTS: { key: ChartPlacement; label: string; note: string }[] = [
  { key: "v0-none",            label: "v0 · Référence (sans chart)",          note: "Bandeau actuel sans modification, pour comparaison." },
  { key: "v1-bg",              label: "v1 · Sparkline en background",          note: "Sparkline blanche translucide derrière le prix, dans le bandeau." },
  { key: "v2-below-bar",       label: "v2 · Sparkline juste sous le bandeau",  note: "Mini chart full-width avec area gradient, sous le bloc prix." },
  { key: "v3-left-of-delta",   label: "v3 · Sparkline à gauche de la variation", note: "Compact, intégré dans le bandeau, à côté du %." },
  { key: "v4-floating-above",  label: "v4 · Sparkline floating au-dessus",     note: "Mini bandeau séparé au-dessus du bloc prix." },
];

export function MockupPriceChartTests({ company }: { company: Company }) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-[20px] font-bold tracking-tight text-zinc-100">
          Tests de mini-chart du prix de l'action
        </h2>
        <p className="mt-1 text-[13px] text-zinc-400">
          5 emplacements pour intégrer une sparkline intraday près du prix, sans modifier les
          autres éléments du header. Données live (fallback FAKE).
        </p>
      </div>
      {TESTS.map((v) => (
        <div key={v.key}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300">{v.label}</span>
            <span className="text-[12px] text-zinc-500">{v.note}</span>
          </div>
          <HeaderRow company={company} placement={v.key} />
        </div>
      ))}
    </div>
  );
}
