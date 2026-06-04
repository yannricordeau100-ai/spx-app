"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Loader2, Search, Star } from "lucide-react";

export type KpiRow = {
  short: string;
  name_fr: string;
  name_en: string;
  type: string;
  period_type: string;
  history_length: number;
  last_value: number | null;
  last_value_fmt: string;
  unit: string;
  is_hero: boolean;
  is_generic: boolean;
  pv_score: number | null;
};

export type SteRow = {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  market_cap: number;
  hero_kpi: string;
  hero_review_status: "needs_review" | "auto_proposed_uncertain" | "validated";
  kpis: KpiRow[];
  disabled_shorts: string[];
};

type SortMode = "capi" | "sector";

// Couleurs contour selon hero_review_status
const STATUS_RING: Record<SteRow["hero_review_status"], string> = {
  needs_review:
    "border-rose-500/60 ring-1 ring-rose-500/40 shadow-[0_0_18px_rgba(244,63,94,0.25)]",
  auto_proposed_uncertain:
    "border-amber-500/60 ring-1 ring-amber-500/40 shadow-[0_0_18px_rgba(245,158,11,0.22)]",
  validated: "border-white/[0.06]",
};

const STATUS_LABEL: Record<SteRow["hero_review_status"], string> = {
  needs_review: "Hero à résoudre",
  auto_proposed_uncertain: "Auto-proposé : valider",
  validated: "Hero validé",
};

const STATUS_CHIP: Record<SteRow["hero_review_status"], string> = {
  needs_review:
    "border-rose-500/40 bg-rose-500/10 text-rose-200",
  auto_proposed_uncertain:
    "border-amber-500/40 bg-amber-500/10 text-amber-200",
  validated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
};

function formatCapi(c: number): string {
  if (!Number.isFinite(c) || c <= 0) return "n.d.";
  if (c >= 1_000_000_000_000) return `${(c / 1_000_000_000_000).toFixed(2)} T$`;
  if (c >= 1_000_000_000) return `${(c / 1_000_000_000).toFixed(0)} Mds $`;
  if (c >= 1_000_000) return `${(c / 1_000_000).toFixed(0)} M $`;
  return `${c.toLocaleString("fr-FR")} $`;
}

