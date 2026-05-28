"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";

export type KpiRow = {
  short: string;
  name_fr: string;
  type: string;
  period_type: string;
  history_length: number;
  last_value: number | null;
  last_value_fmt: string;
  unit: string;
  is_hero: boolean;
};

export type SteRow = {
  ticker: string;
  name: string;
  hero_kpi: string;
  kpis: KpiRow[];
  disabled_shorts: string[];
};

export default function KpisToggleClient({ stes }: { stes: SteRow[] }) {
  const [query, setQuery] = useState("");
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // État optimiste : map ticker -> Set des shorts désactivés
  const [overrides, setOverrides] = useState<Record<string, Set<string>>>(
    () => {
      const init: Record<string, Set<string>> = {};
      for (const s of stes) init[s.ticker] = new Set(s.disabled_shorts);
      return init;
    },
  );

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return stes;
    return stes.filter(
      (s) =>
        s.ticker.includes(q) ||
        s.name.toUpperCase().includes(q),
    );
  }, [stes, query]);

  function toggleOpen(t: string) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  async function toggleKpi(
    ticker: string,
    kpiShort: string,
    nextDisabled: boolean,
  ) {
    const key = `${ticker}|${kpiShort}`;
    setPendingKey(key);

    // Update optimiste
    setOverrides((prev) => {
      const next = { ...prev };
      const set = new Set(next[ticker] ?? []);
      if (nextDisabled) set.add(kpiShort);
      else set.delete(kpiShort);
      next[ticker] = set;
      return next;
    });

    try {
      const res = await fetch("/api/admin/kpis-toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticker,
          kpi_short: kpiShort,
          disabled: nextDisabled,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setToast(
        nextDisabled
          ? `${ticker} : ${kpiShort} désactivé`
          : `${ticker} : ${kpiShort} réactivé`,
      );
      startTransition(() => {
        setTimeout(() => setToast(null), 2000);
      });
    } catch (err) {
      // Revert en cas d'erreur
      setOverrides((prev) => {
        const next = { ...prev };
        const set = new Set(next[ticker] ?? []);
        if (nextDisabled) set.delete(kpiShort);
        else set.add(kpiShort);
        next[ticker] = set;
        return next;
      });
      setToast(`Erreur : ${String(err)}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche sticky */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-white/[0.06] bg-[#050505]/90 px-6 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par ticker ou nom (ex : MU, micron)"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">
            {filtered.length} / {stes.length} stés
          </span>
        </div>
      </div>

      {/* Liste pliable par sté */}
      <div className="space-y-2">
        {filtered.map((sIn) => {
          const disabledSet = overrides[sIn.ticker] ?? new Set();
          const totalK = sIn.kpis.length;
          const activeK = totalK - disabledSet.size;
          const isOpen = openSet.has(sIn.ticker);
          return (
            <div
              key={sIn.ticker}
              className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => toggleOpen(sIn.ticker)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ChevronDown
                    className={`size-4 shrink-0 text-zinc-500 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                  />
                  <span className="font-mono text-[12px] font-semibold text-zinc-300">
                    {sIn.ticker}
                  </span>
                  <span className="truncate text-[14px] text-zinc-100">
                    {sIn.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${
                      disabledSet.size > 0
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {activeK} / {totalK} actifs
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/[0.06]">
                  {sIn.kpis.length === 0 ? (
                    <div className="px-4 py-3 text-[12.5px] text-zinc-500">
                      Aucun KPI avec ≥3 ans d&apos;historique.
                    </div>
                  ) : (
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="border-b border-white/[0.04] text-left text-[10.5px] uppercase tracking-wider text-zinc-500">
                          <th className="w-12 px-4 py-2">Actif</th>
                          <th className="px-2 py-2">Nom</th>
                          <th className="w-24 px-2 py-2">Type</th>
                          <th className="w-24 px-2 py-2">Période</th>
                          <th className="w-20 px-2 py-2 text-right">Hist.</th>
                          <th className="w-32 px-4 py-2 text-right">Valeur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sIn.kpis.map((k) => {
                          const isDisabled = disabledSet.has(k.short);
                          const isPending =
                            pendingKey === `${sIn.ticker}|${k.short}`;
                          return (
                            <tr
                              key={k.short}
                              className="border-b border-white/[0.03] last:border-0"
                            >
                              <td className="px-4 py-2.5">
                                <label className="flex cursor-pointer items-center">
                                  <input
                                    type="checkbox"
                                    checked={!isDisabled}
                                    disabled={isPending}
                                    onChange={(e) =>
                                      toggleKpi(
                                        sIn.ticker,
                                        k.short,
                                        !e.target.checked,
                                      )
                                    }
                                    className="size-4 cursor-pointer accent-emerald-500"
                                  />
                                  {isPending && (
                                    <Loader2 className="ml-2 size-3 animate-spin text-zinc-500" />
                                  )}
                                </label>
                              </td>
                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11.5px] font-semibold text-zinc-200">
                                    {k.short}
                                  </span>
                                  {k.is_hero && (
                                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet-200">
                                      hero
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11.5px] text-zinc-500">
                                  {k.name_fr}
                                </div>
                              </td>
                              <td className="px-2 py-2.5 font-mono text-[11px] text-zinc-400">
                                {k.type || "-"}
                              </td>
                              <td className="px-2 py-2.5 font-mono text-[11px] text-zinc-400">
                                {k.period_type || "-"}
                              </td>
                              <td className="px-2 py-2.5 text-right font-mono text-[11px] text-zinc-400">
                                {k.history_length}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-[11.5px] text-zinc-300">
                                {k.last_value_fmt}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-[13px] text-zinc-500">
            Aucune sté ne correspond à la recherche.
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-white/10 bg-zinc-900 px-4 py-2.5 text-[12.5px] text-zinc-100 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
