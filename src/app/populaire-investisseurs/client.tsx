"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Crown, Download, Info, Sparkles, TrendingUp } from "lucide-react";
import type { PopularData, PopularRow } from "./page";

type Tab = { key: string; label: string; flag: string; country: string };

type Labels = {
  title: string;
  subtitle: string;
  for_you: string;
  world: string;
  country_label: string;
  source_label: string;
  window_label: string;
  universe_label: string;
  country_detected: string;
  download_csv: string;
  view_company: string;
  dollar_volume: string;
  rank: string;
  no_data: string;
  methodology_title: string;
  methodology_body: string;
  rank_label: string;
  popularity_score: string;
};

function rankBarPct(rank: number, totalShown: number): number {
  // Bar décroissante : rang 1 = 100%, dernier = ~10%
  if (totalShown <= 1) return 100;
  const pct = 100 - ((rank - 1) / Math.max(totalShown - 1, 1)) * 90;
  return Math.max(pct, 8);
}

function PodiumCard({
  row,
  rank,
  totalShown,
  scopeLabel,
}: {
  row: PopularRow;
  rank: number;
  totalShown: number;
  scopeLabel: string;
}) {
  const pct = rankBarPct(rank, totalShown);
  const accent =
    rank === 1
      ? { bg: "from-amber-500/20 via-amber-500/8 to-transparent", border: "border-amber-500/40", text: "text-amber-200", chip: "bg-amber-500/15 text-amber-200 ring-amber-500/30" }
      : rank === 2
        ? { bg: "from-zinc-300/15 via-zinc-300/5 to-transparent", border: "border-zinc-400/30", text: "text-zinc-200", chip: "bg-zinc-400/15 text-zinc-200 ring-zinc-400/30" }
        : { bg: "from-orange-700/20 via-orange-700/8 to-transparent", border: "border-orange-600/30", text: "text-orange-200", chip: "bg-orange-700/15 text-orange-200 ring-orange-600/30" };

  return (
    <a
      href={`/sandbox/v1-8/${row.ticker.toLowerCase()}`}
      target="_blank"
      rel="noopener"
      className={`group relative overflow-hidden rounded-2xl border ${accent.border} bg-gradient-to-br ${accent.bg} p-5 transition-all hover:scale-[1.02] hover:shadow-lg`}
    >
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-white/[0.03] blur-3xl" />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          {rank === 1 && <Crown className="size-5 text-amber-300" />}
          <span className={`inline-flex items-center rounded-md ${accent.chip} px-2 py-0.5 font-mono text-[11px] font-bold ring-1`}>
            #{rank}
          </span>
        </div>
        <ArrowRight className="size-4 text-zinc-500 transition-all group-hover:translate-x-1 group-hover:text-zinc-200" />
      </div>
      <div className="relative mt-3">
        <div className="font-mono text-[18px] font-bold text-zinc-50">{row.ticker}</div>
        <div className="mt-0.5 line-clamp-1 text-[13px] text-zinc-300">{row.name}</div>
      </div>
      <div className="relative mt-4">
        <div className={`font-display text-[26px] font-bold leading-none tracking-tight ${accent.text}`}>
          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"} Top {rank}
        </div>
        <div className="mt-0.5 text-[11px] text-zinc-400">{scopeLabel}</div>
      </div>
      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={`h-full rounded-full ${rank === 1 ? "bg-amber-400" : rank === 2 ? "bg-zinc-300" : "bg-orange-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </a>
  );
}

function StockRow({
  row,
  rank,
  totalShown,
}: {
  row: PopularRow;
  rank: number;
  totalShown: number;
}) {
  const pct = rankBarPct(rank, totalShown);

  return (
    <a
      href={`/sandbox/v1-8/${row.ticker.toLowerCase()}`}
      target="_blank"
      rel="noopener"
      className="group relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/[0.04] sm:gap-4 sm:p-4"
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/[0.04] font-mono text-[13px] font-bold text-zinc-300 sm:size-12 sm:text-[14px]">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[14px] font-bold text-zinc-50 sm:text-[15px]">{row.ticker}</span>
          {row.country && row.country !== "US" && (
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
              {row.country}
            </span>
          )}
        </div>
        <div className="line-clamp-1 text-[12px] text-zinc-400 sm:text-[13px]">{row.name}</div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>
      <div className="hidden text-right sm:block">
        <div className="font-mono text-[14px] font-semibold tabular-nums text-zinc-100">
          #{rank}
        </div>
        <div className="text-[10.5px] text-zinc-500">popularité</div>
      </div>
      <div className="text-right sm:hidden">
        <div className="font-mono text-[12px] font-semibold tabular-nums text-zinc-200">
          #{rank}
        </div>
      </div>
      <ArrowRight className="hidden size-4 shrink-0 text-zinc-600 transition-all group-hover:translate-x-1 group-hover:text-violet-300 sm:block" />
    </a>
  );
}

function downloadCSV(data: PopularData) {
  const lines: string[] = ["scope,rank,ticker,name,country"];
  for (const [scope, rows] of Object.entries(data)) {
    if (scope.startsWith("_") || !Array.isArray(rows)) continue;
    for (const r of rows as PopularRow[]) {
      const name = String(r.name || "").replace(/"/g, '""');
      lines.push(`${scope},${r.rank},${r.ticker},"${name}",${r.country || ""}`);
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mettrik-popular-stocks-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type TopN = 10 | 20 | 50 | 9999;

export function PopulaireClient({
  data,
  tabs,
  defaultTab,
  country,
  labels,
}: {
  data: PopularData;
  tabs: Tab[];
  defaultTab: string;
  country: string;
  labels: Labels;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [topN, setTopN] = useState<TopN>(20);

  const allRows = useMemo<PopularRow[]>(() => {
    const r = data[activeTab];
    return Array.isArray(r) ? (r as PopularRow[]) : [];
  }, [data, activeTab]);

  const rows = useMemo<PopularRow[]>(() => {
    return allRows.slice(0, topN);
  }, [allRows, topN]);

  const hasData = useMemo(() => {
    return Object.keys(data).some(
      (k) => !k.startsWith("_") && Array.isArray(data[k]) && (data[k] as PopularRow[]).length > 0
    );
  }, [data]);

  const activeTabInfo = tabs.find((t) => t.key === activeTab);
  const scopeLabel = activeTab === "world"
    ? "dans le top mondial"
    : activeTabInfo
      ? `dans ${activeTabInfo.label}`
      : "";

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const totalShown = rows.length;

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      {/* Halo gradient haut de page */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] overflow-hidden">
        <div className="absolute left-1/2 top-0 size-[700px] -translate-x-1/2 rounded-full bg-violet-600/[0.08] blur-3xl" />
        <div className="absolute right-0 top-20 size-[500px] rounded-full bg-cyan-500/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/[0.08] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-violet-200">
              <TrendingUp className="size-3" /> Live · 3 mois glissants
            </div>
            <h1 className="font-display text-[32px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[40px]">
              {labels.title}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-zinc-400 sm:text-[15px]">
              {labels.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadCSV(data)}
            disabled={!hasData}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-violet-500/30 bg-violet-500/[0.06] px-3 py-2 text-[12.5px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15 disabled:opacity-40 sm:self-end"
          >
            <Download className="size-3.5" /> {labels.download_csv}
          </button>
        </div>

        {/* Tabs pays */}
        <div className="mb-8 overflow-x-auto">
          <div className="inline-flex min-w-full gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1.5">
            {tabs.map((t) => {
              const isActive = t.key === activeTab;
              const isForYou = t.country === country && t.country !== "";
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-[12.5px] font-medium transition-all sm:px-4 sm:py-2.5 sm:text-[13px] ${
                    isActive
                      ? "bg-gradient-to-br from-violet-500/25 to-cyan-500/15 text-zinc-50 shadow-inner ring-1 ring-violet-500/30"
                      : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                  }`}
                >
                  <span className="mr-1.5 text-[13px]">{t.flag}</span>
                  {t.label}
                  {isForYou && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-violet-500/20 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-violet-200">
                      <Sparkles className="mr-0.5 size-2.5" /> {labels.for_you}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {!hasData && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-5 text-[13.5px] text-amber-100">
            ⏳ {labels.no_data}
          </div>
        )}

        {hasData && rows.length > 0 && (
          <>
            {/* Top N filter */}
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="text-[12px] text-zinc-500">
                {rows.length} action{rows.length > 1 ? "s" : ""} sur {allRows.length} disponible{allRows.length > 1 ? "s" : ""}
              </div>
              <div className="inline-flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
                {[10, 20, 50, 9999].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTopN(n as TopN)}
                    className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-all ${
                      topN === n
                        ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/30"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    {n === 9999 ? labels.rank : `Top ${n}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Podium top 3 */}
            {podium.length === 3 && (
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {podium.map((r, i) => (
                  <PodiumCard key={r.ticker} row={r} rank={i + 1} totalShown={totalShown} scopeLabel={scopeLabel} />
                ))}
              </div>
            )}

            {/* Liste reste */}
            <div className="mb-10 space-y-2">
              {rest.map((r, i) => (
                <StockRow key={r.ticker} row={r} rank={i + 4} totalShown={totalShown} />
              ))}
            </div>
          </>
        )}

        {/* Méthodologie */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 sm:p-6">
          <div className="mb-2 flex items-center gap-2">
            <Info className="size-4 text-cyan-300" />
            <h3 className="text-[13.5px] font-semibold uppercase tracking-wider text-zinc-200">
              {labels.methodology_title}
            </h3>
          </div>
          <p className="text-[13px] leading-relaxed text-zinc-400">{labels.methodology_body}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11.5px] sm:grid-cols-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {labels.source_label}
              </div>
              <div className="mt-0.5 text-zinc-200">{data._meta?.source ?? "yfinance"}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {labels.window_label}
              </div>
              <div className="mt-0.5 text-zinc-200">{data._meta?.window ?? "—"}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {labels.universe_label}
              </div>
              <div className="mt-0.5 text-zinc-200">
                {data._meta?.enriched_size ?? "—"} / {data._meta?.universe_size ?? "—"}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {labels.country_detected}
              </div>
              <div className="mt-0.5 text-zinc-200">{labels.country_label}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
