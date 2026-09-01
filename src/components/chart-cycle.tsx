"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, BarChart3, Download, Grid2X2, TrendingUp } from "lucide-react";

import { CurveChart } from "@/components/charts/curve-chart";
import { BarsIso3DStack } from "@/components/charts/bars-3d-variants";
import { VariationIsoSteps3D } from "@/components/charts/variation-3d-variants";
import { MiniMultiplesChart } from "@/components/charts/mini-multiples-chart";
import { downloadSvgAsPng } from "@/lib/chart-export";
import { cn } from "@/lib/utils";
import type { Anomaly } from "@/lib/brand";
import type { Company } from "@/lib/data";
import type { CompanyEvent } from "@/lib/events";
import { useT } from "@/lib/i18n/provider";
import { translate } from "@/lib/i18n/dictionary";

export type ChartMode = "curve" | "bars" | "delta" | "panel";
export type BarsVariant = "iso3d" | "classic";

import type { TimeFraction } from "@/components/charts/time-fraction-toggle";
import { timeFractionDivisor } from "@/components/charts/time-fraction-toggle";
import { toAbsolute, rescaleForReadability } from "@/lib/format";

const MODES: {
  id: ChartMode;
  labelKey: string;
  hintKey: string;
  icon: typeof Activity;
}[] = [
  { id: "bars", labelKey: "company.chart.bars", hintKey: "company.chart.bars.hint", icon: BarChart3 },
  { id: "curve", labelKey: "company.chart.curve", hintKey: "company.chart.curve.hint", icon: Activity },
  { id: "delta", labelKey: "company.chart.variation", hintKey: "company.chart.variation.hint", icon: TrendingUp },
  // Yann 5 juin 2026 : onglet "Tableau de bord" supprimé.
];

// Fallback uniquement utilisé si le KPI n'a pas `last_data_date` ni
// `period_type` exploitables. On ancre sur l'année DERNIÈRE PUBLIÉE
// (= année courante - 1) pour éviter d'inclure une période non publiée.
// Ex : en mai 2026, le dernier exercice fiscal complet publié est 2025
// (10-K fin février 2026), pas 2026 (en cours).
// Yann 10 mai 2026 : avant `end = 2025` hardcodé, faux dès qu'on dépasse 2025.
function defaultLabels(n: number): string[] {
  const end = new Date().getUTCFullYear() - 1;
  return Array.from({ length: n }, (_, i) => String(end - n + 1 + i));
}

/**
 * Yann 17 mai 2026 — D1 fix cascade.
 * `rescaleForReadability` retourne toujours en RAW USD ($T/$B/$M/$K/$) car
 * les facteurs (1e9/1e6/1e3) sont identiques quelle que soit la devise.
 * Pour préserver la devise à l'affichage de l'axe Y sur les stés non-USD
 * (1604 Mds €, 43 Mds £, ~168 Mds CHF/JPY/DKK/INR/etc), on restitue le
 * symbole d'origine ici. ChartAxisHeader gère "€B", "€M", "£B", "£M",
 * "Mds CHF", "Mds JPY", "M CHF", etc.
 */
function preserveOriginalCurrency(inputUnit: string, rawNewUnit: string): string {
  if (!rawNewUnit.startsWith("$")) return rawNewUnit; // non-monetary
  const u = String(inputUnit).trim();
  if (/€|\bEUR\b/i.test(u)) return rawNewUnit.replace("$", "€"); // "$B" → "€B"
  if (/£|\bGBP\b/i.test(u)) return rawNewUnit.replace("$", "£");
  const iso = u.match(/\b(CHF|JPY|DKK|INR|NOK|SEK|KRW|CAD|AUD|HKD|CNY|BRL|MXN|PLN|ZAR|TWD|SGD|ILS|TRY|THB|NZD|RMB|RUB|CZK|HUF|IDR|MYR)\b/i);
  if (iso) {
    const code = iso[1].toUpperCase();
    if (rawNewUnit === "$T" || rawNewUnit === "$B") return `Mds ${code}`;
    if (rawNewUnit === "$M") return `M ${code}`;
    if (rawNewUnit === "$K") return `K ${code}`;
    return code;
  }
  return rawNewUnit; // default = USD raw, ex "$B"
}

