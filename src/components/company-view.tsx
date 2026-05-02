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
  formatHeroValue,
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
import { ChartCycle, ChartCycleControls, useChartMode } from "@/components/chart-cycle";
import { TimeFractionToggle, type TimeFraction } from "@/components/charts/time-fraction-toggle";
import { KpiRow } from "@/components/kpi-row";
import { QualityBadge, QualityChipOnly, PercentileChipOnly } from "@/components/quality-badge";
import { CompanyHeader } from "@/components/company-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { PeriodToggle } from "@/components/period-toggle";
import { InfoTooltip } from "@/components/info-tooltip";
import { InterpretationBlock } from "@/components/interpretation-block";
import { getCompanyEvents } from "@/lib/events";
import { CompareControl } from "@/components/compare-control";
import { ComparePanel } from "@/components/compare-panel";
import { KpiStories } from "@/components/kpi-stories";
import { hasStories } from "@/lib/kpi-stories-ordering";
import { orderKpis } from "@/lib/kpi-ordering";
import { RiskStack } from "@/components/risk-stack";
import { AIPositioningCard } from "@/components/ai-positioning-card";
import { PageSearch } from "@/components/page-search";
import { GovernanceCard } from "@/components/governance-card";
import { RepartitionBlock } from "@/components/repartition-block";
import { FreshnessIndicator } from "@/components/freshness-indicator";
import { AcronymHover } from "@/components/acronym-hover";
import { SenateTradesLive } from "@/components/senate-trades-live";
import { CompanyNavChrome } from "@/components/company-nav-chrome";
import { SuperKpiBoard } from "@/components/super-kpi-board";
import { computeSuperKpis, computeSectorSuperKpis } from "@/lib/super-kpi";
import { useT } from "@/lib/i18n/provider";
import { CmdFSearch } from "@/components/cmdf-search";

const VISIBLE_KPI_COUNT = 6;

