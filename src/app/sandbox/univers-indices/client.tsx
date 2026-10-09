"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type Ligne = {
  ticker: string;
  mettrik: string | null;
  nom: string;
  enLigne: boolean;
  docs: Record<string, number> | null;
  secteur?: string | null;
  radiee?: boolean;
  edgarFini?: boolean;
};
export type Onglet = { cle: string; nom: string; pays: string; source: string; lignes: Ligne[] };

const ORDRE = ["10K", "10Q", "8K", "DEF14A", "ER", "ES", "EP", "20F", "40F", "6K", "S1", "S4", "xbrl", "transcripts", "ir"];
const LIBELLE: Record<string, string> = { "10K": "10-K", "10Q": "10-Q", "8K": "8-K", DEF14A: "DEF 14A", ER: "communiqués", ES: "suppléments", EP: "présentations", "20F": "20-F", "40F": "40-F", "6K": "6-K", S1: "S-1", S4: "S-4", xbrl: "XBRL", transcripts: "transcripts", ir: "IR" };

function total(d: Record<string, number> | null) {
  return d ? Object.values(d).reduce((a, b) => a + b, 0) : 0;
}

export function UniversIndicesClient({ onglets, lacPresent }: { onglets: Onglet[]; lacPresent: boolean }) {
  const [actif, setActif] = useState(onglets[0]?.cle ?? "");
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "en_ligne" | "hors_ligne" | "sans_docs">("tous");
  const o = onglets.find((x) => x.cle === actif) ?? onglets[0];

  const lignes = useMemo(() => {
    if (!o) return [];
    const q = recherche.trim().toLowerCase();
    return o.lignes.filter(
      (l) =>
        (!q || l.ticker.toLowerCase().includes(q) || l.nom.toLowerCase().includes(q)) &&
        (filtre === "tous" || (filtre === "en_ligne" && l.enLigne) || (filtre === "hors_ligne" && !l.enLigne) || (filtre === "sans_docs" && total(l.docs) === 0)),
    );
  }, [o, recherche, filtre]);

  if (!o) return null;
  const nEnLigne = o.lignes.filter((l) => l.enLigne).length;
  const nDocs = o.lignes.filter((l) => total(l.docs) > 0).length;
  const sp = o.cle === "sp5001000";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">Univers par indice</h1>
      <p className="mt-1 text-[13px] text-zinc-400">
        Un onglet par indice : nombre de sociétés, présence en ligne sur Mettrik et documents présents dans le lac de données.
        {!lacPresent && " Le lac de données n est pas présent sur ce serveur : la colonne des documents est vide."}
      </p>

      <div className="mt-5 flex flex-wrap gap-2 text-[12.5px]">
        {onglets.map((x) => (
          <button
            key={x.cle}
            onClick={() => setActif(x.cle)}
            className={`rounded-md border px-3 py-1.5 ${x.cle === o.cle ? "border-violet-400/60 bg-violet-500/15 text-violet-100" : "border-white/15 text-zinc-300 hover:bg-white/5"}`}
          >
            {x.nom} <span className="ml-1 font-mono text-zinc-500">{x.lignes.length}</span>
          </button>
        ))}
      </div>

      <section className="mt-6">
        <h2 className="text-[18px] font-semibold">
          {o.nom} <span className="ml-2 font-mono text-[12px] text-zinc-500">{o.pays}</span>
        </h2>
        <p className="mt-1 text-[12px] text-zinc-500">{o.source}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
          <span><span className="font-mono text-zinc-100">{o.lignes.length}</span> sociétés</span>
          <span className="text-emerald-300"><span className="font-mono">{nEnLigne}</span> en ligne</span>
          <span className="text-zinc-400"><span className="font-mono">{o.lignes.length - nEnLigne}</span> hors ligne</span>
          <span className="text-cyan-300"><span className="font-mono">{nDocs}</span> avec documents</span>
          {sp && <span className="text-amber-300"><span className="font-mono">{o.lignes.filter((l) => l.edgarFini).length}</span> téléchargement EDGAR terminé</span>}
          {sp && <span className="text-rose-300"><span className="font-mono">{o.lignes.filter((l) => l.radiee).length}</span> radiées depuis la liste</span>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Ticker ou nom"
            className="w-56 rounded-md border border-white/15 bg-transparent px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-600"
          />
          {(["tous", "en_ligne", "hors_ligne", "sans_docs"] as const).map((f) => (
            <button key={f} onClick={() => setFiltre(f)} className={`rounded-md border px-2.5 py-1.5 ${filtre === f ? "border-white/40 bg-white/10" : "border-white/10 text-zinc-400"}`}>
              {{ tous: "Toutes", en_ligne: "En ligne", hors_ligne: "Hors ligne", sans_docs: "Sans document" }[f]}
            </button>
          ))}
          <span className="text-zinc-500">{lignes.length} affichées</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3">Ticker</th>
                <th className="py-2 pr-3">Nom</th>
                {sp && <th className="py-2 pr-3">Secteur GICS</th>}
                <th className="py-2 pr-3">En ligne</th>
                <th className="py-2 pr-3 text-right">Documents</th>
                <th className="py-2">Détail</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const n = total(l.docs);
                return (
                  <tr key={l.ticker} className="border-b border-white/5 align-top">
                    <td className="py-1.5 pr-3 font-mono">
                      {l.enLigne && l.mettrik ? (
                        <Link href={`/${l.mettrik.toLowerCase()}`} className="text-emerald-200 hover:underline">{l.ticker}</Link>
                      ) : (
                        <span className={l.radiee ? "text-rose-300 line-through" : "text-zinc-300"}>{l.ticker}</span>
                      )}
                      {l.mettrik && l.mettrik !== l.ticker && <span className="ml-1 text-[10.5px] text-zinc-500">({l.mettrik})</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-zinc-200">{l.nom}</td>
                    {sp && <td className="py-1.5 pr-3 text-zinc-400">{l.secteur ?? <span className="text-zinc-600">non renseigné</span>}</td>}
                    <td className="py-1.5 pr-3">
                      {l.enLigne ? <span className="text-emerald-300">oui</span> : <span className="text-zinc-500">{l.radiee ? "radiée" : "non"}</span>}
                    </td>
                    <td className={`py-1.5 pr-3 text-right font-mono ${n ? "text-cyan-200" : "text-zinc-600"}`}>
                      {l.docs === null ? "aucun" : n}
                      {sp && l.edgarFini && <span className="ml-1 text-[10px] text-amber-300" title="Téléchargement EDGAR 10 ans terminé">✓</span>}
                    </td>
                    <td className="py-1.5 text-[11px] text-zinc-500">
                      {l.docs &&
                        ORDRE.filter((k) => l.docs![k])
                          .map((k) => `${LIBELLE[k]} ${l.docs![k]}`)
                          .join(" · ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
