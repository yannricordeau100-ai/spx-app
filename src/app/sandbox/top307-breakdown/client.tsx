"use client";

import { useMemo, useState } from "react";
import type { Top307Row } from "./page";

type SortKey = "rank_world" | "rank_us" | "rank_fr" | "rank_ch" | "rank_de" | "market_cap_usd" | "name" | "country";

function fmtMC(usd: number): string {
  if (!usd) return "—";
  if (usd >= 1e12) return `${(usd / 1e12).toFixed(2)} T$`;
  if (usd >= 1e9) return `${(usd / 1e9).toFixed(0)} Mds$`;
  return `${(usd / 1e6).toFixed(0)} M$`;
}

export function Top307Client({ rows }: { rows: Top307Row[] }) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("rank_world");

  const countries = useMemo(() => {
    const set = new Set(rows.map((r) => r.country).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (country) out = out.filter((r) => r.country === country);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    return [...out].sort((a, b) => {
      const av = a[sortBy as keyof Top307Row];
      const bv = b[sortBy as keyof Top307Row];
      if (sortBy === "name" || sortBy === "country") {
        return String(av ?? "").localeCompare(String(bv ?? ""));
      }
      if (sortBy === "market_cap_usd") {
        return (bv as number) - (av as number);
      }
      return ((av as number) ?? 999999) - ((bv as number) ?? 999999);
    });
  }, [rows, search, country, sortBy]);

  const stats = useMemo(() => {
    const byCountry = new Map<string, number>();
    for (const r of rows) byCountry.set(r.country || "?", (byCountry.get(r.country || "?") ?? 0) + 1);
    return Array.from(byCountry.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-[1500px] px-4 py-6">
        <div className="mb-4">
          <h1 className="font-display text-[28px] font-bold tracking-tight">Top 307 breakdown</h1>
          <p className="text-[13px] text-zinc-400">
            Décomposition des 307 sociétés du top 307 V1.8 par pays, market cap USD,
            et rangs (Monde / US / FR / CH / DE). Market cap converti USD via FX
            taux indicatifs.
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-mono text-zinc-400">Pays :</span>
          {stats.slice(0, 12).map(([ctry, count]) => (
            <button
              key={ctry}
              type="button"
              onClick={() => setCountry(country === ctry ? "" : ctry)}
              className={
                "rounded-md border px-2 py-1 transition-colors " +
                (country === ctry
                  ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]")
              }
            >
              {ctry} <span className="opacity-60">{count}</span>
            </button>
          ))}
          {country && (
            <button onClick={() => setCountry("")} className="rounded-md border border-rose-500/40 px-2 py-1 text-rose-300">
              ✕ reset
            </button>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer (ticker, nom)…"
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] outline-none focus:border-violet-500/50"
          />
          <span className="ml-auto font-mono text-[11px] text-zinc-400">
            {filtered.length} / {rows.length}
          </span>
        </div>

        <div className="overflow-x-auto rounded-md border border-white/10 bg-[#080808]">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#0c0c0c]">
              <tr>
                {([
                  ["rank_world", "#"],
                  ["name", "Société"],
                  ["country", "Pays"],
                  ["market_cap_usd", "Market Cap USD"],
                  ["rank_world", "Rang Monde"],
                  ["rank_us", "Rang US"],
                  ["rank_fr", "Rang FR"],
                  ["rank_ch", "Rang CH"],
                  ["rank_de", "Rang DE"],
                ] as const).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => setSortBy(key as SortKey)}
                    className={
                      "cursor-pointer border-b border-white/10 px-2 py-2 text-left font-mono text-[10.5px] uppercase tracking-wider hover:bg-white/[0.05] " +
                      (sortBy === key ? "text-violet-300" : "text-zinc-400")
                    }
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.ticker} className="hover:bg-white/[0.02]">
                  <td className="border-b border-white/5 px-2 py-1 font-mono text-[10.5px] text-zinc-500">
                    {r.rank_world}
                  </td>
                  <td className="border-b border-white/5 px-2 py-1">
                    <a href={`/sandbox/v1-8/${r.ticker.toLowerCase()}`} target="_blank" rel="noopener" className="font-mono font-semibold text-zinc-50 hover:text-violet-300">
                      {r.ticker}
                    </a>
                    <span className="ml-2 text-zinc-300">{r.name}</span>
                    {r.sector && <span className="ml-2 font-mono text-[10px] text-zinc-500">{r.sector}</span>}
                  </td>
                  <td className="border-b border-white/5 px-2 py-1 text-zinc-300">{r.country || "—"}</td>
                  <td className="border-b border-white/5 px-2 py-1 text-right font-mono tabular-nums text-zinc-100">
                    {fmtMC(r.market_cap_usd)}
                    {r.market_cap_currency && r.market_cap_currency !== "USD" && (
                      <span className="ml-1 text-[10px] text-zinc-500">({r.market_cap_currency})</span>
                    )}
                  </td>
                  <td className="border-b border-white/5 px-2 py-1 text-right font-mono tabular-nums text-zinc-300">{r.rank_world}</td>
                  <td className="border-b border-white/5 px-2 py-1 text-right font-mono tabular-nums text-zinc-300">{r.rank_us ?? "—"}</td>
                  <td className="border-b border-white/5 px-2 py-1 text-right font-mono tabular-nums text-zinc-300">{r.rank_fr ?? "—"}</td>
                  <td className="border-b border-white/5 px-2 py-1 text-right font-mono tabular-nums text-zinc-300">{r.rank_ch ?? "—"}</td>
                  <td className="border-b border-white/5 px-2 py-1 text-right font-mono tabular-nums text-zinc-300">{r.rank_de ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[11px] text-zinc-500">
          Sources : yfinance.marketCap + yfinance.info.country. FX rates fixes indicatifs.
          « Rang FR/CH/DE » = ordre par market cap parmi les sociétés du même pays présentes
          dans le top 307 V1.8.
        </p>
      </div>
    </div>
  );
}
