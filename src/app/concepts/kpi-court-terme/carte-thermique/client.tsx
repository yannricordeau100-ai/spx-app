"use client";

import { useState } from "react";
import type { SocieteCT } from "../data";
import { Coquille, fmtVal, fmtYoy, yoyAt, VERT, ROUGE } from "../shared";

function Carte({ s }: { s: SocieteCT }) {
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const maxCols = 9;
  const cols = s.kpis[0]?.serie.slice(-maxCols).map((p) => p.p) ?? [];
  const n = s.kpis[0]?.serie.length ?? 0;
  const bg = (v: number | null, pts: boolean) => {
    if (v === null) return "rgba(255,255,255,0.03)";
    const lim = pts ? 5 : 25;
    const a = Math.min(1, Math.abs(v) / lim);
    const c = v >= 0 ? VERT : ROUGE;
    const hex = Math.round(18 + a * 150).toString(16).padStart(2, "0");
    return `${c}${hex}`;
  };
  const cell = sel ? s.kpis[sel.r] : null;
  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="grid items-center gap-1" style={{ gridTemplateColumns: `210px repeat(${cols.length}, minmax(0,1fr))` }}>
          <div className="text-[11px] uppercase tracking-wider text-zinc-600">Croissance annuelle (vs même trimestre N-1)</div>
          {cols.map((c) => (<div key={c} className="text-center font-mono text-[10.5px] text-zinc-500">{c}</div>))}
          {s.kpis.map((k, r) => (
            <div key={k.nom} className="contents">
              <div className="truncate pr-2 text-[12.5px] text-zinc-300" title={k.nom}>{k.nom}</div>
              {cols.map((c, ci) => {
                const i = k.serie.length - cols.length + ci;
                const idx = i >= 0 && k.serie.length >= 5 ? i : -1;
                const y = idx >= 0 ? yoyAt(k, idx) : null;
                const actif = sel?.r === r && sel?.c === ci;
                return (
                  <button
                    key={c}
                    type="button"
                    onMouseEnter={() => setSel({ r, c: ci })}
                    className={`h-10 rounded-md text-center font-mono text-[11px] transition-all ${actif ? "ring-2 ring-white/60" : ""} ${ci === cols.length - 1 ? "outline outline-1 outline-white/25" : ""}`}
                    style={{ background: bg(y, k.unite === "%"), color: y === null ? "#52525b" : "#f4f4f5" }}
                  >
                    {y === null ? "n.d." : (k.unite === "%" ? `${y > 0 ? "+" : ""}${y.toFixed(0)}` : `${y > 0 ? "+" : ""}${y.toFixed(1).replace(".", ",")}`)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="inline-block h-2.5 w-24 rounded" style={{ background: `linear-gradient(90deg, ${ROUGE}cc, #ffffff0a, ${VERT}cc)` }} />
          <span>décroissance, stable, croissance (saturation à +/-25 %, ou 5 points pour les taux)</span>
        </div>
      </div>
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        {cell && sel ? (() => {
          const i = cell.serie.length - cols.length + sel.c;
          const y = i >= 4 ? yoyAt(cell, i) : null;
          return (
            <div>
              <div className="text-[12px] text-zinc-500">{cell.nom}</div>
              <div className="mt-1 font-display text-[22px] font-bold">{cell.serie[i]?.p}</div>
              <div className="mt-3 space-y-2 font-mono text-[12.5px]">
                <div className="flex justify-between"><span className="text-zinc-500">Valeur</span><span>{cell.serie[i] ? fmtVal(cell.serie[i].v, cell.unite) : "n.d."}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">N-1 ({cell.serie[i - 4]?.p ?? "n.d."})</span><span>{cell.serie[i - 4] ? fmtVal(cell.serie[i - 4].v, cell.unite) : "n.d."}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Variation</span><span style={{ color: y === null ? "#71717a" : y >= 0 ? VERT : ROUGE }}>{fmtYoy(cell, y)}</span></div>
              </div>
            </div>
          );
        })() : (
          <div className="text-[12.5px] leading-relaxed text-zinc-500">Survolez une case pour voir la valeur du trimestre, celle de N-1 et l&apos;écart.</div>
        )}
      </div>
    </div>
  );
}

export function CarteThermiqueClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={2}
      titre="Carte thermique trimestre x KPI"
      explication="Une matrice : une ligne par KPI, une colonne par trimestre, chaque case colorée selon la croissance annuelle. On lit en une seconde quels indicateurs accélèrent (colonnes vertes qui foncent), lesquels décrochent, et si la dérive touche tout le tableau ou un seul poste."
      forts={[
        "Lecture transversale impossible avec des graphiques séparés : tendance et dispersion d'un coup d'œil.",
        "Très compact : 8 KPI sur 9 trimestres tiennent dans un seul écran.",
        "Révèle les décrochages simultanés (ex. toutes les lignes d'un groupe qui passent au rouge).",
      ]}
      limites={[
        "Perd le niveau absolu : seule la variation est colorée (le détail apparaît au survol).",
        "Les séries courtes (moins de 5 trimestres) donnent des cases « n.d. ».",
        "Demande de la pédagogie pour un investisseur novice (échelle de couleur).",
      ]}
      societes={societes}
    >
      {(s) => <Carte s={s} />}
    </Coquille>
  );
}
void 0;
