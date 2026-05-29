"use client";

import Link from "next/link";
import { useState } from "react";

type EuCountryGroup = {
  country: string;
  tickers: string[];
};

type CountryCount = {
  country: string;
  count: number;
};

type Props = {
  sp500: string[];
  top307HorsSp500: string[];
  euInTop307: EuCountryGroup[];
  countryCounts: CountryCount[];
  auditToken: string;
};

type TabKey = "sp500" | "top307hors" | "eu";

export function UniverseToggleClient({
  sp500,
  top307HorsSp500,
  euInTop307,
  countryCounts,
  auditToken,
}: Props) {
  const [tab, setTab] = useState<TabKey>("sp500");

  const tickerHref = (ticker: string) =>
    `/sandbox/v1-9-5/${ticker}?audit_token=${auditToken}`;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "sp500", label: "SP500", count: sp500.length },
    {
      key: "top307hors",
      label: "Top 307 hors SP500",
      count: top307HorsSp500.length,
    },
    {
      key: "eu",
      label: "EU dans top 307",
      count: euInTop307.reduce((sum, g) => sum + g.tickers.length, 0),
    },
  ];

  return (
    <div>
      <div className="flex gap-2 border-b border-zinc-800">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative -mb-px px-5 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-b-2 border-violet-500 text-white"
                  : "border-b-2 border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.label}{" "}
              <span
                className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                  active
                    ? "bg-violet-500/20 text-violet-200"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {tab === "sp500" && (
          <TickerGrid tickers={sp500} tickerHref={tickerHref} />
        )}

        {tab === "top307hors" && (
          <TickerGrid tickers={top307HorsSp500} tickerHref={tickerHref} />
        )}

        {tab === "eu" && (
          <div>
            <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Récap par pays (ordre décroissant)
              </h2>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                {countryCounts.map((c) => (
                  <li
                    key={c.country}
                    className="flex items-center justify-between border-b border-zinc-800/50 py-1"
                  >
                    <span className="text-zinc-300">{c.country}</span>
                    <span className="font-mono text-zinc-400">{c.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="space-y-8">
              {euInTop307.map((group) => (
                <section key={group.country}>
                  <h3 className="mb-3 text-sm font-semibold text-zinc-300">
                    {group.country}{" "}
                    <span className="text-zinc-500">({group.tickers.length})</span>
                  </h3>
                  <TickerGrid
                    tickers={group.tickers}
                    tickerHref={tickerHref}
                    compact
                  />
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TickerGrid({
  tickers,
  tickerHref,
  compact = false,
}: {
  tickers: string[];
  tickerHref: (ticker: string) => string;
  compact?: boolean;
}) {
  return (
    <ul
      className={`grid gap-2 ${
        compact
          ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
          : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
      }`}
    >
      {tickers.map((ticker) => (
        <li key={ticker}>
          <Link
            href={tickerHref(ticker)}
            className="block rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-center font-mono text-xs text-zinc-200 hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-white"
          >
            {ticker}
          </Link>
        </li>
      ))}
    </ul>
  );
}
