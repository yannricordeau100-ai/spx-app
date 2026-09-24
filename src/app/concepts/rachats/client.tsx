"use client";

/**
 * Trois propositions de design pour les rachats (24 sept 2026) :
 *  A. Frise par année dans la fiche société
 *  B. Liste dense avec montant, dans la fiche société
 *  C. Classement des sociétés du site qui ont le plus racheté
 * Règle Mettrik : aucune source dans le bloc, tout dans le mini bloc du bas.
 */

import { useMemo, useState } from "react";

type Rachat = { nom: string; annee: number | null; montant: string | null; sources?: string[] };
export type SocieteRachats = { ticker: string; nom: string; nb: number; depuis: number; rachats: Rachat[] };

const DESIGNS = [
  { id: "A" as const, titre: "La frise", parti: "Un chiffre, puis une frise année par année : on voit d'un coup d'œil le rythme des rachats et les grosses opérations." },
  { id: "B" as const, titre: "La liste chiffrée", parti: "Liste dense triée par date, montant aligné à droite quand la société le publie. Pour lire vite le détail." },
  { id: "C" as const, titre: "Le classement", parti: "Les sociétés du site qui ont le plus racheté depuis 2016. Un clic ouvre la liste des sociétés rachetées." },
];

function milliards(m: string | null): number {
  if (!m) return 0;
  const x = parseFloat(m.replace(",", "."));
  return m.includes("Mds") ? x : x / 1000;
}

function totalPublie(r: Rachat[]): string | null {
  const t = r.reduce((a, x) => a + milliards(x.montant), 0);
  if (!t) return null;
  return t >= 1 ? `${t.toFixed(1).replace(".", ",")} Mds $` : `${Math.round(t * 1000)} M$`;
}

function BasDeBloc() {
  return (
    <p className="mt-3 border-t border-white/[0.06] pt-2 font-mono text-[10px] text-zinc-500">
      Rachats finalisés depuis 2016, publiés par la société dans ses rapports annuels. Les petites acquisitions non nommées par la société n'apparaissent pas.
    </p>
  );
}

function BlocFrise({ s }: { s: SocieteRachats }) {
  const parAn = useMemo(() => {
    const m = new Map<number | "nd", Rachat[]>();
    for (const r of s.rachats) {
      const k = r.annee ?? "nd";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => (a[0] === "nd" ? 1 : b[0] === "nd" ? -1 : (a[0] as number) - (b[0] as number)));
  }, [s]);
  const total = totalPublie(s.rachats);
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.06] to-cyan-500/[0.03] p-5">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[40px] font-bold leading-none text-zinc-50">{s.nb}</span>
        <span className="text-[14px] text-zinc-300">sociétés rachetées depuis {s.depuis}</span>
        {total && <span className="ml-auto font-mono text-[12px] text-cyan-200">{total} publiés</span>}
      </div>
      <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
        {parAn.map(([an, liste]) => (
          <div key={String(an)} className="min-w-[140px] flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-violet-200">{an === "nd" ? "Année n.c." : an}</span>
              <span className="h-px flex-1 bg-violet-400/30" />
            </div>
            <ul className="space-y-1.5">
              {liste.map((r) => {
                const gros = milliards(r.montant) >= 5;
                return (
                  <li key={r.nom} className={`rounded-lg border px-2 py-1.5 text-[12px] ${gros ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-50" : "border-white/[0.08] bg-white/[0.02] text-zinc-200"}`}>
                    <div className="font-medium leading-tight">{r.nom}</div>
                    {r.montant && <div className="mt-0.5 font-mono text-[10.5px] text-zinc-400">{r.montant}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <BasDeBloc />
    </div>
  );
}

function BlocListe({ s }: { s: SocieteRachats }) {
  const total = totalPublie(s.rachats);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold text-zinc-100">Sociétés rachetées</h3>
        <span className="font-mono text-[12px] text-zinc-400">
          {s.nb} depuis {s.depuis}{total ? ` · ${total}` : ""}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-white/[0.05]">
        {s.rachats.map((r) => (
          <li key={r.nom} className="flex items-center gap-3 py-1.5 text-[13px]">
            <span className="w-12 font-mono text-[11px] text-violet-300">{r.annee ?? "n.c."}</span>
            <span className="flex-1 text-zinc-100">{r.nom}</span>
            <span className="font-mono text-[12px] text-zinc-300">{r.montant ?? ""}</span>
          </li>
        ))}
      </ul>
      <BasDeBloc />
    </div>
  );
}

function Classement({ societes }: { societes: SocieteRachats[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const max = Math.max(1, ...societes.map((s) => s.nb));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="text-[15px] font-semibold text-zinc-100">Les sociétés qui rachètent le plus</h3>
      <ol className="mt-3 space-y-1">
        {societes.filter((s) => s.nb > 0).slice(0, 25).map((s, i) => (
          <li key={s.ticker}>
            <button onClick={() => setOuvert(ouvert === s.ticker ? null : s.ticker)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.03]">
              <span className="w-5 font-mono text-[11px] text-zinc-500">{i + 1}</span>
              <span className="w-24 truncate font-mono text-[12px] text-violet-200">{s.ticker}</span>
              <span className="w-48 truncate text-[13px] text-zinc-200">{s.nom}</span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${(s.nb / max) * 100}%` }} />
              </span>
              <span className="w-8 text-right font-mono text-[13px] font-semibold text-zinc-50">{s.nb}</span>
            </button>
            {ouvert === s.ticker && (
              <p className="ml-10 mt-1 text-[12px] leading-relaxed text-zinc-400">
                {s.rachats.map((r) => `${r.nom}${r.annee ? ` (${r.annee})` : ""}`).join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ol>
      <BasDeBloc />
    </div>
  );
}

export function RachatsClient({ societes, maj, traitees, avecRachats }: { societes: SocieteRachats[]; maj: string; traitees: number; avecRachats: number }) {
  const [design, setDesign] = useState<"A" | "B" | "C">("A");
  const avec = societes.filter((s) => s.nb > 0);
  const [ticker, setTicker] = useState<string>(avec[0]?.ticker ?? "");
  const s = avec.find((x) => x.ticker === ticker) ?? avec[0];
  return (
    <div className="min-h-screen bg-[#050507] px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-[26px] font-bold">Rachats de sociétés</h1>
        <p className="mt-1 text-[13px] text-zinc-400">
          Concept. Collecte au {maj} : {traitees} sociétés traitées, {avecRachats} avec au moins un rachat publié.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {DESIGNS.map((d) => (
            <button key={d.id} onClick={() => setDesign(d.id)} className={`rounded-xl border p-3 text-left ${design === d.id ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}>
              <div className="text-[13.5px] font-semibold">{d.id}. {d.titre}</div>
              <div className="mt-1 text-[11.5px] leading-snug text-zinc-400">{d.parti}</div>
            </button>
          ))}
        </div>

        {design !== "C" && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {avec.slice(0, 16).map((x) => (
              <button key={x.ticker} onClick={() => setTicker(x.ticker)} className={`rounded-md border px-2 py-0.5 font-mono text-[11.5px] ${x.ticker === s?.ticker ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-zinc-400 hover:text-zinc-100"}`}>
                {x.ticker}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          {!s ? (
            <p className="text-zinc-400">Aucune donnée pour l'instant.</p>
          ) : design === "A" ? (
            <BlocFrise s={s} />
          ) : design === "B" ? (
            <BlocListe s={s} />
          ) : (
            <Classement societes={societes} />
          )}
        </div>
      </div>
    </div>
  );
}