export default function KpisToggleClient({ stes }: { stes: SteRow[] }) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("capi");
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const [showGenericSet, setShowGenericSet] = useState<Set<string>>(new Set());
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [heroPending, setHeroPending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // États optimistes
  const [overrides, setOverrides] = useState<Record<string, Set<string>>>(
    () => {
      const init: Record<string, Set<string>> = {};
      for (const s of stes) init[s.ticker] = new Set(s.disabled_shorts);
      return init;
    },
  );
  // Hero override : { ticker -> new short choisi par Yann (= validé) }
  const [heroOverrides, setHeroOverrides] = useState<Record<string, string>>(
    {},
  );

  function effectiveHero(s: SteRow): string {
    return heroOverrides[s.ticker] ?? s.hero_kpi;
  }
  function effectiveStatus(s: SteRow): SteRow["hero_review_status"] {
    return heroOverrides[s.ticker] ? "validated" : s.hero_review_status;
  }

  // Filtre + tri
  const sortedAndFiltered = useMemo(() => {
    const q = query.trim().toUpperCase();
    let list = stes;
    if (q) {
      list = list.filter(
        (s) =>
          s.ticker.includes(q) ||
          s.name.toUpperCase().includes(q) ||
          s.sector.toUpperCase().includes(q),
      );
    }
    if (sortMode === "sector") {
      list = [...list].sort((a, b) => {
        if (a.sector !== b.sector) return a.sector.localeCompare(b.sector);
        if (a.subsector !== b.subsector)
          return a.subsector.localeCompare(b.subsector);
        if (a.market_cap !== b.market_cap) return b.market_cap - a.market_cap;
        return a.ticker.localeCompare(b.ticker);
      });
    }
    return list;
  }, [stes, query, sortMode]);

  // Compteurs status
  const counts = useMemo(() => {
    const c = { needs_review: 0, auto_proposed_uncertain: 0, validated: 0 };
    for (const s of stes) c[effectiveStatus(s)] += 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stes, heroOverrides]);

  function toggleOpen(t: string) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleShowGeneric(t: string) {
    setShowGenericSet((prev) => {
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToast(
        nextDisabled
          ? `${ticker} : ${kpiShort} désactivé`
          : `${ticker} : ${kpiShort} réactivé`,
      );
      startTransition(() => {
        setTimeout(() => setToast(null), 2000);
      });
    } catch (err) {
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

  async function setHero(ticker: string, newShort: string) {
    const key = `${ticker}|hero`;
    setHeroPending(key);
    const prevHero = heroOverrides[ticker];
    setHeroOverrides((prev) => ({ ...prev, [ticker]: newShort }));
    try {
      const res = await fetch("/api/admin/kpis-toggle/set-hero", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker, kpi_short: newShort }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json().catch(() => ({}))) as {
        persisted?: boolean;
      };
      if (payload.persisted === false) {
        // Yann 4 juin 2026 : Vercel filesystem read-only → écriture skip.
        // L'override reste posé localement pour la validation visuelle.
        setToast(
          `${ticker} : hero = ${newShort} (validé local, commit requis)`,
        );
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast(`${ticker} : hero = ${newShort} ✓`);
        setTimeout(() => setToast(null), 2500);
      }
    } catch (err) {
      // revert
      setHeroOverrides((prev) => {
        const next = { ...prev };
        if (prevHero === undefined) delete next[ticker];
        else next[ticker] = prevHero;
        return next;
      });
      setToast(`Erreur hero : ${String(err)}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setHeroPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche + tri + légende */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-white/[0.06] bg-[#050505]/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer ticker / nom / secteur"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">
              {sortedAndFiltered.length} / {stes.length}
            </span>
          </div>
          {/* Toggle tri */}
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
            <button
              type="button"
              onClick={() => setSortMode("capi")}
              className={`rounded-md px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-wider transition-colors ${
                sortMode === "capi"
                  ? "bg-white/[0.08] text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Capi ↓
            </button>
            <button
              type="button"
              onClick={() => setSortMode("sector")}
              className={`rounded-md px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-wider transition-colors ${
                sortMode === "sector"
                  ? "bg-white/[0.08] text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Secteur
            </button>
          </div>
        </div>
        {/* Légende couleurs */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-wider">
          <span className="text-zinc-500">Statut hero :</span>
          <span className={`rounded-full border px-2 py-0.5 ${STATUS_CHIP.needs_review}`}>
            {counts.needs_review} à résoudre (rouge)
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 ${STATUS_CHIP.auto_proposed_uncertain}`}
          >
            {counts.auto_proposed_uncertain} auto-proposé (jaune)
          </span>
          <span className={`rounded-full border px-2 py-0.5 ${STATUS_CHIP.validated}`}>
            {counts.validated} validé
          </span>
        </div>
      </div>

      {/* Liste pliable par sté */}
      <div className="space-y-2">
        {sortedAndFiltered.map((sIn) => {
          const status = effectiveStatus(sIn);
          const heroNow = effectiveHero(sIn);
          const disabledSet = overrides[sIn.ticker] ?? new Set();
          const totalK = sIn.kpis.length;
          const activeK = totalK - disabledSet.size;
          const isOpen = openSet.has(sIn.ticker);
          const showGen = showGenericSet.has(sIn.ticker);
          const visibleKpis = sIn.kpis.filter(
            (k) => !k.is_generic || showGen || k.short === heroNow,
          );
          const hiddenGenCount = sIn.kpis.filter(
            (k) => k.is_generic && k.short !== heroNow,
          ).length;
          return (
            <div
              key={sIn.ticker}
              className={`overflow-hidden rounded-xl border bg-white/[0.02] transition-colors ${STATUS_RING[status]}`}
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
                  <span className="hidden text-[11px] text-zinc-500 sm:inline">
                    · {sIn.sector || "n.d."} · {formatCapi(sIn.market_cap)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STATUS_CHIP[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
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
                          <th className="w-12 px-4 py-2">Hero</th>
                          <th className="w-12 px-2 py-2">Actif</th>
                          <th className="px-2 py-2">Nom</th>
                          <th className="w-20 px-2 py-2">Type</th>
                          <th className="w-20 px-2 py-2">Période</th>
                          <th className="w-16 px-2 py-2 text-right">Hist.</th>
                          <th className="w-28 px-4 py-2 text-right">Valeur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleKpis.map((k) => {
                          const isHeroNow = k.short === heroNow;
                          const isDisabled = disabledSet.has(k.short);
                          const isPending =
                            pendingKey === `${sIn.ticker}|${k.short}`;
                          const isHeroPending =
                            heroPending === `${sIn.ticker}|hero`;
                          return (
                            <tr
                              key={k.short}
                              className={`border-b border-white/[0.03] last:border-0 ${
                                isHeroNow ? "bg-violet-500/[0.04]" : ""
                              } ${k.is_generic ? "opacity-60" : ""}`}
                            >
                              {/* Radio button hero */}
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  disabled={isHeroPending || isHeroNow}
                                  onClick={() => setHero(sIn.ticker, k.short)}
                                  title={
                                    isHeroNow
                                      ? "Hero actuel"
                                      : "Définir comme hero"
                                  }
                                  className={`flex size-5 items-center justify-center rounded-full border transition-colors ${
                                    isHeroNow
                                      ? "border-violet-400 bg-violet-500/40"
                                      : "border-white/15 hover:border-violet-400/60 hover:bg-violet-500/10"
                                  }`}
                                >
                                  {isHeroNow && (
                                    <Star className="size-3 fill-violet-200 text-violet-200" />
                                  )}
                                </button>
                              </td>
                              {/* Checkbox actif */}
                              <td className="px-2 py-2.5">
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
                                    <Loader2 className="ml-1 size-3 animate-spin text-zinc-500" />
                                  )}
                                </label>
                              </td>
                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11.5px] font-semibold text-zinc-200">
                                    {k.short}
                                  </span>
                                  {isHeroNow && (
                                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet-200">
                                      hero
                                    </span>
                                  )}
                                  {k.is_generic && (
                                    <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                                      générique
                                    </span>
                                  )}
                                  {k.pv_score && k.pv_score >= 7 && (
                                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan-200">
                                      PV {k.pv_score}
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
                  {hiddenGenCount > 0 && (
                    <div className="border-t border-white/[0.04] bg-white/[0.01] px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggleShowGeneric(sIn.ticker)}
                        className="text-[11px] uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300"
                      >
                        {showGen
                          ? `Cacher les ${hiddenGenCount} génériques`
                          : `Voir +${hiddenGenCount} génériques`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {sortedAndFiltered.length === 0 && (
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
