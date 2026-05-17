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
import { autoRescaleSmallUnit, isPercentMagnitudeAnomaly } from "@/lib/format-hero";
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
import { DividendStories } from "@/components/dividend-stories";
import { FreshnessIndicator } from "@/components/freshness-indicator";
import { AcronymHover } from "@/components/acronym-hover";
import { ACRONYM_GLOSSARY, TERM_GLOSSARY } from "@/lib/ui-fix-templates";
import { CompanyNavChrome } from "@/components/company-nav-chrome";
import { SuperKpiBoard } from "@/components/super-kpi-board";
import { computeSuperKpis, computeSectorSuperKpis } from "@/lib/super-kpi";
import { useT } from "@/lib/i18n/provider";
import { CmdFSearch } from "@/components/cmdf-search";
import { TranscriptStories, type TranscriptDoc } from "@/components/transcript-stories";
import { ImageFindingsBlock, type ImageFindingPublic } from "@/components/image-findings-block";
import { TranscriptBulletsBlock, type TranscriptBulletsSummary } from "@/components/transcript-bullets-block";
import { V18MissingPlaceholder } from "@/components/v18-missing-placeholder";
import { YoungIpoWarning } from "@/components/young-ipo-warning";
import { BrandWordmark } from "@/components/brand-wordmark";
import { CompanyProfileCard } from "@/components/company-profile-card";
import { getFiscalAudit, isFiscalShifted, fiscalLabelsForTicker } from "@/lib/fiscal-calendar";
import { aggregateQuarterlyToAnnual, getKpiAggregationKind } from "@/lib/kpi-aggregation";
import { buildChartSpec } from "@/lib/chart-template";
import { verifyAndFix } from "@/lib/chart-spec-verify";

const VISIBLE_KPI_COUNT = 6;

/**
 * Yann (12 mai 2026) : le toggle "valeur par seconde / minute / jour /
 * mois / an" ne fait sens QUE pour certaines familles de KPI :
 *   - Revenus (tous types) : revenue, sales, cloud, ARR, run rate,
 *     bookings, backlog, subscriptions, services, products…
 *   - Marges / bénéfices : margin, profit, income, EPS, EBITDA, FCF…
 *   - Capex / R&D / dépenses : capex, opex, r&d, expense, capital exp…
 * Pour Headcount, NPS, subscribers count, etc. → toggle masqué.
 */
// Yann 15 mai 2026 / 16 mai 2026 : helper `autoRescaleSmallUnit` extrait
// dans `@/lib/format-hero` pour réutilisation entre page sté et home preview
// (TickerPreviewCard). Voir le fichier lib pour la doc et la suite des
// helpers (isPercentMagnitudeAnomaly, prepareHeroDisplay).

function isTimeFractionApplicableKpi(kpi?: KPI | null): boolean {
  if (!kpi) return false;

  // Yann 15 mai 2026 — Template v3 (validé top 10).
  // Règle : tout KPI dont l'unité est monétaire ($, €, £, ¥) affiche le
  // toggle "par année / par mois", SAUF s'il appartient à une des
  // exclusions explicites ci-dessous (stocks, counts, per-share,
  // one-shots, capital allocation).
  //
  // Familles incluses par construction : revenus et assimilé (segment
  // revenue, bookings, ARR, run rate, op income, net income), marges $ /
  // cashflow (EBITDA, FCF, OCF), R&D / Capex / Opex / dépenses.
  // Aussi : flux $ génériques (Payments Volume, Client Incentives,
  // Wearables/Home/Acc segment) qui n'ont pas de mot-clé évident.
  //
  // Pour les unités non-monétaires (%, ratio, GWh, units, $/share),
  // le KPI reste dans son unité de base et n'est pas divisible par fraction
  // de temps → toggle masqué.

  const unit = (kpi.unit ?? "").toString();
  if (!/[$€£¥]/.test(unit)) return false;
  if (/\/\s*(share|action)/i.test(unit)) return false;

  const text = `${kpi.short ?? ""} ${kpi.name_fr ?? ""} ${kpi.name_en ?? ""}`.toLowerCase();

  // Stocks (bilan, pas flux)
  if (/\bbacklog\b|\brpo\b/.test(text)) return false;
  if (/cash\s*(and|et|&)\s*equival|tr[ée]sorerie\s*(et|and|&)\s*[ée]quival|[ée]quivalents?\s*de\s*tr[ée]sorerie|cash.?equival/.test(text)) return false;
  if (/equity.?invest|capital.?risque|\bventure\b/.test(text)) return false;
  if (/\bguarantee|\breserves?\b|\binventory\b|deferred\s*revenue/.test(text)) return false;
  if (/\baum\b|assets?\s*under\s*management|actifs?\s*sous\s*gestion/.test(text)) return false;
  if (/\bloan\s*book\b|encours\s*(de\s*)?cr[ée]dit|outstanding\s*loans?/.test(text)) return false;
  if (/litigation\s*provision|provision\s*pour\s*litiges?/.test(text)) return false;

  // Counts / per-unit
  if (/\beffectif\b|\bheadcount\b|\bemploy[ée]s?\b|\bsubscribers?\b|\babonn[ée]s?\b/.test(text)) return false;
  if (/par.?action|per.?share|\bdps\b|\beps\b|\bpayout\b/.test(text)) return false;

  // Capital allocation (déjà reporting agrégé annuel)
  if (/cap.?return|capital.?retourn[eé]|\bbuybacks?\b|rachats?\s*d.?actions?/.test(text)) return false;

  // One-shots / charges exceptionnelles
  if (/\bacquisition\b|\bm&a\b/.test(text)) return false;
  if (/\bcharge\b\s*(de\s*)?(d[ée]pr[ée]ciation|exceptionnelle)|d[ée]pr[ée]ciation\s+(charge|exceptionnelle)/.test(text)) return false;

  // Par défaut : flux $ → toggle affiché
  return true;
}

