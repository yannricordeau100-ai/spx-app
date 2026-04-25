"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Bookmark, ChevronDown, Sparkles } from "lucide-react";

import {
  type Company,
  type KPI,
  findComparable,
  formatCAGR,
  formatUnit,
  getHero,
  interpretStructured,
} from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { brand, rate, detectAnomalies } from "@/lib/brand";
import { smoothScrollTo } from "@/lib/scroll";
import { CompanyLogo } from "@/components/logos";
import { ChartCycle } from "@/components/chart-cycle";
import { KpiRow } from "@/components/kpi-row";
import { QualityBadge, QualityChipOnly, PercentileChipOnly } from "@/components/quality-badge";
import { InfoTooltip } from "@/components/info-tooltip";
import { InterpretationBlock } from "@/components/interpretation-block";
import { PeriodToggle } from "@/components/period-toggle";
import { VariantSwitcher } from "@/components/variant-switcher";
import { EventTimeline } from "@/components/event-timeline";
import { CompareControl } from "@/components/compare-control";
import { ComparePanel } from "@/components/compare-panel";
import { MarketPositionCard } from "@/components/market-position-card";
import { RiskStack } from "@/components/risk-stack";
import { AIPositioningCard } from "@/components/ai-positioning-card";
import { PageSearch } from "@/components/page-search";
import { GovernanceCard } from "@/components/governance-card";
import { FreshnessIndicator } from "@/components/freshness-indicator";
import { AnimatePresence, motion } from "motion/react";

const VISIBLE = 6;

