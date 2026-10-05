"use client";

import { useState } from "react";
import type { KpiCT, SocieteCT } from "../data";
import { Coquille, Pastille, fmtVal, fmtYoy, yoyDernier, couleurYoy, moyenne, VIOLET, ROUGE, VERT } from "../shared";

function Spark({ k }: { k: KpiCT }) {
  const [h, setH] = useState<number | null>(null);
  const W = 300, H = 92, PX = 6, PY = 10;
  const vs = k.serie.map((p) => p.v);
  const hist = vs.slice(0, -1);
  const mean = moyenne(hist);
  const sd = Math.sqrt(moyenne(hist.map((v) => (v - mean) ** 2)));
  const lo = Math.min(...vs, mean - sd), hi = Math.max(...vs, mean + sd);
  const x = (i: number) => PX + (i * (W - 2 * PX)) / (vs.length - 1);
  const y = (v: number) => H - PY - ((v - lo) / (hi - lo || 1)) * (H - 2 * PY);
  const dernier = vs[vs.length - 1];
  const dehors = dernier > mean + sd || dernier < mean - sd;
  const path = vs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const sel = h ?? vs.length - 1;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setH(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width * W - PX) / ((W - 2 * PX) / (vs.length - 1)));
          setH(Math.max(0, Math.min(vs.length - 1, i)));
        }}>
        <rect x={PX} y={y(mean + sd)} width={W - 2 * PX} height={Math.max(2, y(mean - sd) - y(mean + sd))} fill={VIOLET} opacity="0.10" rx="3" />
        <line x1={PX} x2={W - PX} y1={y(mean)} y2={y(mean)} stroke={VIOLET} strokeOpacity="0.45" strokeDasharray="3 4" />
        <path d={path} fill="none" stroke="#e4e4e7" strokeWidth="1.6" strokeLinejoin="round" />
        {vs.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === sel ? 4 : i === vs.length - 1 ? 3.2 : 1.8} fill={i === vs.length - 1 && dehors ? ROUGE : i === sel ? "#fff" : "#a1a1aa"} />
        ))}
        {h !== null && <line x1={x(h)} x2={x(h)} y1={4} y2={H - 4} stroke="#fff" strokeOpacity="0.18" />}
      </svg>
      <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] text-zinc-500">
        <span>{k.serie[sel].p}</span>
        <span className="text-zinc-200">{fmtVal(k.serie[sel].v, k.unite)}</span>
      </div>
      <div className="mt-1 text-[10.5px]" style={{ color: dehors ? ROUGE : "#71717a" }}>
        {dehors ? "Dernier point hors de la bande habituelle" : "Dans la bande habituelle (moyenne ± 1 écart-type)"}
      </div>
    </div>
  );
}

function Grille({ s }: { s: SocieteCT }) {
  return (
    <div className="grid grid-cols-3 gap-4 xl:grid-cols-4">
      {s.kpis.map((k) => {
        const y = yoyDernier(k);
        return (
          <div key={k.nom} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/20">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12px] font-medium leading-tight text-zinc-400">{k.nom}</div>
              <Pastille k={k} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-[22px] font-bold tracking-tight">{fmtVal(Number(k.serie[k.serie.length - 1].v), k.unite)}</span>
            </div>
            <div className="mb-2 font-mono text-[12px]" style={{ color: couleurYoy(y) }}>
              {fmtYoy(k, y)} <span className="text-zinc-600">vs N-1</span>
            </div>
            <Spark k={k} />
          </div>
        );
      })}
    </div>
  );
}

export function MultiplesClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={1}
      titre="Petits multiples"
      explication="Tous les KPI trimestriels d'une société d'un seul regard, chacun dans une cellule identique. Même échelle visuelle, même lecture : la ligne grise est la moyenne des trimestres passés, la bande violette son écart habituel. Quand le dernier point sort de la bande, il devient rouge. Survol : la valeur de chaque trimestre."
      forts={[
        "Vue d'ensemble immédiate, chaque KPI se compare aux autres au même format.",
        "Le seuil est calculé sur l'historique propre de l'indicateur, sans valeur externe.",
        "Détecte les ruptures sans ouvrir chaque graphique.",
      ]}
      limites={[
        "Pas de comparaison entre sociétés dans la même cellule.",
        "Une moyenne sur 13 trimestres écrase la saisonnalité (le T4 ressort souvent).",
        "Lecture plus dense : au-delà de 12 indicateurs, il faut défiler.",
      ]}
      societes={societes}
    >
      {(s) => <Grille s={s} />}
    </Coquille>
  );
}
void VERT;
