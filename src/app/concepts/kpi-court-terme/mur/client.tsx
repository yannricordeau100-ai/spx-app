"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { SocieteCT } from "../data";
import { Coquille, Courbe, Detail, Filtres, PuceYoy, Valeur, useFleches, useStories } from "../shared";

function Mur({ s }: { s: SocieteCT }) {
  const f = useStories(s.stories);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const n = f.liste.length;
  const prec = () => setOuvert((o) => (o === null ? o : (o - 1 + n) % n));
  const suiv = () => setOuvert((o) => (o === null ? o : (o + 1) % n));
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useFleches(() => { if (ouvert !== null) prec(); }, () => { if (ouvert !== null) suiv(); });
  const cur = ouvert !== null ? f.liste[ouvert] : null;
  return (
    <div className="grid grid-cols-[250px_1fr] gap-6">
      <aside className="self-start lg:sticky lg:top-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{n} stories affichées</div>
        <Filtres f={f} total={s.stories.length} vertical />
      </aside>
      <div className="columns-2 gap-4 xl:columns-3">
        {f.liste.map((st, i) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setOuvert(i)}
            className="group mb-4 block w-full break-inside-avoid rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#101015] to-[#07070a] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/20"
            style={{ boxShadow: `inset 0 0 60px ${s.accent}12` }}
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: s.accent }}>{st.familleLabel}</div>
            <div className="mt-1 text-[15px] font-semibold leading-snug text-zinc-100">{st.titre}</div>
            {st.periode && <div className="text-[11.5px] text-zinc-500">{st.periode}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Valeur s={st} accent={s.accent} taille={34} />
              <PuceYoy s={st} />
            </div>
            {st.serie.length > 1 && <div className="mt-2"><Courbe serie={st.serie} accent={s.accent} hauteur={90} unite={st.unite} /></div>}
            {st.signal && <p className="mt-2 line-clamp-3 text-[12.5px] leading-snug text-zinc-400">{st.signal}</p>}
          </button>
        ))}
      </div>

      {cur && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-8 backdrop-blur-sm" onClick={() => setOuvert(null)}>
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0a0a0e] p-8" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOuvert(null)} aria-label="Fermer" className="absolute right-4 top-4 rounded-full border border-white/10 p-2 text-zinc-400 hover:text-white"><X className="size-4" /></button>
            <Detail s={cur} accent={s.accent} grand />
            <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[12px] text-zinc-500">
              <button type="button" onClick={prec} className="inline-flex items-center gap-1 hover:text-white"><ChevronLeft className="size-4" />Précédente</button>
              <span className="font-mono">{(ouvert ?? 0) + 1} / {n}</span>
              <button type="button" onClick={suiv} className="inline-flex items-center gap-1 hover:text-white">Suivante<ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MurClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={1}
      titre="Mur de cartes éditoriales"
      explication="Toutes les stories à plat, en grille, comme la une d'un journal : on balaie du regard au lieu d'attendre la rotation. Les filtres de famille, le tri et le mode vedette passent dans une colonne à gauche ; un clic ouvre la story en grand avec ses flèches."
      forts={["Vue d'ensemble immédiate : 40 stories se parcourent sans aucune attente", "Filtres toujours visibles, nombre de stories par famille lisible", "La souris sert : survol, clic, flèches du clavier dans la vue agrandie", "Aucune pause à gérer, rien ne bouge sans action"]}
      limites={["Perd l'effet de découverte automatique des stories", "Plus dense : demande une grille bien aérée sur 40 à 70 stories", "Les cartes ont des hauteurs inégales (mise en colonnes)"]}
      societes={societes}
    >
      {(s) => <Mur key={s.ticker} s={s} />}
    </Coquille>
  );
}
