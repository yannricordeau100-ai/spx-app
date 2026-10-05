"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { SocieteCT } from "../data";
import { Coquille, Courbe, Filtres, PuceYoy, Valeur, useAuto, useFleches, useStories } from "../shared";

function Carrousel({ s }: { s: SocieteCT }) {
  const f = useStories(s.stories);
  const [i, setI] = useState(0);
  const n = f.liste.length;
  const idx = Math.min(i, Math.max(0, n - 1));
  const prec = () => setI((idx - 1 + n) % n);
  const suiv = () => setI((idx + 1) % n);
  const auto = useAuto(n > 2, idx, 9000, suiv);
  useFleches(prec, suiv);
  useEffect(() => { setI(0); }, [f.famille, f.ordre, f.vedette]);
  if (!n) return null;
  const decalage = (k: number) => {
    let d = k - idx;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };
  return (
    <div>
      <div className="mb-4"><Filtres f={f} total={s.stories.length} /></div>
      <div className="relative h-[560px] overflow-hidden" onMouseEnter={() => auto.setSurvol(true)} onMouseLeave={() => auto.setSurvol(false)}>
        {f.liste.map((st, k) => {
          const d = decalage(k);
          if (Math.abs(d) > 2) return null;
          const centre = d === 0;
          return (
            <div
              key={st.id}
              onClick={() => !centre && setI(k)}
              className={`absolute left-1/2 top-1/2 w-[470px] rounded-3xl border bg-gradient-to-br from-[#101015] to-[#07070a] p-7 transition-all duration-500 ease-out ${centre ? "border-white/25" : "cursor-pointer border-white/[0.07]"}`}
              style={{
                transform: `translate(calc(-50% + ${d * 500}px), -50%) scale(${centre ? 1 : 0.82})`,
                opacity: Math.abs(d) === 2 ? 0 : centre ? 1 : 0.4,
                zIndex: 10 - Math.abs(d),
                boxShadow: centre ? `0 30px 80px -30px ${s.accent}88, inset 0 0 100px ${s.accent}16` : undefined,
                pointerEvents: Math.abs(d) === 2 ? "none" : undefined,
                filter: centre ? undefined : "saturate(0.6)",
              }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: s.accent }}>{st.familleLabel}{st.periode ? `  ·  ${st.periode}` : ""}</div>
              <h3 className="mt-1 line-clamp-2 font-display text-[22px] font-bold leading-tight text-zinc-50">{st.titre}</h3>
              <div className="mt-4 flex flex-wrap items-center gap-3"><Valeur s={st} accent={s.accent} taille={centre ? 60 : 48} /><PuceYoy s={st} /></div>
              {st.serie.length > 1 && <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"><Courbe serie={st.serie} accent={s.accent} hauteur={centre ? 130 : 110} unite={st.unite} /></div>}
              {st.signal && <p className={`mt-3 text-[13.5px] leading-relaxed text-zinc-300 ${centre ? "line-clamp-5" : "line-clamp-3"}`}>{st.signal}</p>}
            </div>
          );
        })}
        <button type="button" onClick={prec} aria-label="Précédente" className="absolute left-2 top-1/2 z-20 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur hover:scale-110 hover:border-white/30"><ChevronLeft className="size-6" /></button>
        <button type="button" onClick={suiv} aria-label="Suivante" className="absolute right-2 top-1/2 z-20 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur hover:scale-110 hover:border-white/30"><ChevronRight className="size-6" /></button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4">
        <button type="button" onClick={() => auto.setPause(!auto.pause)} aria-label={auto.pause ? "Reprendre" : "Pause"} className="rounded-full border border-white/10 p-2 text-zinc-300 hover:text-white">
          {auto.pause ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
        <div className="flex max-w-[600px] flex-wrap justify-center gap-1.5">
          {f.liste.map((st, k) => (
            <button key={st.id} type="button" onClick={() => setI(k)} aria-label={st.titre} className={`h-1.5 rounded-full transition-all ${k === idx ? "w-6" : "w-1.5 bg-zinc-600 hover:bg-zinc-400"}`} style={k === idx ? { background: s.accent, boxShadow: `0 0 6px ${s.accent}` } : undefined} />
          ))}
        </div>
        <span className="font-mono text-[12px] text-zinc-500">{idx + 1} / {n}</span>
      </div>
    </div>
  );
}

export function CarrouselClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={6}
      titre="Carrousel à focus central"
      explication="Le bloc actuel garde ses trois cartes côte à côte, mais la carte du milieu est agrandie et complète pendant que les deux voisines s'estompent. Un clic sur une voisine la ramène au centre, avec glissement animé ; lecture automatique, pause et points de navigation conservés."
      forts={["Garde l'esprit carrousel du bloc actuel : peu de changement pour l'habitude", "Focus clair : une story lue en grand, deux autres en perspective", "Animation de glissement, clic sur les voisines, flèches du clavier", "Pause, reprise et lecture automatique conservées"]}
      limites={["Texte coupé sur les cartes voisines (affiché en entier au centre)", "Beaucoup de points de navigation si 50 stories", "Moins dense que le mur ou la frise"]}
      societes={societes}
    >
      {(s) => <Carrousel key={s.ticker} s={s} />}
    </Coquille>
  );
}
