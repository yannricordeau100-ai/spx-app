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
} from "lucide-react";

import {
  type Company,
  type KPI,
  cagr,
  formatCAGR,
  formatKpiValue,
  formatUnit,
  findComparable,
  getHero,
  interpretStructured,
  formatHeroValue,
  yoySamePeriod,
} from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { autoRescaleSmallUnit, isPercentMagnitudeAnomaly } from "@/lib/format-hero";
import { translateUnitFrToEn } from "@/lib/i18n/unit-translations";
import { translate } from "@/lib/i18n/dictionary";
import { chartAxisHeader } from "@/lib/chart-axis-header";
import { brand, rate, detectAnomalies } from "@/lib/brand";
import { smoothScrollTo } from "@/lib/scroll";
import { Spotlight } from "@/components/effects/spotlight";
import { NumberTicker } from "@/components/effects/number-ticker";
import { ChartCycle, ChartCycleControls, useChartMode, computeChartDisplay } from "@/components/chart-cycle";
import { TimeFractionToggle, timeFractionDivisor, type TimeFraction } from "@/components/charts/time-fraction-toggle";
import { KpiRow } from "@/components/kpi-row";
import { QualityBadge, QualityChipOnly, PercentileChipOnly } from "@/components/quality-badge";
import { CompanyHeader } from "@/components/company-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { PeriodToggle } from "@/components/period-toggle";
import { InfoTooltip } from "@/components/info-tooltip";
import { InterpretationBlock } from "@/components/interpretation-block";
// Yann 12 juin 2026 : events liés au graph retirés (plus d'import getCompanyEvents).
import { CompareControl } from "@/components/compare-control";
import { ComparePanel } from "@/components/compare-panel";
import { KpiStories } from "@/components/kpi-stories";
import { hasStories } from "@/lib/kpi-stories-ordering";
import { orderKpis, isPhysicalKpi } from "@/lib/kpi-ordering";
import { isGenericKpi } from "@/lib/kpi-generic";
import { isTotalRevenueLabel } from "@/lib/kpi-total-revenue";
import { RiskStack } from "@/components/risk-stack";
import { AntiTheseCard } from "@/components/anti-these-card";
import { AIPositioningCard } from "@/components/ai-positioning-card";
import { PageSearch } from "@/components/page-search";
import { GovernanceCard } from "@/components/governance-card";
import { RepartitionBlock } from "@/components/repartition-block";
import { FreshnessIndicator } from "@/components/freshness-indicator";
import { getFreshnessReference } from "@/lib/freshness/compute-tier";
import { CompanyNavChrome } from "@/components/company-nav-chrome";
import { KpiSwapTitle } from "@/components/kpi-swap-title";
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
import { getFiscalAudit, isFiscalShifted, fiscalLabelsForTicker, fiscalQuarterToCalendar } from "@/lib/fiscal-calendar";
import { aggregateQuarterlyToAnnual, getKpiAggregationKind } from "@/lib/kpi-aggregation";
import { buildChartSpec } from "@/lib/chart-template";
import { verifyAndFix } from "@/lib/chart-spec-verify";
import { BlurredFreeValue } from "@/components/freemium/blurred-free-value";
import { BlurredFreeText } from "@/components/freemium/blurred-free-text";
import type { UserTier } from "@/lib/freemium/context";

const VISIBLE_KPI_COUNT = 6;

