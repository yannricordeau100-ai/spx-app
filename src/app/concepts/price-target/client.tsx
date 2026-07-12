"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { CompanyLogo } from "@/components/logos";

/**
 * Concept : intégration du price target consensus analystes (futur flux FMP)
 * dans le bandeau nom/prix des pages sté. 5 variantes statiques, données
 * mock NVDA. Aucune donnée live : tout est figé pour comparaison visuelle.
 */

const MOCK = {
  ticker: "NVDA",
  name: "NVIDIA",
  sector: "Technologie",
  subsector: "Semi-conducteurs et IA",
  price: "210,96",
  deltaPct: "+4,03 %",
  marketCap: "5 110 Mds $",
  target: "245",
  targetLow: 180,
  targetHigh: 320,
  priceNum: 210.96,
  targetNum: 245,
  analysts: 62,
  upside: "+16,1 %",
};

const GREEN = "#22c55e";
const GREEN_LIGHT = "#bbf7d0";

/* ---------------------------------------------------------------- */
/* Reproduction statique du bandeau header (logo + nom + price block) */
/* ---------------------------------------------------------------- */

function LogoTile() {
  return (
    <div className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a] ring-1 ring-white/10 shadow-[0_3px_14px_rgba(0,0,0,0.4)]">
      <CompanyLogo ticker={MOCK.ticker} />
    </div>
  );
}

function NameBlock() {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-nowrap items-baseline gap-x-3">
        <h2 className="text-[1.7rem] font-bold tracking-tight text-zinc-50 sm:text-[2rem]" style={{ lineHeight: 1.2 }}>
          {MOCK.name}
        </h2>
        <span className="font-mono text-base font-semibold text-[#76b900] sm:text-lg">
          {MOCK.ticker}
        </span>
      </div>
      <div className="mt-1.5 text-[14px] text-zinc-400">
        {MOCK.sector} <span className="text-zinc-700">·</span> {MOCK.subsector}
      </div>
    </div>
  );
}

/** Colonne capitalisation (bord gauche du price block). */
function CapCol() {
  return (
    <div className="flex shrink-0 flex-col items-start justify-center border-r border-white/15 pr-4 text-left">
      <span className="font-mono text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-zinc-100">
        Capitalisation
      </span>
      <span className="font-mono text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-zinc-100">
        boursière
      </span>
      <span className="mt-1 font-display text-[18px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums sm:text-[20px]">
        {MOCK.marketCap}
      </span>
    </div>
  );
}

function DeltaCol() {
  return (
    <div className="flex shrink-0 items-center self-stretch">
      <span
        className="font-display font-bold leading-none tabular-nums tracking-tight whitespace-nowrap"
        style={{
          color: GREEN_LIGHT,
          textShadow: "0 1px 6px rgba(0,0,0,0.35)",
          fontSize: "clamp(18px, 2.2vw, 24px)",
        }}
      >
        {MOCK.deltaPct}
      </span>
    </div>
  );
}

function PriceValue({ size = 42 }: { size?: number }) {
  return (
    <span
      className="block whitespace-nowrap text-right leading-none tracking-[-0.02em] text-white tabular-nums"
      style={{
        fontSize: size,
        fontFamily: "var(--font-sora), ui-sans-serif, sans-serif",
        fontWeight: 200,
        textShadow: "0 2px 12px rgba(0,0,0,0.55)",
      }}
    >
      {MOCK.price}
      <span
        className="ml-1.5 text-white/85"
        style={{
          fontSize: Math.round(size * 0.48),
          fontFamily: "var(--font-sora), ui-sans-serif, sans-serif",
          fontWeight: 300,
        }}
      >
        $
      </span>
    </span>
  );
}

/**
 * Bandeau complet : fond noir page + logo + nom à gauche, price block vert
 * à droite avec fondu. `priceCol` remplace la colonne prix par défaut,
 * `extraCol` s'ajoute après le prix.
 */
