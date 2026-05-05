"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, BarChart3, Grid2X2, TrendingUp } from "lucide-react";

import { CurveChart } from "@/components/charts/curve-chart";
import { BarsIso3DStack } from "@/components/charts/bars-3d-variants";
import { VariationIsoSteps3D } from "@/components/charts/variation-3d-variants";
import { MiniMultiplesChart } from "@/components/charts/mini-multiples-chart";
import { cn } from "@/lib/utils";
import type { Anomaly } from "@/lib/brand";
import type { Company } from "@/lib/data";
import type { CompanyEvent } from "@/lib/events";
import { useT } from "@/lib/i18n/provider";

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
  { id: "curve", labelKey: "company.chart.curve", hintKey: "company.chart.curve.hint", icon: Activity },
  { id: "bars", labelKey: "company.chart.bars", hintKey: "company.chart.bars.hint", icon: BarChart3 },
  { id: "delta", labelKey: "company.chart.variation", hintKey: "company.chart.variation.hint", icon: TrendingUp },
  { id: "panel", labelKey: "company.chart.dashboard", hintKey: "company.chart.dashboard.hint", icon: Grid2X2 },
];

function defaultLabels(n: number): string[] {
  const end = 2025;
  return Array.from({ length: n }, (_, i) => String(end - n + 1 + i));
}

/**
 * Sélecteur du mode de chart, exporté à part pour pouvoir le placer dans
 * le toolbar du HERO (à gauche du PeriodToggle "5 / 10 / 20 ans") au
 * lieu de l'avoir au-dessus du graph.
 */
export type GraphPeriod = "year" | "quarter";

export function ChartCycleControls({
  mode,
  onChange,
  color = "#a78bfa",
  barsVariant,
  onBarsVariantChange,
  graphPeriod,
  onGraphPeriodChange,
  graphPeriodAvailable = { year: true, quarter: true },
}: {
  mode: ChartMode;
  onChange: (m: ChartMode) => void;
  color?: string;
  /** Variant sub-toggle quand mode === 'bars'. Optionnel : si non fourni, pas de toggle. */
  barsVariant?: BarsVariant;
  onBarsVariantChange?: (v: BarsVariant) => void;
  /** Toggle Annuel / Trimestriel — affiché si setter fourni. (5 mai 2026) */
  graphPeriod?: GraphPeriod;
  onGraphPeriodChange?: (p: GraphPeriod) => void;
  /** Quelle période est dispo dans la data ? Si quarter absent → onglet
   *  trimestriel grisé, fallback annuel auto. */
  graphPeriodAvailable?: { year: boolean; quarter: boolean };
}) {
  const { t } = useT();
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div
        role="tablist"
        className="relative inline-flex items-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1"
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
                "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
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
              <Icon className="relative size-3.5" />
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
          <button
            onClick={() => onGraphPeriodChange("quarter")}
            disabled={!graphPeriodAvailable.quarter}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              graphPeriod === "quarter" && graphPeriodAvailable.quarter
                ? "bg-white/10 text-zinc-100"
                : graphPeriodAvailable.quarter
                  ? "text-zinc-500 hover:text-zinc-200"
                  : "text-zinc-700 cursor-not-allowed"
            )}
            title={graphPeriodAvailable.quarter ? "Vue trimestrielle (par défaut)" : "Données trimestrielles non disponibles pour ce KPI"}
          >
            Trimestriel
          </button>
          <button
            onClick={() => onGraphPeriodChange("year")}
            disabled={!graphPeriodAvailable.year}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              graphPeriod === "year"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200"
            )}
            title="Vue annuelle (avec barre TTM)"
          >
            Annuel
          </button>
        </div>
      )}

      {/* Sub-toggle 3D / Classique : visible UNIQUEMENT quand mode === bars
          ET un setter est fourni par le parent. */}
      {mode === "bars" && barsVariant && onBarsVariantChange && (
        <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.02] p-0.5">
          <button
            onClick={() => onBarsVariantChange("iso3d")}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              barsVariant === "iso3d"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200"
            )}
            title="Style 3D isométrique (par défaut)"
          >
            3D
          </button>
          <button
            onClick={() => onBarsVariantChange("classic")}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              barsVariant === "classic"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200"
            )}
            title="Style classique 2D plat"
          >
            Classique
          </button>
        </div>
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
}) {
  // Garde-fou : data peut être null/undefined dans certaines fiches. Forcer tableau.
  const safeData = Array.isArray(data) ? data : [];
  const xLabels = labels ?? defaultLabels(safeData.length);

  // Diviseur appliqué aux valeurs (data + ttm) pour le mode "par jour", "par seconde", etc.
  const divisor = timeFractionDivisor(timeFraction);

  // Rescale auto de l'unité pour garder valeur >= 1 quand on divise.
  // Ex : Cloud GOOGL 58.71 Md$ /an → /seconde = 1.86 $/s (unit Md$ → $)
  // On bosse en valeur ABSOLUE puis on retrouve l'unité optimale basée sur le MAX.
  let scaledData = data;
  let scaledTtm = ttm;
  let displayUnit = unit;

  if (divisor !== 1) {
    // Convertir chaque value de history en valeur absolue (unité de base)
    const absData = safeData.map((v) => toAbsolute(v, unit) / divisor);
    const absTtm = ttm == null ? null : toAbsolute(ttm, unit) / divisor;
    // Trouver le MAX absolu (positif) pour décider de l'unité commune
    const allAbs = [...absData, ...(absTtm != null ? [absTtm] : [])].filter(Number.isFinite);
    const maxAbs = Math.max(...allAbs.map((v) => Math.abs(v)));
    const { unit: newUnit } = rescaleForReadability(maxAbs, unit);
    // Trouver le facteur de conversion entre l'unité de base et la nouvelle unité
    const factorPerUnit: Record<string, number> = {
      "$T": 1e12, "$B": 1e9, "$M": 1e6, "$K": 1e3, "$": 1, "$¢": 0.01,
      "T": 1e12, "B": 1e9, "M": 1e6, "K": 1e3, "": 1,
    };
    const newFactor = factorPerUnit[newUnit] ?? 1;
    scaledData = absData.map((v) => v / newFactor);
    scaledTtm = absTtm == null ? null : absTtm / newFactor;
    displayUnit = newUnit;
  }

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
            <CurveChart data={scaledData} labels={xLabels} unit={displayUnit} color={color} anomalies={anomalies} events={events} ttm={scaledTtm} />
          )}
          {mode === "bars" && (
            <BarsIso3DStack data={scaledData} labels={xLabels} unit={displayUnit} color={color} events={events} ttm={scaledTtm} variant={barsVariant} />
          )}
          {mode === "delta" && (
            <VariationIsoSteps3D data={scaledData} labels={xLabels} events={events} />
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
export function useChartMode(initial: ChartMode = "curve") {
  return useState<ChartMode>(initial);
}
