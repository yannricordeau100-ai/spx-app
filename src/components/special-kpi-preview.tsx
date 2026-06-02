"use client";

import { Info, TrendingUp, Sparkles } from "lucide-react";
import type { SpecialKpi, SpecialKpiPoint } from "@/lib/desk/special-kpis";

/**
 * Preview "réel" d'un KPI spécial. Selon le style :
 *  - classique : 2 vues empilées (Hero card + ligne indicateur clé)
 *  - story    : 2 vues empilées (Hero card + carte verticale 9:16)
 *
 * Cap 5 ans (les 5 derniers points). Sort par période ascendante.
 * Points avec uncertainty_pct sont affichés jaune + tooltip ±X%.
 */
const ACCENT = "#a78bfa";
const GLOW = "#a78bfa66";

function lastNPoints(pts: SpecialKpiPoint[], n: number): SpecialKpiPoint[] {
  if (pts.length <= n) return pts;
  return pts.slice(pts.length - n);
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: n >= 100 ? 0 : 1,
    maximumFractionDigits: n >= 100 ? 0 : 1,
  });
}

export function SpecialKpiPreview({ kpi }: { kpi: SpecialKpi }) {
  const all = kpi.data.values_by_period ?? [];
  if (all.length === 0) {
    return (
      <div className="text-center text-[13px] text-zinc-500">
        Pas encore de données. Lance l'extraction pour voir le rendu.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <HeroView kpi={kpi} />
      {kpi.style === "classique" ? (
        <ClassiqueRow kpi={kpi} />
      ) : (
        <StoryView kpi={kpi} />
      )}
    </div>
  );
}

/* ─── Hero (graph complet, format page société) ─────────────────── */
function HeroView({ kpi }: { kpi: SpecialKpi }) {
  const all = kpi.data.values_by_period ?? [];
  const pts5 = lastNPoints(all, 5);
  const latest = pts5[pts5.length - 1];
  const uncerts = pts5.filter((p) => p.uncertainty_pct).length;

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        Rendu HERO (page société, graph 5 ans)
        {kpi.is_hero && (
          <span className="ml-2 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-200">
            HERO PRINCIPAL
          </span>
        )}
      </div>
      <div className="grid grid-cols-12 gap-5 rounded-xl border border-[#1a1a1a] bg-[#0c0c0c] p-5">
        {/* Left col 4/12 : titre + valeur + YoY + CAGR */}
        <div className="col-span-12 sm:col-span-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">
            KPI principal
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase"
              style={{
                background: `${ACCENT}1a`,
                color: ACCENT,
                border: `1px solid ${ACCENT}33`,
              }}
            >
              {kpi.kpi_short}
            </span>
          </div>
          <div className="mt-2 text-[14px] font-semibold leading-tight text-zinc-100">
            {kpi.kpi_name_fr ?? kpi.kpi_name_en}
          </div>
          <div className="mt-4">
            <div className="font-mono text-[48px] font-bold leading-none text-zinc-50">
              {latest ? fmt(latest.value) : ", "}
            </div>
            {kpi.kpi_unit && (
              <div className="mt-1 text-[14px] text-zinc-400">{kpi.kpi_unit}</div>
            )}
          </div>
          {kpi.data.yoy_latest && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[13px] font-bold text-emerald-200">
              <TrendingUp className="size-3.5" />
              {kpi.data.yoy_latest}
              <span className="text-[10px] italic text-zinc-400" title="Year-on-Year">vs N-1</span>
            </div>
          )}
          {kpi.data.cagr_5y_pct != null && (
            <div className="mt-2 inline-block rounded-md bg-white/5 px-2 py-1 text-[11.5px] text-zinc-300">
              +{kpi.data.cagr_5y_pct} %/an <span className="text-zinc-500">(CAGR 5 ans)</span>
            </div>
          )}
        </div>

        {/* Right col 8/12 : chart */}
        <div className="col-span-12 sm:col-span-8">
          <BigChart kpi={kpi} points={pts5} />
          {uncerts > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300">
              <Info className="size-3" />
              {uncerts}/{pts5.length} points incertains (jaune sur le graph, ± détaillé au survol)
            </div>
          )}
          {kpi.data.hero_summary && (
            <p className="mt-3 text-[13px] italic leading-relaxed text-zinc-300">
              {kpi.data.hero_summary}
            </p>
          )}
          {kpi.data.interpretation && (
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">
              {kpi.data.interpretation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Indicateur clé (ligne sous le hero, format KpiRow) ─────────── */
function ClassiqueRow({ kpi }: { kpi: SpecialKpi }) {
  const all = kpi.data.values_by_period ?? [];
  const pts5 = lastNPoints(all, 5);
  const latest = pts5[pts5.length - 1];
  const yoy = kpi.data.yoy_latest;

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        Rendu LIGNE "Indicateur clé" (sous le graph hero)
      </div>
      <div className="grid grid-cols-12 items-center gap-3 rounded-xl border border-[#1a1a1a] bg-[#0c0c0c] p-4">
        <div className="col-span-4">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase"
              style={{
                background: `${ACCENT}1a`,
                color: ACCENT,
                border: `1px solid ${ACCENT}33`,
              }}
            >
              {kpi.kpi_short}
            </span>
            <div className="text-[15px] font-medium text-zinc-100">
              {kpi.kpi_name_fr ?? kpi.kpi_name_en}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{ borderColor: `${ACCENT}33`, color: ACCENT, background: `${ACCENT}10` }}
            >
              {kpi.kpi_category}
            </span>
            <span className="inline-flex items-center rounded-md border border-[#262626] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              {kpi.chart_type}
            </span>
          </div>
        </div>
        <div className="col-span-3">
          <div className="font-mono text-[26px] font-semibold leading-none text-zinc-50">
            {latest ? fmt(latest.value) : ", "}
            {kpi.kpi_unit && (
              <span className="ml-1 text-sm font-normal text-zinc-400">{kpi.kpi_unit}</span>
            )}
          </div>
          {yoy && (
            <div
              className="mt-2 inline-flex items-center gap-1 font-mono text-[13px]"
              style={{ color: yoy.startsWith("-") ? "#f43f5e" : "#10b981" }}
            >
              <TrendingUp className="size-3.5" />
              {yoy}
              <span className="text-[10.5px] italic text-zinc-400" title="Year-on-Year">vs N-1</span>
            </div>
          )}
        </div>
        <div className="col-span-3">
          <MiniChart kpi={kpi} points={pts5} />
        </div>
        <div className="col-span-2 text-[12px] leading-snug text-zinc-300">
          {kpi.data.hero_summary?.split(".")[0]}
        </div>
      </div>
    </div>
  );
}

/* ─── Story view (carte 9:16) ─────────────────────────────────────── */
function StoryView({ kpi }: { kpi: SpecialKpi }) {
  const all = kpi.data.values_by_period ?? [];
  const pts5 = lastNPoints(all, 5);
  const latest = pts5[pts5.length - 1];
  const uncerts = pts5.filter((p) => p.uncertainty_pct).length;

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        Rendu STORY (carrousel sous le hero)
      </div>
      <div className="flex justify-center">
        <div
          className="relative flex aspect-[9/16] w-72 flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-4 pt-11"
          style={{ boxShadow: `inset 0 0 120px ${GLOW}` }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
            style={{ background: `${ACCENT}55` }}
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase"
                  style={{ background: `${ACCENT}1a`, color: ACCENT, border: `1px solid ${ACCENT}33` }}
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
                  style={{ background: `${ACCENT}10`, color: ACCENT, borderColor: `${ACCENT}33` }}
                >
                  <Sparkles className="size-2.5" />
                  {kpi.story_category}
                </div>
              )}
            </div>
            <div className="my-auto flex flex-col items-center text-center">
              <div
                className="font-display font-bold leading-none tracking-tight"
                style={{ fontSize: "clamp(56px, 18vw, 90px)", color: ACCENT }}
              >
                {latest ? fmt(latest.value) : ", "}
              </div>
              {kpi.kpi_unit && (
                <div className="mt-2 text-[18px] font-semibold text-zinc-100">{kpi.kpi_unit}</div>
              )}
              {kpi.data.yoy_latest && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[14px] font-bold text-emerald-200">
                  <TrendingUp className="size-3.5" />
                  {kpi.data.yoy_latest}
                  <span className="text-[11px] italic text-zinc-400" title="Year-on-Year">vs N-1</span>
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
                  {uncerts}/{pts5.length} pts incertains
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Charts ────────────────────────────────────────────────────── */
function BigChart({ kpi, points }: { kpi: SpecialKpi; points: SpecialKpiPoint[] }) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 320;
  const h = 160;
  const padX = 24;
  const padY = 18;

  const xs = points.map(
    (_, i) => padX + (i * (w - 2 * padX)) / Math.max(1, points.length - 1),
  );
  const ys = values.map((v) => h - padY - ((v - min) / range) * (h - 2 * padY));

  // Yann 15 mai 2026 : calcule la position X des annotations "i" pour
  // les afficher sur le chart. Period peut être :
  //   - "FY20" / "2020" → match exact sur points[].period
  //   - "between:FY20-FY21" / "between:2020-2021" → entre 2 indices
  type AnnotationMarker = { x: number; ann: typeof kpi.annotations[number] };
  const annotationMarkers: AnnotationMarker[] = (kpi.annotations ?? [])
    .map((ann): AnnotationMarker | null => {
      const period = ann.period ?? "";
      if (period.startsWith("between:")) {
        const range = period.replace("between:", "").split("-");
        if (range.length === 2) {
          const i1 = points.findIndex((p) => p.period === range[0]);
          const i2 = points.findIndex((p) => p.period === range[1]);
          if (i1 >= 0 && i2 >= 0) return { x: (xs[i1] + xs[i2]) / 2, ann };
        }
        return null;
      }
      const idx = points.findIndex((p) => p.period === period);
      if (idx < 0) return null;
      return { x: xs[idx], ann };
    })
    .filter((m): m is AnnotationMarker => m !== null);

  const path = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`)
    .join(" ");

  if (kpi.chart_type === "bars") {
    const barW = (w - 2 * padX) / points.length * 0.7;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
        {points.map((p, i) => {
          const x = xs[i] - barW / 2;
          const y = ys[i];
          const isUnc = !!p.uncertainty_pct;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h - padY - y}
                fill={isUnc ? "#f59e0b" : ACCENT}
                opacity={isUnc ? 0.7 : 0.9}
                rx={2}
              >
                <title>
                  {p.period}: {fmt(p.value)} {kpi.kpi_unit ?? ""}
                  {isUnc ? ` (±${p.uncertainty_pct}% : ${p.uncertainty_note ?? "estimation"})` : ""}
                  {p.source ? `\nSource: ${p.source}` : ""}
                </title>
              </rect>
              <text
                x={xs[i]}
                y={h - 4}
                textAnchor="middle"
                fontSize="9"
                fill="#a1a1aa"
                fontFamily="monospace"
              >
                {p.period}
              </text>
              <text
                x={xs[i]}
                y={y - 4}
                textAnchor="middle"
                fontSize="10"
                fill="#fafafa"
                fontFamily="monospace"
              >
                {fmt(p.value)}
              </text>
            </g>
          );
        })}
        <AnnotationMarkers markers={annotationMarkers} chartHeight={h} />
      </svg>
    );
  }
  // curve / variation default
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
      <defs>
        <linearGradient id={`grad-big-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L${xs[xs.length - 1]},${h - padY} L${xs[0]},${h - padY} Z`}
        fill={`url(#grad-big-${kpi.id})`}
      />
      <path d={path} stroke={ACCENT} strokeWidth={2} fill="none" />
      {points.map((p, i) => {
        const isUnc = !!p.uncertainty_pct;
        return (
          <g key={i}>
            <circle
              cx={xs[i]}
              cy={ys[i]}
              r={isUnc ? 4.5 : 3.5}
              fill={isUnc ? "#f59e0b" : ACCENT}
              stroke="#0a0a0a"
              strokeWidth={1.5}
            >
              <title>
                {p.period}: {fmt(p.value)} {kpi.kpi_unit ?? ""}
                {isUnc ? ` (±${p.uncertainty_pct}% : ${p.uncertainty_note ?? "estimation"})` : ""}
                {p.source ? `\nSource: ${p.source}` : ""}
              </title>
            </circle>
            <text
              x={xs[i]}
              y={h - 4}
              textAnchor="middle"
              fontSize="9"
              fill="#a1a1aa"
              fontFamily="monospace"
            >
              {p.period}
            </text>
            <text
              x={xs[i]}
              y={ys[i] - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#fafafa"
              fontFamily="monospace"
            >
              {fmt(p.value)}
            </text>
          </g>
        );
      })}
      <AnnotationMarkers markers={annotationMarkers} chartHeight={h} />
    </svg>
  );
}

/** Marqueurs "i" cliquables / hoverables sur le chart. */
function AnnotationMarkers({
  markers,
  chartHeight,
}: {
  markers: { x: number; ann: { period: string; title_i18n: Record<string, string>; text_i18n: Record<string, string> } }[];
  chartHeight: number;
}) {
  if (!markers || markers.length === 0) return null;
  return (
    <>
      {markers.map((m, idx) => {
        const title = m.ann.title_i18n?.fr || m.ann.title_i18n?.en || "Info";
        const text = m.ann.text_i18n?.fr || m.ann.text_i18n?.en || "";
        return (
          <g key={idx}>
            <line
              x1={m.x}
              y1={6}
              x2={m.x}
              y2={chartHeight - 18}
              stroke="#06b6d4"
              strokeOpacity={0.25}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <circle cx={m.x} cy={10} r={7} fill="#06b6d4" stroke="#0a0a0a" strokeWidth={1.5}>
              <title>{title}{"\n\n"}{text}</title>
            </circle>
            <text
              x={m.x}
              y={13}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill="#0a0a0a"
              style={{ pointerEvents: "none" }}
            >
              i
            </text>
          </g>
        );
      })}
    </>
  );
}

function MiniChart({ kpi, points }: { kpi: SpecialKpi; points: SpecialKpiPoint[] }) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const pad = 2;
  const xs = points.map(
    (_, i) => pad + (i * (w - 2 * pad)) / Math.max(1, points.length - 1),
  );
  const ys = values.map((v) => h - pad - ((v - min) / range) * (h - 2 * pad));
  const path = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full">
      <defs>
        <linearGradient id={`grad-mini-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L${xs[xs.length - 1]},${h - pad} L${xs[0]},${h - pad} Z`}
        fill={`url(#grad-mini-${kpi.id})`}
      />
      <path d={path} stroke={ACCENT} strokeWidth={1.5} fill="none" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xs[i]}
          cy={ys[i]}
          r={p.uncertainty_pct ? 2.2 : 1.5}
          fill={p.uncertainty_pct ? "#f59e0b" : ACCENT}
          stroke="#0a0a0a"
          strokeWidth={0.5}
        >
          <title>
            {p.period}: {p.value}
            {p.uncertainty_pct ? ` (±${p.uncertainty_pct}%)` : ""}
          </title>
        </circle>
      ))}
    </svg>
  );
}
