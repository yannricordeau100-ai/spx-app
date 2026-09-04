"use client";

/**
 * Arbre de la classification sectorielle (Yann 4 sept 2026).
 *
 * L onglet GICS proposait surtout une recherche par mot : impossible de voir
 * la structure d ensemble, ni de se limiter a deux secteurs. Cette vue affiche
 * les quatre niveaux, secteur puis groupe puis industrie puis sous-industrie,
 * chacun repliable, avec un filtre par secteur et le nombre de societes de
 * l univers rattachees a chaque branche.
 *
 * Reserve au back-office, comme le reste de l onglet.
 */

import { useMemo, useState } from "react";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { GICS, type GicsSector } from "@/lib/desk/gics";

function compteSous(s: GicsSector): number {
  return s.groups.reduce((t, g) => t + g.industries.reduce((u, i) => u + i.subs.length, 0), 0);
}

export function ArbreGics({ societesParSousIndustrie }: { societesParSousIndustrie?: Record<string, number> }) {
  const [secteursRetenus, setSecteursRetenus] = useState<string[]>([]);   // vide = tous
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  const visibles = useMemo(
    () => (secteursRetenus.length === 0 ? GICS : GICS.filter((s) => secteursRetenus.includes(s.code))),
    [secteursRetenus],
  );

  const bascule = (cle: string) =>
    setOuverts((prev) => {
      const n = new Set(prev);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const toutDeplier = () => {
    const n = new Set<string>();
    for (const s of visibles) {
      n.add(s.code);
      for (const g of s.groups) {
        n.add(g.code);
        for (const i of g.industries) n.add(i.code);
      }
    }
    setOuverts(n);
  };

  const nb = (code: string) => societesParSousIndustrie?.[code];

  return (
    <div>
      {/* Choix des secteurs : aucun coche = tout l arbre. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Secteurs
        </span>
        {GICS.map((s) => {
          const actif = secteursRetenus.includes(s.code);
          return (
            <button
              key={s.code}
              onClick={() =>
                setSecteursRetenus((p) => (actif ? p.filter((c) => c !== s.code) : [...p, s.code]))
              }
              className={`rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
                actif
                  ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s.name}
              <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{compteSous(s)}</span>
            </button>
          );
        })}
        {secteursRetenus.length > 0 && (
          <button
            onClick={() => setSecteursRetenus([])}
            className="rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-zinc-400 hover:text-zinc-200"
          >
            Tout afficher
          </button>
        )}
        <span className="ml-auto flex gap-1.5">
          <button
            onClick={toutDeplier}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11.5px] text-zinc-300 hover:border-violet-400/40"
          >
            <Plus className="size-3" /> Tout déplier
          </button>
          <button
            onClick={() => setOuverts(new Set())}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11.5px] text-zinc-300 hover:border-violet-400/40"
          >
            <Minus className="size-3" /> Tout replier
          </button>
        </span>
      </div>

      <div className="mt-4 space-y-1">
        {visibles.map((s) => {
          const sOuvert = ouverts.has(s.code);
          return (
            <div key={s.code} className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
              <button
                onClick={() => bascule(s.code)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03]"
              >
                <ChevronRight className={`size-3.5 shrink-0 text-zinc-500 transition-transform ${sOuvert ? "rotate-90" : ""}`} />
                <span className="text-[13px] font-semibold text-zinc-100">{s.name}</span>
                <span className="font-mono text-[10.5px] text-zinc-600">{s.code}</span>
                <span className="ml-auto font-mono text-[11px] text-zinc-500">
                  {s.groups.length} groupes · {compteSous(s)} sous-industries
                </span>
              </button>

              {sOuvert && (
                <div className="border-t border-white/[0.05] px-3 py-2">
                  {s.groups.map((g) => {
                    const gOuvert = ouverts.has(g.code);
                    return (
                      <div key={g.code} className="ml-2">
                        <button
                          onClick={() => bascule(g.code)}
                          className="flex w-full items-center gap-2 py-1.5 text-left"
                        >
                          <ChevronRight className={`size-3 shrink-0 text-zinc-600 transition-transform ${gOuvert ? "rotate-90" : ""}`} />
                          <span className="text-[12.5px] font-medium text-zinc-200">{g.name}</span>
                          <span className="font-mono text-[10px] text-zinc-600">{g.code}</span>
                        </button>
                        {gOuvert && (
                          <div className="ml-4 border-l border-white/[0.07] pl-3">
                            {g.industries.map((i) => {
                              const iOuvert = ouverts.has(i.code);
                              return (
                                <div key={i.code}>
                                  <button
                                    onClick={() => bascule(i.code)}
                                    className="flex w-full items-center gap-2 py-1 text-left"
                                  >
                                    <ChevronRight className={`size-3 shrink-0 text-zinc-600 transition-transform ${iOuvert ? "rotate-90" : ""}`} />
                                    <span className="text-[12px] text-zinc-300">{i.name}</span>
                                    <span className="ml-auto font-mono text-[10px] text-zinc-600">
                                      {i.subs.length}
                                    </span>
                                  </button>
                                  {iOuvert && (
                                    <ul className="ml-5 border-l border-white/[0.07] pl-3">
                                      {i.subs.map((sub) => (
                                        <li
                                          key={sub.code}
                                          className="flex items-center gap-2 py-[3px] text-[11.5px] text-zinc-400"
                                        >
                                          <span className="size-1 shrink-0 rounded-full bg-zinc-700" />
                                          {sub.name}
                                          <span className="font-mono text-[10px] text-zinc-700">{sub.code}</span>
                                          {nb(sub.code) != null && (
                                            <span className="ml-auto font-mono text-[10px] text-violet-300">
                                              {nb(sub.code)} sté{(nb(sub.code) ?? 0) > 1 ? "s" : ""}
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
