"use client";

/**
 * Mockup : barre header complète (logo + nom + capitalisation + variation +
 * prix avec barre rouge/verte) avec plusieurs tailles de la variation %.
 *
 * Référence "Actuel" reproduite à l'identique du live, puis 3 versions
 * avec variation % progressivement réduite. Aucune modif côté live tant
 * que pas validé.
 */

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Company } from "@/lib/data";
import { TICKER_ALIASES } from "@/lib/data";
import { brand } from "@/lib/brand";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";

/* ─────────────────────────────────────────────────────────────────── */
/* Live price hook (copie isolée pour ne pas couplé au live)            */
/* ─────────────────────────────────────────────────────────────────── */
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
/* Variations supportées de la taille du % variation                   */
/* ─────────────────────────────────────────────────────────────────── */
type DeltaSize = "v0-original" | "v1-soft" | "v2-medium" | "v3-subtle";

const DELTA_STYLE: Record<
  DeltaSize,
  { fontSize: string; smFontSize: string; fontWeight: number; opacity: number }
> = {
  "v0-original": { fontSize: "24px", smFontSize: "26px", fontWeight: 700, opacity: 1 },
  "v1-soft":     { fontSize: "20px", smFontSize: "22px", fontWeight: 600, opacity: 1 },
  "v2-medium":   { fontSize: "17px", smFontSize: "18px", fontWeight: 600, opacity: 0.95 },
  "v3-subtle":   { fontSize: "14px", smFontSize: "15px", fontWeight: 500, opacity: 0.85 },
};

function ConceptStockPriceBlock({ company, deltaSize }: { company: Company; deltaSize: DeltaSize }) {
  const live = useLivePrice(company.ticker);
  const isUp = live.deltaPct >= 0;
  const tone = isUp ? GREEN_PURE : RED_PURE;
  const toneLight = isUp ? GREEN_LIGHT : RED_LIGHT;
  const ledColor = isUp ? GREEN_LED : RED_LED;
  const dStyle = DELTA_STYLE[deltaSize];

  return (
    <div
      className="relative flex w-full items-center overflow-hidden rounded-xl px-5 py-3 sm:w-[520px] sm:shrink-0"
      style={{
        background: `linear-gradient(90deg, #0a0a0a 0%, ${tone}10 4%, ${tone}22 10%, ${tone}38 18%, ${tone}50 28%, ${tone}68 38%, ${tone}80 48%, ${tone}96 58%, ${tone}ac 68%, ${tone}c2 78%, ${tone}d8 88%, ${tone}ec 95%, ${tone} 100%)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{ background: `radial-gradient(ellipse at right center, ${tone}66 0%, transparent 70%)` }}
      />
      {/* COL 1 — Capitalisation */}
      <div className="relative flex flex-col items-center justify-center border-r border-white/15 pr-4">
        <span className="text-center font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-100">
          Capitalisation
        </span>
        <span className="mt-1 text-center font-display text-[22px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums sm:text-[24px]">
          {fmtMarketCap(live.marketCap)}
        </span>
      </div>
      {/* COL 2 — Variation % (taille paramétrée) */}
      <div className="relative flex flex-1 items-center justify-center px-3">
        <span
          className="font-display leading-none tabular-nums tracking-tight"
          style={{
            color: toneLight,
            textShadow: "0 1px 6px rgba(0,0,0,0.35)",
            fontSize: dStyle.fontSize,
            fontWeight: dStyle.fontWeight,
            opacity: dStyle.opacity,
          }}
        >
          {isUp ? "+" : ""}{live.deltaPct.toFixed(2)} %
        </span>
      </div>
      {/* COL 3 — Prix avec LED */}
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
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Logo + Nom (copie isolée du live)                                    */
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
/* Header bar version (logo + nom + barre)                             */
/* ─────────────────────────────────────────────────────────────────── */
function ConceptCompanyHeader({ company, deltaSize }: { company: Company; deltaSize: DeltaSize }) {
  const accent = brand(company.ticker).primary;
  return (
    <div>
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
        <ConceptStockPriceBlock company={company} deltaSize={deltaSize} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Mockup principal — 4 versions empilées avec labels                  */
/* ─────────────────────────────────────────────────────────────────── */
const VERSIONS: { key: DeltaSize; label: string; note: string }[] = [
  { key: "v0-original", label: "v0 · Actuel (live)",   note: "Référence : variation 24/26 px, font-bold, opacity 100 %." },
  { key: "v1-soft",     label: "v1 · Légère réduction", note: "20/22 px, font-semibold. Moins agressif sans perdre la lecture." },
  { key: "v2-medium",   label: "v2 · Réduction marquée", note: "17/18 px, font-semibold, opacity 95 %. Hiérarchie claire avec le prix." },
  { key: "v3-subtle",   label: "v3 · Subtile",          note: "14/15 px, font-medium, opacity 85 %. Le prix devient le focus principal." },
];

export function MockupHeaderBarRedesign({ company }: { company: Company }) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-[20px] font-bold tracking-tight text-zinc-100">
          Barre header : réduction de la variation %
        </h2>
        <p className="mt-1 text-[13px] text-zinc-400">
          Copie de la barre header live (logo + nom + capitalisation + variation + prix). 4 versions
          avec progression de réduction de la taille du « %&nbsp;» variation. Live API, fallback FAKE.
        </p>
      </div>
      {VERSIONS.map((v) => (
        <div key={v.key}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300">{v.label}</span>
            <span className="text-[12px] text-zinc-500">{v.note}</span>
          </div>
          <ConceptCompanyHeader company={company} deltaSize={v.key} />
        </div>
      ))}
    </div>
  );
}
