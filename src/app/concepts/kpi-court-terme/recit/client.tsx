"use client";

import { useState } from "react";
import type { KpiCT, SocieteCT } from "../data";
import { Coquille, Pastille, fmtVal, fmtNum, fmtYoy, yoyDernier, VERT, ROUGE } from "../shared";

function phrase(k: KpiCT): string[] {
  const n = k.serie.length;
  const d = k.serie[n - 1];
  const a = k.serie[n - 5];
  const y = yoyDernier(k);
  const vs = k.serie.map((p) => p.v);
  const rang = [...vs].sort((u, v) => v - u).indexOf(d.v) + 1;
  const out: string[] = [];
  out.push(`${k.nom} s'établit à ${fmtVal(d.v, k.unite)} au ${d.p}${a ? `, contre ${fmtVal(a.v, k.unite)} un an plus tôt (${a.p}), soit ${fmtYoy(k, y)}` : ""}.`);
  if (rang === 1) out.push(`C'est le plus haut niveau des ${n} derniers trimestres.`);
  else if (rang === n) out.push(`C'est le plus bas niveau des ${n} derniers trimestres.`);
  else out.push(`Ce niveau se place au rang ${rang} sur ${n} (1 = le plus élevé).`);
  if (a) {
    const pas = [1, 2, 3, 4].map((j) => ({ p: k.serie[n - 5 + j].p, d: k.serie[n - 5 + j].v - k.serie[n - 5 + j - 1].v }));
    const best = [...pas].sort((u, v) => v.d - u.d)[0];
    const worst = [...pas].sort((u, v) => u.d - v.d)[0];
    out.push(`Sur les quatre derniers trimestres, le plus gros pas en avant vient du ${best.p} (${best.d >= 0 ? "+" : ""}${fmtNum(best.d, k.unite)}), le plus faible du ${worst.p} (${worst.d >= 0 ? "+" : ""}${fmtNum(worst.d, k.unite)}).`);
  }
  return out;
}

function Pont({ k }: { k: KpiCT }) {
  const n = k.serie.length;
  if (n < 5) return null;
  const pts = k.serie.slice(n - 5);
  const W = 760, H = 250, PL = 20, PT = 30, PB = 40;
  const deltas = [1, 2, 3, 4].map((i) => pts[i].v - pts[i - 1].v);
  const niveaux = [pts[0].v];
  deltas.forEach((d) => niveaux.push(niveaux[niveaux.length - 1] + d));
  const all = [...niveaux];
  const lo = Math.min(...all), hi = Math.max(...all);
  const marge = (hi - lo) * 0.6 || 1;
  const min = lo - marge, max = hi + marge * 0.4;
  const Y = (v: number) => H - PB - ((v - min) / (max - min)) * (H - PT - PB);
  const cw = (W - PL * 2) / 6;
  const bw = cw * 0.62;
  const X = (i: number) => PL + cw * (i + 0.5);
  const barres = [
    { lab: `${pts[0].p} (N-1)`, a: min, b: pts[0].v, total: true, v: pts[0].v },
    ...deltas.map((d, i) => ({ lab: pts[i + 1].p, a: niveaux[i], b: niveaux[i + 1], total: false, v: d })),
    { lab: `${pts[4].p}`, a: min, b: pts[4].v, total: true, v: pts[4].v },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {barres.map((b, i) => {
        const top = Math.max(b.a, b.b), bot = Math.min(b.a, b.b);
        const col = b.total ? "#8b8ba0" : b.v >= 0 ? VERT : ROUGE;
        return (
          <g key={i}>
            <rect x={X(i) - bw / 2} y={Y(top)} width={bw} height={Math.max(2, Y(bot) - Y(top))} rx="3" fill={col} opacity={b.total ? 0.55 : 0.9} />
            {i < barres.length - 1 && <line x1={X(i) + bw / 2} x2={X(i + 1) - bw / 2} y1={Y(b.b)} y2={Y(b.b)} stroke="#fff" strokeOpacity="0.2" strokeDasharray="2 3" />}
            <text x={X(i)} y={Y(top) - 7} textAnchor="middle" fontSize="11" fill="#e4e4e7" fontFamily="monospace">{b.total ? fmtNum(b.v, k.unite) : `${b.v >= 0 ? "+" : ""}${fmtNum(b.v, k.unite)}`}</text>
            <text x={X(i)} y={H - 14} textAnchor="middle" fontSize="10.5" fill="#71717a" fontFamily="monospace">{b.lab}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Recit({ s }: { s: SocieteCT }) {
  const [i, setI] = useState(0);
  const k = s.kpis[Math.min(i, s.kpis.length - 1)];
  return (
    <div className="grid grid-cols-[260px_1fr] gap-6">
      <div className="space-y-1.5">
        {s.kpis.map((x, j) => (
          <button key={x.nom} type="button" onClick={() => setI(j)}
            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[12.5px] transition-colors ${j === i ? "border-violet-400/50 bg-violet-500/15 text-violet-100" : "border-white/[0.07] text-zinc-400 hover:border-white/20"}`}>
            <span className="leading-tight">{x.nom}</span>
            <Pastille k={x} />
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
        <div className="space-y-2">
          {phrase(k).map((p, j) => (
            <p key={j} className={j === 0 ? "font-display text-[21px] font-semibold leading-snug text-zinc-50" : "text-[14px] leading-relaxed text-zinc-300"}>{p}</p>
          ))}
        </div>
        <div className="mt-5">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-600">Du même trimestre N-1 au dernier chiffre, pas à pas</div>
          <Pont k={k} />
        </div>
        {k.signal && (
          <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-violet-300">Ce que dit la fiche</div>
            <p className="text-[13px] leading-relaxed text-zinc-300">{k.signal}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function RecitClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={5}
      titre="Vue récit"
      explication="Au lieu de laisser l'investisseur décoder un graphique, la vue raconte : une phrase d'accroche construite à partir des vraies valeurs, puis un pont (cascade) qui montre comment le trimestre N-1 devient le dernier chiffre, trimestre après trimestre. Le texte de la fiche vient en dessous comme explication."
      forts={[
        "La variation vs N-1 est expliquée, pas seulement affichée : on voit quel trimestre l'a portée.",
        "Lecture accessible à un investisseur non spécialiste, le chiffre est mis en phrase.",
        "Le pont se vérifie : la somme des quatre pas égale l'écart entre N-1 et aujourd'hui.",
      ]}
      limites={[
        "Un KPI à la fois, la vue d'ensemble se perd.",
        "Les phrases sont générées par règles : elles décrivent, elles n'expliquent pas les causes (le « pourquoi » vient du texte de la fiche quand il existe).",
        "Le pont est séquentiel (trimestre sur trimestre), il ne décompose pas la variation par moteur (prix, volume).",
      ]}
      societes={societes}
    >
      {(s) => <Recit s={s} />}
    </Coquille>
  );
}
