"use client";

/**
 * Arborescence concentration clients (/sandbox/clients), 07 sept 2026.
 * Meme arbre depliable par secteur GICS que les autres ateliers : au bout de
 * chaque branche, une ligne par societe avec le poids des tout premiers
 * clients (badge colore selon la concentration) et celui des plus gros
 * clients elargis. Un resume et des filtres en tete. Donnees prêtes a etre
 * posees sur les fiches quand le proprietaire le demandera.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Search } from "lucide-react";
import { GICS } from "@/lib/desk/gics";

type Mesure = {
  n?: number;
  pct?: number | string | null;
  plafond?: boolean;
  exercice?: string;
  clients?: string[];
  source?: { url?: string; titre?: string };
  commentaire?: string;
};

export type ClientsEntree = {
  ticker: string;
  date?: string;
  top?: Mesure | null;
  top10?: Mesure | null;
  diffus?: boolean;
};

function secteurDe(code: string | undefined): string | null {
  if (!code) return null;
  const s = GICS.find((x) => code.startsWith(x.code));
  return s ? s.code : null;
}

/** Libelle et couleur du badge top clients. */
function badgeTop(e: ClientsEntree): { txt: string; cls: string } {
  const m = e.top;
  if (e.diffus || m?.pct === "<1") return { txt: "<1 % (base diffuse)", cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300" };
  if (!m || m.pct == null) return { txt: "non publié", cls: "border-white/10 text-zinc-500" };
  const v = typeof m.pct === "number" ? m.pct : 0;
  const lab = `${m.plafond ? "<" : ""}${String(m.pct).replace(".", ",")} % (top ${m.n})`;
  if (m.plafond) return { txt: lab, cls: "border-sky-400/40 bg-sky-500/10 text-sky-200" };
  if (v >= 30) return { txt: lab, cls: "border-rose-400/50 bg-rose-500/15 text-rose-100" };
  if (v >= 15) return { txt: lab, cls: "border-amber-400/50 bg-amber-500/15 text-amber-100" };
  return { txt: lab, cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" };
}

export function ClientsAtelier({
  societes,
  gics,
  noms,
}: {
  societes: Record<string, ClientsEntree>;
  gics: Record<string, string>;
  noms: Record<string, string>;
}) {
  const [filtre, setFiltre] = useState("");
  const [concentresSeuls, setConcentresSeuls] = useState(false);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  const lignes = useMemo(
    () =>
      Object.entries(societes)
        .map(([t, e]) => ({ t: t.toUpperCase(), e, sec: secteurDe(gics[t]) }))
        .sort((a, b) => a.t.localeCompare(b.t)),
    [societes, gics],
  );

  const stats = useMemo(() => {
    let pctTop = 0, plafonds = 0, diffus = 0, concentres = 0;
    for (const { e } of lignes) {
      if (e.diffus || e.top?.pct === "<1") diffus += 1;
      else if (e.top?.plafond) plafonds += 1;
      else if (typeof e.top?.pct === "number") {
        pctTop += 1;
        if (e.top.pct >= 30) concentres += 1;
      }
    }
    return { pctTop, plafonds, diffus, concentres };
  }, [lignes]);

  const q = filtre.trim().toLowerCase();
  const passe = ({ t, e }: { t: string; e: ClientsEntree }) => {
    if (q && !t.toLowerCase().includes(q) && !(noms[t] ?? "").toLowerCase().includes(q)) return false;
    if (concentresSeuls && !(typeof e.top?.pct === "number" && !e.top.plafond && e.top.pct >= 30)) return false;
    return true;
  };

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
        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[13px] text-emerald-100">
          % précis <span className="ml-1 font-mono text-[12px] font-bold">{stats.pctTop}</span>
        </span>
        <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-[13px] text-sky-200">
          Plafond « aucun &gt;10 % » <span className="ml-1 font-mono text-[12px] font-bold">{stats.plafonds}</span>
        </span>
        <span className="rounded-full border border-zinc-500/40 bg-zinc-500/10 px-3 py-1.5 text-[13px] text-zinc-300">
          Base diffuse &lt;1 % <span className="ml-1 font-mono text-[12px] font-bold">{stats.diffus}</span>
        </span>
        <button
          onClick={() => setConcentresSeuls((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-[13px] ${concentresSeuls ? "border-rose-400/60 bg-rose-500/20 text-rose-100" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}
        >
          Très concentrées (top ≥30 %) <span className="ml-1 font-mono text-[12px] font-bold">{stats.concentres}</span>
        </button>
        <span className="ml-auto font-mono text-[11px] text-zinc-500">{lignes.length} / 666 recherchées</span>
      </div>

      <div className="relative mt-3 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Ticker ou nom…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
        />
      </div>

      <div className="mt-4 space-y-1.5">
        {GICS.map((s) => {
          const stes = lignes.filter((l) => l.sec === s.code && passe(l));
          if (stes.length === 0) return null;
          const ouvert = ouverts.has(s.code) || !!q || concentresSeuls;
          return (
            <div key={s.code} className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <button onClick={() => bascule(s.code)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.03]">
                <ChevronRight className={`size-4 shrink-0 text-zinc-500 transition-transform ${ouvert ? "rotate-90" : ""}`} />
                <span className="font-mono text-[12px] text-violet-300">{s.code}</span>
                <span className="text-[15px] font-semibold text-zinc-100">{s.name}</span>
                <span className="ml-auto font-mono text-[12px] text-zinc-500">{stes.length} sté{stes.length > 1 ? "s" : ""}</span>
              </button>
              {ouvert && (
                <div className="border-t border-white/[0.05] px-3 py-2">
                  <div className="grid gap-1">
                    {stes.map(({ t, e }) => {
                      const b = badgeTop(e);
                      const t10 = e.top10;
                      return (
                        <div key={t} className="rounded-lg border border-white/[0.05] px-2.5 py-1.5 text-[12.5px]">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <Link href={`/${t.toLowerCase()}`} className="w-[74px] shrink-0 font-mono font-semibold text-violet-200 hover:underline">{t}</Link>
                            <span className="min-w-0 flex-1 basis-40 truncate text-zinc-200">{noms[t] ?? t}</span>
                            <span className={`rounded-full border px-2 py-px font-mono text-[10.5px] ${b.cls}`} title={e.top?.commentaire}>
                              {b.txt}
                            </span>
                            {t10 && t10.pct != null && (
                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-px font-mono text-[10.5px] text-zinc-300" title={t10.commentaire}>
                                {t10.plafond ? "<" : ""}{String(t10.pct).replace(".", ",")} % (top {t10.n})
                              </span>
                            )}
                            {e.top?.exercice && <span className="font-mono text-[10px] text-zinc-600">{e.top.exercice}</span>}
                            {e.top?.source?.url && (
                              <a href={e.top.source.url} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-200" title={e.top.source.titre}>
                                <ExternalLink className="size-3.5" />
                              </a>
                            )}
                          </div>
                          {e.top?.clients && e.top.clients.length > 0 && (
                            <div className="mt-0.5 pl-[84px] text-[11.5px] text-zinc-500">{e.top.clients.join(" · ")}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
