"use client";

import { useEffect, useMemo, useState } from "react";
import { COLOR_META, COLOR_CRITERIA, type CurationScore } from "@/lib/desk/curation-score";
import type { CurationRow, UniverseFlags } from "./page";

type UniverseFilterKey = keyof UniverseFlags;

type UniverseFilterDef = { key: UniverseFilterKey; label: string };

const UNIVERSE_GROUPS: Array<{ title: string; filters: UniverseFilterDef[] }> = [
  {
    title: "Catégorie SEC",
    filters: [
      { key: "cat1", label: "Cat 1 (US natifs)" },
      { key: "cat2", label: "Cat 2 (FPI ADR)" },
      { key: "cat3", label: "Cat 3 (EU pures)" },
    ],
  },
  {
    title: "Univers Mettrik",
    filters: [{ key: "top307", label: "Top 307" }],
  },
  {
    title: "Indices US",
    filters: [
      { key: "sp500", label: "SP500" },
      { key: "sp1500", label: "SP1500" },
    ],
  },
  {
    title: "Indices européens",
    filters: [
      { key: "stoxx600", label: "Stoxx 600" },
      { key: "cac40", label: "CAC 40" },
      { key: "dax40", label: "DAX 40" },
      { key: "ftse100", label: "FTSE 100" },
      { key: "ftse_mib", label: "FTSE MIB" },
      { key: "ibex35", label: "IBEX 35" },
      { key: "smi20", label: "SMI 20" },
      { key: "aex25", label: "AEX 25" },
      { key: "bel20", label: "BEL 20" },
      { key: "omx_stockholm30", label: "OMX Sto 30" },
      { key: "omx_copenhagen25", label: "OMX Cop 25" },
    ],
  },
];

type MinPlan = "free" | "premium" | "max" | "hidden";

type Curation = {
  ticker: string;
  min_plan: MinPlan;
  notes: string | null;
  updated_at?: string;
};

const PLAN_OPTIONS: Array<{ value: MinPlan; label: string; color: string }> = [
  { value: "hidden", label: "Hidden", color: "text-zinc-400 border-zinc-500/40" },
  { value: "free", label: "Free", color: "text-emerald-200 border-emerald-500/40" },
  { value: "premium", label: "Premium", color: "text-violet-200 border-violet-500/40" },
  { value: "max", label: "Max", color: "text-cyan-200 border-cyan-500/40" },
];

