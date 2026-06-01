"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Eu5nData } from "@/lib/v1-9/load-eu5n";

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
  eu5n: Eu5nData;
  auditToken: string;
};

type TabKey = "sp500" | "top307hors" | "eu" | "eu5n";
type SortMode = "alpha" | "country";

// Mapping suffixe ticker -> pays (utilisé pour le tri par pays sur l'onglet
// "Top 307 hors SP500"). Synchronisé avec page.tsx + ajouts pour les marchés
// présents dans le top 307 hors SP500.
const SUFFIX_TO_COUNTRY: Record<string, { flag: string; name: string }> = {
  ".L": { flag: "🇬🇧", name: "Royaume-Uni" },
  ".PA": { flag: "🇫🇷", name: "France" },
  ".DE": { flag: "🇩🇪", name: "Allemagne" },
  ".SW": { flag: "🇨🇭", name: "Suisse" },
  ".MI": { flag: "🇮🇹", name: "Italie" },
  ".AS": { flag: "🇳🇱", name: "Pays-Bas" },
  ".CO": { flag: "🇩🇰", name: "Danemark" },
  ".OL": { flag: "🇳🇴", name: "Norvège" },
  ".ST": { flag: "🇸🇪", name: "Suède" },
  ".HE": { flag: "🇫🇮", name: "Finlande" },
  ".MC": { flag: "🇪🇸", name: "Espagne" },
  ".BR": { flag: "🇧🇪", name: "Belgique" },
  ".LS": { flag: "🇵🇹", name: "Portugal" },
  ".VI": { flag: "🇦🇹", name: "Autriche" },
  ".IR": { flag: "🇮🇪", name: "Irlande" },
  ".HK": { flag: "🇭🇰", name: "Hong Kong" },
  ".T": { flag: "🇯🇵", name: "Japon" },
  ".TO": { flag: "🇨🇦", name: "Canada" },
  ".AX": { flag: "🇦🇺", name: "Australie" },
  ".SS": { flag: "🇨🇳", name: "Chine" },
  ".SZ": { flag: "🇨🇳", name: "Chine" },
  ".KS": { flag: "🇰🇷", name: "Corée du Sud" },
  ".TW": { flag: "🇹🇼", name: "Taïwan" },
  ".SA": { flag: "🇧🇷", name: "Brésil" },
  ".MX": { flag: "🇲🇽", name: "Mexique" },
};

const OTHER_COUNTRY = { flag: "🇺🇸", name: "États-Unis (ADR)" };

function detectCountryForTicker(ticker: string): { flag: string; name: string } {
  for (const suffix of Object.keys(SUFFIX_TO_COUNTRY)) {
    if (ticker.endsWith(suffix)) {
      return SUFFIX_TO_COUNTRY[suffix];
    }
  }
  // Sans suffixe = ADR US (sté étrangère cotée à New York)
  return OTHER_COUNTRY;
}

type CountryGroup = {
  key: string;
  flag: string;
  name: string;
  tickers: string[];
};

function groupByCountry(tickers: string[]): CountryGroup[] {
  const map = new Map<string, CountryGroup>();
  for (const ticker of tickers) {
    const { flag, name } = detectCountryForTicker(ticker);
    const key = `${flag}-${name}`;
    if (!map.has(key)) {
      map.set(key, { key, flag, name, tickers: [] });
    }
    map.get(key)!.tickers.push(ticker);
  }
  // Tri alphabétique au sein de chaque pays
  for (const group of map.values()) {
    group.tickers.sort();
  }
  // Tri des groupes par nombre de stés décroissant, puis nom du pays
  return Array.from(map.values()).sort((a, b) => {
    if (b.tickers.length !== a.tickers.length) {
      return b.tickers.length - a.tickers.length;
    }
    return a.name.localeCompare(b.name, "fr");
  });
}

