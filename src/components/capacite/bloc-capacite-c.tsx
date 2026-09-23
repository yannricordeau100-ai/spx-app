"use client";

/**
 * DESIGN C : « Les quatre cadrans ».
 *
 * Parti pris : une grille de quatre cadrans, chacun avec une aiguille et un
 * repère gravé à la position du taux choisi. C'est la version la plus
 * démonstrative, celle qui donne envie de bouger le réglage pour voir les
 * aiguilles franchir le repère. Réglage par pas, avec deux boutons, pensé
 * pour le doigt plutôt que pour la souris. Chaque cadran répète la valeur en
 * chiffres sous l'arc, pour que le sens ne dépende jamais du dessin seul.
 */

import {
  BORNES,
  COULEURS,
  affichageValeur,
  libelleVerdict,
  formatPct,
  libelleReference,
  synthese,
  valeurReference,
  verdicts,
  type TypeReference,
  type Verdict,
} from "./modele";
import { TEXTES_RATIOS } from "./textes";
import { BandeauReserve, InfoAbsence, InfoMethode, InfoRatio, InfoReference, TITRE_BLOC } from "./mentions";
import { useReglage } from "./use-reference";
import type { PropsBloc } from "./bloc-capacite-a";

const CX = 62;
const CY = 62;
const R = 46;
const LONGUEUR_ARC = Math.PI * R;

function pointSurArc(fraction: number): { x: number; y: number } {
  const f = Math.min(1, Math.max(0, fraction));
  const theta = Math.PI * (1 - f);
  return { x: CX + R * Math.cos(theta), y: CY - R * Math.sin(theta) };
}

function Cadran({ v, reference, haut }: { v: Verdict; reference: number; haut: number }) {
  const c = COULEURS[v.statut];
  const t = TEXTES_RATIOS[v.cle];
  const fractionValeur =
    v.statut === "absent" ? 0 : v.statut === "reserve" ? 1 : Math.min(1, Math.max(0, (v.valeur as number) / haut));
  const fractionRef = Math.min(1, Math.max(0, reference / haut));
  const debutRepere = pointSurArc(fractionRef);
  const finRepere = {
    x: CX + (R + 9) * Math.cos(Math.PI * (1 - fractionRef)),
    y: CY - (R + 9) * Math.sin(Math.PI * (1 - fractionRef)),
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span className="font-mono text-[11px] font-bold text-zinc-500">{t.sigle}</span>
        <span className="truncate text-[12px] text-zinc-300">{t.titre}</span>
        <InfoRatio cle={v.cle} couleur={c.trait} />
      </div>
      <svg viewBox="0 0 124 78" className="mx-auto mt-1 h-[74px] w-full max-w-[150px]" role="img" aria-label={`${t.titre} : ${affichageValeur(v)}`}>
        {/* Piste */}
        <path
          d={`M ${CX - R},${CY} A ${R},${R} 0 0 1 ${CX + R},${CY}`}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={9}
          strokeLinecap="round"
        />
        {/* Aiguille remplie */}
        {v.statut !== "absent" && (
          <path
            d={`M ${CX - R},${CY} A ${R},${R} 0 0 1 ${CX + R},${CY}`}
            fill="none"
            stroke={c.trait}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${LONGUEUR_ARC * fractionValeur} ${LONGUEUR_ARC}`}
            strokeOpacity={v.statut === "reserve" ? 0.4 : 0.95}
            style={{ transition: "stroke-dasharray 320ms ease, stroke 200ms ease" }}
          />
        )}
        {/* Repère gravé à la position du taux choisi */}
        <line
          x1={debutRepere.x}
          y1={debutRepere.y}
          x2={finRepere.x}
          y2={finRepere.y}
          stroke="#67e8f9"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
      <p className="font-mono text-[15px] font-bold tabular-nums" style={{ color: c.texte }}>
        {affichageValeur(v)}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px]" style={{ color: c.texte }}>
        {libelleVerdict(v)}
        {v.statut === "absent" && <InfoAbsence />}
      </p>
    </div>
  );
}

export function BlocCapaciteC({ societe, reglage: ctrl, onReglage }: PropsBloc) {
  const [reglage, setReglage] = useReglage({ reglage: ctrl, onReglage });
  const reference = valeurReference(reglage);
  const vs = verdicts(societe, reference);
  const bornes = BORNES[reglage.type];
  const reserve = vs.filter((v) => v.statut === "reserve").length;
  const comparables = vs.filter((v) => v.statut === "vert" || v.statut === "orange" || v.statut === "rouge");
  const gagnantes = comparables.filter((v) => v.statut !== "rouge").length;
  const haut = Math.max(
    reference * 2,
    10,
    ...comparables.map((v) => v.valeur as number).filter((x) => x > 0)
  );

  const pas = (sens: 1 | -1) => {
    const v = reference + sens * bornes.pas;
    if (v < bornes.min || v > bornes.max) return;
    setReglage(reglage.type === "sans_risque" ? { ...reglage, sansRisque: v } : { ...reglage, inflation: v });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[radial-gradient(120%_90%_at_50%_0%,rgba(103,232,249,0.07),transparent_60%)] p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] font-bold leading-snug tracking-tight text-zinc-100 sm:text-[19px]">
          {TITRE_BLOC}
        </h2>
        <InfoMethode />
      </header>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[30px] font-extrabold leading-none text-zinc-100">
            {gagnantes}
            <span className="text-[18px] text-zinc-500"> / {comparables.length}</span>
          </span>
          <span className="max-w-[22rem] text-[12.5px] leading-snug text-zinc-400">
            {synthese(vs, reference, reglage.type)}
          </span>
        </div>

        {/* Réglage au doigt : deux pastilles, deux boutons de pas. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 p-0.5" role="group" aria-label="Choix de la référence">
            {(["sans_risque", "inflation"] as TypeReference[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={reglage.type === t}
                onClick={() => setReglage({ ...reglage, type: t })}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  reglage.type === t ? "bg-cyan-400/15 text-cyan-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {libelleReference(t)}
              </button>
            ))}
          </div>
          <InfoReference type={reglage.type} />
          <div className="flex items-center gap-1 rounded-full border border-white/10 px-1 py-0.5">
            <button
              type="button"
              onClick={() => pas(-1)}
              disabled={reference <= bornes.min}
              aria-label="Baisser le taux de référence"
              className="size-7 rounded-full text-[16px] text-zinc-300 transition-colors hover:bg-white/10 disabled:opacity-30"
            >
              -
            </button>
            <span className="min-w-[3.6rem] text-center font-mono text-[15px] font-bold tabular-nums text-cyan-200">
              {formatPct(reference)}
            </span>
            <button
              type="button"
              onClick={() => pas(1)}
              disabled={reference >= bornes.max}
              aria-label="Monter le taux de référence"
              className="size-7 rounded-full text-[16px] text-zinc-300 transition-colors hover:bg-white/10 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {vs.map((v) => (
          <Cadran key={v.cle} v={v} reference={reference} haut={haut} />
        ))}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-zinc-500">
        <span className="inline-block h-2.5 w-[2px] bg-cyan-300" aria-hidden />
        Le repère bleu sur chaque cadran marque {libelleReference(reglage.type).toLowerCase()} de {formatPct(reference)}.
      </p>

      <BandeauReserve nombre={reserve} />

      <p className="mt-3 text-[11.5px] text-zinc-500">
        Dernier exercice clos {societe.exercice ?? "non précisé"}
        {societe.cloture ? `, arrêté au ${societe.cloture}` : ""}.
      </p>
    </section>
  );
}
