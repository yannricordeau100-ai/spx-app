"use client";

import { useMemo, useState } from "react";

export type LogoEntry = {
  ticker: string;
  nameSafe: string;
  currentExists: boolean;
  currentSize: number;
  backupKind: "logodev" | "parqet" | "none";
  status: "ok" | "small" | "missing";
};

type Props = {
  entries: LogoEntry[];
  okCount: number;
  smallCount: number;
  missingCount: number;
};

type StatusFilter = "all" | "ok" | "small" | "missing";
type ScopeFilter = "top50" | "top100" | "all";
type Theme = "dark" | "light";

function formatKB(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function LogosCompareClient({
  entries,
  okCount,
  smallCount,
  missingCount,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");

  const filtered = useMemo(() => {
    let out = entries;
    if (statusFilter !== "all") {
      out = out.filter((e) => e.status === statusFilter);
    }
    if (scopeFilter === "top50") out = out.slice(0, 50);
    else if (scopeFilter === "top100") out = out.slice(0, 100);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((e) => e.ticker.toLowerCase().includes(q));
    }
    return out;
  }, [entries, statusFilter, scopeFilter, search]);

  const isDark = theme === "dark";

  const containerStyle = isDark
    ? "bg-neutral-950 text-neutral-100"
    : "bg-neutral-50 text-neutral-900";

  const cardStyle = isDark
    ? "bg-neutral-900 border border-neutral-800"
    : "bg-white border border-neutral-200";

  const subtleText = isDark ? "text-neutral-400" : "text-neutral-600";

  return (
    <div className={`min-h-screen ${containerStyle} transition-colors`}>
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-10">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">
              Comparaison logos avant / apres Logo.dev
            </h1>
            <p className={`mt-1 text-sm ${subtleText}`}>
              {entries.length} stes (V1.9.5 + 35 manquants). Validation
              visuelle Yann.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                isDark
                  ? "bg-neutral-800 hover:bg-neutral-700"
                  : "bg-neutral-200 hover:bg-neutral-300"
              }`}
            >
              {isDark ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        {/* CTA + compteur */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              isDark
                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            Tous les logos OK ?
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
            <span
              className={`rounded-md px-2 py-1 font-mono ${
                isDark
                  ? "bg-emerald-950/40 text-emerald-300"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              OK {okCount}
            </span>
            <span
              className={`rounded-md px-2 py-1 font-mono ${
                isDark
                  ? "bg-amber-950/40 text-amber-300"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              small {smallCount}
            </span>
            <span
              className={`rounded-md px-2 py-1 font-mono ${
                isDark
                  ? "bg-red-950/40 text-red-300"
                  : "bg-red-50 text-red-700"
              }`}
            >
              missing {missingCount}
            </span>
            <span className={`font-mono ${subtleText}`}>
              total {entries.length}
            </span>
          </div>
        </div>

        {/* Filtres */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {(["all", "ok", "small", "missing"] as StatusFilter[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    statusFilter === s
                      ? isDark
                        ? "bg-violet-700 text-white"
                        : "bg-violet-600 text-white"
                      : isDark
                        ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                        : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                  }`}
                >
                  {s}
                </button>
              )
            )}
          </div>

          <div className="flex gap-1">
            {(["top50", "top100", "all"] as ScopeFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  scopeFilter === s
                    ? isDark
                      ? "bg-cyan-700 text-white"
                      : "bg-cyan-600 text-white"
                    : isDark
                      ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                }`}
              >
                {s === "top50"
                  ? "Top 50"
                  : s === "top100"
                    ? "Top 100"
                    : "All"}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche ticker..."
            className={`rounded-md px-3 py-1.5 text-sm font-mono outline-none ${
              isDark
                ? "bg-neutral-800 text-neutral-100 placeholder:text-neutral-500"
                : "bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400"
            }`}
          />

          <span className={`text-xs ${subtleText}`}>
            {filtered.length} affiches
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-4">
          {filtered.map((e) => (
            <LogoCard
              key={e.ticker}
              entry={e}
              isDark={isDark}
              cardStyle={cardStyle}
              subtleText={subtleText}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div
            className={`mt-12 rounded-lg p-8 text-center text-sm ${subtleText}`}
          >
            Aucune ste ne correspond aux filtres.
          </div>
        )}
      </div>
    </div>
  );
}

function LogoCard({
  entry,
  isDark,
  cardStyle,
  subtleText,
}: {
  entry: LogoEntry;
  isDark: boolean;
  cardStyle: string;
  subtleText: string;
}) {
  const tagColor =
    entry.status === "ok"
      ? isDark
        ? "bg-emerald-950/60 text-emerald-300 border-emerald-900"
        : "bg-emerald-100 text-emerald-700 border-emerald-300"
      : entry.status === "small"
        ? isDark
          ? "bg-amber-950/60 text-amber-300 border-amber-900"
          : "bg-amber-100 text-amber-700 border-amber-300"
        : isDark
          ? "bg-red-950/60 text-red-300 border-red-900"
          : "bg-red-100 text-red-700 border-red-300";

  const newSrc = `/logos/${entry.nameSafe}.png`;
  const backupSrc =
    entry.backupKind === "logodev"
      ? `/logos/.backup-logodev/${entry.nameSafe}.png`
      : entry.backupKind === "parqet"
        ? `/logos/.backup-parqet/${entry.nameSafe}.png`
        : null;

  const tileBg = isDark ? "bg-neutral-800" : "bg-neutral-100";

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg p-3 ${cardStyle}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-base font-semibold">
            {entry.ticker}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase ${tagColor}`}
        >
          {entry.status === "ok"
            ? "OK"
            : entry.status === "small"
              ? "small"
              : "miss"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <div className={`text-[10px] uppercase ${subtleText}`}>
            {entry.backupKind === "logodev"
              ? "avant (Logo.dev)"
              : entry.backupKind === "parqet"
                ? "avant (Parqet)"
                : "avant"}
          </div>
          <div
            className={`flex aspect-square items-center justify-center rounded-md ${tileBg} p-2`}
          >
            {backupSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={backupSrc}
                alt={`${entry.ticker} avant`}
                className="max-h-full max-w-full object-contain"
                onError={(ev) => {
                  (ev.target as HTMLImageElement).style.opacity = "0.15";
                }}
              />
            ) : (
              <span className={`text-[10px] ${subtleText}`}>—</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className={`text-[10px] uppercase ${subtleText}`}>
            apres (Logo.dev)
          </div>
          <div
            className={`flex aspect-square items-center justify-center rounded-md ${tileBg} p-2`}
          >
            {entry.currentExists ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={newSrc}
                alt={`${entry.ticker} apres`}
                className="max-h-full max-w-full object-contain"
                onError={(ev) => {
                  (ev.target as HTMLImageElement).style.opacity = "0.15";
                }}
              />
            ) : (
              <span className={`text-[10px] ${subtleText}`}>404</span>
            )}
          </div>
        </div>
      </div>

      <div className={`flex items-center justify-between text-[10px] ${subtleText}`}>
        <span className="font-mono">{formatKB(entry.currentSize)}</span>
        <span className="font-mono">
          {entry.backupKind === "none" ? "no backup" : entry.backupKind}
        </span>
      </div>
    </div>
  );
}
