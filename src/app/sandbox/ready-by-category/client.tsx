"use client";

import { useState } from "react";

export type CatStat = { name: string; total: number; ready: number; pct: number };
export type CountryRow = { country: string; ready: number; total: number; pct: number };

export function ReadyByCategoryClient({
  categories,
  countries,
  adrDuplicates,
}: {
  categories: CatStat[];
  countries: CountryRow[];
  adrDuplicates: string[];
}) {
  const [showAllCountries, setShowAllCountries] = useState(false);
  const visibleCountries = showAllCountries ? countries : countries.slice(0, 30);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="font-display text-[30px] font-bold tracking-tight">Stés prêtes par catégorie & pays</h1>
          <p className="mt-1 text-[13.5px] text-zinc-400">
            Critères "complètement prêt" : Pass 3 validé + ≥5 KPIs + ≥3 risks + hero KPI + governance (CEO) + AI positioning.
            Cf. <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">src/lib/quality-tree.ts</code> pour la liste complète.
          </p>
        </header>

        {/* Par catégorie */}
        <section className="mb-8">
          <h2 className="mb-3 text-[16px] font-semibold text-violet-200">Par catégorie</h2>
          <div className="rounded-lg border border-white/10 bg-[#080808]">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-[#0c0c0c]">
                <tr className="text-left">
                  <th className="border-b border-white/10 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Catégorie</th>
                  <th className="border-b border-white/10 px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Prêtes</th>
                  <th className="border-b border-white/10 px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Total</th>
                  <th className="border-b border-white/10 px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">%</th>
                  <th className="border-b border-white/10 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Barre</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.name} className="hover:bg-white/[0.02]">
                    <td className="border-b border-white/5 px-3 py-2 font-semibold text-zinc-100">{c.name}</td>
                    <td className="border-b border-white/5 px-3 py-2 text-right font-mono tabular-nums text-emerald-300">{c.ready.toLocaleString("fr-FR")}</td>
                    <td className="border-b border-white/5 px-3 py-2 text-right font-mono tabular-nums text-zinc-300">{c.total.toLocaleString("fr-FR")}</td>
                    <td className="border-b border-white/5 px-3 py-2 text-right font-mono tabular-nums text-zinc-300">{c.pct}&nbsp;%</td>
                    <td className="border-b border-white/5 px-3 py-2">
                      <div className="h-2 w-40 rounded-full bg-white/[0.04]">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${c.pct}%`,
                            background: c.pct >= 90 ? "#10b981" : c.pct >= 60 ? "#f59e0b" : "#f43f5e",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] text-zinc-500">
            Note : "Cat 2 ADR" et "Stoxx 600 EU" sont des approximations basées sur le suffix ticker et la présence
            d'un dossier `sec-data/cat3-european`. Liste canonique à confirmer par CONV-DATA.
          </p>
        </section>

        {/* Par pays */}
        <section className="mb-8">
          <h2 className="mb-3 text-[16px] font-semibold text-cyan-200">Par pays (ordre décroissant prêtes)</h2>
          <div className="rounded-lg border border-white/10 bg-[#080808]">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-[#0c0c0c]">
                <tr className="text-left">
                  <th className="border-b border-white/10 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Pays</th>
                  <th className="border-b border-white/10 px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Prêtes</th>
                  <th className="border-b border-white/10 px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Total</th>
                  <th className="border-b border-white/10 px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">%</th>
                </tr>
              </thead>
              <tbody>
                {visibleCountries.map((c) => (
                  <tr key={c.country} className="hover:bg-white/[0.02]">
                    <td className="border-b border-white/5 px-3 py-2 text-zinc-100">{c.country}</td>
                    <td className="border-b border-white/5 px-3 py-2 text-right font-mono tabular-nums text-emerald-300">{c.ready.toLocaleString("fr-FR")}</td>
                    <td className="border-b border-white/5 px-3 py-2 text-right font-mono tabular-nums text-zinc-300">{c.total.toLocaleString("fr-FR")}</td>
                    <td className="border-b border-white/5 px-3 py-2 text-right font-mono tabular-nums text-zinc-300">{c.pct}&nbsp;%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {countries.length > 30 && (
            <button
              onClick={() => setShowAllCountries((s) => !s)}
              className="mt-2 rounded-md border border-violet-500/40 bg-violet-500/[0.08] px-3 py-1 text-[12px] text-violet-200 hover:bg-violet-500/15"
            >
              {showAllCountries ? "Voir top 30" : `Tout afficher (${countries.length} pays)`}
            </button>
          )}
          <p className="mt-2 text-[11.5px] text-zinc-500">
            Note : la valeur "(non renseigné)" correspond aux stés sans champ `country` dans le dataset (ex BABA actuellement).
            CONV-DATA est ordonné de combler ce champ.
          </p>
        </section>

        {/* ADR duplicates masqués */}
        {adrDuplicates.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[16px] font-semibold text-zinc-300">ADR duplicates masqués ({adrDuplicates.length})</h2>
            <div className="rounded-lg border border-white/10 bg-[#080808] p-4">
              <p className="mb-2 text-[12px] text-zinc-400">
                Ces tickers sont des ADR US dupliquant une listing d'origine. Masqués du site et du hub.
                Visibles barrés/grisés sur <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">/sandbox/coverage-matrix</code>.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {adrDuplicates.map((t) => (
                  <span key={t} className="rounded-md border border-zinc-700/40 bg-zinc-800/40 px-2 py-0.5 font-mono text-[11px] text-zinc-500 line-through">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