export function CompanyView({
  company,
  authSlot,
  hideSenate = false,
  hidePriceBar = false,
}: {
  company: Company;
  authSlot?: React.ReactNode;
  /** Si true, masque le bloc SenateTradesLive (utile pour FPI étrangers V2). */
  hideSenate?: boolean;
  /** Si true, masque le StockPriceBlock (utile pour datasets V1.6 sans live data). */
  hidePriceBar?: boolean;
}) {
  const { t } = useT();
  const accent = brand(company.ticker).primary;
  const glow = brand(company.ticker).glow;

  const [activeKpiShort, setActiveKpiShort] = useState(company.hero_kpi);
  const active: KPI = useMemo(
    () => company.kpis.find((k) => k.short === activeKpiShort) ?? getHero(company),
    [activeKpiShort, company]
  );

  const [showAll, setShowAll] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [chartMode, setChartMode] = useChartMode("curve");
  const [barsVariant, setBarsVariant] = useState<"iso3d" | "classic">("classic");
  const [timeFraction, setTimeFraction] = useState<TimeFraction>("year");
  const [compareTicker, setCompareTicker] = useState<string | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const handleKpiClick = (short: string) => {
    setActiveKpiShort(short);
    if (heroRef.current) {
      smoothScrollTo(heroRef.current, 1500);
    }
  };

  // Ordering : règle Hero / Indicateurs clés / Stories (cf. CLAUDE.md § ORDRE)
  const orderedKpis = useMemo(
    () => orderKpis(company.kpis, company.hero_kpi),
    [company]
  );
  const visibleKpis = showAll ? orderedKpis : orderedKpis.slice(0, VISIBLE_KPI_COUNT);
  const hiddenCount = orderedKpis.length - VISIBLE_KPI_COUNT;

  const tone = yoyTone(active.yoy, active.type);
  const yoyColor =
    tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";

  const heroRating = rate(active);
  const anomalies = detectAnomalies(active.history, active.type, active.short);
  const formattedUnit = formatUnit(active.unit);
  const heroFormatted = formatHeroValue(active.value, active.unit);
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
      <CmdFSearch scopeSelector="main" />

      <main className="relative mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        {/* Top nav — tout sur une ligne : back + recherche (collée à gauche)
            puis actions à droite (variant, comparer, enregistrer, compte). */}
        <nav className="mb-9 flex flex-nowrap items-center gap-3 whitespace-nowrap">
          <Link
            href="/"
            className="group inline-flex shrink-0 items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-[15px] font-medium text-zinc-100">{t("nav.home")}</span>
          </Link>
          <PageSearch variant="default" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
              <span className="hidden sm:inline">{t("company.save.button")}</span>
            </button>
            <ThemeToggle />
            {authSlot}
          </div>
        </nav>

        {/* Rich company header */}
        <CompanyHeader company={company} hidePriceBar={hidePriceBar} />

        {/* HERO SECTION — plain section (no motion opacity:0 -> mobile bug) */}
        <section
          id="sec-hero"
          ref={heroRef}
          className="conic-border relative scroll-mt-24 overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#070707] p-5 animate-fade-up sm:p-7"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl"
            style={{ background: `${accent}33` }}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* LEFT: hero number — colonne réduite à 3/12 pour donner plus
                d'espace au graph (8 → 9). Tout ce qui est trop large doit
                glisser à gauche, le bord droit étant fixe. */}
            <div className="lg:col-span-3">
              {/* « À jour » à GAUCHE, juste à côté de KPI principal */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="inline-block size-1.5 animate-pulse-dot rounded-full"
                  style={{ background: accent }}
                />
                <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                  {t("company.kpi_principal")}
                </span>
                <FreshnessIndicator
                  lastDate={active.last_data_date ?? "2025-12-31"}
                  nextEarningsDate={company.next_earnings_date}
                  alwaysShow
                  size="sm"
                />
              </div>

              <div className="mt-1 flex items-center gap-2.5">
                <AcronymHover
                  align="left"
                  label={`${active.name_fr}${
                    active.name_en && active.name_en !== active.name_fr
                      ? ` (${active.name_en})`
                      : ""
                  }`}
                >
                  <span
                    className="cursor-help rounded-md px-1.5 py-0.5 font-mono text-[12px] font-bold uppercase tracking-wider"
                    style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}
                  >
                    {active.short}
                  </span>
                </AcronymHover>
              </div>

              {/* Chiffre principal — clamp responsif (max 7vw) pour éviter
                  l'overflow horizontal sur les grandes valeurs (ex BPA dilué
                  $XX.XX, ABF $XXX.X Mds, etc.). flex-wrap permet à l'unité
                  de basculer en dessous si pas la place. min-w-0 sur la
                  colonne parent côté layout HERO. */}
              <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <div
                  className="font-display font-semibold leading-none tracking-tight gradient-text"
                  style={{
                    fontSize: "clamp(40px, 7vw, 72px)",
                    wordBreak: "keep-all",
                  }}
                >
                  <NumberTicker value={heroFormatted.value} />
                </div>
                {heroFormatted.unit && (
                  <div
                    className="font-medium text-zinc-400"
                    style={{ fontSize: "clamp(15px, 2vw, 22px)" }}
                  >
                    {heroFormatted.unit}
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

            {/* RIGHT: chart — élargi à 9/12 (était 8) pour plus de place au
                graph principal. */}
            <div className="lg:col-span-9">
              {/* Toolbar au-dessus du graph en 2 LIGNES :
                    Ligne 1 : titre du KPI centré, agrandi
                    Ligne 2 : styles graph (gauche) + période 5/10/20 (droite)
                  « À jour » a été remonté dans la col gauche, à côté de
                  « KPI principal ». */}
              {/* Toolbar onglets graph (abaissé) → titre KPI (agrandi) →
                  graph. Les contrôles sont placés EN PREMIER pour pousser le
                  titre vers le bas, puis le graph vient juste sous le titre. */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <ChartCycleControls
                  mode={chartMode}
                  onChange={setChartMode}
                  color={accent}
                  barsVariant={barsVariant}
                  onBarsVariantChange={setBarsVariant}
                />
                <PeriodToggle accent={accent} />
              </div>
              <div className="mb-3 flex flex-wrap items-baseline justify-center gap-2.5 text-center">
                <span className="text-[24px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[28px]">
                  {active.name_fr}
                </span>
                {active.name_en && active.name_en !== active.name_fr && (
                  <span className="text-[14px] leading-tight text-zinc-400">
                    {active.name_en}
                  </span>
                )}
                <InfoTooltip color={accent}>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                    Définition
                  </div>
                  <div className="text-zinc-200">{active.explanation}</div>
                </InfoTooltip>
              </div>
              {/* TimeFraction toggle visible UNIQUEMENT pour les charts qui ont
                  du sens à diviser : courbe + barres. Pour variation/dashboard,
                  on cache (les % de variation ne se divisent pas par seconde). */}
              {(chartMode === "curve" || chartMode === "bars") && (
                <div className="mb-2 flex justify-end">
                  <TimeFractionToggle
                    value={timeFraction}
                    onChange={setTimeFraction}
                    accent={accent}
                  />
                </div>
              )}
              <ChartCycle
                mode={chartMode}
                data={active.history}
                unit={active.unit}
                color={accent}
                anomalies={anomalies}
                events={getCompanyEvents(company.ticker)}
                company={company}
                activeShort={active.short}
                onPickKpi={handleKpiClick}
                ttm={active.ttm ?? null}
                barsVariant={barsVariant}
                timeFraction={timeFraction}
              />
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
        <section id="sec-kpis" className="mt-9 scroll-mt-24 animate-fade-up-d2">
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
                ticker={company.ticker}
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
                  ? t("company.kpi_table.collapse")
                  : (hiddenCount > 1
                      ? t("company.kpi_table.see_more_many").replace("{n}", String(hiddenCount))
                      : t("company.kpi_table.see_more_one"))}
              </button>
            )}
          </div>
        </section>

        {/* Stories — KPIs short-history + MarketPositions intégrées */}
        {hasStories(company.kpis, company.market_positions) && (
          <KpiStories company={company} />
        )}

        {/* Risk factors */}
        {company.risks && (
          <div id="sec-risks" className="scroll-mt-24">
            <RiskStack risks={company.risks} accent={accent} profitWarning={company.profit_warning} />
          </div>
        )}

        {/* Répartition CA (géo + segment) — au-dessus de Gouvernance */}
        <RepartitionBlock company={company} />

        {/* Governance */}
        {company.governance && (
          <div id="sec-governance" className="scroll-mt-24">
            <GovernanceCard governance={company.governance} ticker={company.ticker} />
          </div>
        )}

        {/* AI positioning — placed after risks + governance */}
        <div id="sec-ai" className="scroll-mt-24">
          <AIPositioningCard
            positioning={company.ai_positioning}
            companyName={company.name}
            ticker={company.ticker}
          />
        </div>

        {/* Trades du Sénat US — données LIVE via FMP /stable/senate-trades */}
        {!hideSenate && <SenateTradesLive ticker={company.ticker} accent={accent} />}

        {/* Super-KPI Mettrik — bloc final, combinaisons composites */}
        <SuperKpiBoard
          kpis={computeSuperKpis(company)}
          sectorKpis={computeSectorSuperKpis(company)}
          companyName={company.name}
          ticker={company.ticker}
          accent={accent}
        />

        <footer className="mt-16 pb-8 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          Mettrik AI · KPI Intelligence
        </footer>
      </main>

      <CompanyNavChrome />
    </div>
  );
}
