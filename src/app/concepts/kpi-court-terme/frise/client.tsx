"use client";

import { useState } from "react";
import type { SocieteCT } from "../data";
import { Coquille, fmtVal, fmtYoy, yoyAt, finTrimestre, VERT, ROUGE, VIOLET } from "../shared";

const JOUR = 86400000;

function Frise({ s }: { s: SocieteCT }) {
  const [ik, setIk] = useState(0);
  const [hq, setHq] = useState<number | null>(null);
  const [he, setHe] = useState<number | null>(null);
  const k = s.kpis[Math.min(ik, s.kpis.length - 1)];
  const W = 1000, H = 300, PL = 60, PR = 20, PT = 24, PB = 34;
  const ends = k.serie.map((p) => finTrimestre(p.p).getTime());
  const t0 = ends[0] - 46 * JOUR, t1 = ends[ends.length - 1] + 46 * JOUR;
  const X = (t: number) => PL + ((t - t0) / (t1 - t0)) * (W - PL - PR);
  const vs = k.serie.map((p) => p.v);
  const min = Math.min(0, ...vs), max = Math.max(...vs) * 1.08;
  const Y = (v: number) => H - PB - ((v - min) / (max - min || 1)) * (H - PT - PB);
  const bw = ((W - PL - PR) / (ends.length + 1)) * 0.62;
  const evts = s.evts
    .map((e) => ({ ...e, t: new Date(e.date + "T00:00:00Z").getTime() }))
    .filter((e) => e.t >= t0 && e.t <= t1);
  const q = hq ?? k.serie.length - 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {s.kpis.map((x, i) => (
          <button key={x.nom} type="button" onClick={() => { setIk(i); setHq(null); }}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${i === ik ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"}`}>
            {x.nom}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <svg viewBox={`0 0 ${W} ${H + 70}`} className="w-full" onMouseLeave={() => { setHq(null); setHe(null); }}>
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={PL} x2={W - PR} y1={Y(t)} y2={Y(t)} stroke="#fff" strokeOpacity="0.06" />
                <text x={PL - 8} y={Y(t) + 3} textAnchor="end" fontSize="10" fill="#71717a" fontFamily="monospace">{fmtVal(t, "").replace(/\s/g, " ")}</text>
              </g>
            ))}
            {k.serie.map((p, i) => {
              const y = yoyAt(k, i);
              const col = y === null ? "#8b8ba0" : y >= 0 ? VERT : ROUGE;
              return (
                <g key={p.p} onMouseEnter={() => setHq(i)}>
                  <rect x={X(ends[i]) - bw / 2 - 6} y={PT} width={bw + 12} height={H - PT - PB} fill="transparent" />
                  <rect x={X(ends[i]) - bw / 2} y={Y(p.v)} width={bw} height={Math.max(1, Y(0) - Y(p.v))} rx="3" fill={col} opacity={i === q ? 0.95 : 0.5} />
                  <text x={X(ends[i])} y={H - PB + 16} textAnchor="middle" fontSize="10" fill={i === q ? "#fff" : "#71717a"} fontFamily="monospace">{p.p}</text>
                </g>
              );
            })}
            {/* bande des publications */}
            <line x1={PL} x2={W - PR} y1={H + 22} y2={H + 22} stroke="#fff" strokeOpacity="0.15" />
            <text x={PL} y={H + 8} fontSize="10" fill="#71717a">Publications et événements (dates réelles)</text>
            {evts.map((e, i) => {
              const resultats = /résultats/i.test(e.titre);
              return (
                <g key={i} onMouseEnter={() => setHe(i)} style={{ cursor: "pointer" }}>
                  <line x1={X(e.t)} x2={X(e.t)} y1={PT} y2={H + 22} stroke={resultats ? VIOLET : "#fff"} strokeOpacity={he === i ? 0.7 : 0.18} strokeDasharray="3 4" />
                  <circle cx={X(e.t)} cy={H + 22} r={he === i ? 7 : 5} fill={resultats ? VIOLET : "#52525b"} stroke="#050507" strokeWidth="2" />
                </g>
              );
            })}
            {evts.length === 0 && <text x={PL} y={H + 40} fontSize="11" fill="#71717a">Aucun événement daté disponible sur la période pour cette société.</text>}
          </svg>
          <div className="mt-2 min-h-[64px] rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[12.5px] leading-relaxed text-zinc-300">
            {he !== null && evts[he] ? (
              <>
                <span className="font-mono text-[11px] text-violet-300">{evts[he].date}</span>
                <span className="ml-2 font-semibold text-zinc-100">{evts[he].titre}</span>
                <div className="mt-1 text-zinc-400">{evts[he].texte}</div>
              </>
            ) : (
              <span className="text-zinc-500">Survolez un point de la frise pour lire la publication ou l&apos;événement correspondant.</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="text-[12px] text-zinc-500">{k.nom}</div>
          <div className="mt-1 font-display text-[24px] font-bold">{k.serie[q].p}</div>
          <div className="mt-3 space-y-2 font-mono text-[12.5px]">
            <div className="flex justify-between"><span className="text-zinc-500">Valeur</span><span>{fmtVal(k.serie[q].v, k.unite)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">N-1</span><span>{k.serie[q - 4] ? fmtVal(k.serie[q - 4].v, k.unite) : "n.d."}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Variation</span><span style={{ color: yoyAt(k, q) === null ? "#71717a" : (yoyAt(k, q) as number) >= 0 ? VERT : ROUGE }}>{fmtYoy(k, yoyAt(k, q))}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Fin de période</span><span>{new Date(ends[q]).toISOString().slice(0, 10)}</span></div>
          </div>
          {k.signal && <p className="mt-4 border-t border-white/[0.06] pt-3 text-[12px] leading-relaxed text-zinc-400">{k.signal}</p>}
        </div>
      </div>
    </div>
  );
}

export function FriseClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={3}
      titre="Frise des publications"
      explication="Un seul grand graphique, large, sur un axe du temps réel : les barres sont placées à la fin de chaque trimestre, vertes ou rouges selon la croissance annuelle. Sous l'axe, les publications de résultats et événements réels de la société sont posés à leur date : on voit ce qui a précédé ou suivi chaque trimestre."
      forts={[
        "Relie le chiffre à l'actualité : résultats, accords, communications réglementaires.",
        "Profite pleinement de la largeur d'un écran d'ordinateur, avec un panneau de détail latéral.",
        "Changement de KPI en un clic sans quitter la frise.",
      ]}
      limites={[
        "Un seul KPI à la fois (pas de vue d'ensemble).",
        "Dépend des événements disponibles : LVMH n'en a pas encore dans la fiche, la bande reste vide.",
        "Les événements couvrent surtout les 12 derniers mois, pas tout l'historique de la série.",
      ]}
      societes={societes}
    >
      {(s) => <Frise s={s} />}
    </Coquille>
  );
}
