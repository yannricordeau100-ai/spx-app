"use client";

import { useMemo, useState } from "react";

export type UniverseEntry = {
  ticker: string;
  name?: string;
  country?: string;
  sources?: string[];
};

export type PublishableStock = {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  country: string;
  hero_kpi: string;
  market_cap_usd: number | null;
  sources: string[];
};

type Scope = "all" | "top307" | "sp500" | "eu";
type SortBy = "mc" | "ticker" | "name";

const EU_SOURCES = new Set([
  "dax40",
  "ftsemib",
  "ftse100",
  "smi",
  "bel20",
  "aex",
  "cac40",
  "atx",
]);

function matchesScope(stock: PublishableStock, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "top307") return stock.sources.includes("top307");
  if (scope === "sp500") return stock.sources.includes("sp500");
  if (scope === "eu") {
    if (stock.sources.some((s) => EU_SOURCES.has(s))) return true;
    return /\.(PA|DE|MI|L|SW|AS|BR|MC|HE|CO|OL|ST|LS|VI)$/i.test(stock.ticker);
  }
  return true;
}

function formatMarketCap(mc: number | null): string {
  if (!mc || mc <= 0) return "—";
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(2)} T$`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)} Md$`;
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)} M$`;
  return `${mc.toFixed(0)} $`;
}

export default function V19PublishableClient({
  stocks,
  generatedAt,
  totalClean,
}: {
  stocks: PublishableStock[];
  generatedAt: string;
  totalClean: number;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [sector, setSector] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("mc");

  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const s of stocks) {
      if (s.sector) set.add(s.sector);
    }
    return Array.from(set).sort();
  }, [stocks]);

  const filtered = useMemo(() => {
    let result = stocks.filter((s) => matchesScope(s, scope));
    if (sector !== "all") {
      result = result.filter((s) => s.sector === sector);
    }
    const sorted = [...result];
    if (sortBy === "mc") {
      sorted.sort((a, b) => (b.market_cap_usd ?? 0) - (a.market_cap_usd ?? 0));
    } else if (sortBy === "ticker") {
      sorted.sort((a, b) => a.ticker.localeCompare(b.ticker));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [stocks, scope, sector, sortBy]);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold">
          V1.9 Publishable — Stés clean a-f + g-m
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {filtered.length} stés affichées sur {totalClean} clean totales (audit live).{" "}
          Généré : {new Date(generatedAt).toLocaleString("fr-FR")}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-500">
          Scope
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-100"
          >
            <option value="all">Tous scopes</option>
            <option value="top307">Top 307</option>
            <option value="sp500">SP500</option>
            <option value="eu">EU/UK</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-500">
          Secteur
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-100"
          >
            <option value="all">Tous secteurs</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-500">
          Tri
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-100"
          >
            <option value="mc">Market cap</option>
            <option value="ticker">Ticker</option>
            <option value="name">Nom</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          Aucune sté ne correspond aux filtres.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <a
              href={`/sandbox/v1-9/${s.ticker.toLowerCase()}`}
              key={s.ticker}
              className="block rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition hover:border-emerald-500/50 hover:bg-zinc-800/60"
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="font-mono text-base font-bold text-emerald-300">
                  {s.ticker}
                </span>
                <span className="text-xs text-zinc-500">{s.country}</span>
              </div>
              <div className="mb-1 line-clamp-2 text-sm font-medium text-zinc-100">
                {s.name}
              </div>
              <div className="mb-2 text-xs text-zinc-400">{s.sector}</div>
              {s.hero_kpi && (
                <div className="mb-2 line-clamp-1 text-xs text-zinc-300">
                  Hero: {s.hero_kpi}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>MC : {formatMarketCap(s.market_cap_usd)}</span>
                {s.sources.length > 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-wider">
                    {s.sources[0]}
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