// Yann 8 juin 2026 : un KPI n'est affichable que s'il a une VRAIE valeur non
// nulle. Un "0,0" n'apporte aucune plus-value et trahit presque toujours une
// extraction ratee (ex Cap Return avec history toute a zero sur 226 stes).
// Applique au tableau Indicateurs cles + au hero par defaut + aux stories.
function kpiHasUsableValue(k?: { value?: unknown } | null): boolean {
  if (!k) return false;
  const v = k.value;
  if (typeof v === "number") return Number.isFinite(v) && Math.abs(v) > 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "" || s === "—") return false;
    const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && Math.abs(n) > 0;
  }
  return false;
}

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
  disabledBlocks,
  historyLimitYears,
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
  /** Yann 9 juin 2026 : liste des blocs désactivés (Supabase + fallback
   *  JSON) résolue côté serveur via `resolveDisabledForTicker(ticker)` et
   *  passée en prop. Si fournie, prime sur le fallback client
   *  `isBlockDisabledForTicker` (JSON only). Les pages qui ne la passent
   *  pas encore (v1-8, v1-7-5) gardent le fallback JSON sans régression. */
  disabledBlocks?: string[];
  /** Yann 9 juin 2026 : si la profondeur de données réelle d'une sté est
   *  limitée (ex rupture de segment : APH/AIZ/CAH = 4 ans), affiche un "i"
   *  permanent à gauche du titre hero (indépendant du KPI sélectionné). */
  historyLimitYears?: number;
}) {
  // Yann 9 juin 2026 : helper unique pour savoir si un bloc est désactivé.
  // Si `disabledBlocks` est fourni (page V1.9.5, source Supabase résolue
  // côté serveur), on lit cette prop + expansion legacy gouvernance_top3.
  // Sinon fallback sur isBlockDisabledForTicker (JSON only, client-safe)
  // pour ne pas casser les pages qui ne passent pas encore la prop.
  const isDisabled = (k: string): boolean =>
    disabledBlocks
      ? disabledBlocks.includes(k) ||
        ((k === "gouvernance_top3_votes" || k === "gouvernance_top3_capital") &&
          disabledBlocks.includes("gouvernance_top3"))
      : isBlockDisabledForTicker(company.ticker, k);
  // Yann (25 mai 2026) : helper local — true si on doit flouter pour ce tier
  // sur cette sté (free + sté non accessible en free).
  const freeBlocked =
    (freemiumTier === "free" || freemiumTier === "anon") &&
    !["GOOGL", "GOOG", "META"].includes(company.ticker.toUpperCase());

  // Yann (8 juin 2026) : thème clair réservé aux offres PAYANTES (premium + max).
  // Anonyme + free = non payant → toggle clair verrouillé + thème sombre forcé.
  const isPaidTier = freemiumTier === "premium" || freemiumTier === "max";

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

  // Yann 2 juin 2026 — fix onglet trimestriel manquant (AAPL/GOOGL).
  // Quand `hero_kpi_override` redirige le hero vers un KPI annuel (ex AAPL :
  // Services Revenue <3 ans → fallback iPhone Revenue annuel) alors qu'un
  // autre KPI a une vraie history quarterly ≥4 trims (typiquement
  // "Total Revenue" via _super_kpi_inputs ou pipeline initial), on
  // détecte le meilleur KPI quarterly pour booster le default hero
  // affiché. Préserve l'override comme info mais expose le toggle
  // Trimestriel à l'utilisateur.
  const bestQuarterlyKpiShort = useMemo(() => {
    const kpis = company.kpis ?? [];
    let best: { short: string; len: number } | null = null;
    for (const k of kpis) {
      if (k.period_type !== "quarter") continue;
      // Yann 9 juin 2026 : le hero auto ne doit JAMAIS être un % / une marge
      // ni un KPI générique (ex AAPL tombait sur Gross Margin). On les exclut.
      if (String(k.unit ?? "").trim() === "%" || /marg|ratio|taux/i.test(String(k.short ?? ""))) continue;
      if (isGenericKpi(k.short)) continue;
      // Yann 11 aout 2026 : un CA total ne peut jamais devenir hero par
      // fallback. isGenericKpi ne couvre pas "REV_Q" / "REV_FY" / "CA_T", si
      // bien qu'un CA total trimestriel hijackait le hero choisi des que
      // celui-ci etait semestriel ou annuel (8 stes europeennes).
      if (isTotalRevenueLabel(k.short)) continue;
      const h = Array.isArray(k.history) ? k.history.length : 0;
      // Yann 9 juin 2026 : un quarterly ne prime sur le hero annuel configure
      // QUE s'il a >=16 trims (sinon un KPI quarterly court hijacke le hero
      // annuel profond, ex BP "Adjusted EBITDA" 5 trims vs Production 7 ans).
      if (h < 16) continue;
      // Yann 11 juil 2026 : éligibilité quarterly = last_data_date non vide
      // ET history_periods aligné avec history (sinon labels fabriqués depuis
      // année-1 provoquent affichage incohérent).
      const ldd = (k as { last_data_date?: unknown }).last_data_date;
      if (typeof ldd !== "string" || ldd.trim().length === 0) continue;
      const hp = (k as { history_periods?: unknown }).history_periods;
      if (!Array.isArray(hp) || hp.length !== h) continue;
      if (!best || h > best.len) {
        best = { short: k.short, len: h };
      }
    }
    return best?.short ?? null;
  }, [company]);

  // Hero KPI effectif : si le hero "configuré" est annuel/sans history mais
  // qu'un autre KPI a du quarterly ≥4 trims, on préfère ce dernier comme
  // hero par défaut. Sinon on garde le hero d'origine (override respecté).
  const effectiveDefaultHero = useMemo(() => {
    const heroShort = company.hero_kpi;
    const heroKpi = company.kpis?.find((k) => k.short === heroShort);
    const heroIsQuarterly =
      heroKpi?.period_type === "quarter" &&
      Array.isArray(heroKpi.history) &&
      heroKpi.history.length >= 4;
    // Yann 8 juin 2026 : si le hero configure n'a pas de valeur reelle non
    // nulle (ex Cap Return 0,0, segment vide), on NE l'affiche PAS par defaut.
    // On bascule sur le 1er KPI specifique avec une vraie valeur + history,
    // pour ne jamais afficher un gros chiffre "0,0". Le user re-curera le
    // hero via /admin/kpis-toggle (son choix prime quand la valeur est valide).
    const heroUsable = kpiHasUsableValue(heroKpi);
    // Yann 9 juin 2026 : un hero % / marge / ratio est interdit même s'il est
    // configuré. On bascule alors sur le meilleur KPI quarterly non-%.
    const heroPct =
      String(heroKpi?.unit ?? "").trim() === "%" ||
      /margin|marge|ratio|taux|growth|croissance|yield|rendement/i.test(String(heroShort ?? "")) ||
      ["GM", "ROE", "ROTE", "ROIC", "ROA", "ROCE", "NIM", "ROTCE"].includes(String(heroShort ?? ""));
    if (heroUsable && heroIsQuarterly && !heroPct) return heroShort;
    // Yann 15 aout 2026 : un hero explicite VALIDE (valeur reelle, non %, non
    // generique, non CA total, serie >=3 points) n'est plus ecrase par le
    // fallback quarterly. Mesure du 12 aout : quand le segment principal n'est
    // publie qu'en annuel ou en semestriel, bestQuarterlyKpiShort promouvait la
    // ligne comptable suivante (resultat net, BPA, dividende) et annulait le
    // hero choisi. Le fallback ne sert plus que si le hero configure est
    // inutilisable, en %, generique ou un CA total.
    const heroHistLen = Array.isArray(heroKpi?.history) ? heroKpi.history.length : 0;
    if (
      heroUsable &&
      !heroPct &&
      heroHistLen >= 3 &&
      !isGenericKpi(heroShort) &&
      !isTotalRevenueLabel(heroShort)
    ) {
      return heroShort;
    }
    if (bestQuarterlyKpiShort) return bestQuarterlyKpiShort;
    if (heroUsable && !heroPct) return heroShort;
    const fallback = company.kpis?.find(
      (k) =>
        kpiHasUsableValue(k) &&
        Array.isArray(k.history) &&
        k.history.length >= 3 &&
        String(k.unit ?? "").trim() !== "%" &&
        !/marg|ratio|taux/i.test(String(k.short ?? "")) &&
        !isGenericKpi(k.short),
    );
    return fallback?.short ?? heroShort;
  }, [company, bestQuarterlyKpiShort]);

  const [activeKpiShort, setActiveKpiShort] = useState(effectiveDefaultHero);
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
  const [chartMode, setChartMode] = useChartMode("bars");
  const [barsVariant, setBarsVariant] = useState<"iso3d" | "classic">("classic");
  const [timeFraction, setTimeFraction] = useState<TimeFraction>("year");
  // Toggle Annuel / Trimestriel / Semestriel selon period_type du hero KPI
  // (6 mai 2026 : extension semester pour stés EU qui reportent 2x/an).
  // Yann (1er juin 2026) : default Trimestriel pour TOUTES les stés. Pour les
  // stés qui reportent en semestriel, on bascule sur semester. Sinon quarter.
  // L'utilisateur peut toujours switcher vers Annuel via le toggle.
  const heroDefaultPeriod = (() => {
    // Yann 2 juin 2026 — fix onglet trimestriel par défaut (AAPL/GOOGL).
    // Si le hero effectif (post-fallback quarterly) a period_type=quarter +
    // history.length >= 4, on démarre sur "quarter". Sinon, on respecte le
    // period_type du hero (semester/year/null).
    const hk = company.kpis?.find((k) => k.short === effectiveDefaultHero) ?? company.kpis?.[0];
    const pt = hk?.period_type;
    const histLen = Array.isArray(hk?.history) ? hk!.history.length : 0;
    if (pt === "quarter" && histLen >= 4) return "quarter";
    if (pt === "semester") return "semester";
    return "year";
  })();
  const [graphPeriod, setGraphPeriod] = useState<"year" | "quarter" | "semester">(heroDefaultPeriod);
  // Yann 8 juin 2026 : fenetre temporelle du chart. "5y" = 5 dernieres annees
  // (= 20 trimestres / 10 semestres selon la frequence), "max" = tout dispo.
  const [chartRange, setChartRange] = useState<"5y" | "max">("5y");
  const [compareTicker, setCompareTicker] = useState<string | null>(null);
  // Yann 8 juin 2026 (Point 4) : state lifte ici pour que la bascule FR/EN
  // du titre KPI hero (via KpiSwapTitle) propage aussi a l'axe Y du graph.
  // Default = locale globale (fr ou en selon user). Au clic sur le titre,
  // KpiSwapTitle appelle onLangChange et on synchronise l'axe Y.
  const [heroTitleLang, setHeroTitleLang] = useState<"fr" | "en">(
    locale === "fr" ? "fr" : "en"
  );

  // Yann 9 juin 2026 (BUG A) : les indicateurs supplementaires reveles par le
  // bouton "voir X indicateurs supplementaires" n'existaient pas dans le DOM
  // au moment ou applyFloutageRules tournait (mount + 150 ms / 1500 ms). Ils
  // n'etaient donc jamais floutes en mode gratuit, contrairement aux lignes
  // visibles. On re-applique les MEMES regles des que showAll passe a true.
  // applyFloutageRules est idempotent (skip data-floutageApplied="1") donc
  // seules les nouvelles lignes sont traitees, a l'identique des visibles.
  useEffect(() => {
    if (!freeBlocked || !showAll) return;
    const rules = (FLOUTAGE_RULES_FILE as { rules?: FloutageRule[] }).rules ?? [];
    if (rules.length === 0) return;
    let cleanup: (() => void) | null = null;
    // Petit delai pour laisser React monter les lignes supplementaires.
    const id = setTimeout(() => {
      cleanup = applyFloutageRules(rules);
    }, 60);
    return () => {
      clearTimeout(id);
      if (cleanup) cleanup();
    };
  }, [freeBlocked, showAll, company.ticker]);

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
  const chartLabelsFull = useMemo(() => {
    if (!active) return undefined;
    // Yann 12 juil 2026 : les labels d'axe X suivent la langue du GRAPH
    // (heroTitleLang) : T1/S1 en français, Q1/H1 en anglais. Avant, "T1 22"
    // restait affiché (et exporté en PNG) même graph basculé EN.
    const qPrefix = heroTitleLang === "en" ? "Q" : "T";
    const sPrefix = heroTitleLang === "en" ? "H" : "S";
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
        out.unshift(`${sPrefix}${endSem} ${String(endY).slice(-2)}`);
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
      const agg = aggregateQuarterlyToAnnual(
        active.history ?? [],
        active.last_data_date,
        kind,
        fyEndMonth,
        (active as { history_periods?: string[] }).history_periods,
      );
      // Yann 16 juil 2026 : plus de préfixe "FY" à l'écran. L'exercice fiscal
      // se nomme par son année de clôture : on affiche cette année telle
      // quelle (AAPL FY2026 clôt en septembre 2026 → "2026").
      return [...agg.years].map(String);
    }

    // Mode trimestriel : 1 label par trimestre.
    // Yann 15 juil 2026 (screen AAPL : axe décalé d'un an) : si le KPI porte
    // des history_periods XBRL complets ("Q1 2026", ...), on étiquette avec
    // les VRAIES périodes point par point au lieu de reconstruire à rebours
    // depuis last_data_date (source des axes décalés dès que la date ne
    // correspond plus au dernier point).
    {
      const hp = (active as { history_periods?: unknown[] }).history_periods;
      if (
        Array.isArray(hp) &&
        hp.length === n &&
        hp.every((s) => typeof s === "string" && /^Q[1-4][\s-]+(?:FY)?\d{4}$/.test(s.trim()))
      ) {
        return (hp as string[]).map((s) => {
          const m = s.trim().match(/^Q([1-4])[\s-]+(?:FY)?(\d{4})$/)!;
          // Yann 16 juil 2026 : plus de trimestres FISCAUX à l'écran. Les
          // périodes des stés à exercice décalé sont converties en trimestre
          // CALENDAIRE réel (AAPL Q1 FY2026 → T4 25 = oct-déc 2025).
          const cal = isFiscalShifted
            ? fiscalQuarterToCalendar(Number(m[1]), Number(m[2]), fyEndMonth, audit?.fyLabelConvention ?? "end")
            : { q: Number(m[1]), year: Number(m[2]) };
          return `${qPrefix}${cal.q} ${String(cal.year).slice(-2)}`;
        });
      }
    }
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
        // Yann 16 juil 2026 : label = trimestre CALENDAIRE réel (plus de
        // numérotation fiscale à l'écran) : n'importe qui sait de quand
        // datent les chiffres.
        const q = Math.ceil(calM / 3);
        out.unshift(`${qPrefix}${q} ${String(calY % 100).padStart(2, "0")}`);
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
      out.unshift(`${qPrefix}${endQ} ${String(endY).slice(-2)}`);
      endQ -= 1;
      if (endQ === 0) { endQ = 4; endY -= 1; }
    }
    return out;
  }, [active, graphPeriod, company.ticker, heroTitleLang]);

  // History adaptée :
  //  - Mode trimestriel : history brute (mais filtrée des Q non publiés en
  //    sécurité — cf. Patch 2 Yann 16 mai 2026).
  //  - Mode annuel sur KPI quarterly : aggrégation propre via
  //    aggregateQuarterlyToAnnual (somme 4Q pour flow, last Q pour stock,
  //    skip année incomplète, ajoute point TTM final).
  //  - Mode annuel sur KPI semester : last value de chaque 2-block (legacy).
  const chartHistoryRawFull = useMemo(() => {
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

  // Yann 8 juin 2026 : filtre fenetre "5 ans / Max" REELLEMENT fonctionnel.
  // "5y" garde les N derniers points (20 trims / 10 semestres / 5 ans selon
  // graphPeriod), "max" garde tout. Applique aux labels + history -> propage
  // au chart ET au gros chiffre hero (qui lit chartHistoryRangeApplied).
  const rangeLimit = chartRange === "max"
    ? Infinity
    : graphPeriod === "quarter" ? 20 : graphPeriod === "semester" ? 10 : 5;
  const chartHistoryRaw = rangeLimit !== Infinity && chartHistoryRawFull.length > rangeLimit
    ? chartHistoryRawFull.slice(-rangeLimit)
    : chartHistoryRawFull;
  const chartLabels = rangeLimit !== Infinity && (chartLabelsFull?.length ?? 0) > rangeLimit
    ? chartLabelsFull!.slice(-rangeLimit)
    : chartLabelsFull;

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
    const filtered = all.filter((k) => {
      // Yann 8 juin 2026 : jamais de KPI a valeur 0/null affiche (meme le
      // hero). Un "0,0" n'a aucune PV. Le hero reste prioritaire MAIS doit
      // avoir une vraie valeur.
      if (!kpiHasUsableValue(k)) return false;
      if (k.short === heroShort) return true;
      if (isGenericKpi(k.short)) return false;
      if (hiddenByRule.has(k.short)) return false;
      const hist = Array.isArray(k.history) ? k.history : [];
      const pt = (k as unknown as { period_type?: string }).period_type;
      if (hist.length < requiredForPeriod(pt)) return false;
      return true;
    });
    // Yann 15 juin 2026 : si la sté a au moins 3 KPIs trimestriels
    // affichables, on n'affiche QUE du trimestriel (hero excepté) pour ne
    // plus melanger annuel/trimestriel. Les stés sans donnee trimestrielle
    // (EU annuel/semestriel) gardent leurs KPIs normalement.
    const isQuarter = (k: (typeof filtered)[number]) =>
      (k as unknown as { period_type?: string }).period_type === "quarter";
    const quarterCount = filtered.filter(isQuarter).length;
    if (quarterCount >= 3) {
      // Yann 18 août 2026 : le 1er KPI (physique qualitatif choisi par
      // orderKpis, souvent annuel) est EXEMPTÉ du filtre trimestriel-only :
      // c'est la seule ligne visible en clair pour le tier free.
      const firstPhysicalShort =
        filtered.length > 0 && isPhysicalKpi(filtered[0]) ? filtered[0].short : null;
      return filtered.filter(
        (k) => k.short === heroShort || k.short === firstPhysicalShort || isQuarter(k),
      );
    }
    return filtered;
  }, [company]);
  const visibleKpis = showAll ? orderedKpis : orderedKpis.slice(0, VISIBLE_KPI_COUNT);
  const hiddenCount = orderedKpis.length - VISIBLE_KPI_COUNT;

  // Yann 14 mai 2026 : fallback YoY computed from history when dataset
  // yoy is empty (ex Tesla Energy Storage GWh : yoy='', history dispo).
  const effectiveYoy: string | number = (() => {
    const h = Array.isArray(active.history) ? active.history : [];
    // Yann 15 juil 2026 (screen AAPL "+0,3 %") : sur une série trimestrielle,
    // le YoY affiché DOIT être vs même trimestre N-1 (4 pas en arrière),
    // recalculé depuis l'historique verbatim. Le yoy stocké sur ces KPI
    // fusionnés est souvent un reliquat annuel ou un QoQ.
    if (active.period_type === "quarter" && h.length >= 5) {
      // Yann 18 juil 2026 (MA Rebates +27,6 % faux) : match par LABEL de
      // période en priorité, le recul -4 positions ment sur les séries à
      // trous (T4 absents des 10-Q).
      const byLabel = yoySamePeriod(
        h,
        (active as unknown as { history_periods?: string[] }).history_periods,
      );
      // Yann 28 juillet 2026 : un KPI déjà exprimé en % (marge, taux, taux de
      // croissance) se compare en POINTS. Avant, la croissance des impressions
      // publicitaires de META (5 % au T1 2025 -> 19 % au T1 2026) s'affichait
      // "+280,0 %", lu comme une hausse de 280 % des impressions.
      const isPctUnit = String(active.unit ?? "").trim() === "%";
      const ptsLabel = (diff: number) =>
        `${diff > 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")}${Math.abs(diff) < 2 ? " pt" : " pts"}`;
      if (byLabel !== null) {
        if (isPctUnit) {
          const li = h.length - 1;
          const lastV = h[li];
          const prevV = h[li - 4];
          if (typeof lastV === "number" && typeof prevV === "number") return ptsLabel(lastV - prevV);
        }
        const sign = byLabel > 0 ? "+" : "";
        return `${sign}${byLabel.toFixed(1).replace(".", ",")} %`;
      }
      const last = h[h.length - 1];
      const prevY = h[h.length - 5];
      if (isPctUnit && typeof last === "number" && typeof prevY === "number") {
        return ptsLabel(last - prevY);
      }
      if (typeof last === "number" && typeof prevY === "number" && prevY !== 0) {
        const pct = ((last - prevY) / Math.abs(prevY)) * 100;
        const sign = pct > 0 ? "+" : "";
        return `${sign}${pct.toFixed(1).replace(".", ",")} %`;
      }
    }
    if (typeof active.yoy === "string" && active.yoy.trim()) return active.yoy;
    if (typeof active.yoy === "number" && Number.isFinite(active.yoy)) return active.yoy;
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
  // Yann 8 juin 2026 (Point 3 bis) : la hero value DOIT toujours correspondre
  // au DERNIER point visible du chart à droite (rightmost). Source canonique =
  // `chartSpec.values[length-1]` (chart-template.ts garantit oldest-first +
  // labels alignés). Si chartSpec absent ou vide, fallback sur kpi.value brut.
  // Si timeFraction != "year", applique le même divisor que côté chart pour
  // que la magnitude affichée match (ex Revenue annuel ÷ 12 si "month").
  // Yann 8 juin 2026 : effectiveTimeFraction = timeFraction UNIQUEMENT si le KPI
  // supporte la fraction de temps (monetaire flux). Sinon "year" (divisor 1),
  // sinon un compteur "Nombre d'entrepots" (914) etait divise par 402 = "2,27".
  const effectiveTimeFraction: TimeFraction = isTimeFractionApplicableKpi(active) ? timeFraction : "year";
  const rawNumericValue = typeof active.value === "number" ? active.value : Number(active.value);
  const hist = Array.isArray(active.history) ? active.history.filter((x): x is number => typeof x === "number") : [];
  const allBelowOne = (hist.length > 0 && hist.every((v) => Math.abs(v) < 1) && (!Number.isFinite(rawNumericValue) || Math.abs(rawNumericValue) < 1));
  const { unit: scaledUnit, factor: scaleFactor } = autoRescaleSmallUnit(rawUnit, allBelowOne);
  const displayUnit = scaledUnit;
  // Yann 8 juin 2026 (BUG Costco + frequences) : le gros chiffre hero DOIT etre
  // EXACTEMENT le dernier point visible du graph + son unite d'axe Y, a CHAQUE
  // changement de frequence. On reutilise le MEME helper que le chart
  // (computeChartDisplay, source de verite unique) avec les MEMES inputs que
  // ceux passes a <ChartCycle> : data * scaleFactor, displayUnit, ttm, et le
  // divisor de effectiveTimeFraction. Coherence hero <-> axe Y garantie par
  // construction (plus de divergence "0,2 Mds $" vs axe "M $ / 191").
  const heroChartInput: (number | null)[] = scaleFactor !== 1
    ? chartHistoryRaw.map((v) => (typeof v === "number" ? v * scaleFactor : null))
    : (chartHistoryRaw as (number | null)[]);
  const heroChart = computeChartDisplay(heroChartInput, displayUnit, chartTTM, timeFractionDivisor(effectiveTimeFraction));
  const heroAxisUnit = heroChart.displayUnit;
  const heroLastVisibleValue = heroChart.lastValue;
  const scaledValue = heroLastVisibleValue != null
    ? heroLastVisibleValue
    : (Number.isFinite(rawNumericValue) ? rawNumericValue * scaleFactor : active.value);
  // Yann 16 mai 2026 : guard magnitude % aberrante (ex ASML R&D 32 milliards %
  // = bug data, pas vraie valeur). Affiche "—" avec tooltip + log console.
  const heroPercentAnomaly = isPercentMagnitudeAnomaly(active.value, rawUnit);
  if (heroPercentAnomaly && typeof console !== "undefined") {
    console.warn(
      `[Mettrik] Hero KPI % anomaly on ${company.ticker} / ${active.short}: value=${active.value}, unit=${rawUnit}`,
    );
  }
  // Yann 18 juil 2026 (screen MA "5 389 M USD") : le gros chiffre hero suit la
  // regle ABSOLUE 1-999 + magnitude (formatHeroValue), meme quand l'axe du
  // chart reste en M. L'axe garde son unite ; seul le hero rescale.
  const heroMagnitude = !heroPercentAnomaly && typeof scaledValue === "number" && Number.isFinite(scaledValue)
    ? formatHeroValue(scaledValue, heroAxisUnit)
    : null;
  const formattedUnit = heroPercentAnomaly ? "" : (heroMagnitude ? heroMagnitude.unit : formatUnit(heroAxisUnit));
  const heroFormatted = heroPercentAnomaly
    ? { value: "—", unit: "" }
    : (heroMagnitude
      ? { value: heroMagnitude.value, unit: heroMagnitude.unit }
      : { value: formatKpiValue(scaledValue, heroAxisUnit), unit: formattedUnit });
  // Yann 8 juin 2026 (Point 4 bis) : si KpiSwapTitle a bascule le titre en EN,
  // l'unite affichee a cote du hero number doit suivre la MEME regle que l'axe
  // Y (cf curve-chart.tsx ligne 267-268). Chaine 2 etapes identique :
  //   1) translateUnitFrToEn : traduit les unites TEXTUELLES non monetaires
  //      (Mds tonnes, unites, abonnes, employes, etc.). Garde-fou : aucune
  //      transformation sur les devises ($, EUR, USD, etc.) ni sur les %.
  //   2) chartAxisHeader(unit, 'en') : applique les SCALE_WORDS locale-aware
  //      sur les formes monetaires (Mds $ -> Bn $, Mds CHF -> Bn CHF, etc.)
  //      via le mapping case-by-case du switch. La devise reste preservee.
  // Cette chaine garantit la coherence stricte hero <-> axe Y du graph.
  const displayHeroUnit = heroTitleLang === "en"
    ? chartAxisHeader(translateUnitFrToEn(heroFormatted.unit), "en")
    : heroFormatted.unit;
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
  // Yann 10 juin 2026 (Point 3) : CAGR annualisé injecté dans le PNG export,
  // sous le titre. cagr() est TOUJOURS annualisé (il divise par les années
  // réelles via period_type), donc le résultat est en %/an quel que soit
  // l'affichage (annuel/trimestriel) ou la "fréquence" affichée (par an /
  // par minute, qui ne touche pas active.history). Format discret locale-aware
  // (Point 6) : "CAGR +47,8 %/an" (FR), "CAGR +47,8 %/yr" (EN).
  const exportCagr = (() => {
    const c = cagr(active.history, displayUnit, active.period_type ?? "year");
    if (c === null) return undefined;
    // Yann 12 juil 2026 : le PNG exporté suit la langue du GRAPH au moment du
    // téléchargement (heroTitleLang, toggle FR/EN du titre), pas la locale de
    // la page. Avant : titre EN mais "CAGR +12,3 %/an" restait FR.
    const exportLang = heroTitleLang === "en" ? "en" : locale;
    const numLoc = exportLang === "fr" ? "fr-FR" : exportLang === "de" || exportLang === "de-CH" ? "de-DE" : "en-US";
    const perYear =
      exportLang === "fr"
        ? "/an"
        : exportLang === "de" || exportLang === "de-CH"
          ? "/Jahr"
          : exportLang === "nl"
            ? "/jaar"
            : "/yr";
    // "CAGR" reste tel quel (acronyme reconnu dans toutes les locales).
    const sign = c > 0 ? "+" : "";
    const pct = c.toLocaleString(numLoc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `CAGR ${sign}${pct} %${perYear}`;
  })();
  const interp = useMemo(() => interpretStructured(company, active.short, locale), [company, active.short, locale]);

  // Yann 10 juin 2026 (corrigé) : le texte injecté SOUS le graph dans le PNG
  // exporté = le SIGNAL du KPI (le texte affiché à gauche du graph dans l'app),
  // PAS le lead "Le KPI X...". Strippé des balises HTML car le canvas PNG ne
  // rend que du texte brut. Le signal vient du dataset (langue de la page) ;
  // le titre/axe suivent heroTitleLang (clic titre).
  const exportInterp = useMemo(() => {
    // Yann 12 juil 2026 : si le graph est basculé EN alors que la page est FR,
    // le signal n'existe qu'en FR -> on l'omet du PNG (pas de mélange de langues).
    if (heroTitleLang === "en" && locale !== "en" && locale !== "en-GB") return "";
    const sig = typeof active.signal === "string" ? active.signal : "";
    return sig
      .replace(/<[^>]+>/g, "") // retire toutes les balises HTML
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }, [active.signal, heroTitleLang, locale]);

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
              <ThemeToggle paid={isPaidTier} />
              {authSlot}
            </div>
          </nav>

          <CompanyHeader
            company={company}
            hidePriceBar={hidePriceBar || isDisabled("snapshot_boursier")}
            freeBlocked={false}
            disabledBlocks={disabledBlocks}
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
            <ThemeToggle paid={isPaidTier} />
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
          hidePriceBar={hidePriceBar || isDisabled("snapshot_boursier")}
          freeBlocked={false}
          disabledBlocks={disabledBlocks}
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
            {/* LEFT: hero number — colonne réduite à 2/12 (Yann 21 août 2026,
                était 3/12) pour donner encore plus d'espace au graph (9 → 10).
                Tout ce qui est trop large doit glisser à gauche, le bord droit
                étant fixe.
                Yann 13 juin 2026 : flex flex-col + order-* pour remonter le
                gros chiffre (order-1) et descendre les badges meta sous les
                chips (order-3). */}
            <div className="flex min-w-0 flex-col lg:col-span-2">
              {/*
                ┌────────────────────────────────────────────────────────────┐
                │ ⚠️  RÈGLE FIGÉE — NE PAS MODIFIER (Yann 5 juin 2026)        │
                │                                                            │
                │ "KPI PRINCIPAL" + chip "Earning attendu" + tous les "i"    │
                │ (Data en cours, Fiscal décalé, etc.) DOIVENT RESTER SUR   │
                │ UNE SEULE LIGNE, peu importe la résolution. Le titre du   │
                │ hero KPI ne doit JAMAIS être décalé verticalement par     │
                │ un wrap de cette toolbar.                                  │
                │                                                            │
                │ Pattern obligatoire :                                      │
                │   - flex-nowrap (PAS flex-wrap)                            │
                │   - overflow-x-auto (scroll horizontal en cas d'overflow) │
                │   - scrollbar masqué (pas de barre visible)                │
                │   - gap-1.5 maximum (compact)                              │
                │                                                            │
                │ Tout refactor qui change `flex-nowrap` en `flex-wrap`     │
                │ ou retire le `overflow-x-auto` doit être reverté.         │
                └────────────────────────────────────────────────────────────┘
              */}
              {/* Yann 8 juin 2026 : passage flex-nowrap+overflow-x-auto -> flex-wrap.
                  L'ancien overflow clippait le "i" orange "Exercice fiscal decale"
                  (FY) en bout de ligne sur les stes a exercice decale. Le user
                  veut ce "i" TOUJOURS visible : les badges wrappent sous le titre
                  au lieu d'etre coupes. (Override regle figee 5 juin.) */}
              {/* Yann 8 juin 2026 : "KPI principal" + chip categorie bleu
                  supprimes. Le badge "A jour" (freshness) est desormais aligne
                  a gauche en premier (a la place de l'ancien label). */}
              {/* Yann 21 août 2026 : les badges meta (freshness + "i") ont été
                  remontés à côté du titre du KPI (colonne droite). Ils ne
                  consomment plus une ligne entière dans cette colonne. */}

              {/* Yann 8 juin 2026 : chip categorie bleu (active.short) supprime
                  du hero a la demande du user. */}

              {/* Chiffre principal — clamp responsif (max 7vw) pour éviter
                  l'overflow horizontal sur les grandes valeurs (ex BPA dilué
                  $XX.XX, ABF $XXX.X Mds, etc.). flex-wrap permet à l'unité
                  de basculer en dessous si pas la place. min-w-0 sur la
                  colonne parent côté layout HERO. */}
              <div className="order-1 mt-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {freeBlocked ? (
                  <div style={{ fontSize: "clamp(34px, 4.4vw, 56px)" }}>
                    <BlurredFreeValue
                      value={heroFormatted.value}
                      suffix={displayHeroUnit ? ` ${displayHeroUnit}` : ""}
                      ticker={company.ticker}
                    />
                  </div>
                ) : (
                  <>
                    <div
                      className="font-display font-semibold leading-none tracking-tight gradient-text"
                      style={{
                        fontSize: "clamp(34px, 4.4vw, 56px)",
                        wordBreak: "keep-all",
                      }}
                      title={heroPercentAnomaly ? "Donnée incohérente détectée (magnitude aberrante)" : undefined}
                    >
                      <NumberTicker value={heroFormatted.value} />
                    </div>
                    {displayHeroUnit && (
                      <div
                        className="font-medium text-zinc-400"
                        style={{ fontSize: "clamp(14px, 1.5vw, 19px)" }}
                      >
                        {displayHeroUnit}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="order-2 mt-3 flex flex-col items-start gap-2">
                {/* YoY pill : masquée si KPI incomplet (= aucune valeur YoY calculable) */}
                {!isIncompleteKpi && (effectiveYoy !== "" || typeof effectiveYoy === "number") && (
                  <div
                    className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-sm font-medium"
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
                {/* Yann 24 aout 2026 : bulle CAGR sur DEUX lignes (taux au-dessus,
                    periode en dessous), contenu centre dans la bulle, et "i"
                    exercice fiscal a droite, hors bulle, centre verticalement. */}
                <div className="flex w-fit items-center gap-2">
                {heroCAGR && (
                  <div className="inline-flex w-fit flex-col items-center justify-center rounded-2xl border border-[#262626] bg-[#0d0d0d] px-3 py-1.5 text-center font-mono text-[12px] tabular-nums text-zinc-200">
                    <span className="leading-tight">
                      {freeBlocked ? (
                        <BlurredFreeValue value="+0,0 %/an" ticker={company.ticker} />
                      ) : (
                        heroCAGR
                      )}
                    </span>
                    <span className="whitespace-nowrap text-[10.5px] italic leading-tight text-zinc-400">
                      {heroCagrYears >= 4.5 && heroCagrYears <= 5.5
                        ? t("hero.cagr_5y")
                        : `(CAGR ${(heroCagrYears > 5.5 ? Math.round(heroCagrYears) : heroCagrYears).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} ${heroCagrYears <= 1 ? (locale === "de" || locale === "de-CH" ? "Jahr" : locale === "fr" ? "an" : "year") : (locale === "de" || locale === "de-CH" ? "Jahre" : locale === "fr" ? "ans" : "years")})`}
                    </span>
                  </div>
                )}
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
                                {" "}Pour simplifier la lecture, tous les trimestres affichés sur cette
                                page sont les <strong>trimestres calendaires réels</strong> : T4 2025 =
                                octobre-décembre 2025, quel que soit le nom fiscal que la société leur donne.
                              </>
                            ) : (
                              <>
                                <strong>{company.name}</strong>&apos;s fiscal year ends in{" "}
                                <strong>{fyEndMonthEn}</strong> (not December like the calendar year).
                                {" "}For readability, every quarter shown on this page uses the{" "}
                                <strong>real calendar quarter</strong>: Q4 2025 = October-December 2025,
                                whatever the company calls it fiscally.
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
                {/* Yann 16 juil 2026 : chip percentile "Top X % · sous-secteur"
                    SUPPRIMÉE. C'était une heuristique sur le YoY (yoy>=0 → "Top 50 %"),
                    pas un vrai classement vs pairs : impossible à rendre juste pour
                    des KPI propres à chaque sté (CA iPhone n'a pas de pairs). */}
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
              {/* Yann 21 août 2026 : étoile "IA" (Sparkles) retirée du hero. */}
              {typeof active.signal === "string" && active.signal.trim() && (
                <div className="order-4 mt-5 flex max-w-md items-start gap-2.5 rounded-xl border border-[#1a1a1a] bg-[#070707] p-3.5">
                  <BlurredFreeText blocked={freeBlocked} ticker={company.ticker} className="flex-1">
                    <div className="text-[14px] font-semibold leading-snug text-zinc-100">
                      {active.signal}
                    </div>
                  </BlurredFreeText>
                </div>
              )}
            </div>

            {/* RIGHT: chart — élargi à 10/12 (était 9) pour plus de place au
                graph principal. */}
            <div className="min-w-0 lg:col-span-10">
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
              {/* Yann 5 juin 2026 v3 : flex-nowrap + overflow-x-auto pour
                  vraiment forcer UNE seule ligne (le flex-wrap retombait
                  encore sur 2 lignes sur certains écrans). Scrollbar masqué.
                  Séparateurs dots violet retirés (cosmétique, prenaient de
                  la place). Onglet "Tableau de bord" supprimé (cf liste
                  TABS dans chart-cycle.tsx). */}
              <div className="mb-3 flex flex-nowrap items-center justify-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <PeriodToggle accent={accent} value={chartRange} onChange={setChartRange} hasMaxPlan={!freeBlocked} />
                {(chartMode === "curve" || chartMode === "bars") && isTimeFractionApplicableKpi(active) && (
                  <TimeFractionToggle
                    value={timeFraction}
                    onChange={setTimeFraction}
                    accent={accent}
                  />
                )}
                <ChartCycleControls
                  mode={chartMode}
                  onChange={setChartMode}
                  color={accent}
                  barsVariant={barsVariant}
                  onBarsVariantChange={setBarsVariant}
                  graphPeriod={graphPeriod}
                  onGraphPeriodChange={setGraphPeriod}
                  graphPeriodAvailable={{
                    // Yann 12 juil 2026 : "Annuel" grisé si l'agrégation ne
                    // produit AUCUNE FY complète (KPI quarterly sans les Q4,
                    // ex MSFT LinkedIn revenue growth) -> plus jamais de vue
                    // annuelle vide, quel que soit le KPI promu.
                    year: (() => {
                      if (active.period_type !== "quarter" && active.period_type !== "semester") return true;
                      const kind = getKpiAggregationKind(active);
                      const fyEnd = getFiscalAudit(company.ticker)?.fiscalYearEndMonth ?? 12;
                      const agg = aggregateQuarterlyToAnnual(
                        active.history ?? [],
                        active.last_data_date,
                        kind,
                        fyEnd,
                        (active as { history_periods?: string[] }).history_periods,
                      );
                      return agg.values.length > 0;
                    })(),
                    // Quarter / Semester dispo selon period_type natif du KPI.
                    // (data réelle, sinon désactivé).
                    quarter: active.period_type === "quarter",
                    semester: active.period_type === "semester",
                  }}
                />
              </div>
              <div className="mb-3 flex flex-wrap items-baseline justify-center gap-2.5 text-center">
                {/* Yann 9 juin 2026 : "i" permanent à GAUCHE du titre hero quand
                    la profondeur de données est limitée. Indépendant du KPI
                    sélectionné (rendu hors KpiSwapTitle, donc persiste au swap). */}
                {historyLimitYears ? (
                  <InfoTooltip color="#f59e0b">
                    <div className="text-zinc-200">
                      {locale === "fr"
                        ? `Données disponibles sur ${historyLimitYears} ans seulement pour cette société.`
                        : `Data available for only ${historyLimitYears} years for this company.`}
                    </div>
                  </InfoTooltip>
                ) : null}
                {/* Yann 5 juin 2026 : hero KPI title bascule FR/EN au clic
                    via KpiSwapTitle. Modification purement locale (state du
                    composant), n'écrit rien dans le dataset. Le suffix temps
                    "par X" est géré par KpiSwapTitle via la prop timeFraction. */}
                {/* Yann 9 juin 2026 : le TITRE du hero KPI est flouté en mode
                    gratuit, meme lorsqu'un autre KPI est selectionne (KpiSwapTitle
                    lit `active`, donc le floutage suit la selection). GOOGL/META
                    gratuits restent nets via freeBlocked. */}
                <BlurredFreeText blocked={freeBlocked} ticker={company.ticker} mode="full" as="span">
                  <KpiSwapTitle
                    nameFr={active.name_fr}
                    nameEn={active.name_en}
                    short={active.short}
                    defaultLang={heroTitleLang}
                    timeFraction={effectiveTimeFraction}
                    onLangChange={setHeroTitleLang}
                    className="text-[24px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[28px]"
                    suffixClassName="ml-2 text-[18px] font-medium text-zinc-300 sm:text-[22px]"
                  />
                </BlurredFreeText>
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
                {/* Yann 21 août 2026 : badges meta (freshness, "i" data en
                    cours, "i" exercice fiscal décalé) REMONTÉS ici, collés au
                    titre du KPI. Avant : ligne dédiée dans la colonne gauche,
                    qui gaspillait une ligne entière pour un seul "i". */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Yann (V1.9.5, juin 2026) : chip freshness identique entre
                    card home et page sté. On utilise le hero KPI **configuré**
                    (= getHero(company)), pas l'`active` qui peut diverger
                    quand l'utilisateur clique un autre KPI ou quand
                    effectiveDefaultHero swap vers un quarterly. Voir
                    `src/lib/freshness/compute-tier.ts`. */}
                <FreshnessIndicator
                  lastDate={getFreshnessReference(company).lastDate ?? "2025-12-31"}
                  publicationDate={getFreshnessReference(company).publicationDate}
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
              </div>
                {/* Yann 19 mai 2026 : ancien tooltip orange "Exercice fiscal
                    décalé" DÉPLACÉ vers la zone "À jour" (col gauche) pour
                    ne pas surcharger le titre KPI. Voir code ~ligne 535. */}
              </div>
              {/* Yann 5 juin 2026 : TimeFractionToggle DÉPLACÉ dans la ligne
                  principale des onglets ci-dessus (entre 5 ans/Max et
                  Courbe/Barres/etc) pour compacter la hauteur. La logique
                  d'affichage conditionnel (curve|bars + isTimeFractionApplicableKpi)
                  est préservée à l'identique. */}
              <ChartCycle
                mode={chartMode}
                data={scaleFactor !== 1 ? chartHistoryRaw.map((v) => (typeof v === "number" ? v * scaleFactor : v)) : chartHistoryRaw}
                labels={chartLabels}
                unit={displayUnit}
                color={accent}
                anomalies={anomalies}
                events={[]}
                company={company}
                activeShort={active.short}
                onPickKpi={handleKpiClick}
                ttm={chartTTM}
                barsVariant={barsVariant}
                timeFraction={effectiveTimeFraction}
                titleLocale={heroTitleLang}
                exportCagr={exportCagr}
                exportInterpretation={exportInterp}
                exportTitle={`${(() => {
                  // Yann juin 2026 : l'export suit la langue du SWAP titre
                  // (heroTitleLang via KpiSwapTitle), pas la locale globale, pour
                  // que le PNG corresponde au titre affiché (clic = EN sur page FR).
                  type N = typeof active & { name_en?: string };
                  const a = active as N;
                  return heroTitleLang === "en" ? (a.name_en || a.name_fr) : a.name_fr;
                })()}${
                  timeFraction !== "year" ? ` ${translate(`timefrac.suffix.${timeFraction}`, heroTitleLang)}` : ""
                } · ${company.name}`}
              />
            </div>
          </div>

          {/* Interpretation retiree le 23 aout 2026 (demande Yann) : le bloc
              sous le graph n apportait pas de valeur. Le composant et les
              donnees restent en place pour un eventuel retour. */}
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
              <div className="col-span-3">{t("company.kpi_table.col_indicator")}</div>
              <div className="col-span-3">{t("company.kpi_table.col_value")} <span className="ml-0.5 italic text-zinc-400" title="Year-on-Year : variation vs même période l'an dernier">(vs N-1)</span></div>
              <div className="col-span-2">{t("company.kpi_table.col_trend")}</div>
              <div className="col-span-4">{t("company.kpi_table.col_quality")}</div>
            </div>
            {/* Yann 8 juin 2026 (Point 3) : la valeur principale affichée à
                GAUCHE du KPI actif doit TOUJOURS égaler le dernier point
                visible du chart à DROITE. Recalcule live selon timeFraction
                (year/month/week/day) et chart view (quarterly vs annual via
                chartSpec qui dépend de graphPeriod). Source = dernier point
                non-TTM de `chartSpec.values`. Si timeFraction != "year",
                applique le divisor déjà utilisé côté chart (cf
                chart-cycle.tsx ligne 285). */}
            {visibleKpis.map((kpi, kpiIdx) => {
              const isActive = kpi.short === active.short;
              // Yann 18 août 2026 : en tier free, la 1re ligne (KPI physique
              // qualitatif) est EN CLAIR ; toutes les suivantes sont floutées
              // en entier (nom + valeurs), non cliquables.
              const rowFullyBlurred = freeBlocked && kpiIdx > 0;
              const row = (
                <KpiRow
                  key={kpi.short}
                  kpi={kpi}
                  active={isActive}
                  subsector={company.subsector}
                  ticker={company.ticker}
                  onClick={rowFullyBlurred ? () => {} : () => handleKpiClick(kpi.short)}
                  freeBlocked={rowFullyBlurred}
                  overrideValue={isActive ? heroLastVisibleValue : null}
                />
              );
              if (!rowFullyBlurred) return row;
              return (
                <div
                  key={kpi.short}
                  className="pointer-events-none select-none blur-[6px]"
                  aria-hidden="true"
                >
                  {row}
                </div>
              );
            })}
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
        {isBlockEnabled("stories", company.ticker) && !isDisabled("kpi_stories") ? (
          hasStories(company.kpis, []) && (
            <KpiStories company={company} freeBlocked={freeBlocked} />
          )
        ) : (
          <BlockComingSoon blockId="stories" />
        )}

        {/* Graphiques et Schémas de sources diverses (Yann 15 mai 2026 v2).
            Placé SOUS les Stories. Images approuvées dans
            /sandbox/image-findings mergées au SSR dans company.image_findings. */}
        {isBlockEnabled("image_findings", company.ticker) && !isDisabled("graphiques_schemas") ? (
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
        {isBlockEnabled("transcripts", company.ticker) && !isDisabled("transcript_bullets") ? (
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
          hideDescription={isDisabled("description_mettrik")}
          hideSnapshot={isDisabled("snapshot_boursier")}
        />

        {/* Risk factors */}
        {isBlockEnabled("risks", company.ticker) && !isDisabled("risks") ? (
          company.risks && company.risks.length > 0 ? (
            <div id="sec-risks" className="scroll-mt-24">
              <RiskStack risks={company.risks} accent={accent} profitWarning={isDisabled("profit_warning") ? undefined : company.profit_warning} freeBlocked={freeBlocked} ticker={company.ticker} />
            </div>
          ) : (
            v18Mode && <V18MissingPlaceholder id="sec-risks" label="Facteurs de risque" hint="Item 1A 10-K à extraire (Sonnet/Haiku Pass 2)." />
          )
        ) : (
          <BlockComingSoon blockId="risks" id="sec-risks" />
        )}

        {/* Anti-thèse d'investissement — juste APRÈS Facteurs de risque
            (Yann 14 août 2026). Rendu uniquement si une ATT existe pour la
            sté (src/data/att/<t>.json ou override desk_att). Le gating plan
            Max est déjà appliqué côté serveur (gateAttForTier) : ici on ne
            fait qu'afficher, att.locked pilote le placeholder flouté. */}
        {company.att && !isDisabled("anti_these") && (
          <AntiTheseCard att={company.att} accent={accent} />
        )}

        {/* Répartition CA (géo + segment) — au-dessus de Gouvernance */}
        {isBlockEnabled("repartition", company.ticker) ? (
          <RepartitionBlock company={company} disabledBlocks={disabledBlocks} />
        ) : (
          <BlockComingSoon blockId="repartition" />
        )}

        {/* Bloc Dividendes RETIRÉ pour toutes les stés (Yann 15 juin 2026). */}

        {/* Governance */}
        {isBlockEnabled("governance", company.ticker) && !isDisabled("gouvernance") ? (
          company.governance ? (
            <div id="sec-governance" className="scroll-mt-24">
              <GovernanceCard governance={company.governance} ticker={company.ticker} company={company} freeBlocked={freeBlocked} disabledBlocks={disabledBlocks} />
            </div>
          ) : (
            v18Mode && <V18MissingPlaceholder id="sec-governance" label="Gouvernance & rémunération" hint="DEF14A (cat 1) ou rapport annuel à extraire." />
          )
        ) : (
          <BlockComingSoon blockId="governance" id="sec-governance" />
        )}

        {/* AI positioning — Yann 20 mai 2026 : masquer si stance=absent (= 10-K ne mentionne pas IA).
            Pas de bloc vide ou "Absent". Soit la sté a du AI réel à montrer, soit on masque. */}
        {isBlockEnabled("ai_positioning", company.ticker) && !isDisabled("ai_positioning") ? (
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
        {!isDisabled("super_kpi") && (
          <SuperKpiBoard
            kpis={computeSuperKpis(company, locale)}
            sectorKpis={computeSectorSuperKpis(company, locale)}
            companyName={company.name}
            ticker={company.ticker}
            accent={accent}
            hideSector={isDisabled("super_kpi_sector")}
          />
        )}

        {/* Provenance — Yann 26 mai 2026 : déplacée du haut (sous le header)
            vers le bas de page. Ligne discrète, italique, max-w-3xl, juste
            avant le footer. */}
        <p className="mt-12 max-w-3xl text-[11.5px] italic leading-relaxed text-zinc-500">
          {t("company.provenance")}
        </p>

        {/* Yann 11 juin 2026 : ligne "valeur ajoutée" (KPIS SPÉCIFIQUES +
            INTERPRÉTATION INVESTISSEUR SUR 5 ANS) retirée. Copyright seul. */}
        <footer className="mt-6 pb-8 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          {t("company.footer_copyright")}
        </footer>
      </main>

      <CompanyNavChrome />
    </div>
  );
}