export function UniverseToggleClient({
  sp500,
  top307HorsSp500,
  euInTop307,
  countryCounts,
  eu5n,
  auditToken,
}: Props) {
  const [tab, setTab] = useState<TabKey>("sp500");
  const [top307SortMode, setTop307SortMode] = useState<SortMode>("alpha");
  const [eu5nCountry, setEu5nCountry] = useState<string>(
    // Premier pays non vide par défaut, sinon France
    eu5n.byCountry.find((g) => g.stes.length > 0)?.country ??
      eu5n.byCountry[0]?.country ??
      "France",
  );

  const top307GroupedByCountry = useMemo(
    () => groupByCountry(top307HorsSp500),
    [top307HorsSp500],
  );

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
    { key: "eu5n", label: "EU 5+N", count: eu5n.totalStes },
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
          <div>
            <div className="mb-6 flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-400">Tri :</span>
              <div className="inline-flex rounded-md border border-orange-500/30 bg-zinc-900/40 p-1">
                <button
                  type="button"
                  onClick={() => setTop307SortMode("alpha")}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    top307SortMode === "alpha"
                      ? "bg-orange-500/20 text-orange-200"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Alphabétique
                </button>
                <button
                  type="button"
                  onClick={() => setTop307SortMode("country")}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    top307SortMode === "country"
                      ? "bg-orange-500/20 text-orange-200"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Pays
                </button>
              </div>
            </div>

            {top307SortMode === "alpha" && (
              <TickerGrid tickers={top307HorsSp500} tickerHref={tickerHref} />
            )}

            {top307SortMode === "country" && (
              <div className="space-y-8">
                {top307GroupedByCountry.map((group) => (
                  <section key={group.key}>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                      <span className="text-lg leading-none">{group.flag}</span>
                      <span>{group.name}</span>
                      <span className="text-zinc-500">
                        ({group.tickers.length} sté
                        {group.tickers.length > 1 ? "s" : ""})
                      </span>
                    </h3>
                    <TickerGrid
                      tickers={group.tickers}
                      tickerHref={tickerHref}
                      compact
                    />
                  </section>
                ))}
              </div>
            )}
          </div>
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

        {tab === "eu5n" && (
          <div>
            {eu5n.totalStes === 0 && (
              <section className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                Manifest EU5+N pas encore généré ou vide. Le fichier source est{" "}
                <code className="rounded bg-zinc-900/80 px-1.5 py-0.5 font-mono text-xs">
                  sec-data/_meta/eu5n-pipeline-manifest.json
                </code>
                . Relancer la génération côté pipeline data pour peupler cet
                onglet.
              </section>
            )}

            <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Récap par pays (cohort EU5+N)
              </h2>
              <ul className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
                {eu5n.countryCounts.map((c) => (
                  <li
                    key={c.country}
                    className="flex items-center justify-between border-b border-zinc-800/50 py-1"
                  >
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span>{c.country}</span>
                    </span>
                    <span className="font-mono text-zinc-400">{c.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mb-5 flex flex-wrap gap-2">
              {eu5n.byCountry.map((group) => {
                const active = group.country === eu5nCountry;
                const disabled = group.stes.length === 0;
                return (
                  <button
                    key={group.country}
                    type="button"
                    onClick={() => {
                      if (!disabled) setEu5nCountry(group.country);
                    }}
                    disabled={disabled}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                        : disabled
                          ? "cursor-not-allowed border-zinc-800 bg-zinc-900/20 text-zinc-600"
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-emerald-500/40 hover:text-zinc-100"
                    }`}
                    title={disabled ? "Aucune sté pour ce pays" : undefined}
                  >
                    <span className="text-sm leading-none">{group.flag}</span>
                    <span>{group.country}</span>
                    <span
                      className={`font-mono text-[10px] ${
                        active ? "text-emerald-200/80" : "text-zinc-500"
                      }`}
                    >
                      {group.stes.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {eu5n.byCountry
              .filter((g) => g.country === eu5nCountry)
              .map((group) => (
                <section key={group.country}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                    <span className="text-lg leading-none">{group.flag}</span>
                    <span>{group.country}</span>
                    <span className="text-zinc-500">
                      ({group.stes.length} sté
                      {group.stes.length > 1 ? "s" : ""})
                    </span>
                  </h3>
                  {group.stes.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Aucune sté disponible pour ce pays.
                    </p>
                  ) : (
                    <TickerGrid
                      tickers={group.stes.map((s) => s.ticker)}
                      tickerHref={tickerHref}
                      compact
                    />
                  )}
                </section>
              ))}
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