/**
 * Yann 8 juin 2026 : SOURCE DE VERITE UNIQUE du rescale chart.
 * Calcule les valeurs + l'unite EXACTEMENT comme l'axe Y du graph.
 * Utilise par ChartCycle (rendu) ET par company-view (gros chiffre hero)
 * pour garantir que le hero == dernier point visible du graph + meme unite.
 */
const FACTOR_PER_UNIT: Record<string, number> = {
  "$T": 1e12, "$B": 1e9, "$M": 1e6, "$K": 1e3, "$": 1, "$¢": 0.01,
  "T": 1e12, "B": 1e9, "M": 1e6, "K": 1e3, "": 1,
};
export function computeChartDisplay(
  data: (number | null)[],
  unit: string,
  ttm: number | null,
  divisor: number,
): { scaledData: (number | null)[]; scaledTtm: number | null; displayUnit: string; lastValue: number | null } {
  const safe = Array.isArray(data) ? data : [];
  let scaledData: (number | null)[] = safe;
  let scaledTtm = ttm;
  let displayUnit = unit;
  const absData = safe.map((v) => (typeof v === "number" ? toAbsolute(v, unit) / divisor : null));
  const absTtm = ttm == null ? null : toAbsolute(ttm, unit) / divisor;
  const allAbs = [...absData, ...(absTtm != null ? [absTtm] : [])].filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const maxAbs = allAbs.length > 0 ? Math.max(...allAbs.map((v) => Math.abs(v))) : 0;
  const { unit: newUnit } = rescaleForReadability(maxAbs, unit);
  const newFactor = FACTOR_PER_UNIT[newUnit];
  if (newFactor != null && (newUnit !== unit || divisor !== 1)) {
    scaledData = absData.map((v) => (v == null ? null : v / newFactor));
    scaledTtm = absTtm == null ? null : absTtm / newFactor;
    displayUnit = preserveOriginalCurrency(unit, newUnit);
  }
  // Dernier point numerique visible (= dernier point du graph affiche).
  let lastValue: number | null = null;
  for (let i = scaledData.length - 1; i >= 0; i -= 1) {
    if (typeof scaledData[i] === "number" && Number.isFinite(scaledData[i] as number)) {
      lastValue = scaledData[i] as number;
      break;
    }
  }
  return { scaledData, scaledTtm, displayUnit, lastValue };
}

/**
 * Sélecteur du mode de chart, exporté à part pour pouvoir le placer dans
 * le toolbar du HERO (à gauche du PeriodToggle "5 / 10 / 20 ans") au
 * lieu de l'avoir au-dessus du graph.
 */
export type GraphPeriod = "year" | "quarter" | "semester";

/**
 * Yann 8 juin 2026 : le bouton télécharger a été DÉPLACÉ de chaque chart
 * (curve / bars / variation) vers la barre d'onglets (ChartCycleControls).
 * Le chart visible expose son <svg> via [data-chart-export="true"] + les
 * options d'export en data-export-*. Un seul chart est monté à la fois
 * (AnimatePresence mode="wait"), donc querySelector renvoie le bon SVG.
 */
const EXPORT_LOCALES = ["fr", "en", "en-GB", "de", "de-CH", "nl"] as const;
type ExportLocale = (typeof EXPORT_LOCALES)[number];

