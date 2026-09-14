"use client";

/**
 * Onglet MarketBeat de la logothèque (14 sept 2026).
 *
 * Liste TOUTES les sociétés de l'univers : logo actuellement affiché sur le
 * site, logo récupéré sur MarketBeat, et statut de remplacement. Les données
 * viennent d'un import JSON côté serveur (page.tsx), donc à jour à chaque
 * déploiement.
 */

import { useMemo, useState } from "react";

export type LigneMarketBeat = {
  ticker: string;
  safe: string;
  nom: string;
  nonUs: boolean;
  recupere: boolean;
  fichier: string;
  nomMarketBeat: string;
  remplace: boolean;
  aVerifier: boolean;
  erreur: string;
};

type Filtre = "toutes" | "non-us" | "us" | "manquants" | "remplaces" | "a-verifier";

const FILTRES: { id: Filtre; label: string }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "non-us", label: "Non américaines" },
  { id: "us", label: "Américaines" },
  { id: "manquants", label: "Non récupérés" },
  { id: "remplaces", label: "Remplacés" },
  { id: "a-verifier", label: "Images à vérifier" },
];

function pourcent(n: number, total: number) {
  if (!total) return "0 %";
  return `${Math.round((n / total) * 1000) / 10} %`.replace(".", ",");
}

export function OngletMarketBeat({ lignes }: { lignes: LigneMarketBeat[] }) {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [recherche, setRecherche] = useState("");

  const total = lignes.length;
  const nbRecuperes = lignes.filter((l) => l.recupere).length;
  const nbRemplaces = lignes.filter((l) => l.remplace).length;

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter((l) => {
      if (filtre === "non-us" && !l.nonUs) return false;
      if (filtre === "us" && l.nonUs) return false;
      if (filtre === "manquants" && l.recupere) return false;
      if (filtre === "remplaces" && !l.remplace) return false;
      if (filtre === "a-verifier" && !l.aVerifier) return false;
      if (q && !l.ticker.toLowerCase().includes(q) && !l.nom.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [lignes, filtre, recherche]);

  return (
    <section className="mt-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Logos récupérés sur MarketBeat
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {pourcent(nbRecuperes, total)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {nbRecuperes} sur {total} sociétés
          </p>
        </div>
        <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Logos remplacés sur les pages
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {pourcent(nbRemplaces, total)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {nbRemplaces} sur {total} sociétés
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTRES.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltre(f.id)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filtre === f.id
                ? "border-purple-500 bg-purple-500/15 text-purple-200"
                : "border-[#262626] bg-[#0a0a0a] text-zinc-400 hover:border-[#3a3a3a]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un ticker ou un nom"
          className="ml-auto w-56 rounded-full border border-[#262626] bg-[#0a0a0a] px-3 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-purple-500/60 focus:outline-none"
        />
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {visibles.length} société(s) affichée(s). Le logo MarketBeat n&apos;est
        posé sur les pages que lorsque le nom de la société a été vérifié et que
        l&apos;image correspond bien à cette société.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#262626]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#0f0f0f] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Ticker</th>
              <th className="px-4 py-2 font-medium">Société</th>
              <th className="px-4 py-2 font-medium">Logo actuel</th>
              <th className="px-4 py-2 font-medium">Logo MarketBeat</th>
              <th className="px-4 py-2 font-medium">Remplacé</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr key={l.ticker} className="border-t border-[#1c1c1c] align-middle">
                <td className="px-4 py-2 font-mono text-xs text-zinc-300">{l.ticker}</td>
                <td className="px-4 py-2 text-zinc-200">
                  {l.nom}
                  {l.nomMarketBeat && l.nomMarketBeat !== l.nom && (
                    <span className="block text-[10px] text-zinc-600">
                      MarketBeat : {l.nomMarketBeat}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className="flex h-10 w-24 items-center justify-center rounded border border-[#1c1c1c] bg-[#111] p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/logos/${l.safe}.png`}
                      alt={`Logo actuel ${l.ticker}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </span>
                </td>
                <td className="px-4 py-2">
                  {l.recupere ? (
                    <span className="flex h-10 w-24 items-center justify-center rounded border border-[#1c1c1c] bg-[#111] p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={l.fichier}
                        alt={`Logo MarketBeat ${l.ticker}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </span>
                  ) : (
                    <span
                      className="text-xs text-zinc-600"
                      title={l.erreur || undefined}
                    >
                      non récupéré
                    </span>
                  )}
                  {l.recupere && l.aVerifier && (
                    <span
                      className="mt-1 block text-[10px] text-amber-400"
                      title={l.erreur || undefined}
                    >
                      image à vérifier
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      l.remplace
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-[#2a2a2a] text-zinc-500"
                    }`}
                  >
                    {l.remplace ? "oui" : "non"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
