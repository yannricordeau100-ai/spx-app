"use client";

/**
 * Societes retirees de la mise en ligne (Yann 28 aout 2026) : tout ce qui
 * n appartient pas aux indices retenus (S&P 500, Nasdaq 100, SOX, CAC 40,
 * SMI, AEX, DAX). Leurs KPI restent consultables ici, filtres par categorie.
 * Donnees : src/data/hors-indices-kpis.json, régénérées par
 * scripts/build-hors-indices.py.
 */
import { useMemo, useState } from "react";

type Kpi = { nom: string; valeur: unknown; unite?: string | null; yoy?: string | null; categorie: string };
type Ste = { ticker: string; nom: string; secteur: string; kpis: Kpi[] };

export function HorsIndicesClient({ data }: { data: Ste[] }) {
  const [categorie, setCategorie] = useState("Toutes");
  const [recherche, setRecherche] = useState("");

  const categories = useMemo(() => {
    const c = new Map<string, number>();
    for (const s of data) for (const k of s.kpis) c.set(k.categorie, (c.get(k.categorie) ?? 0) + 1);
    return ["Toutes", ...[...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)];
  }, [data]);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return data
      .map((s) => ({
        ...s,
        kpis: s.kpis.filter(
          (k) =>
            (categorie === "Toutes" || k.categorie === categorie) &&
            (!q || s.nom.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q) || k.nom?.toLowerCase().includes(q)),
        ),
      }))
      .filter((s) => s.kpis.length > 0);
  }, [data, categorie, recherche]);

  const totalKpi = lignes.reduce((n, s) => n + s.kpis.length, 0);

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-[22px] font-bold">Sociétés hors indices</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-zinc-400">
          Retirées de la mise en ligne le 28 août 2026 : elles n appartiennent à aucun des
          indices retenus (S&amp;P 500, Nasdaq 100, SOX, CAC 40, SMI, AEX, DAX). Leurs KPI
          restent consultables ici.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Filtrer par société ou KPI…"
            className="w-64 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] outline-none placeholder:text-zinc-600 focus:border-violet-500/40"
          />
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategorie(c)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  c === categorie
                    ? "bg-violet-500/25 text-violet-100 ring-1 ring-violet-500/40"
                    : "bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          {lignes.length} sociétés · {totalKpi} KPI
        </div>

        <div className="mt-4 space-y-3">
          {lignes.map((s) => (
            <div key={s.ticker} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[12px] font-bold text-cyan-300">{s.ticker}</span>
                <span className="text-[14.5px] font-semibold text-zinc-100">{s.nom}</span>
                <span className="text-[11.5px] text-zinc-500">{s.secteur}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {s.kpis.map((k, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2 border-b border-white/[0.04] py-1">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-400" title={k.nom}>
                      {k.nom}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[12px] tabular-nums text-zinc-100">
                      {String(k.valeur)}
                      {k.unite ? <span className="ml-1 text-zinc-500">{k.unite}</span> : null}
                      {k.yoy ? <span className="ml-1.5 text-[10.5px] text-zinc-500">{k.yoy}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
