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
export function ChartCycleControls({
  mode,
  onChange,
  color = "#a78bfa",
}: {
  mode: ChartMode;
  onChange: (m: ChartMode) => void;
  color?: string;
}) {
  const { t } = useT();
  return (
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
}) {
  const xLabels = labels ?? defaultLabels(data.length);

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
            <CurveChart data={data} labels={xLabels} unit={unit} color={color} anomalies={anomalies} events={events} />
          )}
          {mode === "bars" && (
            <BarsIso3DStack data={data} labels={xLabels} unit={unit} color={color} events={events} />
          )}
          {mode === "delta" && (
            <VariationIsoSteps3D data={data} labels={xLabels} events={events} />
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
