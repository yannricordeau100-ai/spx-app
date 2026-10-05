"use client";

import type { KpiCT, SocieteCT } from "../data";
import { Coquille, Pastille, fmtVal, fmtYoy, yoyAt, yoyDernier, couleurYoy, moyenne, VIOLET } from "../shared";

function Carte({ k }: { k: KpiCT }) {
  const vs = k.serie.map((p) => p.v);
  const dernier = vs[vs.length - 1];
  const min = Math.min(...vs), max = Math.max(...vs);
  const pos = (dernier - min) / (max - min || 1);
  const rang = vs.filter((v) => v <= dernier).length;
  const percentile = Math.round((rang / vs.length) * 100);
  const m = moyenne(vs);
  const ecart = m !== 0 ? ((dernier - m) / Math.abs(m)) * 100 : null;
  const yoys = vs.map((_, i) => yoyAt(k, i)).filter((x): x is number => x !== null);
  const positifs = yoys.filter((x) => x >= 0).length;
  const y = yoyDernier(k);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[12.5px] font-medium leading-tight text-zinc-300">{k.nom}</div>
          <Pastille k={k} />
        </div>
        <div className="mt-2 font-display text-[28px] font-bold leading-none tracking-tight">{fmtVal(dernier, k.unite)}</div>
        <div className="mt-1 font-mono text-[12.5px]" style={{ color: couleurYoy(y) }}>{fmtYoy(k, y)} <span className="text-zinc-600">vs N-1 · {k.serie[k.serie.length - 1].p}</span></div>
      </div>
      <div className="border-t border-white/[0.06] bg-black/25 p-4">
        <div className="mb-1.5 flex justify-between text-[10.5px] uppercase tracking-wider text-zinc-600">
          <span>Contexte : {vs.length} derniers trimestres</span>
          <span className="font-mono normal-case text-zinc-400">percentile {percentile}</span>
        </div>
        <div className="relative h-2 rounded-full bg-white/[0.07]">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pos * 100}%`, background: `linear-gradient(90deg, ${VIOLET}33, ${VIOLET})` }} />
          <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#050507] bg-white" style={{ left: `${pos * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-600">
          <span>min {fmtVal(min, k.unite)}</span><span>max {fmtVal(max, k.unite)}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
          <div className="rounded-lg bg-white/[0.04] p-2">
            <div className="text-zinc-500">Écart à la moyenne</div>
            <div className="font-mono text-zinc-200">{ecart === null ? "n.d." : `${ecart > 0 ? "+" : ""}${ecart.toFixed(1).replace(".", ",")} %`}</div>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <div className="text-zinc-500">Trimestres en croissance</div>
            <div className="font-mono text-zinc-200">{yoys.length ? `${positifs} sur ${yoys.length}` : "n.d."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DoubleNiveauClient({ societes }: { societes: SocieteCT[] }) {
  return (
    <Coquille
      numero={4}
      titre="Cartes à double niveau"
      explication="Chaque KPI a une carte en deux étages. Étage haut : la valeur, la variation et la note. Étage bas : le contexte, c'est-à-dire où se situe ce trimestre dans la fourchette des 13 derniers (percentile), son écart à la moyenne et la régularité de la croissance. Le chiffre n'est plus isolé."
      forts={[
        "Répond à la question « est-ce beaucoup ou peu ? » sans graphique.",
        "Le percentile et la régularité sont calculés sur les vraies séries, sans seuil arbitraire.",
        "Hiérarchie claire : l'investisseur pressé lit l'étage haut, l'analyste descend.",
      ]}
      limites={[
        "Le contexte est celui de l'historique propre de la société. Un contexte sectoriel réel (percentile face aux pairs) demande des données de secteur absentes de la fiche, donc non simulé ici.",
        "Un percentile sur une série en croissance continue est mécaniquement élevé (un bon chiffre n'est pas une surprise).",
        "Pas de forme de la série visible (la sparkline est volontairement absente).",
      ]}
      societes={societes}
    >
      {(s) => (
        <div className="grid grid-cols-3 gap-5 xl:grid-cols-4">
          {s.kpis.map((k) => (<Carte key={k.nom} k={k} />))}
        </div>
      )}
    </Coquille>
  );
}
