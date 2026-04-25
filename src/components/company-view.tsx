"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  Sparkles,
} from "lucide-react";

import {
  type Company,
  type KPI,
  formatCAGR,
  formatUnit,
  findComparable,
  getHero,
  interpretStructured,
} from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { brand, rate, detectAnomalies } from "@/lib/brand";
import { smoothScrollTo } from "@/lib/scroll";
import { Spotlight } from "@/components/effects/spotlight";
import { NumberTicker } from "@/components/effects/number-ticker";
import { ChartCycle } from "@/components/chart-cycle";
import { KpiRow } from "@/components/kpi-row";
import { QualityBadge, QualityChipOnly, PercentileChipOnly } from "@/components/quality-badge";
import { CompanyHeader } from "@/components/company-header";
import { PeriodToggle } from "@/components/period-toggle";
import { InfoTooltip } from "@/components/info-tooltip";
import { InterpretationBlock } from "@/components/interpretation-block";
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

const VISIBLE_KPI_COUNT = 6;

export function CompanyView({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const glow = brand(company.ticker).glow;

  const [activeKpiShort, setActiveKpiShort] = useState(company.hero_kpi);
  const active: KPI = useMemo(
    () => company.kpis.find((k) => k.short === activeKpiShort) ?? getHero(company),
    [activeKpiShort, company]
  );

  const [showAll, setShowAll] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareTicker, setCompareTicker] = useState<string | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const handleKpiClick = (short: string) => {
    setActiveKpiShort(short);
    if (heroRef.current) {
      smoothScrollTo(heroRef.current, 1500);
    }
  };

  const visibleKpis = showAll ? company.kpis : company.kpis.slice(0, VISIBLE_KPI_COUNT);
  const hiddenCount = company.kpis.length - VISIBLE_KPI_COUNT;

  const tone = yoyTone(active.yoy, active.type);
  const yoyColor =
    tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";

  const heroRating = rate(active);
  const anomalies = detectAnomalies(active.history, active.type, active.short);
  const formattedUnit = formatUnit(active.unit);
  const heroCAGR = formatCAGR(active.history, active.unit);
  const interp = useMemo(() => interpretStructured(company), [company]);

  const comparables = useMemo(
    () => findComparable(company.ticker, active.short),
    [company.ticker, active.short]
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${glow}, transparent 60%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" />

      <div className="relative mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        {/* Top nav */}
        <nav className="mb-9 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-display text-xl tracking-tight text-zinc-100">Mettrik</span>
          </Link>
          <div className="flex items-center gap-2">
            <PageSearch variant="default" />
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
            />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#0a0a0a] px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-[#3a3a3a] hover:text-zinc-100">
              <Bookmark className="size-4" />
              <span className="hidden sm:inline">Enregistrer</span>
            </button>
          </div>
        </nav>

        {/* Rich company header */}
        <CompanyHeader company={company} />

        {/* HERO SECTION — plain section (no motion opacity:0 -> mobile bug) */}
        <section
          ref={heroRef}
          className="conic-border relative scroll-mt-6 overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#070707] p-5 animate-fade-up sm:p-7"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl"
            style={{ background: `${accent}33` }}
          />

          <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
            {/* LEFT: hero number — 4 cols (narrower) */}
            <div className="lg:col-span-4">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="inline-block size-1.5 animate-pulse-dot rounded-full"
                  style={{ background: accent }}
                />
                <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                  KPI principal
                </span>
                <FreshnessIndicator lastDate={active.last_data_date ?? "2025-12-31"} alwaysShow size="sm" />
              </div>

              <div className="mt-1 flex items-center gap-2.5">
                <span
                  className="rounded-md px-1.5 py-0.5 font-mono text-[12px] font-bold uppercase tracking-wider"
                  style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}
                >
                  {active.short}
                </span>
                <div className="leading-tight">
                  <div className="text-[16px] font-semibold text-zinc-100">{active.name_fr}</div>
                  {active.name_en && active.name_en !== active.name_fr && (
                    <div className="text-[11.5px] text-zinc-400">{active.name_en}</div>
                  )}
                </div>
                <InfoTooltip color={accent}>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                    Définition
                  </div>
                  <div className="text-zinc-200">{active.explanation}</div>
                </InfoTooltip>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <div className="font-display text-[64px] font-semibold leading-none tracking-tight gradient-text sm:text-[88px]">
                  <NumberTicker value={active.value} />
                </div>
                {formattedUnit && (
                  <div className="text-xl font-medium text-zinc-400 sm:text-2xl">
                    {formattedUnit}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-col items-start gap-2">
                <div
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
                  style={{
                    color: yoyColor,
                    borderColor: `${yoyColor}40`,
                    background: `${yoyColor}12`,
                  }}
                >
                  {tone === "pos" && <ArrowUpRight className="size-4" />}
                  {tone === "neg" && <ArrowDownRight className="size-4" />}
                  <span className="font-mono tabular-nums">{active.yoy}</span>
                  <span className="text-[11px] italic text-zinc-400">(YoY)</span>
                </div>
                <QualityChipOnly rating={heroRating} />
                {heroCAGR && (
                  <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#262626] bg-[#0d0d0d] px-3 py-1 font-mono text-[12.5px] tabular-nums text-zinc-200">
                    {heroCAGR}
                    <span className="text-[10.5px] italic text-zinc-400">(CAGR 5 ans)</span>
                  </div>
                )}
                <PercentileChipOnly rating={heroRating} scope={company.subsector} />
              </div>

              <div className="mt-5 flex max-w-md items-start gap-2.5 rounded-xl border border-[#1a1a1a] bg-[#070707] p-3.5">
                <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: accent }} />
                <div>
                  <div className="text-[14px] font-semibold text-zinc-100">{active.signal}</div>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">
                    {active.description}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: chart — 8 cols (dominant) */}
            <div className="lg:col-span-8">
              <div className="mb-3 flex items-center justify-end gap-2">
                <PeriodToggle accent={accent} />
              </div>
              <ChartCycle
                data={active.history}
                unit={active.unit}
                color={accent}
                anomalies={anomalies}
                company={company}
                activeShort={active.short}
                onPickKpi={handleKpiClick}
              />
              <EventTimeline ticker={company.ticker} color={accent} />
            </div>
          </div>

          {/* Interpretation INSIDE hero panel */}
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
        <section className="mt-9 animate-fade-up-d2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-[22px] font-semibold text-zinc-100">Indicateurs clés</h2>
              <p className="mt-0.5 text-[13.5px] text-zinc-400">
                Cliquez sur un indicateur pour le promouvoir en KPI principal.
              </p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              {company.kpis.length} indicateurs
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#080808]">
            <div className="grid grid-cols-12 gap-3 border-b border-[#1a1a1a] bg-[#0c0c0c] px-5 py-3.5 font-sans text-[11.5px] font-semibold uppercase tracking-[0.12em] text-zinc-300 sm:px-6">
              <div className="col-span-4">Indicateur</div>
              <div className="col-span-2">Valeur <span className="ml-0.5 italic text-zinc-400">(YoY)</span></div>
              <div className="col-span-2">Tendance</div>
              <div className="col-span-4">Qualité · Signal</div>
            </div>
            {visibleKpis.map((kpi) => (
              <KpiRow
                key={kpi.short}
                kpi={kpi}
                active={kpi.short === active.short}
                subsector={company.subsector}
                onClick={() => handleKpiClick(kpi.short)}
              />
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="group flex w-full items-center justify-center gap-2 border-t border-[#1a1a1a] bg-[#0a0a0a] px-6 py-4 text-sm text-zinc-400 transition-colors hover:bg-[#0e0e0e] hover:text-zinc-100"
              >
                <ChevronDown
                  className={`size-4 transition-transform ${showAll ? "rotate-180" : ""}`}
                />
                {showAll
                  ? "Réduire"
                  : `Voir ${hiddenCount} indicateur${hiddenCount > 1 ? "s" : ""} supplémentaire${hiddenCount > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </section>

        {/* Market position / TAM */}
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
                company.market_positions.length === 1
                  ? "grid-cols-1"
                  : "lg:grid-cols-2"
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

        {/* Risk factors */}
        {company.risks && <RiskStack risks={company.risks} accent={accent} />}

        {/* Governance */}
        {company.governance && (
          <GovernanceCard governance={company.governance} ticker={company.ticker} />
        )}

        {/* AI positioning — placed after risks + governance */}
        <AIPositioningCard
          positioning={company.ai_positioning}
          companyName={company.name}
          ticker={company.ticker}
        />

        <footer className="mt-16 pb-8 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          Mettrik · KPI Intelligence — V1
        </footer>
      </div>
    </div>
  );
}
