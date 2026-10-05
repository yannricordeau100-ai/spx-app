"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { SocieteCT } from "../data";
import { Coquille, Courbe, Filtres, PuceYoy, Valeur, useAuto, useFleches, useStories } from "../shared";

function Diaporama({ s }: { s: SocieteCT }) {
  const f = useStories(s.stories);
  const [i, setI] = useState(0);
  const n = f.liste.length;
  const idx = Math.min(i, Math.max(0, n - 1));
  const cur = f.liste[idx];
  const prec = () => setI((idx - 1 + n) % n);
  const suiv = () => setI((idx + 1) % n);
  const auto = useAuto(n > 1, idx, 8000, suiv);
  useFleches(prec, suiv);
  useEffect(() => { setI(0); }, [f.famille, f.ordre, f.vedette]);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rail.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [idx]);
  if (!cur) return null;
  return (
    <div>
      <div className="mb-4"><Filtres f={f} total={s.stories.length} /></div>
      <div
        className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608]"
        style={{ boxShadow: `0 30px 80px -30px ${s.accent}66, inset 0 0 140px ${s.accent}18` }}
        onMouseEnter={() => auto.setSurvol(true)}
        onMouseLeave={() => auto.setSurvol(false)}
      >
        <div className="absolute inset-x-6 top-4 z-10 h-[3px] overflow-hidden rounded-full bg-white/15">
          {!auto.pause && <div key={`${cur.id}-${idx}`} className="h-full bg-white" style={{ width: "0%", animation: "story-progress 8s linear forwards", animationPlayState: auto.survol ? "paused" : "running" }} />}
        </div>
        <div className="absolute right-6 top-8 z-10 flex items-center gap-3 text-[12px] text-zinc-400">
          <span className="font-mono">{idx + 1} / {n}</span>
          <button type="button" onClick={() => auto.setPause(!auto.pause)} aria-label={auto.pause ? "Reprendre" : "Pause"} className="rounded-full border border-white/15 bg-black/40 p-2 text-white hover:bg-black/60">
            {auto.pause ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        </div>
        <button type="button" onClick={prec} aria-label="Précédente" className="absolute inset-y-0 left-0 z-10 flex w-16 items-center justify-center text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white"><ChevronLeft className="size-7" /></button>
        <button type="button" onClick={suiv} aria-label="Suivante" className="absolute inset-y-0 right-0 z-10 flex w-16 items-center justify-center text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white"><ChevronRight className="size-7" /></button>

        <div key={cur.id} className="grid min-h-[470px] grid-cols-2 items-center gap-12 px-24 pb-10 pt-16">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: s.accent }}>{cur.familleLabel}{cur.periode ? `  ·  ${cur.periode}` : ""}</div>
            <h3 className="mt-2 font-display text-[30px] font-bold leading-tight text-zinc-50">{cur.titre}</h3>
            <div className="mt-6 flex flex-wrap items-center gap-3"><Valeur s={cur} accent={s.accent} taille={92} /><PuceYoy s={cur} /></div>
            {cur.signal && <p className="mt-6 text-[17px] leading-relaxed text-zinc-200">{cur.signal}</p>}
          </div>
          <div>
            {cur.serie.length > 1 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4"><Courbe serie={cur.serie} accent={s.accent} hauteur={250} unite={cur.unite} /></div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-[13px] text-zinc-500">Valeur publiée une seule fois : pas de courbe à tracer.</div>
            )}
            {cur.description && <p className="mt-5 text-[13.5px] leading-relaxed text-zinc-400">{cur.description}</p>}
          </div>
        </div>
      </div>

      <div ref={rail} className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {f.liste.map((st, k) => (
          <button key={st.id} type="button" onClick={() => setI(k)} title={st.titre}
            className={`w-[150px] shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${k === idx ? "border-white/40 bg-white/[0.08]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"}`}>
            <div className="truncate text-[11px] text-zinc-400">{st.titre}</div>
            <div className="font-mono text-[14px] tabular-nums text-zinc-100">{st.valeur} <span className="text-[10px] text-zinc-500">{st.unite}</span></div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DiaporamaClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={5}
      titre="Diaporama plein bloc"
      explication="Une seule grande diapositive horizontale occupe toute la largeur du bloc : chiffre géant et phrase de lecture à gauche, graphique et détail à droite. C'est l'esprit des stories (progression, pause, reprise, flèches) mais en paysage, avec une rangée de vignettes pour sauter."
      forts={["Le plus proche du bloc actuel : mêmes réflexes, mais format paysage", "Chiffre énorme et graphique large lus d'un coup d'œil", "Pause et reprise, barre de progression, flèches gauche et droite du clavier", "Rangée de vignettes : on voit toutes les stories sans lancer la rotation"]}
      limites={["Une seule story à l'écran à la fois", "Le bloc devient plus haut que les trois cartes actuelles côte à côte", "La rotation automatique peut gêner quelqu'un qui lit : d'où la pause au survol"]}
      societes={societes}
    >
      {(s) => <Diaporama key={s.ticker} s={s} />}
    </Coquille>
  );
}
