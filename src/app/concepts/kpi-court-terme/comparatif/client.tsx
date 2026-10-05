"use client";

import { useState } from "react";
import type { KpiCT, SocieteCT } from "../data";
import { Coquille, fmtVal, fmtPct, yoyAt, yoyDernier, moyenne, VIOLET, AMBRE } from "../shared";

const COULEURS = [VIOLET, AMBRE];

function Comparaison({ societes }: { societes: SocieteCT[] }) {
  const [hov, setHov] = useState<string | null>(null);
  const lignes = societes.flatMap((s, si) =>
    s.kpis.filter((k) => k.unite !== "%").map((k) => ({ s, si, k, y: yoyDernier(k) }))
  ).filter((l): l is typeof l & { y: number } => l.y !== null).sort((a, b) => b.y - a.y);
  const ext = Math.max(10, Math.ceil(Math.max(...lignes.map((l) => Math.abs(l.y))) / 5) * 5);
  const W = 700, RH = 30, PL = 250, PR = 30;
  const X = (v: number) => PL + ((v + ext) / (2 * ext)) * (W - PL - PR);
  const H = lignes.length * RH + 46;
  // trajectoires de croissance sur 9 trimestres, alignees par libelle
  const labels = societes[0].kpis[0].serie.slice(-9).map((p) => p.p);
  const traj = societes.map((s) => s.kpis.filter((k) => k.unite !== "%" && k.serie.length >= 13).map((k) => ({ k, pts: labels.map((l) => {
    const i = k.serie.findIndex((p) => p.p === l);
    return i >= 4 ? yoyAt(k, i) : null;
  }) })));
  const flat = traj.flat().flatMap((t) => t.pts).filter((x): x is number => x !== null);
  const lo = Math.min(...flat, 0), hi = Math.max(...flat, 0);
  const W2 = 520, H2 = 330, P2 = 40;
  const X2 = (i: number) => P2 + (i * (W2 - 2 * P2)) / (labels.length - 1);
  const Y2 = (v: number) => H2 - 36 - ((v - lo) / (hi - lo || 1)) * (H2 - 36 - 20);
  const mediane = (a: number[]) => { const b = [...a].sort((x, y) => x - y); const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  return (
    <div className="grid grid-cols-[1.35fr_1fr] gap-6">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="mb-1 flex items-center gap-4 text-[12px] text-zinc-400">
          {societes.map((s, i) => (<span key={s.ticker} className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: COULEURS[i] }} />{s.nom}</span>))}
          <span className="ml-auto text-[11px] text-zinc-600">Croissance vs N-1, dernier trimestre</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <line x1={X(0)} x2={X(0)} y1={8} y2={H - 28} stroke="#fff" strokeOpacity="0.35" />
          {[-ext, -ext / 2, ext / 2, ext].map((t) => (
            <g key={t}><line x1={X(t)} x2={X(t)} y1={8} y2={H - 28} stroke="#fff" strokeOpacity="0.06" /><text x={X(t)} y={H - 12} textAnchor="middle" fontSize="10" fill="#71717a" fontFamily="monospace">{t > 0 ? "+" : ""}{t} %</text></g>
          ))}
          <text x={X(0)} y={H - 12} textAnchor="middle" fontSize="10" fill="#a1a1aa" fontFamily="monospace">0</text>
          {lignes.map((l, i) => {
            const cy = 22 + i * RH;
            const id = `${l.s.ticker}-${l.k.nom}`;
            const actif = hov === id;
            return (
              <g key={id} onMouseEnter={() => setHov(id)} onMouseLeave={() => setHov(null)} opacity={hov && !actif ? 0.45 : 1}>
                <text x={PL - 12} y={cy + 4} textAnchor="end" fontSize="11.5" fill={actif ? "#fff" : "#a1a1aa"}>{l.k.nom.length > 34 ? l.k.nom.slice(0, 33) + "…" : l.k.nom}</text>
                <line x1={X(0)} x2={X(l.y)} y1={cy} y2={cy} stroke={COULEURS[l.si]} strokeWidth="2" strokeOpacity="0.6" />
                <circle cx={X(l.y)} cy={cy} r={actif ? 7 : 5.5} fill={COULEURS[l.si]} />
                <text x={X(l.y) + (l.y >= 0 ? 11 : -11)} y={cy + 4} textAnchor={l.y >= 0 ? "start" : "end"} fontSize="10.5" fill="#d4d4d8" fontFamily="monospace">{fmtPct(l.y)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="mb-1 text-[12px] text-zinc-400">Trajectoire de croissance annuelle, 9 trimestres (trait épais = médiane des KPI)</div>
        <svg viewBox={`0 0 ${W2} ${H2}`} className="w-full">
          <line x1={P2} x2={W2 - P2} y1={Y2(0)} y2={Y2(0)} stroke="#fff" strokeOpacity="0.3" />
          <text x={P2 - 6} y={Y2(0) + 3} textAnchor="end" fontSize="10" fill="#71717a" fontFamily="monospace">0 %</text>
          <text x={P2 - 6} y={Y2(hi) + 3} textAnchor="end" fontSize="10" fill="#71717a" fontFamily="monospace">{Math.round(hi)} %</text>
          <text x={P2 - 6} y={Y2(lo) + 3} textAnchor="end" fontSize="10" fill="#71717a" fontFamily="monospace">{Math.round(lo)} %</text>
          {labels.map((l, i) => (<text key={l} x={X2(i)} y={H2 - 12} textAnchor="middle" fontSize="10" fill="#71717a" fontFamily="monospace">{l}</text>))}
          {traj.map((ts, si) => (
            <g key={si}>
              {ts.map((t) => {
                const d = t.pts.map((v, i) => (v === null ? null : `${X2(i).toFixed(1)},${Y2(v).toFixed(1)}`)).filter(Boolean).join(" L");
                return d ? <path key={t.k.nom} d={`M${d}`} fill="none" stroke={COULEURS[si]} strokeWidth="1.2" strokeOpacity={hov && hov.endsWith(t.k.nom) ? 1 : 0.28} /> : null;
              })}
              <path d={"M" + labels.map((_, i) => { const vals = ts.map((t) => t.pts[i]).filter((v): v is number => v !== null); return vals.length ? `${X2(i).toFixed(1)},${Y2(mediane(vals)).toFixed(1)}` : null; }).filter(Boolean).join(" L")} fill="none" stroke={COULEURS[si]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
        </svg>
        <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
          Lecture : au dernier trimestre, la médiane de {societes[0].nom} est de {fmtPct(mediane(traj[0].map((t) => t.pts[labels.length - 1]).filter((v): v is number => v !== null)))}, celle de {societes[1].nom} de {fmtPct(mediane(traj[1].map((t) => t.pts[labels.length - 1]).filter((v): v is number => v !== null)))}.
        </p>
      </div>
    </div>
  );
}
void moyenne;
void (null as unknown as KpiCT);
void fmtVal;

export function ComparatifClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={6}
      titre="Comparatif sur un même axe"
      explication="Les KPI de deux sociétés posés sur un axe unique, celui de la croissance annuelle (les taux ne sont pas mélangés aux montants). À gauche, un point par KPI, classés du plus fort au plus faible. À droite, la trajectoire sur 9 trimestres : traits fins = chaque KPI, trait épais = la médiane. Survol : un KPI s'allume."
      forts={[
        "Met côte à côte deux modèles très différents (streaming et luxe) sans tenir compte des unités.",
        "Le classement fait ressortir les moteurs et les freins de chaque groupe.",
        "Les trajectoires montrent si la croissance accélère ou ralentit globalement.",
      ]}
      limites={[
        "Compare des croissances, pas des niveaux : une croissance forte sur une petite base reste fragile.",
        "Les KPI ne sont pas strictement équivalents d'une société à l'autre (régions contre lignes de métiers).",
        "Ici les deux sociétés servent de démonstration, un vrai comparatif de concurrents demande le Comparer existant.",
      ]}
      societes={societes}
      sansChoix
    >
      {() => <Comparaison societes={societes} />}
    </Coquille>
  );
}
