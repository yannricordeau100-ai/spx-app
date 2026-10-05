"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { SocieteCT } from "../data";
import { Coquille, Detail, Filtres, PuceYoy, useAuto, useFleches, useStories, valeurAffichee } from "../shared";

function Lecteur({ s }: { s: SocieteCT }) {
  const f = useStories(s.stories);
  const [i, setI] = useState(0);
  const n = f.liste.length;
  const idx = Math.min(i, Math.max(0, n - 1));
  const cur = f.liste[idx];
  const prec = () => setI((idx - 1 + n) % n);
  const suiv = () => setI((idx + 1) % n);
  const auto = useAuto(n > 1, idx, 10000, suiv);
  useFleches(prec, suiv, "y");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { refs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [idx]);
  useEffect(() => { setI(0); }, [f.famille, f.ordre, f.vedette]);
  if (!cur) return null;
  return (
    <div>
      <div className="mb-4"><Filtres f={f} total={s.stories.length} /></div>
      <div className="grid grid-cols-[340px_1fr] gap-5" onMouseEnter={() => auto.setSurvol(true)} onMouseLeave={() => auto.setSurvol(false)}>
        <div className="max-h-[680px] overflow-y-auto rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1.5 [scrollbar-width:thin]">
          {f.liste.map((st, k) => (
            <button
              key={st.id}
              ref={(el) => { refs.current[k] = el; }}
              type="button"
              onClick={() => setI(k)}
              className={`relative block w-full rounded-xl px-3.5 py-3 text-left transition-colors ${k === idx ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
            >
              {k === idx && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full" style={{ background: s.accent }} />}
              <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-zinc-100">{st.titre}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[12.5px] tabular-nums text-zinc-300">{valeurAffichee(st)} <span className="text-zinc-500">{st.unite}</span></span>
                <PuceYoy s={st} />
              </div>
              {st.periode && <div className="mt-0.5 text-[11px] text-zinc-600">{st.periode}</div>}
            </button>
          ))}
        </div>
        <div className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#101015] to-[#07070a] p-8" style={{ boxShadow: `inset 0 0 120px ${s.accent}14` }}>
          {n > 1 && !auto.pause && (
            <div className="absolute inset-x-0 top-0 h-[3px] overflow-hidden rounded-t-3xl bg-white/10">
              <div key={`${cur.id}-${auto.survol}`} className="h-full bg-white" style={{ width: "0%", animation: "story-progress 10s linear forwards", animationPlayState: auto.survol ? "paused" : "running" }} />
            </div>
          )}
          <div className="absolute right-5 top-5 flex items-center gap-2 text-[12px] text-zinc-500">
            <span className="font-mono">{idx + 1} / {n}</span>
            <button type="button" onClick={() => auto.setPause(!auto.pause)} aria-label={auto.pause ? "Reprendre" : "Pause"} className="rounded-full border border-white/10 p-1.5 hover:text-white">
              {auto.pause ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            </button>
          </div>
          <Detail key={cur.id} s={cur} accent={s.accent} grand />
          <div className="mt-6 text-[11.5px] text-zinc-600">Flèches haut et bas du clavier pour passer d'une story à l'autre.</div>
        </div>
      </div>
    </div>
  );
}

export function LecteurClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={2}
      titre="Lecteur à deux panneaux"
      explication="Le réflexe d'une messagerie : la liste de toutes les stories à gauche (titre, chiffre, variation), le détail complet à droite (grand chiffre, graphique interactif, texte). Lecture automatique avec pause et reprise conservée, flèches du clavier."
      forts={["La liste joue le rôle de sommaire permanent : on sait où l'on est", "Détail très large : graphique agrandi et texte sans coupe", "Garde la lecture automatique avec pause, reprise et barre de progression", "Navigation au clavier, à la souris ou en lecture seule"]}
      limites={["Un seul détail à la fois, moins de comparaison visuelle que le mur", "La liste scrolle quand il y a 40 stories ou plus", "Deux colonnes : demande au moins 1100 px de large"]}
      societes={societes}
    >
      {(s) => <Lecteur key={s.ticker} s={s} />}
    </Coquille>
  );
}
