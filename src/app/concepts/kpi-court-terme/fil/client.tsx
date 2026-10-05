"use client";

import { useState } from "react";
import type { SocieteCT, StoryCT } from "../data";
import { Coquille, Courbe, PuceYoy, Valeur, useStories } from "../shared";

function Post({ st, accent }: { st: StoryCT; accent: string }) {
  const [plus, setPlus] = useState(false);
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#101015] to-[#07070a] p-6" style={{ boxShadow: `inset 0 0 70px ${accent}10` }}>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider" style={{ color: accent, borderColor: `${accent}55`, background: `${accent}14` }}>{st.familleLabel}</span>
        {st.periode && <span className="text-zinc-500">{st.periode}</span>}
      </div>
      <div className="mt-3 grid grid-cols-[230px_1fr] gap-6">
        <div>
          <Valeur s={st} accent={accent} taille={44} />
          <div className="mt-2"><PuceYoy s={st} /></div>
        </div>
        <div>
          <h3 className="text-[18px] font-semibold leading-snug text-zinc-50">{st.titre}</h3>
          {st.signal && <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-300">{st.signal}</p>}
        </div>
      </div>
      {st.serie.length > 1 && <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><Courbe serie={st.serie} accent={accent} hauteur={130} unite={st.unite} /></div>}
      {(st.description || st.explication) && (
        <div className="mt-3">
          <button type="button" onClick={() => setPlus(!plus)} className="text-[12.5px] font-medium text-violet-300 hover:text-violet-200">{plus ? "Réduire" : "Lire la suite"}</button>
          {plus && <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">{[st.description, st.explication].filter(Boolean).join(" ")}</p>}
        </div>
      )}
    </article>
  );
}

function Fil({ s }: { s: SocieteCT }) {
  const f = useStories(s.stories);
  const groupes: { cle: string; items: StoryCT[] }[] = [];
  for (const st of f.liste) {
    const cle = st.periode ?? "Date non précisée";
    const g = groupes.find((x) => x.cle === cle);
    if (g) g.items.push(st); else groupes.push({ cle, items: [st] });
  }
  return (
    <div className="grid grid-cols-[1fr_260px] gap-8">
      <div className="mx-auto w-full max-w-[760px] space-y-8">
        {groupes.map((g) => (
          <section key={g.cle}>
            <div className="sticky top-0 z-10 -mx-1 mb-3 bg-[#050507]/90 px-1 py-2 backdrop-blur">
              <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-400">{g.cle}</span>
              <span className="ml-2 font-mono text-[11px] text-zinc-600">{g.items.length}</span>
            </div>
            <div className="space-y-4">{g.items.map((st) => <Post key={st.id} st={st} accent={s.accent} />)}</div>
          </section>
        ))}
      </div>
      <aside className="self-start lg:sticky lg:top-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Sommaire</div>
          <div className="space-y-0.5">
            <button type="button" onClick={() => f.setFamille("toutes")} className={`flex w-full justify-between rounded-lg px-2.5 py-1.5 text-[13px] ${f.famille === "toutes" ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400 hover:text-zinc-100"}`}>Toutes<span className="font-mono text-[11px] text-zinc-500">{s.stories.length}</span></button>
            {f.familles.map((x) => (
              <button key={x.key} type="button" onClick={() => f.setFamille(x.key)} className={`flex w-full justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] ${f.famille === x.key ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400 hover:text-zinc-100"}`}>{x.label}<span className="ml-2 font-mono text-[11px] text-zinc-500">{x.n}</span></button>
            ))}
          </div>
          <div className="mt-4 flex gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
            <button type="button" onClick={() => f.setOrdre("recent")} className={`flex-1 rounded-full py-1 text-[12px] ${f.ordre === "recent" ? "bg-white/[0.09] text-zinc-50" : "text-zinc-400"}`}>Récentes</button>
            <button type="button" onClick={() => f.setOrdre("ancien")} className={`flex-1 rounded-full py-1 text-[12px] ${f.ordre === "ancien" ? "bg-white/[0.09] text-zinc-50" : "text-zinc-400"}`}>Anciennes</button>
          </div>
          <button type="button" onClick={() => f.setVedette(!f.vedette)} className={`mt-2 w-full rounded-full border py-1.5 text-[12px] ${f.vedette ? "border-violet-400/50 bg-violet-500/15 text-violet-100" : "border-[#1f1f1f] text-zinc-400"}`}>Une vedette par famille</button>
        </div>
      </aside>
    </div>
  );
}

export function FilClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={4}
      titre="Fil d'actualité"
      explication="Les stories deviennent des publications dans un fil vertical daté, regroupées par trimestre. Chaque post met le chiffre et la phrase de lecture côte à côte, le graphique dessous, et « Lire la suite » déroule le détail. Le sommaire collant à droite porte les filtres."
      forts={["Se lit à la molette, geste naturel sur ordinateur", "Regroupement par trimestre : on voit ce qui est tombé à chaque publication", "Texte complet et graphique sans clic dans chaque post", "Sommaire collant : filtres et tri toujours à portée"]}
      limites={["Fil long avec 40 stories ou plus : demande les filtres pour aller vite", "Une seule colonne de lecture, moins de vue d'ensemble que le mur", "Pas de lecture automatique"]}
      societes={societes}
    >
      {(s) => <Fil key={s.ticker} s={s} />}
    </Coquille>
  );
}
