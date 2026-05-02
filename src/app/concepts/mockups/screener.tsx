"use client";

import { Sliders, Search, Star } from "lucide-react";

/**
 * MOCKUP STATIQUE — Screener multi-critères.
 *
 * À faire en V2 : permettre de filtrer 100+ sociétés par secteur, sous-secteur,
 * tranche de capitalisation, scores qualité KPI, scores risque, dividende, etc.
 *
 * Brouillon visuel uniquement, aucune logique branchée.
 */

const FILTERS = [
  { label: "Secteur GICS", value: "Technologies de l'information", count: 12 },
  { label: "Sous-secteur", value: "Logiciels", count: 8 },
  { label: "Région", value: "USA + Europe", count: 0 },
  { label: "Capi (Mds $)", value: "10 — 1 000", count: 0 },
  { label: "Score qualité KPI", value: "≥ 7 / 10", count: 0 },
  { label: "Score risque global", value: "≤ 3 / 5", count: 0 },
  { label: "Dividende", value: "Toutes", count: 0 },
  { label: "Croissance CA 5 ans", value: "≥ 10 % CAGR", count: 0 },
];

const RESULTS = [
  { ticker: "GOOGL", name: "Alphabet", sector: "Tech", capi: 2461, qual: 9.1, risk: 2.1, cagr: 18.4 },
  { ticker: "META", name: "Meta Platforms", sector: "Comm. Services", capi: 1850, qual: 8.7, risk: 2.8, cagr: 22.0 },
  { ticker: "MSFT", name: "Microsoft", sector: "Tech", capi: 3120, qual: 9.4, risk: 1.9, cagr: 15.7 },
  { ticker: "ADBE", name: "Adobe", sector: "Tech", capi: 218, qual: 8.5, risk: 2.4, cagr: 14.1 },
  { ticker: "NOW", name: "ServiceNow", sector: "Tech", capi: 195, qual: 8.9, risk: 2.6, cagr: 27.5 },
];

export function MockupScreener() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[12px] text-amber-200">
        ⚠️ <strong>Mockup statique</strong> — vue conceptuelle de ce que le screener pourrait être (pour V2 quand on aura 30-100+ sociétés). Aucune logique branchée. Tu peux changer la composition / le layout sans risque, c'est juste un brouillon visuel.
      </div>

      <h2 className="mb-4 font-display text-[24px] font-bold tracking-tight text-zinc-50">
        Screener multi-critères
      </h2>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Filters sidebar */}
        <aside className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-baseline gap-2">
            <Sliders className="size-4 text-violet-300" />
            <span className="text-[13px] font-semibold text-zinc-100">Filtres</span>
            <span className="ml-auto text-[10.5px] text-zinc-500">5 actifs</span>
          </div>
          <div className="space-y-3">
            {FILTERS.map((f) => (
              <div key={f.label}>
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">{f.label}</div>
                <div className="mt-0.5 truncate text-[12.5px] text-zinc-200">{f.value}</div>
                <div className="mt-1 h-1 rounded-full bg-white/[0.05]">
                  <div className="h-full w-1/3 rounded-full bg-violet-500/40" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Results table */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02]">
          <div className="border-b border-white/8 p-4">
            <div className="flex items-center gap-3">
              <Search className="size-4 text-zinc-500" />
              <input placeholder="Recherche libre (nom, ticker, dirigeant…)" className="flex-1 bg-transparent text-[13px] text-zinc-100 placeholder-zinc-500 outline-none" />
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10.5px] text-zinc-400">
                <strong className="text-zinc-100">{RESULTS.length}</strong> sur <strong className="text-zinc-100">87</strong> sociétés
              </span>
            </div>
          </div>

          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.02] text-left">
                <th className="px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Société</th>
                <th className="px-3 py-2.5 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Secteur</th>
                <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Capi</th>
                <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Qualité</th>
                <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Risque</th>
                <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">CAGR 5a</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {RESULTS.map((r) => (
                <tr key={r.ticker} className="border-b border-white/5 transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] font-bold uppercase text-violet-300">{r.ticker}</span>
                      <span className="font-medium text-zinc-100">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-400">{r.sector}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-100">{r.capi.toLocaleString("fr-FR")} <span className="text-[10px] text-zinc-500">Mds$</span></td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-300">{r.qual.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-300">{r.risk.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-100">+{r.cagr.toFixed(1)} %</td>
                  <td className="px-3 py-2.5">
                    <button className="text-zinc-500 hover:text-amber-300">
                      <Star className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