function downloadVisibleChart() {
  if (typeof document === "undefined") return;
  const svg = document.querySelector<SVGSVGElement>(
    'svg[data-chart-export="true"]'
  );
  if (!svg) return;
  const prefix = svg.getAttribute("data-export-prefix") || "chart";
  const rawLocale = svg.getAttribute("data-export-locale") || "";
  const locale = (EXPORT_LOCALES as readonly string[]).includes(rawLocale)
    ? (rawLocale as ExportLocale)
    : "fr";
  // Yann 1er sept 2026 : nom EN + unite EN poses par company-view sur le
  // wrapper [data-export-extra] (evite de faire transiter deux props par
  // chaque composant de chart).
  const extra = svg.closest<HTMLElement>("[data-export-extra]");
  void downloadSvgAsPng(svg, `mettrik-${prefix}-${Date.now()}.png`, {
    title: svg.getAttribute("data-export-title") || undefined,
    titleEn: extra?.getAttribute("data-export-title-en") || undefined,
    unitEn: extra?.getAttribute("data-export-unit-en") || undefined,
    avgPct: extra?.getAttribute("data-export-avg") || undefined,
    ticker: svg.getAttribute("data-export-ticker") || undefined,
    cagr: svg.getAttribute("data-export-cagr") || undefined,
    frequency: svg.getAttribute("data-export-frequency") || undefined,
    // Yann juin 2026 : texte d'interprétation RETIRÉ du doc/graph exporté.
    interpretation: undefined,
    locale,
  });
}

