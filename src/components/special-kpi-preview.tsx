"use client";

import { useMemo } from "react";
import { Info, TrendingUp, Sparkles } from "lucide-react";
import type { SpecialKpi, SpecialKpiPoint } from "@/lib/desk/special-kpis";

/**
 * Preview "réel" d'un KPI spécial — rend les 2 vues possibles selon le style :
 *  - classique : ligne d'indicateur clé (façon KpiRow) + mini-chart
 *  - story    : carte verticale façon KpiStoryCard (9:16)
 *
 * Affiche un "i" sur les points avec uncertainty_pct.
 */
export function SpecialKpiPreview({ kpi }: { kpi: SpecialKpi }) {
  const points = kpi.data.values_by_period ?? [];
  if (points.length === 0) {
    return (
      <div className="text-center text-[13px] text-zinc-500">
        Pas encore de données. Lance l'extraction pour voir le rendu.
      </div>
    );
  }

  if (kpi.style === "story") {
    return <StoryStyle kpi={kpi} />;
  }
  return <ClassiqueStyle kpi={kpi} />;
}

function pointsToHistory(points: SpecialKpiPoint[]): number[] {
  return points.map((p) => p.value);
}

function MiniChart({ kpi, accent }: { kpi: SpecialKpi; accent: string }) {
  const points = kpi.data.values_by_period ?? [];
  const values = pointsToHistory(points);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const pad = 2;

  const xs = points.map((_, i) => pad + (i * (w - 2 * pad)) / Math.max(1, points.length - 1));
  const ys = values.map((v) => h - pad - ((v - min) / range) * (h - 2 * pad));
  const path = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full">
      <defs>
        <linearGradient id={`grad-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L${xs[xs.length - 1]},${h - pad} L${xs[0]},${h - pad} Z`}
        fill={`url(#grad-${kpi.id})`}
      />
      <path d={path} stroke={accent} strokeWidth={1.5} fill="none" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xs[i]}
          cy={ys[i]}
          r={p.uncertainty_pct ? 2.2 : 1.5}
          fill={p.uncertainty_pct ? "#f59e0b" : accent}
          stroke="#0a0a0a"
          strokeWidth={0.5}
        >
          <title>
            {p.period}: {p.value}
            {p.uncertainty_pct
              ? ` (±${p.uncertainty_pct}% — ${p.uncertainty_note ?? "estimation"})`
              : ""}
            {p.source ? `\nSource: ${p.source}` : ""}
          </title>
        </circle>
      ))}
    </svg>
  );
}

function uncertaintyCount(points: SpecialKpiPoint[]): number {
  return points.filter((p) => p.uncertainty_pct).length;
}

function ClassiqueStyle({ kpi }: { kpi: SpecialKpi }) {
  const accent = "#a78bfa";
  const points = kpi.data.values_by_period ?? [];
  const latest = points[points.length - 1];
  const prev = points[points.length - 2];
  const uncerts = uncertaintyCount(points);
  const yoy = kpi.data.yoy_latest;

  return (
    <div className="space-y-4">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">Rendu "Indicateur clé"</div>
      <div className="grid grid-cols-12 items-center gap-3 rounded-xl border border-[#1a1a1a] bg-[#0c0c0c] p-4">
        <div className="col-span-4">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase"
              style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}
            >
              {kpi.kpi_short}
            </span>
          </div>
          <div className="mt-1 text-[15px] font-medium text-zinc-100">
            {kpi.kpi_name_fr ?? kpi.kpi_name_en}
          </div>
        </div>
        <div className="col-span-3">
          <div className="font-mono text-[26px] font-semibold leading-none text-zinc-50">
            {latest?.value}
            {kpi.kpi_unit && <span className="ml-1 text-sm font-normal text-zinc-400">{kpi.kpi_unit}</span>}
          </div>
          {yoy && (
            <div
              className="mt-2 inline-flex items-center gap-1 font-mono text-[13px]"
              style={{ color: yoy.startsWith("-") ? "#f43f5e" : "#10b981" }}
            >
              <TrendingUp className="size-3.5" />
              {yoy}
              <span className="text-[10.5px] italic text-zinc-400">YoY</span>
            </div>
          )}
        </div>
        <div className="col-span-3">
          <MiniChart kpi={kpi} accent={accent} />
        </div>
        <div className="col-span-2 text-[12px] leading-snug text-zinc-300">
          {kpi.data.hero_summary ?? kpi.data.interpretation?.split(".")[0]}
          {uncerts > 0 && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-amber-300">
              <Info className="size-3" />
              {uncerts}/{points.length} pts incertains
            </div>
          )}
        </div>
      </div>
      {prev && latest && (
        <div className="text-[11.5px] text-zinc-500">
          Dernière valeur ({latest.period}) : <strong className="text-zinc-200">{latest.value}{kpi.kpi_unit ? " " + kpi.kpi_unit : ""}</strong> · précédente ({prev.period}) : <strong className="text-zinc-300">{prev.value}{kpi.kpi_unit ? " " + kpi.kpi_unit : ""}</strong>
        </div>
      )}
    </div>
  );
}

function StoryStyle({ kpi }: { kpi: SpecialKpi }) {
  const accent = "#a78bfa";
  const glow = "#a78bfa66";
  const points = kpi.data.values_by_period ?? [];
  const latest = points[points.length - 1];
  const uncerts = uncertaintyCount(points);

  return (
    <div className="flex flex-col items-center">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">Rendu "Story" (carrousel)</div>
      <div
        className="relative mt-3 flex aspect-[9/16] w-72 flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-4 pt-11"
        style={{ boxShadow: `inset 0 0 120px ${glow}` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
          style={{ background: `${accent}55` }}
        />
        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase"
                style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}
              >
                {kpi.kpi_short}
              </span>
              <div className="mt-1 text-[20px] font-bold leading-tight text-zinc-50">
                {kpi.kpi_name_fr ?? kpi.kpi_name_en}
              </div>
            </div>
            {kpi.story_category && (
              <div
                className="shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
                style={{ background: `${accent}10`, color: accent, borderColor: `${accent}33` }}
              >
                <Sparkles className="size-2.5" />
                {kpi.story_category}
              </div>
            )}
          </div>
          <div className="my-auto flex flex-col items-center text-center">
            <div
              className="font-display font-bold leading-none tracking-tight"
              style={{ fontSize: "clamp(56px, 18vw, 90px)", color: accent }}
            >
              {latest?.value}
            </div>
            {kpi.kpi_unit && (
              <div className="mt-2 text-[18px] font-semibold text-zinc-100">{kpi.kpi_unit}</div>
            )}
            {kpi.data.yoy_latest && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[14px] font-bold text-emerald-200">
                <TrendingUp className="size-3.5" />
                {kpi.data.yoy_latest}
                <span className="text-[11px] italic text-zinc-400">YoY</span>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/55 p-3 backdrop-blur">
            <div className="text-[13px] font-semibold leading-snug text-zinc-50">
              {kpi.data.hero_summary ?? kpi.data.interpretation?.split(".")[0]}
            </div>
            {uncerts > 0 && (
              <div className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-amber-300">
                <Info className="size-3" />
                {uncerts}/{points.length} pts incertains
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
