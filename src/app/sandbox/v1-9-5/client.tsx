"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function V195OverviewClient({
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
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Debounce 150ms
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 150);
    return () => clearTimeout(t);
  }, [searchInput]);

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
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.sector && s.sector.toLowerCase().includes(q)),
      );
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
  }, [stocks, scope, sector, sortBy, searchQuery]);

  const searchHasNoMatch = searchQuery.length > 0 && filtered.length === 0;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <header className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-3xl font-bold text-emerald-200">
            Mettrik V1.9.5
          </h1>
          <span className="text-xs uppercase tracking-wider text-emerald-400/70">
            Stés validées qualité
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {filtered.length} stés affichées sur {totalClean} clean a-f+g-m
          (audit strict, 0 hallucination). Mis à jour :{" "}
          {new Date(generatedAt).toLocaleString("fr-FR")}
        </p>
      </header>

      <div className="mb-4">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-500">
          Recherche
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ticker, nom ou secteur..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-emerald-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </label>
      </div>

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
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          {searchHasNoMatch ? (
            <span className="text-amber-600">
              Aucune sté validée qualité ne correspond à &laquo;&nbsp;{searchQuery}&nbsp;&raquo;. Cette sté n&apos;est peut-être pas encore dans V1.9.5 (en cours d&apos;audit). Vérifie l&apos;orthographe ou retire le filtre.
            </span>
          ) : (
            <span className="text-zinc-400">Aucune sté ne correspond aux filtres.</span>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <a
              href={`/sandbox/v1-9-5/${s.ticker.toLowerCase()}`}
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
                  Hero : {s.hero_kpi}
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