export function ChartCycleControls({
  mode,
  onChange,
  color = "#a78bfa",
  barsVariant,
  onBarsVariantChange,
  graphPeriod,
  onGraphPeriodChange,
  graphPeriodAvailable = { year: true, quarter: true, semester: false },
}: {
  mode: ChartMode;
  onChange: (m: ChartMode) => void;
  color?: string;
  /** Variant sub-toggle quand mode === 'bars'. Optionnel : si non fourni, pas de toggle. */
  barsVariant?: BarsVariant;
  onBarsVariantChange?: (v: BarsVariant) => void;
  /** Toggle Annuel / Trimestriel / Semestriel — affiché si setter fourni. (5 mai 2026, semester ajouté 6 mai). */
  graphPeriod?: GraphPeriod;
  onGraphPeriodChange?: (p: GraphPeriod) => void;
  /** Quelles périodes sont dispo dans la data ? Bouton grisé si false. */
  graphPeriodAvailable?: { year: boolean; quarter: boolean; semester?: boolean };
}) {
  const { t } = useT();
  return (
    // Pas de flex-wrap : on veut TOUT sur une ligne (4 modes + Trimestriel/Annuel
    // + 2D/3D + 5/10/20 ans à droite via le parent). gap-1.5 minimal.
    <div className="inline-flex items-center gap-1.5">
      <div
        role="tablist"
        className="relative inline-flex items-center gap-0.5 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-0.5"
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(m.id)}
              title={t(m.hintKey)}
              className={cn(
                "relative inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium transition-colors",
                active ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              {active && (
                <motion.span
                  layoutId="chart-mode-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${color}30, ${color}18)`,
                    border: `1px solid ${color}55`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="relative size-3" />
              <span className="relative">{t(m.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Toggle Annuel / Trimestriel — visible si setter fourni. Le bouton
          Trimestriel est grisé si la data n'a pas de quarterly history.
          (5 mai 2026 : Yann impose trimestriel par défaut sur tous les
          graphs hero, fallback annuel pour les KPIs sans data quarterly.) */}
      {graphPeriod && onGraphPeriodChange && (
        <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.02] p-0.5">
          {/* Yann 29 mai 2026 (Bug 2) : le bouton Trimestriel est TOUJOURS
              rendu (même si data quarterly absente) — grisé + disabled dans
              ce cas. Avant : bouton complètement masqué, l'utilisateur ne
              savait pas que la fonctionnalité existait. */}
          <button
            onClick={() => graphPeriodAvailable.quarter && onGraphPeriodChange("quarter")}
            disabled={!graphPeriodAvailable.quarter}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
              graphPeriod === "quarter"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200",
              !graphPeriodAvailable.quarter && "cursor-not-allowed opacity-40"
            )}
            title={!graphPeriodAvailable.quarter
              ? "Trimestriel indisponible pour ce KPI"
              : t("graph.period.quarter.tooltip")}
          >
            {t("graph.period.quarter")}
          </button>

          {graphPeriodAvailable.semester && (
            <button
              onClick={() => onGraphPeriodChange("semester")}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                graphPeriod === "semester"
                  ? "bg-white/10 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-200"
              )}
              title={t("graph.period.semester.tooltip")}
            >
              {t("graph.period.semester")}
            </button>
          )}
          <button
            onClick={() => onGraphPeriodChange("year")}
            disabled={!graphPeriodAvailable.year}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
              graphPeriod === "year"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200"
            )}
            title={t("graph.period.year.tooltip")}
          >
            {t("graph.period.year")}
          </button>
        </div>
      )}

      {/* Sub-toggle 2D / 3D : visible UNIQUEMENT quand mode === bars
          ET un setter est fourni par le parent. Ordre : 2D à gauche, 3D
          à droite (logique = simple → enrichi). 6 mai 2026. */}
      {mode === "bars" && barsVariant && onBarsVariantChange && (
        <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.02] p-0.5">
          <button
            onClick={() => onBarsVariantChange("classic")}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
              barsVariant === "classic"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200"
            )}
            title={t("graph.bars.2d.tooltip")}
          >
            2D
          </button>
          <button
            onClick={() => onBarsVariantChange("iso3d")}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
              barsVariant === "iso3d"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200"
            )}
            title={t("graph.bars.3d.tooltip")}
          >
            3D
          </button>
        </div>
      )}

      {/* Yann 8 juin 2026 : bouton TÉLÉCHARGER déplacé ici, tout à droite de
          la ligne des onglets (au-dessus du titre du graph). Plus visible
          qu'avant (était opacity-50 sur le chart) : fond teinté à la couleur
          de la sté + bordure + texte/icône net. Exporte le chart visible. */}
      {mode !== "panel" && (
        <button
          type="button"
          onClick={downloadVisibleChart}
          aria-label={t("graph.download")}
          title={t("graph.download")}
          className="ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-zinc-100 transition-all hover:text-white"
          style={{
            background: `linear-gradient(135deg, ${color}33, ${color}1f)`,
            borderColor: `${color}66`,
          }}
        >
          <Download className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * ChartCycle — n'affiche plus que le chart courant.
 * Les contrôles (boutons Courbe / Barres / Variation / Tableau de bord)
 * sont exposés via ChartCycleControls et rendus côté parent dans le
 * toolbar du HERO.
 */
export function ChartCycle({
  mode,
  data,
  unit,
  color = "#a78bfa",
  labels,
  anomalies = [],
  events = [],
  company,
  activeShort,
  onPickKpi,
  ttm = null,
  barsVariant = "iso3d",
  timeFraction = "year",
  exportTitle,
  exportCagr,
  exportInterpretation,
  titleLocale = "fr",
}: {
  mode: ChartMode;
  data: number[];
  unit: string;
  color?: string;
  labels?: string[];
  anomalies?: Anomaly[];
  events?: CompanyEvent[];
  company?: Company;
  activeShort?: string;
  onPickKpi?: (short: string) => void;
  /** TTM = somme des 4 derniers trimestres (Q-1 + Q-2 + Q-3 + Q-4). Si fourni,
      ajoute une barre / point supplémentaire au chart. */
  ttm?: number | null;
  /** Variant pour le mode bars uniquement. */
  barsVariant?: BarsVariant;
  /** Fraction de temps : year (défaut) divise pas, month=/12, day=/365, etc.
   *  Affecte uniquement les valeurs affichées (data + ttm). YoY% inchangé. */
  timeFraction?: TimeFraction;
  /** Titre injecté dans le PNG exporté (KPI name_fr, déjà visible côté HTML
   *  donc pas répété live mais ajouté dans le download pour qu'il se suffise
   *  à lui-même hors du contexte page). */
  exportTitle?: string;
  /** Yann 10 juin 2026 (Point 3) : CAGR annualisé déjà formaté (ex "CAGR
   *  +47,8 %/an") injecté sous le titre dans le PNG. Calculé côté parent
   *  (company-view) sur la série de valeurs réelles du hero KPI. */
  exportCagr?: string;
  /** Yann 10 juin 2026 : lead de l'interprétation IA du KPI (1 phrase, texte
   *  brut déjà strippé des balises HTML), dans la MÊME langue que le titre
   *  exporté (heroTitleLang). Rendu SOUS le graph dans le PNG. Calculé côté
   *  company-view via interpretStructured(..., heroTitleLang).lead. */
  exportInterpretation?: string;
  /** Yann 8 juin 2026 (Point 4) : si le titre KPI est bascule en EN via
   *  KpiSwapTitle (state local au parent), on traduit aussi l'axe Y SAUF
   *  pour les unites monetaires (les symboles $/EUR/etc restent identiques).
   *  Par defaut 'fr' = pas de traduction (axe Y identique a la locale globale).
   *  Quand 'en', on applique translateUnitFrToEn sur l'unite display. */
  titleLocale?: "fr" | "en";
}) {
  const { t } = useT();
  // Garde-fou : data peut être null/undefined dans certaines fiches. Forcer tableau.
  const safeData = Array.isArray(data) ? data : [];
  const xLabels = labels ?? defaultLabels(safeData.length);

  // Yann 8 juin 2026 (PRIO 3) : suffixe fréquence "par x" pour l'export PNG.
  // company-view inclut DÉJÀ ce suffixe dans exportTitle via le MÊME
  // t(`timefrac.suffix.${timeFraction}`). On le recalcule ici à l'identique
  // pour le transmettre séparément à l'export, qui le détecte en fin de
  // sous-titre et le style (2 pts plus petit, bleu-violet, opacité 0.85).
  // Si fréquence = année : undefined → sous-titre inchangé.
  // Yann juin 2026 : la fréquence exportée suit la langue du titre (titleLocale
  // = heroTitleLang du swap), pas la locale globale, pour matcher le PNG.
  const exportFrequency =
    timeFraction !== "year" ? translate(`timefrac.suffix.${timeFraction}`, titleLocale) : undefined;

  // Diviseur appliqué aux valeurs (data + ttm) pour le mode "par jour", "par seconde", etc.
  const divisor = timeFractionDivisor(timeFraction);

  // Rescale auto de l'unité pour TOUJOURS garder le MAX value ∈ [1, 999].
  // Yann 17 mai 2026 (Phase 2 D1) : normalisation RAW_UNIT_NORMALIZE
  // centralisée dans `src/lib/format.ts`. `toAbsolute` et
  // `rescaleForReadability` gèrent maintenant les units formatés FR
  // ("Mds $", "M €", etc) automatiquement → plus de double-mapping ici.
  // Yann 8 juin 2026 : rescale via helper partage computeChartDisplay
  // (meme calcul utilise par le gros chiffre hero dans company-view).
  const { scaledData, scaledTtm, displayUnit } = computeChartDisplay(safeData, unit, ttm, divisor);

  return (
    <div className="relative min-h-[320px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {mode === "curve" && (
            <CurveChart data={scaledData as number[]} labels={xLabels} unit={displayUnit} color={color} anomalies={anomalies} events={events} ttm={scaledTtm} exportTitle={exportTitle} exportTicker={company?.ticker} exportCagr={exportCagr} exportFrequency={exportFrequency} exportInterpretation={exportInterpretation} titleLocale={titleLocale} />
          )}
          {mode === "bars" && (
            <BarsIso3DStack data={scaledData as number[]} labels={xLabels} unit={displayUnit} color={color} events={events} ttm={scaledTtm} variant={barsVariant} exportTitle={exportTitle} exportTicker={company?.ticker} exportCagr={exportCagr} exportFrequency={exportFrequency} exportInterpretation={exportInterpretation} titleLocale={titleLocale} />
          )}
          {mode === "delta" && (
            <VariationIsoSteps3D data={scaledData as number[]} labels={xLabels} events={events} exportTitle={exportTitle} exportTicker={company?.ticker} exportCagr={exportCagr} exportFrequency={exportFrequency} exportInterpretation={exportInterpretation} />
          )}
          {mode === "panel" && company && activeShort && onPickKpi && (
            <MiniMultiplesChart
              company={company}
              activeShort={activeShort}
              onPick={onPickKpi}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook utilitaire si un parent veut juste l'état de mode + un setter
 * sans avoir à le déclarer manuellement.
 */
export function useChartMode(initial: ChartMode = "bars") {
  return useState<ChartMode>(initial);
}