function HeaderStrip({
  priceCol,
  extraCol,
}: {
  priceCol?: React.ReactNode;
  extraCol?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-[#050507]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 py-4 pl-5">
        <LogoTile />
        <NameBlock />
        {/* Price block */}
        <div
          className="relative flex items-stretch py-2.5 pl-8 pr-5"
          style={{
            background: GREEN,
            borderTopRightRadius: "0.75rem",
            borderBottomRightRadius: "0.75rem",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute right-full top-0 h-full w-[400px]"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${GREEN}22 40%, ${GREEN}66 65%, ${GREEN}cc 85%, ${GREEN} 100%)`,
            }}
          />
          <div className="relative flex items-stretch gap-x-4">
            <CapCol />
            <DeltaCol />
            {priceCol ?? (
              <div className="flex shrink-0 items-center">
                <PriceValue />
              </div>
            )}
            {extraCol}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Variante 1 : pill discret à côté du prix                          */
/* ---------------------------------------------------------------- */

function Variant1() {
  return (
    <HeaderStrip
      extraCol={
        <div className="flex shrink-0 items-center">
          <span className="inline-flex items-baseline gap-1.5 rounded-full border border-white/25 bg-black/25 px-3 py-1.5 font-mono text-[12px] font-semibold text-white whitespace-nowrap">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/70">PT</span>
            <span className="tabular-nums">{MOCK.target} $</span>
            <span className="tabular-nums text-white/80">({MOCK.upside})</span>
          </span>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------------------- */
/* Variante 2 : jauge horizontale min-cible-max sous le prix         */
/* ---------------------------------------------------------------- */

function Variant2() {
  const range = MOCK.targetHigh - MOCK.targetLow;
  const pricePct = ((MOCK.priceNum - MOCK.targetLow) / range) * 100;
  const targetPct = ((MOCK.targetNum - MOCK.targetLow) / range) * 100;
  return (
    <HeaderStrip
      priceCol={
        <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
          <PriceValue size={34} />
          <div className="w-[180px]">
            <div className="relative h-[5px] rounded-full bg-black/35">
              {/* Segment prix actuel → cible */}
              <div
                className="absolute top-0 h-full rounded-full bg-white/45"
                style={{ left: `${pricePct}%`, width: `${targetPct - pricePct}%` }}
              />
              {/* Curseur prix actuel */}
              <div
                className="absolute top-1/2 h-[11px] w-[3px] -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                style={{ left: `${pricePct}%` }}
              />
              {/* Marqueur cible */}
              <div
                className="absolute top-1/2 h-[9px] w-[2px] -translate-y-1/2 rounded-full bg-[#0b2e1a]"
                style={{ left: `${targetPct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] font-semibold uppercase tracking-wide text-white/75 tabular-nums">
              <span>{MOCK.targetLow} $</span>
              <span className="text-white">Cible {MOCK.target} $</span>
              <span>{MOCK.targetHigh} $</span>
            </div>
          </div>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------------------- */
/* Variante 3 : badge "Objectif analystes" avec tooltip i            */
/* ---------------------------------------------------------------- */

function Variant3() {
  return (
    <HeaderStrip
      extraCol={
        <div className="group relative flex shrink-0 items-center">
          <span className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-3 py-1.5 whitespace-nowrap">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75">
              Objectif analystes
            </span>
            <span className="font-mono text-[12.5px] font-bold text-white tabular-nums">
              {MOCK.target} $
            </span>
            <Info className="size-3.5 text-white/70" />
          </span>
          {/* Tooltip au survol */}
          <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-[240px] rounded-xl border border-white/10 bg-[#0c0c0c] p-3.5 opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.6)] transition-opacity duration-150 group-hover:opacity-100">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Consensus analystes
            </div>
            <div className="mt-2 space-y-1.5 text-[12.5px] text-zinc-200">
              <div className="flex justify-between">
                <span className="text-zinc-400">Analystes</span>
                <span className="font-mono font-semibold tabular-nums">{MOCK.analysts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Fourchette</span>
                <span className="font-mono font-semibold tabular-nums">
                  {MOCK.targetLow} $ à {MOCK.targetHigh} $
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Potentiel</span>
                <span className="font-mono font-semibold text-emerald-400 tabular-nums">{MOCK.upside}</span>
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------------------- */
/* Variante 4 : double affichage prix actuel | cible avec flèche     */
/* ---------------------------------------------------------------- */

function Variant4() {
  return (
    <HeaderStrip
      priceCol={
        <div className="flex shrink-0 items-center gap-x-3">
          <div className="flex flex-col items-end">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Actuel
            </span>
            <PriceValue size={32} />
          </div>
          <div className="flex flex-col items-center">
            <ArrowRight className="size-5 text-white/80" />
            <span className="mt-0.5 font-mono text-[10px] font-bold text-white tabular-nums">
              {MOCK.upside}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Cible 12 mois
            </span>
            <span
              className="block whitespace-nowrap leading-none tracking-[-0.02em] text-white tabular-nums"
              style={{
                fontSize: 32,
                fontFamily: "var(--font-sora), ui-sans-serif, sans-serif",
                fontWeight: 300,
                textShadow: "0 2px 12px rgba(0,0,0,0.55)",
              }}
            >
              {MOCK.target}
              <span className="ml-1 text-[16px] text-white/85">$</span>
            </span>
          </div>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------------------- */
/* Variante 5 : mini-arc circulaire upside                           */
/* ---------------------------------------------------------------- */

function ArcGauge() {
  // Demi-cercle : min 180 $ à gauche, max 320 $ à droite.
  const range = MOCK.targetHigh - MOCK.targetLow;
  const fPrice = (MOCK.priceNum - MOCK.targetLow) / range; // ~0.22
  const fTarget = (MOCK.targetNum - MOCK.targetLow) / range; // ~0.46
  const r = 26;
  const cx = 32;
  const cy = 32;
  const halfLen = Math.PI * r;
  const point = (f: number) => {
    const a = Math.PI * (1 - f);
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  const tp = point(fTarget);
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" className="overflow-visible">
      {/* Piste */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Progression jusqu'au prix actuel */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${halfLen * fPrice} ${halfLen}`}
      />
      {/* Marqueur cible */}
      <circle cx={tp.x} cy={tp.y} r="3.5" fill="#0b2e1a" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

function Variant5() {
  return (
    <HeaderStrip
      extraCol={
        <div className="flex shrink-0 items-center gap-x-2 border-l border-white/15 pl-4">
          <div className="relative flex flex-col items-center">
            <ArcGauge />
            <span className="-mt-2 font-mono text-[11px] font-bold text-white tabular-nums">
              {MOCK.upside}
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Cible
            </span>
            <span className="font-mono text-[14px] font-bold text-white tabular-nums">
              {MOCK.target} $
            </span>
            <span className="font-mono text-[9px] text-white/65 tabular-nums">
              {MOCK.analysts} analystes
            </span>
          </div>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

const VARIANTS: Array<{ id: number; title: string; pv: string; node: React.ReactNode }> = [
  {
    id: 1,
    title: "Pill discret",
    pv: "Le PT visible en un coup d'oeil sans toucher à la hiérarchie actuelle du bandeau.",
    node: <Variant1 />,
  },
  {
    id: 2,
    title: "Jauge min-cible-max",
    pv: "Situe le prix actuel dans la fourchette des analystes : le potentiel se lit spatialement.",
    node: <Variant2 />,
  },
  {
    id: 3,
    title: "Badge avec tooltip i",
    pv: "Bandeau épuré, le détail (nb d'analystes, fourchette) reste à un survol de distance.",
    node: <Variant3 />,
  },
  {
    id: 4,
    title: "Double affichage actuel vers cible",
    pv: "Met le chemin prix actuel vers cible au centre : le upside devient le message principal.",
    node: <Variant4 />,
  },
  {
    id: 5,
    title: "Mini-arc circulaire",
    pv: "Variante ambitieuse : une gauge compacte qui condense fourchette, position et upside.",
    node: <Variant5 />,
  },
];

export function PriceTargetClient() {
  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      {/* HEADER */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#050507]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/concepts"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Concepts
          </Link>
          <h1 className="font-display text-[17px] font-bold tracking-tight text-zinc-50">
            Price target analystes
          </h1>
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
            concept brouillon
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="mb-2 text-[14px] text-zinc-400">
          5 intégrations possibles du consensus analystes (futur flux FMP) dans le bandeau des pages sté.
        </p>
        <p className="mb-10 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          Mock NVDA : prix 210,96 $ · {MOCK.deltaPct} · capi {MOCK.marketCap} · cible {MOCK.target} $ ({MOCK.upside}) · fourchette {MOCK.targetLow} $ à {MOCK.targetHigh} $ · {MOCK.analysts} analystes
        </p>

        <div className="space-y-12">
          {VARIANTS.map((v) => (
            <section key={v.id}>
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-mono text-[11px] font-bold text-violet-300">V{v.id}</span>
                <h2 className="font-display text-[16px] font-bold text-zinc-50">{v.title}</h2>
              </div>
              <p className="mb-4 text-[13px] text-zinc-400">{v.pv}</p>
              {v.node}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
