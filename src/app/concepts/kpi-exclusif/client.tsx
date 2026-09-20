"use client";

import { TICKERS_EXCLUSIFS } from "@/components/bandeau-exclusif";

/**
 * Yann 21 sept 2026 : les maquettes precedentes montraient un faux en tete, donc
 * elles ne prouvaient rien. Le bandeau est desormais pose dans le vrai composant
 * de page societe et s affiche sur demande par le parametre « bandeau ».
 * Cette page ne sert plus qu a donner les liens de comparaison.
 * Le nombre d indicateurs n est jamais affiche.
 */

const VARIANTES: { id: "A" | "B" | "C" | "D"; titre: string; sous: string }[] = [
  { id: "A", titre: "Ligne encadrée", sous: "Un bloc posé au dessus du nom, note en dessous" },
  { id: "B", titre: "Pastille seule", sous: "Aucune hauteur perdue, la note suit sur la même ligne" },
  { id: "C", titre: "Bloc en dégradé", sous: "Le plus visible, formulation commerciale" },
  { id: "D", titre: "Ruban pleine largeur", sous: "Deux lignes, hauteur minimale" },
];

const NOMS: Record<string, string> = {
  NFLX: "Netflix",
  AAPL: "Apple",
  PLTR: "Palantir",
  "MC.PA": "LVMH",
  "RMS.PA": "Hermès",
  "TTE.PA": "TotalEnergies",
};

export function KpiExclusifClient() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight">Bandeau « introuvable ailleurs »</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-zinc-400">
          Quatre intégrations, posées dans la vraie page société. Cliquez, jugez sur pièce, dites moi la lettre :
          je la fixe et le bandeau apparaît sans paramètre. Le nombre d’indicateurs n’est jamais affiché.
        </p>

        <div className="mt-8 space-y-6">
          {VARIANTES.map((v) => (
            <section key={v.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-violet-300">{v.id}</span>
                <span className="text-[15px] font-semibold text-zinc-100">{v.titre}</span>
                <span className="text-[12.5px] text-zinc-500">{v.sous}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {TICKERS_EXCLUSIFS.map((t) => (
                  <a
                    key={t}
                    href={`/${t.toLowerCase()}?bandeau=${v.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/10 px-3 py-1 text-[12.5px] text-zinc-300 hover:border-violet-400/50 hover:text-violet-100"
                  >
                    {NOMS[t] ?? t}
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-[12.5px] text-zinc-500">
          Sociétés concernées : {TICKERS_EXCLUSIFS.map((t) => NOMS[t] ?? t).join(", ")}. La liste se modifie dans le
          composant du bandeau.
        </p>
      </main>
    </div>
  );
}
