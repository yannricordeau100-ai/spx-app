"use client";

/**
 * Arborescence des bourses mondiales (/sandbox/bourses), 07 sept 2026.
 * Pays en tete de pyramide, puis indice principal / secondaire (ou les 3
 * indices US), puis les societes. Une societe deja en ligne = lien violet
 * vers sa fiche. Sur nasdaq100 et soxx, un mini symbole ● marque celles
 * aussi presentes dans le S&P 500.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Search } from "lucide-react";

type Ste = {
  nom: string;
  ticker?: string;
  mettrik?: string | null;
  sp500?: boolean;
};

type Indice = {
  cle: string;
  nom: string;
  reference?: string;
  source?: { url?: string; titre?: string };
  stes?: Ste[];
};

export type PaysBourse = {
  pays: string;
  code: string;
  drapeau?: string;
  indices?: Indice[];
};

const ORDRE = ["US", "FR", "DE", "GB", "CH", "NL", "IT", "ES", "BE", "AT", "SE", "CA", "AU", "JP", "KR", "HK", "SG", "TW"];

function libelleCle(cle: string): string {
  if (cle === "principal") return "Indice principal";
  if (cle === "secondaire") return "Indice secondaire";
  if (cle === "sp500") return "S&P 500";
  if (cle === "nasdaq100") return "Nasdaq 100";
  if (cle === "soxx") return "SOXX (semi-conducteurs)";
  return cle;
}

export function BoursesAtelier({ pays }: { pays: PaysBourse[] }) {
  const [filtre, setFiltre] = useState("");
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  const tries = useMemo(
    () =>
      [...pays].sort((a, b) => {
        const ia = ORDRE.indexOf(a.code);
        const ib = ORDRE.indexOf(b.code);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }),
    [pays],
  );

  const q = filtre.trim().toLowerCase();
  const passe = (s: Ste) =>
    !q || s.nom.toLowerCase().includes(q) || (s.ticker ?? "").toLowerCase().includes(q) || (s.mettrik ?? "").toLowerCase().includes(q);

  const stats = useMemo(() => {
    let total = 0, enLigne = 0;
    for (const p of pays)
      for (const i of p.indices ?? [])
        for (const s of i.stes ?? []) {
          total += 1;
          if (s.mettrik) enLigne += 1;
        }
    return { total, enLigne };
  }, [pays]);

  const bascule = (c: string) =>
    setOuverts((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-[13px] text-violet-200">
          Pays reçus <span className="ml-1 font-mono text-[12px] font-bold">{pays.length} / 18</span>
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-300">
          Lignes <span className="ml-1 font-mono text-[12px] font-bold">{stats.total}</span>
        </span>
        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[13px] text-emerald-100">
          Déjà en ligne <span className="ml-1 font-mono text-[12px] font-bold">{stats.enLigne}</span>
        </span>
      </div>

      <div className="relative mt-3 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Société, ticker…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
        />
      </div>

      <div className="mt-4 space-y-1.5">
        {tries.map((p) => {
          const indices = (p.indices ?? []).map((i) => ({ ...i, visibles: (i.stes ?? []).filter(passe) }));
          const nb = indices.reduce((a, i) => a + (i.stes?.length ?? 0), 0);
          if (q && indices.every((i) => i.visibles.length === 0)) return null;
          const ouvert = ouverts.has(p.code) || !!q;
          return (
            <div key={p.code} className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <button onClick={() => bascule(p.code)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.03]">
                <ChevronRight className={`size-4 shrink-0 text-zinc-500 transition-transform ${ouvert ? "rotate-90" : ""}`} />
                <span className="text-[17px]">{p.drapeau ?? "🌐"}</span>
                <span className="text-[15px] font-semibold text-zinc-100">{p.pays}</span>
                <span className="ml-auto font-mono text-[12px] text-zinc-500">{nb} lignes</span>
              </button>
              {ouvert && (
                <div className="space-y-2 border-t border-white/[0.05] px-3 py-2.5">
                  {indices.map((i) => (
                    <div key={i.cle} className="rounded-lg border border-white/[0.05] p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-px font-mono text-[10.5px] ${i.cle === "secondaire" ? "border-sky-400/40 bg-sky-500/10 text-sky-200" : "border-violet-400/40 bg-violet-500/10 text-violet-200"}`}>
                          {libelleCle(i.cle)}
                        </span>
                        <span className="text-[13.5px] font-semibold text-zinc-100">{i.nom}</span>
                        <span className="font-mono text-[10.5px] text-zinc-500">{i.stes?.length ?? 0} stés{i.reference ? ` · ${i.reference}` : ""}</span>
                        {(i.cle === "nasdaq100" || i.cle === "soxx") && (
                          <span className="font-mono text-[10px] text-amber-300/90">● = aussi dans le S&P 500</span>
                        )}
                        {i.source?.url && (
                          <a href={i.source.url} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-200" title={i.source.titre}>
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {i.visibles.map((s, k) => {
                          const contenu = (
                            <>
                              {(i.cle === "nasdaq100" || i.cle === "soxx") && s.sp500 && (
                                <span className="mr-1 text-[8px] text-amber-300">●</span>
                              )}
                              {s.nom}
                              {s.ticker && <span className="ml-1 font-mono text-[9.5px] opacity-70">{s.ticker}</span>}
                            </>
                          );
                          return s.mettrik ? (
                            <Link
                              key={`${s.ticker ?? s.nom}-${k}`}
                              href={`/${s.mettrik.toLowerCase()}`}
                              className="rounded-md border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-[11.5px] text-violet-100 hover:bg-violet-500/25"
                            >
                              {contenu}
                            </Link>
                          ) : (
                            <span key={`${s.ticker ?? s.nom}-${k}`} className="rounded-md border border-white/[0.07] px-2 py-0.5 text-[11.5px] text-zinc-400">
                              {contenu}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