export function CuratedCompaniesClient({ rows }: { rows: CurationRow[] }) {
  const [curationMap, setCurationMap] = useState<Map<string, MinPlan>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<"all" | CurationScore["color"]>("all");
  const [filterPlan, setFilterPlan] = useState<"all" | MinPlan>("all");
  const [search, setSearch] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [universeFilters, setUniverseFilters] = useState<Set<UniverseFilterKey>>(new Set());

  function toggleUniverseFilter(key: UniverseFilterKey) {
    setUniverseFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/desk/curated-companies", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Curation[]) => {
        const m = new Map<string, MinPlan>();
        for (const c of data) m.set(c.ticker.toUpperCase(), c.min_plan);
        setCurationMap(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updatePlan(ticker: string, plan: MinPlan) {
    const upper = ticker.toUpperCase();
    setSaving(upper);
    const next = new Map(curationMap);
    next.set(upper, plan);
    setCurationMap(next);
    try {
      await fetch("/api/desk/curated-companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticker: upper, min_plan: plan }),
      });
    } catch {
      // rollback en cas d'erreur
      const rollback = new Map(curationMap);
      setCurationMap(rollback);
    } finally {
      setSaving(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    const activeFilters = Array.from(universeFilters);
    return rows.filter((r) => {
      if (filterColor !== "all" && r.score.color !== filterColor) return false;
      const plan = curationMap.get(r.ticker.toUpperCase()) ?? "hidden";
      if (filterPlan !== "all" && plan !== filterPlan) return false;
      if (q && !r.ticker.toUpperCase().includes(q) && !r.name.toUpperCase().includes(q)) return false;
      if (activeFilters.length > 0) {
        // OR logic : garder si la sté matche au moins un filtre actif
        const matches = activeFilters.some((k) => r.flags[k]);
        if (!matches) return false;
      }
      return true;
    });
  }, [rows, filterColor, filterPlan, search, curationMap, universeFilters]);

  const universeCounts = useMemo(() => {
    const counts: Record<UniverseFilterKey, number> = {
      cat1: 0, cat2: 0, cat3: 0, top307: 0, sp500: 0, sp1500: 0,
      stoxx600: 0, cac40: 0, dax40: 0, ftse100: 0, ftse_mib: 0,
      ibex35: 0, smi20: 0, aex25: 0, bel20: 0,
      omx_stockholm30: 0, omx_copenhagen25: 0,
    };
    for (const r of rows) {
      for (const k of Object.keys(counts) as UniverseFilterKey[]) {
        if (r.flags[k]) counts[k]++;
      }
    }
    return counts;
  }, [rows]);

  const stats = useMemo(() => {
    const byColor: Record<CurationScore["color"], number> = { green: 0, yellow: 0, orange: 0, red: 0 };
    const byPlan: Record<MinPlan, number> = { free: 0, premium: 0, max: 0, hidden: 0 };
    for (const r of rows) {
      byColor[r.score.color]++;
      const plan = curationMap.get(r.ticker.toUpperCase()) ?? "hidden";
      byPlan[plan]++;
    }
    return { byColor, byPlan, total: rows.length };
  }, [rows, curationMap]);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="font-display text-[30px] font-bold tracking-tight">
            Curated Companies · Sés en prod par plan
          </h1>
          <p className="mt-1 text-[13.5px] text-zinc-400">
            Sélectionne les sés visibles côté front public (niveau 0 + 1) par plan tier.
            Modèle cumulatif : <em>Free</em> visible par tous · <em>Premium</em> visible par
            Premium + Max · <em>Max</em> visible par Max uniquement · <em>Hidden</em> = jamais
            en prod publique. Niveau 2/3 ignore ce filtre (toutes les sés visibles pour dev).
          </p>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="mt-2 text-[12px] text-violet-300 hover:text-violet-100"
          >
            {showHelp ? "Masquer" : "Voir"} la légende des couleurs et critères
          </button>
          {showHelp && (
            <div className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-[12.5px] sm:grid-cols-2">
              {(Object.keys(COLOR_META) as Array<CurationScore["color"]>).map((c) => {
                const meta = COLOR_META[c];
                return (
                  <div key={c} className="flex items-start gap-2">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
                    <div>
                      <div className={`font-medium ${meta.text}`}>{meta.emoji} {meta.label}</div>
                      <div className="text-[11.5px] text-zinc-400">{COLOR_CRITERIA[c]}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </header>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total</div>
            <div className="font-mono text-[18px]">{stats.total}</div>
          </div>
          {(Object.keys(COLOR_META) as Array<CurationScore["color"]>).map((c) => {
            const meta = COLOR_META[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilterColor(filterColor === c ? "all" : c)}
                className={`rounded-md border px-3 py-2 text-left transition-colors ${
                  filterColor === c
                    ? `${meta.bg} ${meta.border}`
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${meta.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
                  {meta.label}
                </div>
                <div className="font-mono text-[18px]">{stats.byColor[c]}</div>
              </button>
            );
          })}
          {PLAN_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setFilterPlan(filterPlan === p.value ? "all" : p.value)}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                filterPlan === p.value
                  ? `${p.color} bg-white/[0.06]`
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">{p.label}</div>
              <div className="font-mono text-[18px]">{stats.byPlan[p.value]}</div>
            </button>
          ))}
        </div>

        {/* Filtres univers */}
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-wider text-zinc-400">
              Filtres univers
              {universeFilters.size > 0 && (
                <span className="ml-2 text-violet-300">
                  · {universeFilters.size} actif{universeFilters.size > 1 ? "s" : ""} (OR)
                </span>
              )}
            </h2>
            {universeFilters.size > 0 && (
              <button
                type="button"
                onClick={() => setUniverseFilters(new Set())}
                className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-300 hover:border-white/30"
              >
                Reset univers
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {UNIVERSE_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  {group.title}
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.filters.map((f) => {
                    const active = universeFilters.has(f.key);
                    const count = universeCounts[f.key];
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => toggleUniverseFilter(f.key)}
                        className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                          active
                            ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                            : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                        }`}
                      >
                        {f.label}
                        <span className={`ml-1 font-mono text-[10px] ${active ? "text-violet-200" : "text-zinc-500"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search + reset */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche ticker ou nom…"
            className="flex-1 rounded-md border border-white/15 bg-[#0c0c10] px-3 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilterColor("all");
              setFilterPlan("all");
            }}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] text-zinc-300 hover:border-white/30"
          >
            Reset filtres
          </button>
          {loading && <span className="text-[11px] text-zinc-500">Chargement…</span>}
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.03] text-[10.5px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left">Ticker</th>
                <th className="px-3 py-2 text-left">Nom</th>
                <th className="px-3 py-2 text-left">Score</th>
                <th className="px-3 py-2 text-left">Plan minimum visible</th>
                <th className="px-3 py-2 text-left">Détail blocs en défaut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = COLOR_META[r.score.color];
                const currentPlan = curationMap.get(r.ticker.toUpperCase()) ?? "hidden";
                return (
                  <tr key={r.ticker} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono font-medium">
                      <a href={`/sandbox/v1-8/${r.ticker.toLowerCase()}`} className="hover:text-violet-300" target="_blank" rel="noreferrer">
                        {r.ticker}
                      </a>
                      {r.in_top307 && (
                        <span className="ml-1 rounded-sm border border-violet-500/30 bg-violet-500/10 px-1 py-px text-[9px] uppercase text-violet-300">307</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{r.name}</td>
                    <td className="px-3 py-2">
                      <div className={`inline-flex items-center gap-1.5 rounded-full border ${meta.border} ${meta.bg} ${meta.text} px-2 py-0.5 text-[11px] font-medium`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
                        {meta.label} · {r.score.blocksGood}/{r.score.blocksTotal}
                      </div>
                      <div className="mt-1 text-[10.5px] text-zinc-500">{r.score.reason}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {PLAN_OPTIONS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            disabled={saving === r.ticker.toUpperCase()}
                            onClick={() => updatePlan(r.ticker, p.value)}
                            className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                              currentPlan === p.value
                                ? `${p.color} bg-white/[0.08]`
                                : "border-white/10 text-zinc-500 hover:border-white/25 hover:text-zinc-300"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11.5px] text-zinc-400">
                      {r.score.blocksInDefault.length === 0 ? (
                        <span className="text-emerald-400">Aucun</span>
                      ) : (
                        <span className="font-mono">{r.score.blocksInDefault.join(", ")}</span>
                      )}
                      {r.score.visualMajorFails > 0 && (
                        <span className="ml-2 rounded-sm border border-orange-500/30 bg-orange-500/10 px-1 py-px text-[10px] text-orange-300">
                          Gemini : {r.score.visualMajorFails} fail ≥3
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-zinc-500">
                    Aucune sté ne correspond aux filtres actuels.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11.5px] text-zinc-500">
          Ligne {filtered.length}/{rows.length} affichées. Tri : top 307 d&apos;abord,
          puis du vert au rouge. Modifs persistées en BDD (table{" "}
          <code className="text-zinc-400">desk_curated_companies</code>) — appliquées
          immédiatement côté niveau 0 et niveau 1.
        </p>
      </div>
    </div>
  );
}
