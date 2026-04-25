"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  GitCompare,
  Info,
  Telescope,
  X,
} from "lucide-react";
import {
  type Company,
  type KPI,
  COMPANIES,
  formatUnit,
  getHero,
} from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { brand, rate } from "@/lib/brand";
import { buildCompareAnalysis, type CompareReadingTone } from "@/lib/compare";
import { QualityBadge } from "@/components/quality-badge";
import { CompareOverlayChart } from "@/components/compare-overlay-chart";

const TONE_META: Record<
  CompareReadingTone,
  { color: string; icon: typeof Crown }
> = {
  leader: { color: "#10b981", icon: Crown },
  challenger: { color: "#f59e0b", icon: ArrowUpRight },
  neutral: { color: "#a78bfa", icon: GitCompare },
  watch: { color: "#06b6d4", icon: Telescope },
};

function defaultLabels(n: number): string[] {
  const end = 2025;
  return Array.from({ length: n }, (_, i) => String(end - n + 1 + i));
}

export function ComparePanel({
  sourceCompany,
  sourceKpi,
  targetTicker,
  onClose,
}: {
  sourceCompany: Company;
  sourceKpi: KPI;
  targetTicker: string;
  onClose: () => void;
}) {
  const target = COMPANIES[targetTicker];
  if (!target) return null;

  // Match the target KPI on compare_key, else fall back to hero
  const matchedKpi =
    target.kpis.find((k) => k.compare_key && k.compare_key === sourceKpi.compare_key) ??
    getHero(target);

  const aAccent = brand(sourceCompany.ticker).primary;
  const bAccent = brand(target.ticker).primary;

  const analysis = buildCompareAnalysis(
    { ticker: sourceCompany.ticker, name: sourceCompany.name, kpi: sourceKpi },
    { ticker: target.ticker, name: target.name, kpi: matchedKpi }
  );

  const labels = defaultLabels(sourceKpi.history.length);

  const aTone = yoyTone(sourceKpi.yoy, sourceKpi.type);
  const bTone = yoyTone(matchedKpi.yoy, matchedKpi.type);
  const tip = (t: "pos" | "neg" | "neutral") =>
    t === "pos" ? "#10b981" : t === "neg" ? "#f43f5e" : "#a1a1aa";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-5 sm:p-7">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-300 transition-colors hover:bg-[#161616] hover:text-zinc-50"
        aria-label="Fermer"
      >
        <X className="size-4" />
      </button>

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <GitCompare className="size-4 text-zinc-200" />
        <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-100">
          {analysis.matchType === "direct" ? "Comparaison directe" : "Comparaison indirecte"}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          {analysis.a.ticker} <span className="mx-1">vs</span> {analysis.b.ticker}
        </span>
      </div>

      {/* Headline */}
      <p
        className="text-[15.5px] leading-relaxed text-zinc-100 [&_em]:italic [&_em]:text-zinc-100 [&_strong]:font-semibold [&_strong]:text-zinc-50"
        dangerouslySetInnerHTML={{ __html: analysis.headline }}
      />

      {/* Side-by-side hero cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          {
            co: sourceCompany,
            kpi: sourceKpi,
            accent: aAccent,
            tone: aTone,
            stats: analysis.a.stats,
          },
          {
            co: target,
            kpi: matchedKpi,
            accent: bAccent,
            tone: bTone,
            stats: analysis.b.stats,
          },
        ].map(({ co, kpi, accent, tone, stats }) => (
          <div
            key={co.ticker}
            className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-5"
          >
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: accent }} />
              <Link
                href={`/${co.ticker.toLowerCase()}`}
                className="text-[15px] font-medium text-zinc-50 hover:underline"
              >
                {co.name}
              </Link>
              <span className="font-mono text-[11px]" style={{ color: accent }}>
                {co.ticker}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider"
                style={{
                  background: `${accent}1a`,
                  color: accent,
                  border: `1px solid ${accent}33`,
                }}
              >
                {kpi.short}
              </span>
              <span className="text-[13px] text-zinc-200">{kpi.name_fr}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-semibold tabular-nums text-zinc-50">
                {kpi.value}
              </span>
              {formatUnit(kpi.unit) && (
                <span className="text-sm text-zinc-300">{formatUnit(kpi.unit)}</span>
              )}
              <span
                className="ml-2 inline-flex items-center gap-1 font-mono text-xs tabular-nums"
                style={{ color: tip(tone) }}
              >
                {tone === "pos" && <ArrowUpRight className="size-3" />}
                {tone === "neg" && <ArrowDownRight className="size-3" />}
                {kpi.yoy}
                <span className="text-[10px] italic text-zinc-400">(YoY)</span>
              </span>
            </div>

            {/* Per-side stats grid */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="CAGR 5 ans" value={stats.cagr === null ? "n/a" : pct(stats.cagr)} />
              <Stat label="Constance" value={stats.consistency} mono={false} />
              <Stat
                label="Momentum"
                value={pct(stats.momentum)}
                color={stats.momentum >= 0 ? "#10b981" : "#f43f5e"}
              />
            </div>

            <div className="mt-4">
              <QualityBadge rating={rate(kpi)} size="sm" scope={co.subsector} layout="stack" />
            </div>
          </div>
        ))}
      </div>

      {/* Normalized overlay chart */}
      <div className="mt-5">
        <CompareOverlayChart
          a={{
            name: sourceCompany.name,
            ticker: sourceCompany.ticker,
            data: sourceKpi.history,
            color: aAccent,
          }}
          b={{
            name: target.name,
            ticker: target.ticker,
            data: matchedKpi.history,
            color: bAccent,
          }}
          labels={labels}
        />
      </div>

      {/* Reading bullets */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Info className="size-4 text-zinc-200" />
          <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-100">
            Lecture comparée
          </span>
        </div>
        <ul className="grid gap-2.5">
          {analysis.readings.map((r, i) => {
            const meta = TONE_META[r.tone];
            const Icon = meta.icon;
            return (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-[#1a1a1a] bg-[#070707] p-3.5"
              >
                <span
                  className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: `${meta.color}1a`,
                    color: meta.color,
                    border: `1px solid ${meta.color}40`,
                  }}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[12.5px] font-semibold uppercase tracking-wider"
                    style={{ color: meta.color }}
                  >
                    {r.label}
                  </div>
                  <p
                    className="mt-1 text-[14px] leading-relaxed text-zinc-200 [&_em]:italic [&_em]:text-zinc-100 [&_strong]:font-semibold [&_strong]:text-zinc-50"
                    dangerouslySetInnerHTML={{ __html: r.body }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* What to watch */}
      {analysis.watch.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-300" />
            <span className="font-sans text-[12.5px] font-semibold uppercase tracking-[0.12em] text-amber-200">
              À garder en tête
            </span>
          </div>
          <ul className="space-y-1.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-3.5">
            {analysis.watch.map((w, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13.5px] leading-relaxed text-amber-100/95 [&_em]:italic [&_em]:text-amber-50 [&_strong]:font-semibold [&_strong]:text-amber-50"
              >
                <span className="text-amber-400">•</span>
                <span dangerouslySetInnerHTML={{ __html: w }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-5 rounded-lg border border-[#1f1f1f] bg-[#0c0c0c] p-3 text-[11.5px] italic leading-relaxed text-zinc-400">
        {analysis.disclaimer}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-[13px] font-semibold ${mono ? "font-mono tabular-nums" : ""}`}
        style={{ color: color ?? "#fafafa" }}
      >
        {value}
      </div>
    </div>
  );
}

function pct(x: number): string {
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}
