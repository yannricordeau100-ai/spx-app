"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, BarChart3, Grid2X2, TrendingUp } from "lucide-react";

import { CurveChart } from "@/components/charts/curve-chart";
import { BarsChart } from "@/components/charts/bars-chart";
import { DeltaChart } from "@/components/charts/delta-chart";
import { MiniMultiplesChart } from "@/components/charts/mini-multiples-chart";
import { Chart3DWrapper } from "@/components/charts/chart-3d-wrapper";
import { cn } from "@/lib/utils";
import type { Anomaly } from "@/lib/brand";
import type { Company } from "@/lib/data";

type Mode = "curve" | "bars" | "delta" | "panel";

const MODES: {
  id: Mode;
  label: string;
  hint: string;
  icon: typeof Activity;
}[] = [
  { id: "curve", label: "Courbe", hint: "Trajectoire", icon: Activity },
  { id: "bars", label: "Barres", hint: "Année par année", icon: BarChart3 },
  { id: "delta", label: "Variation", hint: "Variation annuelle (year-over-year)", icon: TrendingUp },
  { id: "panel", label: "Tableau de bord", hint: "6 indicateurs en un coup d'œil", icon: Grid2X2 },
];

function defaultLabels(n: number): string[] {
  const end = 2025;
  return Array.from({ length: n }, (_, i) => String(end - n + 1 + i));
}

export function ChartCycle({
  data,
  unit,
  color = "#a78bfa",
  labels,
  anomalies = [],
  company,
  activeShort,
  onPickKpi,
}: {
  data: number[];
  unit: string;
  color?: string;
  labels?: string[];
  anomalies?: Anomaly[];
  /** Required for "panel" mode (mini-multiples). */
  company?: Company;
  activeShort?: string;
  onPickKpi?: (short: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("curve");
  const xLabels = labels ?? defaultLabels(data.length);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-sans text-[12px] font-medium uppercase tracking-[0.14em] text-zinc-300">
          {MODES.find((m) => m.id === mode)?.hint}
        </span>
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
                onClick={() => setMode(m.id)}
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
                <span className="relative">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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
              <Chart3DWrapper>
                <CurveChart data={data} labels={xLabels} unit={unit} color={color} anomalies={anomalies} />
              </Chart3DWrapper>
            )}
            {mode === "bars" && (
              <Chart3DWrapper>
                <BarsChart data={data} labels={xLabels} unit={unit} color={color} anomalies={anomalies} />
              </Chart3DWrapper>
            )}
            {mode === "delta" && (
              <Chart3DWrapper>
                <DeltaChart data={data} labels={xLabels} unit={unit} />
              </Chart3DWrapper>
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
    </div>
  );
}
