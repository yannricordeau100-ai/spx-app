"use client";

import { useMemo, useState, useEffect, useDeferredValue } from "react";
import Link from "next/link";
import { Search, Users, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CompanyLogo } from "@/components/logos";

export type KpiSearchInitialPayload = {
  universeSize: number;
  uniqueShorts: number;
  allShorts: string[];
  byShort: Record<string, string[]>;
};

type PeriodFilter = "all" | "quarter" | "year" | "none";

type KpiDetail = {
  value: number | string | null;
  unit: string | null;
  period_type: string | null;
  history_len: number | null;
  name_fr: string | null;
};

type KpiDetailsResponse = {
  short: string;
  tickers: Record<string, KpiDetail>;
};

const ACCENT = "#a855f7";

/**
 * Debounce minimal pour la valeur du champ search (200 ms).
 */
function useDebounced<T>(value: T, delay = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function KpiSearchClient({ initial }: { initial: KpiSearchInitialPayload }) {
  const { universeSize, uniqueShorts, allShorts, byShort } = initial;

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 200);
  const deferredQuery = useDeferredValue(debouncedQuery);

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [minCount, setMinCount] = useState<number>(1);
  const [onlyWow, setOnlyWow] = useState<boolean>(false);

  // Filtrage fuzzy case-insensitive sur all_shorts
  const filteredShorts = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const effectiveMin = onlyWow ? Math.max(minCount, 3) : minCount;

    const matched: { short: string; count: number }[] = [];
    for (const short of allShorts) {
      if (q && !short.toLowerCase().includes(q)) continue;
      const count = byShort[short]?.length ?? 0;
      if (count < effectiveMin) continue;
      matched.push({ short, count });
    }
    // Tri par count desc, puis nom asc
    matched.sort((a, b) => (b.count - a.count) || a.short.localeCompare(b.short));
    return matched;
  }, [allShorts, byShort, deferredQuery, minCount, onlyWow]);

  const top20 = filteredShorts.slice(0, 20);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
            Moteur de recherche KPIs Mettrik
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {uniqueShorts.toLocaleString("fr-FR")} KPIs uniques sur{" "}
            {universeSize.toLocaleString("fr-FR")} stés &middot; V1.9.5
          </p>

          {/* Search input */}
          <div className="relative mt-6">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un KPI..."
              autoFocus
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/50 py-4 pl-12 pr-4 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition"
            />
          </div>

          {/* Filtres */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
            {/* Period toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-zinc-500">Période :</span>
              <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-1">
                {(["all", "quarter", "year", "none"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodFilter(p)}
                    className={
                      "rounded-md px-3 py-1 text-xs transition " +
                      (periodFilter === p
                        ? "bg-violet-500/20 text-violet-200"
                        : "text-zinc-400 hover:text-zinc-200")
                    }
                  >
                    {p === "all" ? "Tous" : p === "quarter" ? "Trim" : p === "year" ? "Annuel" : "Sans"}
                  </button>
                ))}
              </div>
            </div>

            {/* Min count slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-zinc-500">
                Min stés :
              </span>
              <input
                type="range"
                min={1}
                max={100}
                value={minCount}
                onChange={(e) => setMinCount(Number(e.target.value))}
                className="h-1 w-40 appearance-none rounded-full bg-zinc-800 accent-violet-500"
              />
              <span className="font-mono text-xs text-zinc-300 w-8 text-right">{minCount}</span>
            </div>

            {/* Wow toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWow}
                onChange={(e) => setOnlyWow(e.target.checked)}
                className="size-4 rounded border-zinc-700 bg-zinc-950 accent-violet-500"
              />
              <span className="text-xs text-zinc-300">
                Seulement KPIs wow (≥ 3 stés)
              </span>
            </label>
          </div>

          {/* Stats compteur */}
          <div className="mt-5 text-sm text-zinc-400">
            <span className="font-mono text-violet-300">
              {filteredShorts.length.toLocaleString("fr-FR")}
            </span>{" "}
            KPIs trouvés / {uniqueShorts.toLocaleString("fr-FR")} indexés
            {filteredShorts.length > 20 ? (
              <span className="ml-2 text-xs text-zinc-500">
                (top 20 affichés)
              </span>
            ) : null}
          </div>
        </header>

        {/* Résultats */}
        <section className="space-y-4">
          <AnimatePresence initial={false}>
            {top20.map((r) => (
              <KpiResultCard
                key={r.short}
                short={r.short}
                tickers={byShort[r.short] ?? []}
                periodFilter={periodFilter}
              />
            ))}
          </AnimatePresence>

          {top20.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-6 py-10 text-center text-sm text-zinc-500">
              Aucun KPI ne correspond aux critères.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function KpiResultCard({
  short,
  tickers,
  periodFilter,
}: {
  short: string;
  tickers: string[];
  periodFilter: PeriodFilter;
}) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<Record<string, KpiDetail> | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Lazy load details la 1re fois qu'on déplie
  useEffect(() => {
    if (!expanded || details !== null || loadingDetails) return;
    let cancelled = false;
    setLoadingDetails(true);
    fetch(`/api/sandbox/kpi-search/details?short=${encodeURIComponent(short)}`)
      .then((r) => (r.ok ? (r.json() as Promise<KpiDetailsResponse>) : null))
      .then((json) => {
        if (cancelled || !json) return;
        setDetails(json.tickers ?? {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, details, loadingDetails, short]);

  const sample = tickers.slice(0, 5);
  const all = tickers;

  // Filtre period_type côté affichage seulement (sur details quand chargés)
  function passesPeriod(t: string): boolean {
    if (periodFilter === "all") return true;
    const d = details?.[t];
    if (!d) return true; // pas encore chargé, on garde
    if (periodFilter === "none") return !d.period_type;
    return d.period_type === periodFilter;
  }

  const displayedAll = all.filter(passesPeriod);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 hover:border-zinc-700 transition"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight text-zinc-50">
            {short}
          </h2>
          <p className="mt-1 text-sm text-zinc-400 flex items-center gap-2">
            <Users className="size-3.5 text-zinc-500" aria-hidden />
            Présent dans{" "}
            <span className="font-mono text-violet-300">{tickers.length}</span>{" "}
            sté{tickers.length > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {/* Sample 5 tickers */}
      <div className="mt-4 flex flex-wrap gap-2">
        {sample.map((t) => (
          <TickerChip key={t} ticker={t} detail={details?.[t]} />
        ))}
      </div>

      {/* Voir toutes */}
      {tickers.length > 5 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 transition"
            style={{ color: expanded ? ACCENT : undefined }}
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3.5" aria-hidden />
                Masquer
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" aria-hidden />
                Voir toutes les {tickers.length} stés
              </>
            )}
          </button>

          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                key="all"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {displayedAll.map((t) => (
                    <TickerChip key={t} ticker={t} detail={details?.[t]} />
                  ))}
                </div>
                {loadingDetails ? (
                  <p className="mt-3 text-xs text-zinc-500">Chargement des détails...</p>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </motion.article>
  );
}

function TickerChip({
  ticker,
  detail,
}: {
  ticker: string;
  detail: KpiDetail | undefined;
}) {
  const slug = ticker.toLowerCase();
  return (
    <Link
      href={`/sandbox/v1-9-5/${slug}`}
      className="group flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-2 hover:border-violet-500/40 hover:bg-zinc-900/60 transition"
    >
      <span className="block size-6 shrink-0 overflow-hidden rounded-md bg-zinc-950">
        <CompanyLogo ticker={ticker} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-mono text-xs text-zinc-200 truncate">
          {ticker}
        </span>
        {detail ? (
          <span className="block text-[10px] text-zinc-500 truncate">
            {formatDetail(detail)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function formatDetail(d: KpiDetail): string {
  const parts: string[] = [];
  if (d.value !== null && d.value !== undefined) {
    const v = typeof d.value === "number"
      ? d.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
      : String(d.value);
    parts.push(d.unit ? `${v} ${d.unit}` : v);
  }
  if (d.period_type) {
    parts.push(d.period_type === "quarter" ? "trim" : d.period_type === "year" ? "an" : d.period_type);
  }
  if (d.history_len && d.history_len > 0) {
    parts.push(`${d.history_len} pts`);
  }
  return parts.join(" · ");
}