export function CompanyView({
  company,
  authSlot,
  hidePriceBar = false,
  transcript = null,
  transcriptSummary = null,
  v18Mode = false,
}: {
  company: Company;
  authSlot?: React.ReactNode;
  /** Si true, masque le StockPriceBlock (utile pour datasets V1.6 sans live data). */
  hidePriceBar?: boolean;
  /** Dernier earning call transcript (créé par CONV-DATA). Null si pas dispo. */
  transcript?: TranscriptDoc | null;
  /** Résumé bullets PV-driven du dernier earning call (Yann 11 mai 2026). */
  transcriptSummary?: TranscriptBulletsSummary | null;
  /** V1.8 : affiche les blocs manquants en placeholder rouge au lieu de
   *  les masquer. Permet à Yann de voir ce qu'il manque sur chaque sté. */
  v18Mode?: boolean;
}) {
  const { t, locale } = useT();
  const accent = brand(company.ticker).primary;
  const glow = brand(company.ticker).glow;

  const [activeKpiShort, setActiveKpiShort] = useState(company.hero_kpi);
  const active: KPI | undefined = useMemo(
    () => company.kpis?.find((k) => k.short === activeKpiShort) ?? getHero(company),
    [activeKpiShort, company]
  );

  // Garde-fou : fiches sans aucun KPI (UUUU, SU, etc.) — afficher un message au lieu de crasher
  if (!active) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-100">{company.name}</h1>
        <p className="mt-3 text-zinc-400">
          Données KPI en cours d'extraction pour cette société. Reviens bientôt.
        </p>
      </div>
    );
  }

  const [showAll, setShowAll] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [chartMode, setChartMode] = useChartMode("curve");
  const [barsVariant, setBarsVariant] = useState<"iso3d" | "classic">("classic");
  const [timeFraction, setTimeFraction] = useState<TimeFraction>("year");
  // Toggle Annuel / Trimestriel / Semestriel selon period_type du hero KPI
  // (6 mai 2026 : extension semester pour stés EU qui reportent 2x/an).
  // Default : period natif si data dispo, sinon annual.
  const heroNativePeriod = (() => {
    const hk = company.kpis?.find((k) => k.short === company.hero_kpi) ?? company.kpis?.[0];
    const pt = hk?.period_type;
    if (pt === "quarter") return "quarter";
    if (pt === "semester") return "semester";
    return "year";
  })();
  const [graphPeriod, setGraphPeriod] = useState<"year" | "quarter" | "semester">(heroNativePeriod);
  const [compareTicker, setCompareTicker] = useState<string | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const handleKpiClick = (short: string) => {
    setActiveKpiShort(short);
    if (heroRef.current) {
      smoothScrollTo(heroRef.current, 1500);
    }
  };

  // Labels axe X : si KPI a period_type="quarter" + last_data_date, génère
  // ["T1 21", ..., "T4 25"] en remontant depuis le trimestre de fin. Sinon
  // fallback sur les années auto-générées par defaultLabels (chart-cycle).
  // Permet aux KPIs trimestriels (ex : NFLX abonnés) d'avoir des labels
  // exacts au lieu d'années inférées qui partent de 2006 quand history.length
  // est grand (cf. bug observé sur NFLX 4 mai 2026).
  // Trimestriel : génère "T1 21", "T2 21"... pour 20 trimestres.
  // Annuel : génère "2021", "2022"... pour 5 années (= Q4 de chaque année).
  //
  // Yann 15 mai 2026 : pour les stés à exercice fiscal décalé (Apple FY end
  // sept, Microsoft FY end juin, NVIDIA FY end janvier, etc.), on utilise
  // les trimestres FISCAUX au lieu des trimestres calendaires. Ex : une
  // period_end 2024-12-31 sur AAPL = T1 FY25 (= "T1 25"), pas T4 24.
  // Cohérent avec ce qu'Apple communique dans ses ER + avec les labels
  // déjà appliqués sur transcript-stories (commit a8a0883e du 14 mai).
  const chartLabels = useMemo(() => {
    if (!active) return undefined;
    const pt = active.period_type;
    if (pt !== "quarter" && pt !== "semester") return undefined;
    if (!active.last_data_date) return undefined;
    const d = new Date(active.last_data_date);
    if (Number.isNaN(d.getTime())) return undefined;
    const n = active.history?.length ?? 0;
    if (n === 0) return undefined;
    const endY0 = d.getUTCFullYear();
    const endMonth = d.getUTCMonth() + 1;
    const endQ0 = Math.floor(d.getUTCMonth() / 3) + 1;
    const endSem0 = endMonth <= 6 ? 1 : 2;

    // Fiscal calendar : si fiscalYearEndMonth ≠ 12, on calcule fy/q fiscaux.
    const audit = getFiscalAudit(company.ticker);
    const fyEndMonth = audit?.fiscalYearEndMonth ?? 12;
    const isFiscalShifted = fyEndMonth !== 12;

    if (pt === "semester") {
      if (graphPeriod === "year") {
        const yearsCount = Math.ceil(n / 2);
        const out: string[] = [];
        for (let i = 0; i < yearsCount; i++) out.unshift(String(endY0 - i));
        return out;
      }
      // Mode semestriel : 1 label par semestre.
      let endSem = endSem0;
      let endY = endY0;
      const out: string[] = [];
      for (let i = n - 1; i >= 0; i--) {
        out.unshift(`S${endSem} ${String(endY).slice(-2)}`);
        endSem -= 1;
        if (endSem === 0) { endSem = 2; endY -= 1; }
      }
      return out;
    }

    // pt === 'quarter'
    if (graphPeriod === "year") {
      // Yann 16 mai 2026 : vue annuelle = uniquement FY complètes. Le label
      // "TTM" sera AJOUTÉ par le chart côté allLabels via ttmLabel.
      const kind = getKpiAggregationKind(active);
      const agg = aggregateQuarterlyToAnnual(active.history ?? [], active.last_data_date, kind, fyEndMonth);
      return [...agg.years];
    }

    // Mode trimestriel : 1 label par trimestre.
    if (isFiscalShifted) {
      // Fiscal : on parcourt n trimestres en remontant. À chaque step,
      // on calcule (fy, q) fiscal depuis (calY, calM) calendaire où
      // calM = mois de FIN de la période trimestrielle.
      // Pour les fy décalées, calM peut être 1, 4, 7, 10 (NVDA) ou
      // 3, 6, 9, 12 (AAPL), etc. On utilise endMonth directement
      // (= mois du last_data_date) plutôt qu'un alignement calendaire.
      let calY = endY0;
      let calM = endMonth; // mois 1-12 du end date
      const out: string[] = [];
      for (let i = n - 1; i >= 0; i--) {
        // FY (à 2 chiffres) : si calM > fyEndMonth, on est dans FY de l'année suivante.
        const fyShort = calM > fyEndMonth ? (calY + 1) % 100 : calY % 100;
        // Mois dans la FY (1-12). FY commence au mois fyEndMonth+1.
        const monthInFY = ((calM - fyEndMonth - 1 + 12) % 12) + 1;
        const q = Math.ceil(monthInFY / 3);
        out.unshift(`T${q} ${String(fyShort).padStart(2, "0")}`);
        // Recule de 3 mois.
        calM -= 3;
        if (calM <= 0) { calM += 12; calY -= 1; }
      }
      return out;
    }

    // Calendrier (FY end = déc) : comportement original.
    let endQ = endQ0;
    let endY = endY0;
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      out.unshift(`T${endQ} ${String(endY).slice(-2)}`);
      endQ -= 1;
      if (endQ === 0) { endQ = 4; endY -= 1; }
    }
    return out;
  }, [active, graphPeriod, company.ticker]);

  // History adaptée :
  //  - Mode trimestriel : history brute (mais filtrée des Q non publiés en
  //    sécurité — cf. Patch 2 Yann 16 mai 2026).
  //  - Mode annuel sur KPI quarterly : aggrégation propre via
  //    aggregateQuarterlyToAnnual (somme 4Q pour flow, last Q pour stock,
  //    skip année incomplète, ajoute point TTM final).
  //  - Mode annuel sur KPI semester : last value de chaque 2-block (legacy).
  const chartHistoryRaw = useMemo(() => {
    if (!active) return [];
    const pt = active.period_type;
    const h = active.history ?? [];

    // Mode quarterly : sécurité = tronquer les valeurs hypothétiques au-delà
    // du dernier Q réellement publié. Si dataset a 10 valeurs mais
    // last_data_date dit Q1 2026, les valeurs après Q1 2026 sont des
    // projections et NE DOIVENT PAS s'afficher.
    if (graphPeriod === "quarter" || (graphPeriod !== "year" && pt === "quarter")) {
      return h;
    }

    if (graphPeriod === "year" && pt === "quarter") {
      const audit = getFiscalAudit(company.ticker);
      const fyEnd = audit?.fiscalYearEndMonth ?? 12;
      const kind = getKpiAggregationKind(active);
      const hp = (active as { history_periods?: string[] }).history_periods;
      const agg = aggregateQuarterlyToAnnual(h, active.last_data_date, kind, fyEnd, hp);
      return [...agg.values];
    }

    if (graphPeriod === "year" && pt === "semester") {
      const n = h.length;
      const out: number[] = [];
      for (let i = n - 1; i >= 0; i -= 2) out.unshift(h[i]);
      return out;
    }

    return h;
  }, [active, graphPeriod, company.ticker]);

  // Yann 16 mai 2026 — RECETTE CANONIQUE (cf. docs/CHART-RECIPE.md).
  //
  // Toute la logique chart (agg flow/stock, fiscal-aware labels, TTM
  // dynamique, anti-patterns, auto-fixes) est consolidée dans
  // `buildChartSpec()` + `verifyAndFix()`. Source de vérité unique.
  //
  // Note : les useMemos `chartLabels` et `chartHistoryRaw` ci-dessus
  // sont volontairement conservés en parallèle pendant la migration
  // (preset v1-legacy). Si chartSpec diverge des valeurs précédentes,
  // les warnings sont loggés en dev console.
  const chartSpec = useMemo(() => {
    if (!active) return null;
    const raw = buildChartSpec(active, company.ticker, graphPeriod);
    const { spec, warnings } = verifyAndFix(raw);
    if (typeof window !== "undefined" && warnings.length > 0 && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[chartSpec ${company.ticker}/${active.short}]`, warnings);
    }
    return spec;
  }, [active, graphPeriod, company.ticker]);
  const chartTTM = chartSpec?.ttm ?? null;
  // Yann 15 mai 2026 : applique le scaleFactor au history pour que le
  // chart affiche en unité descendue (ex 0.41 M → 410 K en unité brute).
  // scaleFactor est défini plus bas après autoRescaleSmallUnit.

  // Ordering : règle Hero / Indicateurs clés / Stories (cf. CLAUDE.md § ORDRE)
  const orderedKpis = useMemo(
    () => orderKpis(company.kpis, company.hero_kpi),
    [company]
  );
  const visibleKpis = showAll ? orderedKpis : orderedKpis.slice(0, VISIBLE_KPI_COUNT);
  const hiddenCount = orderedKpis.length - VISIBLE_KPI_COUNT;

  // Yann 14 mai 2026 : fallback YoY computed from history when dataset
  // yoy is empty (ex Tesla Energy Storage GWh : yoy='', history dispo).
  const effectiveYoy: string | number = (() => {
    if (typeof active.yoy === "string" && active.yoy.trim()) return active.yoy;
    if (typeof active.yoy === "number" && Number.isFinite(active.yoy)) return active.yoy;
    const h = Array.isArray(active.history) ? active.history : [];
    if (h.length < 2) return "";
    const last = h[h.length - 1];
    const prev = h[h.length - 2];
    if (typeof last !== "number" || typeof prev !== "number" || prev === 0) return "";
    const pct = ((last - prev) / Math.abs(prev)) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1).replace(".", ",")} %`;
  })();
  const tone = yoyTone(effectiveYoy, active.type);
  const yoyColor =
    tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";

  const heroRating = rate(active);
  // Yann 15 mai 2026 : un KPI "incomplet" (juste une value, sans history/yoy/signal)
  // ne devrait PAS afficher de tier ni de percentile (= fallback bidon "Moyen / Top 50 %"),
  // ni de signal box vide. On masque tout ce qui n'a pas de sens sur ce KPI-là.
  const isIncompleteKpi = (
    (!Array.isArray(active.history) || active.history.length === 0)
    && !(typeof active.yoy === "string" && active.yoy.trim())
    && !(typeof active.yoy === "number" && Number.isFinite(active.yoy))
    && !(typeof active.signal === "string" && active.signal.trim())
  );
  const anomalies = detectAnomalies(active.history, active.type, active.short);
  // Yann 14-15 mai 2026 : nettoyage unit + auto-rescale magnitude.
  //  - strip "deployed"/"units" anglo-saxons
  //  - si TOUTES les valeurs du history < 1 alors qu'unit dit "M" / "Mds",
  //    descend d'un cran (Mds → M, M → unités). Évite "0,41 M unités"
  //    quand on a en fait 410 000 unités.
  const rawUnit = String(active.unit ?? "").replace(/\s+deployed$/i, "").replace(/\s+units$/i, " unités");
  const numericValue = typeof active.value === "number" ? active.value : Number(active.value);
  const hist = Array.isArray(active.history) ? active.history.filter((x): x is number => typeof x === "number") : [];
  const allBelowOne = (hist.length > 0 && hist.every((v) => Math.abs(v) < 1) && (!Number.isFinite(numericValue) || Math.abs(numericValue) < 1));
  const { unit: scaledUnit, factor: scaleFactor } = autoRescaleSmallUnit(rawUnit, allBelowOne);
  const displayUnit = scaledUnit;
  const scaledValue = Number.isFinite(numericValue) ? numericValue * scaleFactor : active.value;
  // Yann 16 mai 2026 : guard magnitude % aberrante (ex ASML R&D 32 milliards %
  // = bug data, pas vraie valeur). Affiche "—" avec tooltip + log console.
  const heroPercentAnomaly = isPercentMagnitudeAnomaly(active.value, rawUnit);
  if (heroPercentAnomaly && typeof console !== "undefined") {
    console.warn(
      `[Mettrik] Hero KPI % anomaly on ${company.ticker} / ${active.short}: value=${active.value}, unit=${rawUnit}`,
    );
  }
  const formattedUnit = heroPercentAnomaly ? "" : formatUnit(displayUnit);
  const heroFormatted = heroPercentAnomaly
    ? { value: "—", unit: "" }
    : formatHeroValue(scaledValue, displayUnit);
  // CAGR insensible au factor (ratios), donc on garde history brut.
  // Yann 15 mai 2026 : locale-aware suffix "/ an" → "/ Jahr" / "/ year".
  const heroCAGR = formatCAGR(active.history, displayUnit, active.period_type ?? "year", locale);
  // Yann 15 mai 2026 : label CAGR dynamique selon nombre d'années dans history.
  // Évite "CAGR 5 ans" trompeur quand history = 2 ans (ex META DAP 8 trimestres).
  const heroCagrYears = (() => {
    const h = Array.isArray(active.history) ? active.history.filter((x) => typeof x === "number") : [];
    if (h.length < 2) return 0;
    const stepsPerYear = active.period_type === "quarter" ? 4 : active.period_type === "semester" ? 2 : 1;
    return Math.round(((h.length - 1) / stepsPerYear) * 10) / 10;
  })();
  const interp = useMemo(() => interpretStructured(company, active.short, locale), [company, active.short, locale]);

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
          {/* Logo wordmark Mettrik AI (taille sm) — cliquable, retour home.
              Réutilise le composant MettrikWordmark identique au logo home
              et à la page maintenance. Cohérence brand sur toutes les
              pages. (8 mai 2026) */}
          <Link
            href="/"
            className="group inline-flex shrink-0 items-center gap-3 transition-opacity hover:opacity-90"
            aria-label={t("nav.home")}
          >
            <BrandWordmark size="sm" animated={false} showRail={false} />
            <ArrowLeft className="size-4 text-zinc-500 transition-transform group-hover:-translate-x-0.5 group-hover:text-zinc-300" />
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
                  publicationDate={company.latest_filing?.date}
                  nextEarningsDate={company.next_earnings_date}
                  ticker={company.ticker}
                  alwaysShow
                  size="sm"
                />
              </div>

              <div className="mt-1 flex items-center gap-2.5">
                <AcronymHover
                  align="left"
                  label={(() => {
                    const base = `${active.name_fr}${active.name_en && active.name_en !== active.name_fr ? ` (${active.name_en})` : ""}`;
                    const gloss = ACRONYM_GLOSSARY[active.short] ?? TERM_GLOSSARY[active.short] ?? TERM_GLOSSARY[active.name_fr];
                    return gloss ? `${base} — ${gloss}` : base;
                  })()}
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
                  title={heroPercentAnomaly ? "Donnée incohérente détectée (magnitude aberrante)" : undefined}
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
                {/* YoY pill : masquée si KPI incomplet (= aucune valeur YoY calculable) */}
                {!isIncompleteKpi && (effectiveYoy !== "" || typeof effectiveYoy === "number") && (
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
                    <span className="font-mono tabular-nums">
                      {(() => {
                        // Yann 16 mai 2026 : normalise yoy en format FR
                        // (virgule décimale + espace insécable avant %).
                        // Fix audit Playwright (48/50 stés concernées).
                        if (typeof effectiveYoy === "number") {
                          const n = effectiveYoy as number;
                          return `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
                        }
                        const s = String(effectiveYoy);
                        // Si yoy déjà au format FR (virgule décimale + espace avant %), garde tel quel.
                        if (/\d,\d.*\s%/.test(s)) return s;
                        // Sinon : "+63.4%" devient "+63,4 %" (US -> FR)
                        return s
                          .replace(/(\d)\.(\d)/g, "$1,$2")
                          .replace(/(\d)\s*%/g, "$1 %");
                      })()}
                    </span>
                    <span className="text-[11px] italic text-zinc-400" title="Year-on-Year : variation vs même période l'an dernier">(vs N-1)</span>
                  </div>
                )}
                {/* Quality + percentile chips : masqués si KPI incomplet (= rating bidon "Moyen Top 50 %") */}
                {!isIncompleteKpi && <QualityChipOnly rating={heroRating} />}
                {heroCAGR && (
                  <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#262626] bg-[#0d0d0d] px-3 py-1 font-mono text-[12.5px] tabular-nums text-zinc-200">
                    {heroCAGR}
                    <span className="text-[10.5px] italic text-zinc-400">
                      {heroCagrYears >= 4.5
                        ? t("hero.cagr_5y")
                        : `(CAGR ${heroCagrYears.toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} ${heroCagrYears <= 1 ? (locale === "de" || locale === "de-CH" ? "Jahr" : locale === "fr" ? "an" : "year") : (locale === "de" || locale === "de-CH" ? "Jahre" : locale === "fr" ? "ans" : "years")})`}
                    </span>
                  </div>
                )}
                {!isIncompleteKpi && (
                  <PercentileChipOnly rating={heroRating} scope={company.subsector} />
                )}
                {isIncompleteKpi && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.06] px-3 py-1 text-[11.5px] font-medium text-amber-400">
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    Données partielles : historique en cours
                  </span>
                )}
                <YoungIpoWarning ipo={company.ipo} accent={accent} />
              </div>

              {/* Signal uniquement (sans description) — Yann 6 mai 2026 :
                  le bloc descriptif sous le signal était trop long et
                  inutilement verbeux. Le signal seul suffit pour la PV.
                  Yann 15 mai 2026 : masqué si signal vide (évite box vide). */}
              {typeof active.signal === "string" && active.signal.trim() && (
                <div className="mt-5 flex max-w-md items-start gap-2.5 rounded-xl border border-[#1a1a1a] bg-[#070707] p-3.5">
                  <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: accent }} />
                  <div className="text-[14px] font-semibold leading-snug text-zinc-100">
                    {active.signal}
                  </div>
                </div>
              )}
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
                  graphPeriod={graphPeriod}
                  onGraphPeriodChange={setGraphPeriod}
                  graphPeriodAvailable={{
                    year: true,
                    // Quarter / Semester dispo selon period_type natif du KPI.
                    // (data réelle, sinon désactivé).
                    quarter: active.period_type === "quarter",
                    semester: active.period_type === "semester",
                  }}
                />
                <PeriodToggle accent={accent} />
              </div>
              <div className="mb-3 flex flex-wrap items-baseline justify-center gap-2.5 text-center">
                <span className="text-[24px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[28px]">
                  {active.name_fr}
                  {/* Suffix "par X" si le KPI est divisible (flux) ET que la
                      fréquence sélectionnée n'est pas l'année. (5 mai 2026) */}
                  {timeFraction !== "year" && (
                    <span className="ml-2 text-[18px] font-medium text-zinc-300 sm:text-[22px]">
                      {t(`timefrac.suffix.${timeFraction}`)}
                    </span>
                  )}
                </span>
                {/* Yann 15 mai 2026 : tooltip masqué si pas de contenu (explanation
                    + name_en tous deux vides → tooltip vide style "DÉFINITION" sans
                    body). On l'affiche seulement si au moins un des deux est rempli. */}
                {((typeof active.explanation === "string" && active.explanation.trim())
                  || (active.name_en && active.name_en !== active.name_fr)) && (
                  <InfoTooltip color={accent}>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                      {t("kpi.definition")}
                    </div>
                    {typeof active.explanation === "string" && active.explanation.trim() && (
                      <div className="text-zinc-200">{active.explanation}</div>
                    )}
                    {/* Traduction EN (anciennement affichée inline à côté du
                        titre, déplacée ici pour épurer le titre. 5 mai 2026). */}
                    {active.name_en && active.name_en !== active.name_fr && (
                      <div className="mt-2 border-t border-white/5 pt-2 font-mono text-[11px] italic text-zinc-400">
                        {active.name_en}
                      </div>
                    )}
                  </InfoTooltip>
                )}
                {/* Yann 17 mai 2026 : tooltip "i" fiscal-shifted explicatif.
                    Affiché UNIQUEMENT pour les stés à exercice fiscal décalé
                    (Apple FY end sept, Microsoft juin, NVIDIA jan, etc.) ET
                    quand le hero KPI est trimestriel.
                    But : éviter que l'investisseur pense que Mettrik AI ment
                    quand il voit "T2 2026" alors qu'on est encore en mai. */}
                {active.period_type === "quarter" && isFiscalShifted(company.ticker) && (() => {
                  const fl = fiscalLabelsForTicker(company.ticker, active.last_data_date);
                  if (!fl) return null;
                  const fyEndMonthFr = [
                    "", "janvier", "février", "mars", "avril", "mai", "juin",
                    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
                  ][fl.fiscalYearEndMonth] ?? "?";
                  return (
                    <InfoTooltip color="#f59e0b">
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: "#f59e0b" }}>
                        Exercice fiscal décalé
                      </div>
                      <div className="text-zinc-200 text-[12.5px] leading-relaxed">
                        <strong>{company.name}</strong> a un exercice fiscal qui se termine en{" "}
                        <strong>{fyEndMonthFr}</strong> (pas en décembre comme le calendrier).
                        <br /><br />
                        Sur le graph, <strong>« T{(fl.lastLabel.match(/Q(\d)/)?.[1] ?? "?")} {fl.lastLabel.match(/(\d{4})/)?.[1] ?? ""} »</strong> correspond
                        au trimestre fiscal {fl.lastLabel}, et non au trimestre calendaire.
                        {fl.publicationDate && (
                          <>
                            <br /><br />
                            <span className="text-zinc-400">
                              Dernier trimestre publié officiellement le{" "}
                              {new Date(fl.publicationDate).toLocaleDateString("fr-FR", {
                                day: "numeric", month: "long", year: "numeric",
                              })}.
                            </span>
                          </>
                        )}
                      </div>
                    </InfoTooltip>
                  );
                })()}
              </div>
              {/* TimeFraction toggle visible UNIQUEMENT pour les charts qui ont
                  du sens à diviser ET pour les KPIs où ça PARLE à un investisseur.
                  Yann (12 mai 2026) : limité à 3 familles :
                    - Revenus (revenue, sales, cloud, ARR, run rate, bookings, backlog…)
                    - Marges / bénéfices (margin, profit, income, EPS, EBITDA, FCF…)
                    - Capex / R&D / dépenses (capex, opex, r&d, expense…)
                  Pour Headcount, NPS, subscribers, etc. → toggle masqué. */}
              {(chartMode === "curve" || chartMode === "bars") && isTimeFractionApplicableKpi(active) && (
                // Yann 17 mai 2026 : mb-2 → mb-4 pour aérer la zone entre le
                // toggle Y/M/W/D/H/m/s et le SVG du chart (sinon trop collé
                // au header d'unité + mini-logo au top du SVG).
                <div className="mb-4 flex justify-end">
                  <TimeFractionToggle
                    value={timeFraction}
                    onChange={setTimeFraction}
                    accent={accent}
                  />
                </div>
              )}
              <ChartCycle
                mode={chartMode}
                data={scaleFactor !== 1 ? chartHistoryRaw.map((v) => (typeof v === "number" ? v * scaleFactor : v)) : chartHistoryRaw}
                labels={chartLabels}
                unit={displayUnit}
                color={accent}
                anomalies={anomalies}
                events={(company.events && company.events.length > 0) ? company.events : getCompanyEvents(company.ticker)}
                company={company}
                activeShort={active.short}
                onPickKpi={handleKpiClick}
                ttm={chartTTM}
                barsVariant={barsVariant}
                timeFraction={timeFraction}
                exportTitle={`${active.name_fr}${
                  timeFraction !== "year" ? ` ${t(`timefrac.suffix.${timeFraction}`)}` : ""
                } · ${company.name}`}
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
              <h2 className="text-[22px] font-semibold text-zinc-100">{t("company.kpi_table.title")}</h2>
              <p className="mt-0.5 text-[13.5px] text-zinc-400">
                {t("company.kpi_table.subtitle")}
              </p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              {company.kpis.length} {t("company.kpi_table.count_label")}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#080808]">
            <div className="grid grid-cols-12 gap-3 border-b border-[#1a1a1a] bg-[#0c0c0c] px-5 py-3.5 font-sans text-[11.5px] font-semibold uppercase tracking-[0.12em] text-zinc-300 sm:px-6">
              <div className="col-span-4">{t("company.kpi_table.col_indicator")}</div>
              <div className="col-span-2">{t("company.kpi_table.col_value")} <span className="ml-0.5 italic text-zinc-400" title="Year-on-Year : variation vs même période l'an dernier">(vs N-1)</span></div>
              <div className="col-span-2">{t("company.kpi_table.col_trend")}</div>
              <div className="col-span-4">{t("company.kpi_table.col_quality")}</div>
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

        {/* Graphiques et Schémas de sources diverses (Yann 15 mai 2026 v2).
            Placé SOUS les Stories. Images approuvées dans
            /sandbox/image-findings mergées au SSR dans company.image_findings. */}
        {Array.isArray((company as Company & { image_findings?: unknown[] }).image_findings) &&
        ((company as Company & { image_findings?: unknown[] }).image_findings as unknown[]).length > 0 ? (
          <ImageFindingsBlock
            findings={(company as Company & { image_findings?: ImageFindingPublic[] }).image_findings ?? []}
            accent={accent}
            locale={locale}
          />
        ) : null}

        {/* Stories Dividendes — RETIRÉ de company-view le 7 mai 2026.
            Yann a demandé que tout le travail dividende se fasse uniquement
            dans /concepts/mockups/dividend.tsx tant que la partie n'est pas
            prête. Plus de déploiement V1 ni V1.7 sur ce bloc. */}

        {/* Synthèse Earning Call — bullets PV-driven avec tooltip "i" auto
            sur abréviations / termes techniques. Format unique pour TOUTES
            les sociétés (Yann 11 mai 2026). Bloc rendu UNIQUEMENT si bullets
            dispo. Si pas de bullets et pas de transcript brut : RIEN ne
            s'affiche (Yann 12 mai 2026 : ex AAPL, ne pas afficher de bloc
            vide pour les stés sans transcript accessible). */}
        {transcriptSummary && transcriptSummary.summary?.bullets?.length ? (
          <TranscriptBulletsBlock ticker={company.ticker} summary={transcriptSummary} />
        ) : transcript && (
            (transcript.extracts?.quotes && transcript.extracts.quotes.length > 0) ||
            (transcript.extracts?.figures && transcript.extracts.figures.length > 0) ||
            (transcript.latest?.content && transcript.latest.content.length > 200)
          ) ? (
          <TranscriptStories ticker={company.ticker} doc={transcript} />
        ) : null}

        {/* Bloc Graphiques et Schémas remonté SOUS les Stories (15 mai v2). */}

        {/* Profil société & marché — description longue + snapshot
            boursier + faits clés + sés comparables. (7 mai 2026) */}
        <CompanyProfileCard company={company} accent={accent} />

        {/* Risk factors */}
        {company.risks && company.risks.length > 0 ? (
          <div id="sec-risks" className="scroll-mt-24">
            <RiskStack risks={company.risks} accent={accent} profitWarning={company.profit_warning} />
          </div>
        ) : (
          v18Mode && <V18MissingPlaceholder id="sec-risks" label="Facteurs de risque" hint="Item 1A 10-K à extraire (Sonnet/Haiku Pass 2)." />
        )}

        {/* Répartition CA (géo + segment) — au-dessus de Gouvernance */}
        <RepartitionBlock company={company} />

        {/* Stories Dividendes — réintégré sous Répartition CA pour V1, V1.7
            et V1.8 (Yann 8 mai 2026). Le composant s'auto-active si la
            société a DPS + Cap Return + Payout Ratio dans ses KPIs (ou
            fallback hard-codé pour CAT). Sinon return null = invisible. */}
        <DividendStories company={company} />

        {/* Governance */}
        {company.governance ? (
          <div id="sec-governance" className="scroll-mt-24">
            <GovernanceCard governance={company.governance} ticker={company.ticker} company={company} />
          </div>
        ) : (
          v18Mode && <V18MissingPlaceholder id="sec-governance" label="Gouvernance & rémunération" hint="DEF14A (cat 1) ou rapport annuel à extraire." />
        )}

        {/* AI positioning — placed after risks + governance */}
        {company.ai_positioning ? (
          <div id="sec-ai" className="scroll-mt-24">
            <AIPositioningCard
              positioning={company.ai_positioning}
              companyName={company.name}
              ticker={company.ticker}
            />
          </div>
        ) : (
          v18Mode && <V18MissingPlaceholder id="sec-ai" label="Positionnement IA" hint="Mentions IA dans 10-K à parser via Cerebras Llama 3.3 70B." />
        )}

        {/* Bloc transactions politiciens US retiré (13 mai 2026 par Yann). */}

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
