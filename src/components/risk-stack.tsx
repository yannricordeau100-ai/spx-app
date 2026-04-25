"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Gavel,
  Swords,
  ShieldAlert,
  Wrench,
  Banknote,
  Globe2,
  Cpu,
  AlertTriangle,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  X,
} from "lucide-react";
import type { CompanyRisk, RiskCategory, RiskTrend } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";

const CATEGORY_META: Record<
  RiskCategory,
  { label: string; color: string; Icon: typeof Gavel }
> = {
  regulatory: { label: "Réglementaire", color: "#f59e0b", Icon: Gavel },
  competitive: { label: "Concurrentiel", color: "#f43f5e", Icon: Swords },
  cyber: { label: "Cybersécurité", color: "#06b6d4", Icon: ShieldAlert },
  operational: { label: "Opérationnel", color: "#a78bfa", Icon: Wrench },
  financial: { label: "Financier", color: "#10b981", Icon: Banknote },
  macro: { label: "Macro", color: "#94a3b8", Icon: Globe2 },
  technology: { label: "Technologique", color: "#fb923c", Icon: Cpu },
};

const TREND_META: Record<
  RiskTrend,
  { label: string; color: string; Icon: typeof ArrowUp | typeof Sparkles }
> = {
  new: { label: "Nouveau 2025", color: "#a78bfa", Icon: Sparkles },
  up: { label: "Aggravé", color: "#f43f5e", Icon: ArrowUp },
  stable: { label: "Stable", color: "#a1a1aa", Icon: Minus },
  down: { label: "Atténué", color: "#10b981", Icon: ArrowDown },
  removed: { label: "Retiré", color: "#71717a", Icon: X },
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="h-1.5 w-4 rounded-sm"
          style={{
            background: n <= score ? color : "#1f1f1f",
            boxShadow: n <= score ? `0 0 6px ${color}66` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function ScoreLabel(score: number): string {
  return score >= 5
    ? "Critique"
    : score >= 4
      ? "Élevé"
      : score >= 3
        ? "Modéré"
        : score >= 2
          ? "Faible"
          : "Marginal";
}

function RiskCard({ risk, index }: { risk: CompanyRisk; index: number }) {
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[risk.category];
  const trend = TREND_META[risk.trend];
  const Icon = meta.Icon;
  const TrendIcon = trend.Icon;

  // Score color scales from yellow (low) to red (critical)
  const scoreColor =
    risk.score >= 5
      ? "#ef4444"
      : risk.score >= 4
        ? "#f97316"
        : risk.score >= 3
          ? "#eab308"
          : risk.score >= 2
            ? "#84cc16"
            : "#22c55e";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-[#1a1a1a] bg-[#070707] transition-colors hover:border-[#2a2a2a]"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3.5 p-4 text-left"
      >
        <span
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md"
          style={{
            background: `${meta.color}1a`,
            color: meta.color,
            border: `1px solid ${meta.color}40`,
          }}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
              style={{
                background: `${meta.color}1a`,
                color: meta.color,
                border: `1px solid ${meta.color}33`,
              }}
            >
              {meta.label}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
              style={{
                background: `${trend.color}1a`,
                color: trend.color,
                border: `1px solid ${trend.color}33`,
              }}
            >
              <TrendIcon className="size-3" />
              {trend.label}
            </span>
          </div>
          <div className="mt-2 text-[15px] font-semibold leading-snug text-zinc-50">
            {risk.title}
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <ScoreBar score={risk.score} color={scoreColor} />
            <span
              className="font-mono text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: scoreColor }}
            >
              {ScoreLabel(risk.score)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-400">
              {risk.score}/5
            </span>
            <span
              onClick={(e) => e.stopPropagation()}
              className="ml-1"
            >
              <InfoTooltip color={scoreColor}>
                <div
                  className="mb-1.5 font-mono text-[10px] uppercase tracking-wider"
                  style={{ color: scoreColor }}
                >
                  Comment cette note a été calculée
                </div>
                <p className="text-[12px] leading-relaxed text-zinc-200">
                  {risk.score_rationale}
                </p>
                <div className="mt-3 rounded-md border border-[#1f1f1f] bg-[#0c0c0c] p-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    Barème
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11.5px] text-zinc-300">
                    <li>• Position dans le 10-K (ordre officiel)</li>
                    <li>• Intensité du langage juridique</li>
                    <li>• Tendance vs 10-K N-1</li>
                    <li>• Poids de catégorie (cyber, regulatory élevés)</li>
                  </ul>
                </div>
              </InfoTooltip>
            </span>
          </div>
        </div>
        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#1a1a1a] px-4 py-3.5">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                Extrait du 10-K
              </div>
              <p className="border-l-2 border-[#2a2a2a] pl-3 text-[13px] italic leading-relaxed text-zinc-200">
                « {risk.quote} »
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function RiskStack({
  risks,
  accent = "#a78bfa",
}: {
  risks: CompanyRisk[];
  accent?: string;
}) {
  if (!risks || risks.length === 0) return null;

  // Sort by score desc to emphasize critical first
  const sorted = [...risks].sort((a, b) => b.score - a.score);

  // Count emerging risks (new to 2025)
  const newCount = risks.filter((r) => r.trend === "new").length;
  const upCount = risks.filter((r) => r.trend === "up").length;

  return (
    <section className="mt-9 animate-fade-up-d2">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <AlertTriangle className="size-5" style={{ color: accent }} />
            Facteurs de risque
          </h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-300">
            Extraits directs du 10-K, notés selon 4 critères. Cliquez pour voir la citation
            intégrale ; survolez l'icône « i » pour comprendre la note.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          <span>{risks.length} risques</span>
          {upCount > 0 && (
            <span className="text-rose-300">{upCount} aggravé{upCount > 1 ? "s" : ""}</span>
          )}
          {newCount > 0 && (
            <span className="text-violet-300">
              {newCount} nouveau{newCount > 1 ? "x" : ""} en 2025
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {sorted.map((r, i) => (
          <RiskCard key={r.title} risk={r} index={i} />
        ))}
      </div>
    </section>
  );
}
