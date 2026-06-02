"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyFloutageRules, type FloutageRule } from "@/lib/floutage";
import FLOUTAGE_RULES_FILE from "@/data/floutage-free-mode.json";
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
import { isGenericKpi } from "@/lib/kpi-generic";
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
import { BlockComingSoon } from "@/components/block-coming-soon";
import { isBlockEnabled } from "@/lib/v1-9-blocks-control";
import { isBlockDisabledForTicker } from "@/lib/disabled-blocks";
import { YoungIpoWarning } from "@/components/young-ipo-warning";
import { BrandWordmark } from "@/components/brand-wordmark";
import { CompanyProfileCard } from "@/components/company-profile-card";
import { RecentIpoPlaceholder, getRecentIpoMeta } from "@/components/recent-ipo-placeholder";
import { getFiscalAudit, isFiscalShifted, fiscalLabelsForTicker } from "@/lib/fiscal-calendar";
import { aggregateQuarterlyToAnnual, getKpiAggregationKind } from "@/lib/kpi-aggregation";
import { buildChartSpec } from "@/lib/chart-template";
import { verifyAndFix } from "@/lib/chart-spec-verify";
import { BlurredFreeValue } from "@/components/freemium/blurred-free-value";
import { BlurredFreeText } from "@/components/freemium/blurred-free-text";
import type { UserTier } from "@/lib/freemium/context";

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
  // Yann 19 mai 2026 : ajout des codes devise texte (EUR, USD, GBP, etc.)
  // en plus des symboles ($, €, £, ¥). Le pipeline LLM peut sortir l'un
  // ou l'autre format. Ex NESTE.HE Revenue unité = "M EUR" (texte) →
  // sans cette extension, le toggle par jour/semaine/mois était masqué.
  const isMonetary =
    /[$€£¥]/.test(unit) ||
    /\b(EUR|USD|GBP|CHF|JPY|CAD|AUD|DKK|SEK|NOK|HKD|CNY|INR|BRL|MXN|ZAR|KRW|PLN)\b/i.test(unit);
  if (!isMonetary) return false;
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
  freemiumTier,
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
  /** Yann (25 mai 2026) : tier freemium pour floutage chiffres + textes PV.
   *  Si "free"/"anon" sur une sté non accessible (≠ GOOGL/META), floute les
   *  chiffres importants + textes plus-value. Provider FreemiumBlurProvider
   *  doit être posé côté SSR (page.tsx V1.9 / V1.9.5). */
  freemiumTier?: UserTier;
}) {
  // Yann (25 mai 2026) : helper local — true si on doit flouter pour ce tier
  // sur cette sté (free + sté non accessible en free).
  const freeBlocked =
    (freemiumTier === "free" || freemiumTier === "anon") &&
    !["GOOGL", "GOOG", "META"].includes(company.ticker.toUpperCase());

  // Yann (1er juin 2026) : applique les règles FREE mode universelles
  // (src/data/floutage-rules.json) dès que freeBlocked === true.
  // Délai 100 ms pour laisser le DOM se rendre + retry observer pour les
  // sections lazy-chargées (transcript-bullets, super-kpi).
  useEffect(() => {
    if (!freeBlocked) return;
    const rules = (FLOUTAGE_RULES_FILE as { rules?: FloutageRule[] }).rules ?? [];
    if (rules.length === 0) return;
    let cleanup: (() => void) | null = null;
    const t1 = setTimeout(() => {
      cleanup = applyFloutageRules(rules);
    }, 150);
    // Retry pour blocs lazy (chart, transcript)
    const t2 = setTimeout(() => {
      if (cleanup) cleanup();
      cleanup = applyFloutageRules(rules);
    }, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (cleanup) cleanup();
    };
  }, [freeBlocked, company.ticker]);

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
  // Yann (1er juin 2026) : default Trimestriel pour TOUTES les stés. Pour les
  // stés qui reportent en semestriel, on bascule sur semester. Sinon quarter.
  // L'utilisateur peut toujours switcher vers Annuel via le toggle.
  const heroDefaultPeriod = (() => {
    const hk = company.kpis?.find((k) => k.short === company.hero_kpi) ?? company.kpis?.[0];
    const pt = hk?.period_type;
    if (pt === "semester") return "semester";
    return "quarter";
  })();
  const [graphPeriod, setGraphPeriod] = useState<"year" | "quarter" | "semester">(heroDefaultPeriod);
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
      // Yann 19 mai 2026 ~22h : si fiscal shifted, préfixer "FY" sur axe X.
      const kind = getKpiAggregationKind(active);
      const agg = aggregateQuarterlyToAnnual(active.history ?? [], active.last_data_date, kind, fyEndMonth);
      if (isFiscalShifted) {
        return agg.years.map((y) => {
          const short = String(y).slice(-2);
          return `FY${short}`;
        });
      }
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
  // Yann 19 mai 2026 — masquage des KPIs génériques (Revenue, Op Margin,
  // EPS, EBITDA, etc.) : ces KPIs sont présents par défaut chez 95 % des
  // stés et n'apportent aucune PV différentiante. Ils sont conservés en
  // data mais retirés du rendu app par défaut. Source de vérité = liste
  // `kpi-generic-library.json` (matching par `short`).
  // Activation possible par catégorie via `generic-kpi-activations.json`
  // (à venir Phase 2 — pour l'instant tout masqué).
  const orderedKpis = useMemo(() => {
    const all = orderKpis(company.kpis, company.hero_kpi);
    // Hero KPI toujours visible (même s'il est dans la library générique,
    // ex pour SP500 où on a activé manuellement Revenue comme hero).
    const heroShort = company.hero_kpi;
    // Yann 26 mai 2026 — Règle ABSOLUE : aucun KPI hero ou Indicateurs clés
    // avec moins de 3 ans d'historique. Sources :
    // 1. enrich._kpis_hidden_by_history_rule (produit par fix-hero-kpi-history.py)
    // 2. Filtre live : history.length < seuil pour son period_type
    //    (year/undefined → 3, quarter → 12, semester → 6).
    const hiddenByRule = new Set(
      ((company as unknown as { _kpis_hidden_by_history_rule?: string[] })
        ._kpis_hidden_by_history_rule) || []
    );
    // Yann 27 mai 2026 : seuil relâché. 12 quarters = 3 ans était trop strict,
    // filtrait 14/15 KPIs sur GOOGL (segments newly disclosed). Maintenant
    // 4 quarters = 1 an minimum, semestre 2 = 1 an, année 3 = 3 ans.
    const requiredForPeriod = (pt?: string) => {
      if (pt === "quarter") return 4;
      if (pt === "semester") return 2;
      return 3; // year or undefined
    };
    // Yann 28 mai 2026 — REVERT des fallback "min 5 indicateurs" qui
    // incluaient des KPIs génériques (Revenue / Op Margin / EPS / Net
    // Income / Capex / R&D / Headcount / etc.) en violation directe de la
    // règle §0septies "KPI SPÉCIFIQUES UNIQUEMENT" (édictée 19 mai).
    // Aucun fallback n'inclut plus de génériques. Si <5 spécifiques
    // disponibles pour une sté, on affiche MOINS de 5 — c'est honnête
    // côté contenu vs faux confort "5 visibles" avec génériques.
    return all.filter((k) => {
      if (k.short === heroShort) return true;
      if (isGenericKpi(k.short)) return false;
      if (hiddenByRule.has(k.short)) return false;
      const hist = Array.isArray(k.history) ? k.history : [];
      const pt = (k as unknown as { period_type?: string }).period_type;
      if (hist.length < requiredForPeriod(pt)) return false;
      return true;
    });
  }, [company]);
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

  // Yann (1er juin 2026) : sociétés cotées depuis moins de 24 mois (7 stés
  // identifiées sur V1.9.5 = CRWV / FLTR.L / GEV / Q / RDDT / SNDK / SOLV).
  // On garde le bloc TOP (logo, nom, ticker, variation %, prix via
  // CompanyHeader + StockPriceBlock) et on remplace tout le reste par le
  // RecentIpoPlaceholder. Pas d'analyse fiable possible sans 5 ans
  // d'historique et de tendances.
  const recentIpoMeta = getRecentIpoMeta(company.ticker);
  if (recentIpoMeta) {
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

        <main className="relative mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
          <nav className="mb-9 flex flex-nowrap items-center gap-3 whitespace-nowrap">
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
              <ThemeToggle />
              {authSlot}
            </div>
          </nav>

          <CompanyHeader
            company={company}
            hidePriceBar={hidePriceBar || isBlockDisabledForTicker(company.ticker, "snapshot_boursier")}
            freeBlocked={false}
          />

          <RecentIpoPlaceholder
            ticker={company.ticker}
            ipoLabel={recentIpoMeta.ipoLabel}
            monthsUntilReady={recentIpoMeta.readyInMonths}
          />
        </main>
      </div>
    );
  }

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

        {/* Rich company header.
            Yann 26 mai 2026 : snapshot_boursier (= StockPriceBlock dans le
            header) désactivable via /sandbox/v1-8/blocks-toggle. Quand
            désactivé, la description Mettrik passe full-width côté
            CompanyProfileCard (cf prop hideSnapshot ci-dessous). */}
        <CompanyHeader
          company={company}
          hidePriceBar={hidePriceBar || isBlockDisabledForTicker(company.ticker, "snapshot_boursier")}
          freeBlocked={false}
        />

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
                {/* Yann 19 mai 2026 : garde-fou data — affiche un badge
                    "Data en cours" si le hero KPI a une history < 4 points
                    OU period_type=quarter avec une série monotone décr 3-5
                    pts (= probablement de l'annuel mal étiqueté, cf audit
                    81/307 stés top V1.8). Signal honnête pour l'investisseur
                    + ping CONV-DATA pour enrichissement. */}
                {(() => {
                  const h = Array.isArray(active.history) ? active.history : [];
                  const tooShort = h.length > 0 && h.length < 4;
                  const looksAnnualMislabel =
                    active.period_type === "quarter" &&
                    h.length >= 3 &&
                    h.length <= 8 &&
                    h.every((v, i) => i === 0 || (typeof v === "number" && typeof h[i - 1] === "number" && v <= (h[i - 1] as number)));
                  if (!tooShort && !looksAnnualMislabel) return null;
                  const isFr = locale === "fr";
                  return (
                    <InfoTooltip color="#fb923c">
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-orange-400">
                        {isFr ? "Data en cours d'enrichissement" : "Data being enriched"}
                      </div>
                      <div className="text-zinc-200 text-[12.5px] leading-relaxed">
                        {isFr ? (
                          <>
                            L&apos;historique de ce KPI sur cette société est{" "}
                            {tooShort ? <>limité à <strong>{h.length} points</strong></> : <>peut-être mal étiqueté en trimestriel</>}.
                            Le pipeline d&apos;extraction Mettrik continue d&apos;enrichir les sources publiques pour cette société.
                            Les chiffres affichés restent fidèles aux dépôts officiels disponibles.
                          </>
                        ) : (
                          <>
                            The history of this KPI for this company is{" "}
                            {tooShort ? <>limited to <strong>{h.length} data points</strong></> : <>possibly mislabeled as quarterly</>}.
                            Mettrik&apos;s extraction pipeline continues to enrich public sources for this company.
                            Displayed values remain faithful to available official filings.
                          </>
                        )}
                      </div>
                    </InfoTooltip>
                  );
                })()}
                {/* Yann 19 mai 2026 : tooltip "Exercice fiscal décalé"
                    (i orange) déplacé du titre KPI vers la zone "À jour"
                    pour ne pas polluer visuellement le titre + cohérence
                    avec les autres infos meta de cette zone (date
                    fraîcheur, fréquence). */}
                {isFiscalShifted(company.ticker) && (() => {
                  const fl = fiscalLabelsForTicker(company.ticker, active.last_data_date);
                  if (!fl) return null;
                  const fyEndMonthFr = [
                    "", "janvier", "février", "mars", "avril", "mai", "juin",
                    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
                  ][fl.fiscalYearEndMonth] ?? "?";
                  const fyEndMonthEn = [
                    "", "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December",
                  ][fl.fiscalYearEndMonth] ?? "?";
                  const isFr = locale === "fr";
                  // Yann 27 mai 2026 : refonte tooltip "Exercice fiscal décalé".
                  // - Garder explication FY décalé
                  // - Retirer la phrase "On the chart Q4 refers to..." (outdated, confuse)
                  // - Lire le dernier trimestre RÉEL via active.last_data_date ou
                  //   company.latest_filing?.date (plutôt que fiscal-audit.json stale)
                  // - Ajouter info sur prochain earning attendu (company.next_earnings_date)
                  // - Sync avec chip Freshness : si earning attendu en retard, le mentionner
                  const latestData = active.last_data_date ?? company.latest_filing?.period_end ?? null;
                  const filingDate = company.latest_filing?.date ?? fl.publicationDate ?? null;
                  const nextEarningsDate = company.next_earnings_date ?? null;
                  const dateFmt = (iso: string | null) =>
                    iso
                      ? new Date(iso).toLocaleDateString(isFr ? "fr-FR" : "en-US", {
                          day: "numeric", month: "long", year: "numeric",
                        })
                      : null;
                  const today = new Date();
                  today.setUTCHours(0, 0, 0, 0);
                  const isEarningPending =
                    nextEarningsDate && latestData
                      ? (() => {
                          try {
                            const nextD = new Date(nextEarningsDate.split("T")[0]);
                            const lastD = new Date(latestData.split("T")[0]);
                            return (
                              !Number.isNaN(nextD.getTime()) &&
                              !Number.isNaN(lastD.getTime()) &&
                              nextD.getTime() < today.getTime() &&
                              lastD.getTime() < nextD.getTime()
                            );
                          } catch {
                            return false;
                          }
                        })()
                      : false;
                  return (
                    <InfoTooltip color="#f59e0b">
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: "#f59e0b" }}>
                        {isFr ? "Exercice fiscal décalé" : "Shifted fiscal year"}
                      </div>
                      <div className="text-zinc-200 text-[12.5px] leading-relaxed">
                        {isFr ? (
                          <>
                            <strong>{company.name}</strong> a un exercice fiscal qui se termine en{" "}
                            <strong>{fyEndMonthFr}</strong> (pas en décembre comme le calendrier).
                          </>
                        ) : (
                          <>
                            <strong>{company.name}</strong>&apos;s fiscal year ends in{" "}
                            <strong>{fyEndMonthEn}</strong> (not December like the calendar year).
                          </>
                        )}
                        {fl.lastLabel && (
                          <>
                            <br /><br />
                            <span className="text-zinc-300">
                              {isFr ? "Dernier trimestre publié : " : "Latest published quarter: "}
                              <strong>{fl.lastLabel}</strong>
                              {filingDate && (
                                <>
                                  {" "}
                                  <span className="text-zinc-400">
                                    ({isFr ? "publié le " : "filed on "}
                                    {dateFmt(filingDate)})
                                  </span>
                                </>
                              )}
                            </span>
                          </>
                        )}
                        {nextEarningsDate && (
                          <>
                            <br />
                            <span style={{ color: isEarningPending ? "#fbbf24" : "#facc15" }}>
                              {isEarningPending
                                ? isFr
                                  ? "Earning attendu : "
                                  : "Earning pending: "
                                : isFr
                                  ? "Prochain earning : "
                                  : "Next earning: "}
                              <strong>{fl.nextLabel}</strong>
                              {" "}
                              <span className="opacity-80">({dateFmt(nextEarningsDate)})</span>
                            </span>
                          </>
                        )}
                      </div>
                    </InfoTooltip>
                  );
                })()}
              </div>

              <div className="mt-1 flex items-center gap-2.5">
                <AcronymHover
                  align="left"
                  label={(() => {
                    const base = `${active.name_fr}${active.name_en && active.name_en !== active.name_fr ? ` (${active.name_en})` : ""}`;
                    const gloss = ACRONYM_GLOSSARY[active.short] ?? TERM_GLOSSARY[active.short] ?? TERM_GLOSSARY[active.name_fr];
                    return gloss ? `${base}, ${gloss}` : base;
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
                {freeBlocked ? (
                  <div style={{ fontSize: "clamp(40px, 7vw, 72px)" }}>
                    <BlurredFreeValue
                      value={heroFormatted.value}
                      suffix={heroFormatted.unit ? ` ${heroFormatted.unit}` : ""}
                      ticker={company.ticker}
                    />
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              <div className="mt-3 flex flex-col items-start gap-2">
                {/* YoY pill : masquée si KPI incomplet (= aucune valeur YoY calculable) */}
                {!isIncompleteKpi && (effectiveYoy !== "" || typeof effectiveYoy === "number") && (
                  <div
                    className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
                    style={{
                      color: freeBlocked ? "#52525b" : yoyColor,
                      borderColor: `${freeBlocked ? "#52525b" : yoyColor}40`,
                      background: `${freeBlocked ? "#52525b" : yoyColor}12`,
                    }}
                  >
                    {!freeBlocked && tone === "pos" && <ArrowUpRight className="size-4" />}
                    {!freeBlocked && tone === "neg" && <ArrowDownRight className="size-4" />}
                    <span className="font-mono tabular-nums">
                      {freeBlocked ? (
                        <BlurredFreeValue value="+0,0" suffix=" %" ticker={company.ticker} />
                      ) : (() => {
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
                    {freeBlocked ? (
                      <BlurredFreeValue value="+0,0 %/an" ticker={company.ticker} />
                    ) : (
                      heroCAGR
                    )}
                    <span className="text-[10.5px] italic text-zinc-400">
                      {heroCagrYears >= 4.5
                        ? t("hero.cagr_5y")
                        : `(CAGR ${heroCagrYears.toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} ${heroCagrYears <= 1 ? (locale === "de" || locale === "de-CH" ? "Jahr" : locale === "fr" ? "an" : "year") : (locale === "de" || locale === "de-CH" ? "Jahre" : locale === "fr" ? "ans" : "years")})`}
                    </span>
                  </div>
                )}
                {!isIncompleteKpi && !freeBlocked && (
                  <PercentileChipOnly rating={heroRating} scope={company.subsector} />
                )}
                {!isIncompleteKpi && freeBlocked && (
                  <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#262626] bg-[#0d0d0d] px-3 py-1 font-mono text-[12.5px] text-zinc-200">
                    <BlurredFreeValue value="Top 5 %" ticker={company.ticker} />
                  </div>
                )}
                {isIncompleteKpi && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.06] px-3 py-1 text-[11.5px] font-medium text-amber-400">
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    {t("kpi.partial_data_full")}
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
                  <BlurredFreeText blocked={freeBlocked} ticker={company.ticker} className="flex-1">
                    <div className="text-[14px] font-semibold leading-snug text-zinc-100">
                      {active.signal}
                    </div>
                  </BlurredFreeText>
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
              {/* Yann 19 mai 2026 : toggles TOUJOURS centrés.
                  Avant : `justify-between` poussait ChartCycleControls à
                  gauche + PeriodToggle à droite → quand l'un des deux
                  était caché (ex : sté sans quarterly history), le reste
                  flottait collé sur sa bordure (très moche).
                  Après : `justify-center` + gap. Les groupes restent
                  centrés ensemble, séparés par un petit dot iridescent
                  pour différentier visuellement les 2 familles d'onglets
                  (modes graph + période vs fenêtre 5/10/20 ans). */}
              <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
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
                {/* Séparateur décoratif : visible uniquement si les 2 groupes
                    sont rendus simultanément (rare PeriodToggle soit caché,
                    on garde par sécurité un :only-child:hidden CSS-like via
                    le `gap-3` qui gère naturellement le cas seul). */}
                <span aria-hidden className="size-1 rounded-full bg-violet-400/40" />
                <PeriodToggle accent={accent} />
              </div>
              <div className="mb-3 flex flex-wrap items-baseline justify-center gap-2.5 text-center">
                <span className="text-[24px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[28px]">
                  {/* Yann (27 mai 2026) : hero title doit suivre la locale.
                      Avant : hardcoded active.name_fr → en EN/DE on voyait du FR.
                      Maintenant : name_en pour EN, name_de pour DE, name_fr sinon. */}
                  {(() => {
                    type N = typeof active & { name_de?: string; name_en?: string };
                    const a = active as N;
                    if (locale === "en" || locale === "en-GB") return a.name_en || a.name_fr;
                    if (locale === "de" || locale === "de-CH") return a.name_de || a.name_en || a.name_fr;
                    return a.name_fr;
                  })()}
                  {/* Suffix "par X" si le KPI est divisible (flux) ET que la
                      fréquence sélectionnée n'est pas l'année. (5 mai 2026) */}
                  {timeFraction !== "year" && (
                    <span className="ml-2 text-[18px] font-medium text-zinc-300 sm:text-[22px]">
                      {t(`timefrac.suffix.${timeFraction}`)}
                    </span>
                  )}
                </span>
                {/* Yann 15 mai 2026 : tooltip masqué si pas de contenu.
                    Yann 19 mai 2026 : prise en compte des champs i18n
                    `explanation_fr` / `explanation_en` si présents dans le
                    dataset (CONV-TRAD enrichira progressivement). Fallback
                    sur `active.explanation` (souvent EN brut de pipeline). */}
                {(() => {
                  type WithI18n = typeof active & { explanation_fr?: string; explanation_en?: string };
                  const a = active as WithI18n;
                  const isFr = locale === "fr";
                  const localExplanation = isFr
                    ? (a.explanation_fr || a.explanation || "")
                    : (a.explanation_en || a.explanation || "");
                  const hasContent =
                    (localExplanation && localExplanation.trim()) ||
                    (active.name_en && active.name_en !== active.name_fr);
                  if (!hasContent) return null;
                  return (
                    <InfoTooltip color={accent}>
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                        {t("kpi.definition")}
                      </div>
                      {localExplanation && localExplanation.trim() && (
                        <div className="text-zinc-200">{localExplanation}</div>
                      )}
                      {active.name_en && active.name_en !== active.name_fr && (
                        <div className="mt-2 border-t border-white/5 pt-2 font-mono text-[11px] italic text-zinc-400">
                          {active.name_en}
                        </div>
                      )}
                    </InfoTooltip>
                  );
                })()}
                {/* Yann 19 mai 2026 : ancien tooltip orange "Exercice fiscal
                    décalé" DÉPLACÉ vers la zone "À jour" (col gauche) pour
                    ne pas surcharger le titre KPI. Voir code ~ligne 535. */}
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
                events={isBlockDisabledForTicker(company.ticker, "events") ? [] : ((company.events && company.events.length > 0) ? company.events : getCompanyEvents(company.ticker))}
                company={company}
                activeShort={active.short}
                onPickKpi={handleKpiClick}
                ttm={chartTTM}
                barsVariant={barsVariant}
                timeFraction={timeFraction}
                exportTitle={`${(() => {
                  type N = typeof active & { name_de?: string; name_en?: string };
                  const a = active as N;
                  if (locale === "en" || locale === "en-GB") return a.name_en || a.name_fr;
                  if (locale === "de" || locale === "de-CH") return a.name_de || a.name_en || a.name_fr;
                  return a.name_fr;
                })()}${
                  timeFraction !== "year" ? ` ${t(`timefrac.suffix.${timeFraction}`)}` : ""
                } · ${company.name}`}
              />
            </div>
          </div>

          {/* Interpretation INSIDE hero panel */}
          {isBlockEnabled("interpretation", company.ticker) ? (
            <div className="mt-6">
              <BlurredFreeText blocked={freeBlocked} ticker={company.ticker}>
                <InterpretationBlock block={interp} accent={accent} />
              </BlurredFreeText>
            </div>
          ) : (
            <BlockComingSoon blockId="interpretation" />
          )}
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
              {/* Yann (26 mai 2026) : compte affiché = orderedKpis (après filtre
                  isGenericKpi) au lieu de company.kpis.length (total brut).
                  Avant : Broadcom affichait "31 indicateurs" mais ne montrait
                  que 5 (génériques filtrés), sans bouton "voir plus". */}
              {orderedKpis.length} {t("company.kpi_table.count_label")}
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
                freeBlocked={freeBlocked}
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
        {isBlockEnabled("stories", company.ticker) && !isBlockDisabledForTicker(company.ticker, "kpi_stories") ? (
          hasStories(company.kpis, company.market_positions) && (
            <KpiStories company={company} freeBlocked={freeBlocked} />
          )
        ) : (
          <BlockComingSoon blockId="stories" />
        )}

        {/* Graphiques et Schémas de sources diverses (Yann 15 mai 2026 v2).
            Placé SOUS les Stories. Images approuvées dans
            /sandbox/image-findings mergées au SSR dans company.image_findings. */}
        {isBlockEnabled("image_findings", company.ticker) && !isBlockDisabledForTicker(company.ticker, "graphiques_schemas") ? (
          Array.isArray((company as Company & { image_findings?: unknown[] }).image_findings) &&
          ((company as Company & { image_findings?: unknown[] }).image_findings as unknown[]).length > 0 ? (
            <ImageFindingsBlock
              findings={(company as Company & { image_findings?: ImageFindingPublic[] }).image_findings ?? []}
              accent={accent}
              locale={locale}
            />
          ) : null
        ) : (
          <BlockComingSoon blockId="image_findings" />
        )}

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
        {isBlockEnabled("transcripts", company.ticker) && !isBlockDisabledForTicker(company.ticker, "transcript_bullets") ? (
          transcriptSummary && transcriptSummary.summary?.bullets?.length ? (
            <TranscriptBulletsBlock ticker={company.ticker} summary={transcriptSummary} />
          ) : transcript && (
              (transcript.extracts?.quotes && transcript.extracts.quotes.length > 0) ||
              (transcript.extracts?.figures && transcript.extracts.figures.length > 0) ||
              (transcript.latest?.content && transcript.latest.content.length > 200)
            ) ? (
            <TranscriptStories ticker={company.ticker} doc={transcript} />
          ) : null
        ) : (
          <BlockComingSoon blockId="transcripts" />
        )}

        {/* Bloc Graphiques et Schémas remonté SOUS les Stories (15 mai v2). */}

        {/* Profil société & marché — description longue + snapshot
            boursier + faits clés + sés comparables. (7 mai 2026).
            Yann 26 mai 2026 : description_mettrik + snapshot (carte
            "Snapshot boursier" dans le bloc) désactivables séparément
            via /sandbox/v1-8/blocks-toggle. Si snapshot off → description
            full-width automatique. */}
        <CompanyProfileCard
          company={company}
          accent={accent}
          hideDescription={isBlockDisabledForTicker(company.ticker, "description_mettrik")}
          hideSnapshot={isBlockDisabledForTicker(company.ticker, "snapshot_boursier")}
        />

        {/* Risk factors */}
        {isBlockEnabled("risks", company.ticker) && !isBlockDisabledForTicker(company.ticker, "risks") ? (
          company.risks && company.risks.length > 0 ? (
            <div id="sec-risks" className="scroll-mt-24">
              <RiskStack risks={company.risks} accent={accent} profitWarning={company.profit_warning} freeBlocked={freeBlocked} ticker={company.ticker} />
            </div>
          ) : (
            v18Mode && <V18MissingPlaceholder id="sec-risks" label="Facteurs de risque" hint="Item 1A 10-K à extraire (Sonnet/Haiku Pass 2)." />
          )
        ) : (
          <BlockComingSoon blockId="risks" id="sec-risks" />
        )}

        {/* Répartition CA (géo + segment) — au-dessus de Gouvernance */}
        {isBlockEnabled("repartition", company.ticker) ? (
          <RepartitionBlock company={company} />
        ) : (
          <BlockComingSoon blockId="repartition" />
        )}

        {/* Stories Dividendes — réintégré sous Répartition CA pour V1, V1.7
            et V1.8 (Yann 8 mai 2026). Le composant s'auto-active si la
            société a DPS + Cap Return + Payout Ratio dans ses KPIs (ou
            fallback hard-codé pour CAT). Sinon return null = invisible. */}
        {isBlockEnabled("dividend", company.ticker) ? (
          <DividendStories company={company} />
        ) : (
          <BlockComingSoon blockId="dividend" />
        )}

        {/* Governance */}
        {isBlockEnabled("governance", company.ticker) && !isBlockDisabledForTicker(company.ticker, "gouvernance") ? (
          company.governance ? (
            <div id="sec-governance" className="scroll-mt-24">
              <GovernanceCard governance={company.governance} ticker={company.ticker} company={company} freeBlocked={freeBlocked} />
            </div>
          ) : (
            v18Mode && <V18MissingPlaceholder id="sec-governance" label="Gouvernance & rémunération" hint="DEF14A (cat 1) ou rapport annuel à extraire." />
          )
        ) : (
          <BlockComingSoon blockId="governance" id="sec-governance" />
        )}

        {/* AI positioning — Yann 20 mai 2026 : masquer si stance=absent (= 10-K ne mentionne pas IA).
            Pas de bloc vide ou "Absent". Soit la sté a du AI réel à montrer, soit on masque. */}
        {isBlockEnabled("ai_positioning", company.ticker) && !isBlockDisabledForTicker(company.ticker, "ai_positioning") ? (
          (() => {
            const ai = company.ai_positioning;
            if (!ai) return v18Mode ? <V18MissingPlaceholder id="sec-ai" label="Positionnement IA" hint="Mentions IA dans 10-K à parser via Cerebras Llama 3.3 70B." /> : null;
            // Masque si stance="absent" OU pas d'evidence (= pas de positionnement réel à montrer)
            if (ai.stance === "absent" || !Array.isArray(ai.evidence) || ai.evidence.length === 0) return null;
            return (
              <div id="sec-ai" className="scroll-mt-24">
                <AIPositioningCard
                  positioning={ai}
                  companyName={company.name}
                  ticker={company.ticker}
                  freeBlocked={freeBlocked}
                />
              </div>
            );
          })()
        ) : (
          <BlockComingSoon blockId="ai_positioning" id="sec-ai" />
        )}

        {/* Bloc transactions politiciens US retiré (13 mai 2026 par Yann). */}

        {/* Super-KPI Mettrik — bloc final, combinaisons composites */}
        <SuperKpiBoard
          kpis={computeSuperKpis(company, locale)}
          sectorKpis={computeSectorSuperKpis(company, locale)}
          companyName={company.name}
          ticker={company.ticker}
          accent={accent}
        />

        {/* Provenance — Yann 26 mai 2026 : déplacée du haut (sous le header)
            vers le bas de page. Ligne discrète, italique, max-w-3xl, juste
            avant le footer. */}
        <p className="mt-12 max-w-3xl text-[11.5px] italic leading-relaxed text-zinc-500">
          {t("company.provenance")}
        </p>

        <footer className="mt-6 pb-8 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          Mettrik AI · KPI Intelligence
        </footer>
      </main>

      <CompanyNavChrome />
    </div>
  );
}
