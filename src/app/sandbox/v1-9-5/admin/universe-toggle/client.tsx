"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Eu5nData } from "@/lib/v1-9/load-eu5n";

type EuCountryGroup = { country: string; tickers: string[] };
type CountryCount = { country: string; count: number };

type Props = {
  sp500: string[];
  top307HorsSp500: string[];
  euInTop307: EuCountryGroup[];
  countryCounts: CountryCount[];
  eu5n: Eu5nData;
  auditToken: string;
  capOrder: string[];
  names: Record<string, string>;
  problemTickers: string[];
  partialTickers: string[];
};

type Tab = "all" | "sp500" | "top307" | "country";

/**
 * Toggle de publication V1.9.5 (Yann 9 juin 2026).
 * - "Tout" par défaut + SP500 / Top 307 hors SP500 / Par pays.
 * - Tri par capi décroissante (ordre v1-8-sorted, NVDA en tête), inconnus en fin.
 * - Case cochée = sté EN LIGNE sur N2 (source = desk_curated_companies via
 *   /api/online-tickers). Auto-refresh 20s → on voit les cases se cocher au fil
 *   des publications. Clic = publie/retire (PATCH /api/desk/curated-companies,
 *   nécessite session admin).
 */
export function UniverseToggleClient({
  sp500,
  top307HorsSp500,
  euInTop307,
  auditToken,
  capOrder,
  names,
  problemTickers,
  partialTickers,
}: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [country, setCountry] = useState<string>(euInTop307[0]?.country ?? "");
  const [onlineSet, setOnlineSet] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  // Stés mises de côté à cause d'un problème de données (placeholder "Analyse
  // en préparation") : affichées en rouge, case décochée et désactivée.
  const problemSet = useMemo(
    () => new Set(problemTickers.map((t) => t.toUpperCase())),
    [problemTickers],
  );
  // Stés traitées partiellement (technique réduite) à retraiter : violet,
  // retirées du live, case désactivée.
  const partialSet = useMemo(
    () => new Set(partialTickers.map((t) => t.toUpperCase())),
    [partialTickers],
  );

  const capIndex = useMemo(() => {
    const m = new Map<string, number>();
    capOrder.forEach((t, i) => m.set(t.toUpperCase(), i));
    return m;
  }, [capOrder]);

  const sortCap = useMemo(
    () => (arr: string[]) =>
      [...arr].sort((a, b) => {
        const ia = capIndex.get(a.toUpperCase()) ?? 1e9;
        const ib = capIndex.get(b.toUpperCase()) ?? 1e9;
        return ia !== ib ? ia - ib : a.localeCompare(b);
      }),
    [capIndex],
  );

  const allTickers = useMemo(
    () => sortCap(Array.from(new Set([...sp500, ...top307HorsSp500]))),
    [sp500, top307HorsSp500, sortCap],
  );

  async function refetchOnline() {
    try {
      const r = await fetch("/api/online-tickers", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d?.tickers)) {
        setOnlineSet(new Set(d.tickers.map((t: string) => String(t).toUpperCase())));
      }
    } catch {
      /* garde l'état courant */
    }
  }
  useEffect(() => {
    refetchOnline();
    const id = setInterval(refetchOnline, 20000);
    return () => clearInterval(id);
  }, []);

  async function toggle(ticker: string) {
    const T = ticker.toUpperCase();
    if (busy.has(T)) return;
    const next = !(onlineSet?.has(T) ?? false);
    setBusy((s) => new Set(s).add(T));
    setOnlineSet((s) => {
      const n = new Set(s ?? []);
      if (next) n.add(T);
      else n.delete(T);
      return n;
    });
    try {
      const res = await fetch("/api/desk/curated-companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: T, min_plan: next ? "free" : "hidden" }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setOnlineSet((s) => {
        const n = new Set(s ?? []);
        if (next) n.delete(T);
        else n.add(T);
        return n;
      });
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(T);
        return n;
      });
    }
  }

  const shown = useMemo(() => {
    if (tab === "sp500") return sortCap(sp500);
    if (tab === "top307") return sortCap(top307HorsSp500);
    if (tab === "country") return sortCap(euInTop307.find((x) => x.country === country)?.tickers ?? []);
    return allTickers;
  }, [tab, country, allTickers, sp500, top307HorsSp500, euInTop307, sortCap]);

  const onlineInView = onlineSet ? shown.filter((t) => onlineSet.has(t.toUpperCase())).length : 0;
  const totalOnline = onlineSet?.size ?? 0;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Tout", count: allTickers.length },
    { key: "sp500", label: "SP500", count: sp500.length },
    { key: "top307", label: "Top 307 hors SP500", count: top307HorsSp500.length },
    { key: "country", label: "Par pays", count: euInTop307.length },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-200">
          🟢 {totalOnline} en ligne sur N2{onlineSet === null ? " · chargement…" : ""}
        </span>
        <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-200">
          🔴 {problemSet.size} mises de côté (problème)
        </span>
        <span className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-sm font-semibold text-violet-200">
          🟣 {partialSet.size} à retraiter (traitement partiel ou trop coûteux)
        </span>
        <button
          type="button"
          onClick={refetchOnline}
          className="text-xs text-zinc-400 underline transition-colors hover:text-zinc-200"
        >
          Rafraîchir
        </button>
        <span className="text-xs text-zinc-500">
          Case cochée = publiée sur N2 · clic = publier/retirer (session admin) · auto-refresh 20s ·
          rouge = analyse en préparation (donnée non publiable)
        </span>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800">
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
                  active ? "bg-violet-500/20 text-violet-200" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "country" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {euInTop307.map((g) => (
            <button
              key={g.country}
              type="button"
              onClick={() => setCountry(g.country)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                g.country === country
                  ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                  : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {g.country} ({g.tickers.length})
            </button>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        {onlineInView} / {shown.length} en ligne dans cette vue
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {shown.map((ticker) => {
          const T = ticker.toUpperCase();
          const isProblem = problemSet.has(T);
          const isPartial = !isProblem && partialSet.has(T);
          const online = !isProblem && !isPartial && (onlineSet?.has(T) ?? false);
          const isBusy = busy.has(T);
          const name = names[T] ?? "";
          return (
            <li
              key={ticker}
              className={`flex items-center gap-2 rounded border px-2 py-1.5 transition-colors ${
                isProblem
                  ? "border-red-500/50 bg-red-500/10"
                  : isPartial
                    ? "border-violet-500/60 bg-violet-500/10"
                    : online
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-900/40"
              }`}
            >
              <input
                type="checkbox"
                checked={online}
                disabled={isBusy || isProblem || isPartial || onlineSet === null}
                onChange={() => toggle(ticker)}
                className={`size-4 shrink-0 accent-emerald-500 ${
                  isProblem || isPartial ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                }`}
                aria-label={
                  isProblem
                    ? `${ticker} mise de côté`
                    : isPartial
                      ? `${ticker} traitée partiellement, à retraiter`
                      : `Publier ${ticker}`
                }
                title={
                  isProblem
                    ? "Analyse en préparation : donnée non publiable"
                    : isPartial
                      ? "Traitée partiellement (technique réduite), retirée du live, à retraiter"
                      : undefined
                }
              />
              <Link
                href={`/sandbox/v1-9-5/${ticker}?audit_token=${auditToken}`}
                className="flex min-w-0 flex-col leading-tight"
                title={name || ticker}
              >
                <span
                  className={`truncate font-mono text-xs transition-colors ${
                    isProblem
                      ? "text-red-300 hover:text-red-200"
                      : isPartial
                        ? "text-violet-300 hover:text-violet-200"
                        : "text-zinc-200 hover:text-white"
                  }`}
                >
                  {ticker}
                </span>
                {name ? (
                  <span className="truncate text-[10px] text-zinc-500">{name}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
