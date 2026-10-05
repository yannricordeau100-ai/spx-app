"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SocieteCT } from "../data";
import { Coquille, Courbe, Detail, Filtres, PuceYoy, Valeur, useStories } from "../shared";

function Frise({ s }: { s: SocieteCT }) {
  const f = useStories(s.stories);
  const [fixe, setFixe] = useState(0);
  const [survol, setSurvol] = useState<number | null>(null);
  const bande = useRef<HTMLDivElement>(null);
  const n = f.liste.length;
  const a = survol ?? Math.min(fixe, Math.max(0, n - 1));
  const cur = f.liste[a];
  const defile = (dir: number) => bande.current?.scrollBy({ left: dir * 640, behavior: "smooth" });
  if (!cur) return null;
  return (
    <div>
      <div className="mb-4"><Filtres f={f} total={s.stories.length} /></div>
      <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#101015] to-[#07070a] p-8" style={{ boxShadow: `inset 0 0 120px ${s.accent}14` }}>
        <div className="grid grid-cols-[1fr_1.1fr] gap-10">
          <div key={cur.id}>
            <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: s.accent }}>{cur.familleLabel}</div>
            <h3 className="mt-1 font-display text-[28px] font-bold leading-tight text-zinc-50">{cur.titre}</h3>
            {cur.periode && <div className="mt-1 text-[13px] text-zinc-400">{cur.periode}</div>}
            <div className="mt-5 flex flex-wrap items-center gap-3"><Valeur s={cur} accent={s.accent} taille={72} /><PuceYoy s={cur} /></div>
            {cur.signal && <p className="mt-5 text-[16px] leading-relaxed text-zinc-200">{cur.signal}</p>}
            {cur.description && <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-500">{cur.description}</p>}
          </div>
          <div className="flex items-center">
            {cur.serie.length > 1 ? (
              <div className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><Courbe serie={cur.serie} accent={s.accent} hauteur={260} unite={cur.unite} /></div>
            ) : (
              <div className="w-full rounded-xl border border-dashed border-white/10 p-8 text-center text-[13px] text-zinc-500">Valeur publiée une seule fois : pas de courbe à tracer.</div>
            )}
          </div>
        </div>
      </div>

      <div className="relative mt-5">
        <button type="button" onClick={() => defile(-1)} aria-label="Précédent" className="absolute -left-4 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-zinc-200 backdrop-blur hover:border-white/30"><ChevronLeft className="size-5" /></button>
        <button type="button" onClick={() => defile(1)} aria-label="Suivant" className="absolute -right-4 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-zinc-200 backdrop-blur hover:border-white/30"><ChevronRight className="size-5" /></button>
        <div ref={bande} className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]" onMouseLeave={() => setSurvol(null)}>
          {f.liste.map((st, k) => (
            <button
              key={st.id}
              type="button"
              onMouseEnter={() => setSurvol(k)}
              onClick={() => setFixe(k)}
              className={`w-[210px] shrink-0 rounded-2xl border p-3.5 text-left transition-all ${k === a ? "-translate-y-1 border-white/40 bg-white/[0.07]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"} ${k === fixe ? "ring-1" : ""}`}
              style={k === fixe ? { boxShadow: `0 0 0 1px ${s.accent}` } : undefined}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{st.periode ?? st.familleLabel}</div>
              <div className="mt-1 line-clamp-2 min-h-[34px] text-[12.5px] font-semibold leading-snug text-zinc-200">{st.titre}</div>
              <div className="mt-2 font-display text-[22px] font-bold tabular-nums text-zinc-50">{st.valeur}<span className="ml-1 text-[11px] font-medium text-zinc-500">{st.unite}</span></div>
              <div className="mt-1 h-10">{st.serie.length > 1 ? <Courbe serie={st.serie.map((p) => ({ ...p, q: "" }))} accent={s.accent} hauteur={40} /> : <PuceYoy s={st} />}</div>
            </button>
          ))}
        </div>
        <div className="mt-1 text-[11.5px] text-zinc-600">Survoler une vignette affiche l'aperçu, cliquer la fixe. Molette ou flèches pour faire défiler.</div>
      </div>
    </div>
  );
}

export function FriseClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={3}
      titre="Frise défilante avec aperçu"
      explication="Une bande de vignettes à parcourir comme une pellicule, sous un grand panneau d'aperçu. Le survol de la souris change l'aperçu instantanément, le clic fixe la story ; chaque vignette porte déjà son chiffre et sa mini courbe."
      forts={["Le survol remplace l'attente : tout se lit à la vitesse de la souris", "Chiffre et tendance visibles sur chaque vignette avant même d'ouvrir", "Grand panneau avec texte complet et graphique large", "Se prête bien à 50 stories : la frise défile, la page ne s'allonge pas"]}
      limites={["Nécessite une souris : le survol n'a pas d'équivalent au toucher (sans importance sur ordinateur)", "Peu de stories visibles en même temps (5 à 6 vignettes)", "Pas de lecture automatique"]}
      societes={societes}
    >
      {(s) => <Frise key={s.ticker} s={s} />}
    </Coquille>
  );
}