export function AuroraView({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const accent2 = brand(company.ticker).secondary;

  const [activeShort, setActiveShort] = useState(company.hero_kpi);
  const active: KPI = useMemo(
    () => company.kpis.find((k) => k.short === activeShort) ?? getHero(company),
    [activeShort, company]
  );
  const [showAll, setShowAll] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareTicker, setCompareTicker] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const handleClick = (s: string) => {
    setActiveShort(s);
    if (heroRef.current) smoothScrollTo(heroRef.current, 1500);
  };
  const comparables = useMemo(
    () => findComparable(company.ticker, active.short),
    [company.ticker, active.short]
  );

  const tone = yoyTone(active.yoy, active.type);
  const yoyColor = tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";
  const heroRating = rate(active);
  const anomalies = detectAnomalies(active.history, active.type, active.short);
  const formattedUnit = formatUnit(active.unit);
  const heroCAGR = formatCAGR(active.history, active.unit);
  const interp = useMemo(() => interpretStructured(company), [company]);
  const visibleKpis = showAll ? company.kpis : company.kpis.slice(0, VISIBLE);
  const hidden = company.kpis.length - VISIBLE;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04040a]">
      {/* AURORA HALOS — slow drifting blurred blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-aurora-1 absolute -left-1/4 -top-1/4 size-[60vw] rounded-full opacity-40 blur-[140px]"
          style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
        />
        <div
          className="animate-aurora-2 absolute -right-1/4 top-1/3 size-[50vw] rounded-full opacity-30 blur-[140px]"
          style={{ background: `radial-gradient(circle, ${accent2} 0%, transparent 70%)` }}
        />
        <div
          className="animate-aurora-1 absolute left-1/3 bottom-0 size-[45vw] rounded-full opacity-25 blur-[140px]"
          style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)" }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_70%)]" />

      <div className="relative mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        {/* Top nav */}
        <nav className="mb-9 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-sm text-zinc-200 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-display text-xl tracking-tight text-zinc-50">Mettrik</span>
            <span className="ml-2 rounded-full bg-violet-500/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
              Aurora
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <PageSearch variant="aurora" />
            <VariantSwitcher ticker={company.ticker} />
            <CompareControl
              comparables={comparables}
              activeKpi={active}
              open={compareOpen}
              onToggle={() => setCompareOpen((o) => !o)}
              onPick={(t) => {
                setCompareTicker(t);
                setCompareOpen(false);
              }}
              variant="aurora"
            />
            <button className="glass-card inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/5">
              <Bookmark className="size-4" />
              <span className="hidden sm:inline">Enregistrer</span>
            </button>
          </div>
        </nav>

        {/* Header — glass */}
        <div className="glass-card mb-7 rounded-2xl p-6 animate-fade-up">
          <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
            <div className="size-16 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur sm:size-20">
              <CompanyLogo ticker={company.ticker} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1
                  className="text-[2.1rem] font-bold tracking-tight text-zinc-50 sm:text-[2.6rem]"
                  style={{ lineHeight: 1.05, textShadow: `0 0 30px ${accent}40` }}
                >
                  {company.name}
                </h1>
                <span
                  className="font-mono text-lg font-semibold sm:text-xl"
                  style={{ color: accent2 }}
                >
                  {company.ticker}
                </span>
              </div>
              <div className="mt-1.5 text-[14px] text-zinc-300">
                {company.sector} · {company.subsector}
              </div>
              <p className="mt-2 max-w-2xl text-[14.5px] italic leading-relaxed text-zinc-300">
                “{company.tagline}”
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {[
              ["Rang mondial", company.ranks.global_world],
              ["Rang USA", company.ranks.global_us],
              [`Secteur (${company.sector})`, company.ranks.sector],
              [`Sous-secteur (${company.subsector})`, company.ranks.subsector],
              ["Fondée", String(company.founded)],
              ["IPO", String(company.ipo)],
            ].map(([l, v]) => (
              <span
                key={l}
                className="glass-card inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px]"
              >
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
                  {l}
                </span>
                <span className="font-medium text-zinc-100">{v}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Hero */}
        <section
          ref={heroRef}
          className="glass-card relative scroll-mt-6 overflow-hidden rounded-2xl p-5 animate-fade-up sm:p-7"
        >
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="inline-block size-1.5 animate-pulse-dot rounded-full"
                  style={{ background: accent }}
                />
                <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
                  KPI principal
                </span>
                <FreshnessIndicator lastDate={active.last_data_date ?? "2025-12-31"} alwaysShow size="sm" />
              </div>
              <div className="mt-1 flex items-center gap-2.5">
                <span
                  className="rounded-md border px-1.5 py-0.5 font-mono text-[12px] font-bold uppercase tracking-wider"
                  style={{ background: `${accent}1a`, color: accent2, borderColor: `${accent}40` }}
                >
                  {active.short}
                </span>
                <div className="leading-tight">
                  <div className="text-[16px] font-semibold text-zinc-50">{active.name_fr}</div>
                  {active.name_en && active.name_en !== active.name_fr && (
                    <div className="text-[11.5px] text-zinc-300">{active.name_en}</div>
                  )}
                </div>
                <InfoTooltip color={accent2}>
                  <div className="text-zinc-100">{active.explanation}</div>
                </InfoTooltip>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <div
                  className="font-display text-[64px] font-semibold leading-none tracking-tight text-zinc-50 sm:text-[88px]"
                  style={{ textShadow: `0 0 40px ${accent}60` }}
                >
                  {active.value}
                </div>
                {formattedUnit && (
                  <div className="text-xl font-medium text-zinc-300 sm:text-2xl">
                    {formattedUnit}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-col items-start gap-2">
                <div
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium backdrop-blur"
                  style={{
                    color: yoyColor,
                    borderColor: `${yoyColor}55`,
                    background: `${yoyColor}18`,
                  }}
                >
                  {tone === "pos" && <ArrowUpRight className="size-4" />}
                  {tone === "neg" && <ArrowDownRight className="size-4" />}
                  <span className="font-mono tabular-nums">{active.yoy}</span>
                  <span className="text-[11px] italic text-zinc-300">(YoY)</span>
                </div>
                <QualityChipOnly rating={heroRating} />
                {heroCAGR && (
                  <div className="glass-card inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[12.5px] tabular-nums text-zinc-100">
                    {heroCAGR}
                    <span className="text-[10.5px] italic text-zinc-300">(CAGR 5 ans)</span>
                  </div>
                )}
                <PercentileChipOnly rating={heroRating} scope={company.subsector} />
              </div>

              <div className="glass-card mt-5 flex items-start gap-2.5 rounded-xl p-4">
                <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: accent2 }} />
                <div>
                  <div className="text-[14.5px] font-semibold text-zinc-50">{active.signal}</div>
                  <div className="mt-1.5 text-[13px] leading-relaxed text-zinc-200">
                    {active.description}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="mb-3 flex items-center justify-end">
                <PeriodToggle accent={accent} />
              </div>
              <ChartCycle
                data={active.history}
                unit={active.unit}
                color={accent}
                anomalies={anomalies}
                company={company}
                activeShort={active.short}
                onPickKpi={handleClick}
              />
              <EventTimeline ticker={company.ticker} color={accent2} />
            </div>
          </div>

          <div className="mt-6">
            <InterpretationBlock block={interp} accent={accent} />
          </div>
        </section>

        {/* Compare panel */}
        <AnimatePresence>
          {compareTicker && (
            <motion.section
              key={compareTicker + active.short}
              initial={{ opacity: 0, y: 12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 12, height: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 overflow-hidden"
            >
              <ComparePanel
                sourceCompany={company}
                sourceKpi={active}
                targetTicker={compareTicker}
                onClose={() => setCompareTicker(null)}
              />
            </motion.section>
          )}
        </AnimatePresence>

        {/* KPI table */}
        <section className="glass-card mt-9 overflow-hidden rounded-2xl">
          <div className="flex items-end justify-between border-b border-white/5 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-[22px] font-semibold text-zinc-50">Indicateurs clés</h2>
              <p className="mt-0.5 text-[13.5px] text-zinc-300">
                Cliquez sur un indicateur pour le promouvoir en KPI principal.
              </p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              {company.kpis.length} indicateurs
            </span>
          </div>
          <div>
            {visibleKpis.map((kpi) => (
              <KpiRow
                key={kpi.short}
                kpi={kpi}
                active={kpi.short === active.short}
                subsector={company.subsector}
                onClick={() => handleClick(kpi.short)}
              />
            ))}
            {hidden > 0 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="group flex w-full items-center justify-center gap-2 border-t border-white/5 px-6 py-4 text-sm text-zinc-200 transition-colors hover:bg-white/5"
              >
                <ChevronDown className={`size-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
                {showAll
                  ? "Réduire"
                  : `Voir ${hidden} indicateur${hidden > 1 ? "s" : ""} supplémentaire${hidden > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </section>

        {company.market_positions && company.market_positions.length > 0 && (
          <section className="mt-9 animate-fade-up-d2">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-[22px] font-semibold text-zinc-50">
                  Position marché · TAM
                </h2>
                <p className="mt-0.5 text-[13.5px] text-zinc-300">
                  Part de marché de la société sur ses segments clés vs le Total Addressable Market.
                </p>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                {company.market_positions.length} segment{company.market_positions.length > 1 ? "s" : ""}
              </span>
            </div>
            <div
              className={`grid gap-4 ${
                company.market_positions.length === 1 ? "grid-cols-1" : "lg:grid-cols-2"
              }`}
            >
              {company.market_positions.map((p) => (
                <MarketPositionCard
                  key={p.segment_name}
                  company={company}
                  position={p}
                  wide={company.market_positions!.length === 1}
                />
              ))}
            </div>
          </section>
        )}

        {company.risks && <RiskStack risks={company.risks} accent={accent} />}

        {company.governance && (
          <GovernanceCard governance={company.governance} ticker={company.ticker} />
        )}

        <AIPositioningCard
          positioning={company.ai_positioning}
          companyName={company.name}
          ticker={company.ticker}
        />

        <footer className="mt-16 pb-8 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          Mettrik · Aurora — V1
        </footer>
      </div>
    </div>
  );
}
