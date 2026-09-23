"use client";

/**
 * DESIGN B : « La règle graduée ».
 *
 * Parti pris : une seule règle horizontale commune aux quatre mesures, et un
 * trait vertical qui marque le taux choisi. Le message se lit à la position
 * des barres, pas à leur couleur : ce qui dépasse le trait est au dessus du
 * taux, ce qui s'arrête avant est en dessous. Le curseur déplace le trait en
 * direct, ce qui rend le réglage physique. La couleur ne fait que confirmer,
 * ce qui reste lisible pour une personne qui distingue mal le rouge du vert.
 */

import { useId } from "react";
import {
  BORNES,
  COULEURS,
  MARGE_ORANGE_PTS,
  affichageValeur,
  formatEcart,
  formatPct,
  libelleReference,
  synthese,
  valeurReference,
  verdicts,
  type ReglageReference,
  type TypeReference,
  type Verdict,
} from "./modele";
import { TEXTES_RATIOS } from "./textes";
import { BandeauReserve, InfoAbsence, InfoMethode, InfoRatio, InfoReference, TITRE_BLOC } from "./mentions";
import { useReglage } from "./use-reference";
import type { PropsBloc } from "./bloc-capacite-a";

/** Domaine de la règle : toujours 0, le taux et ses marges, et les valeurs lisibles. */
function domaine(vs: Verdict[], reference: number): { bas: number; haut: number } {
  const valeurs = vs
    .filter((v) => v.statut !== "absent" && v.statut !== "reserve")
    .map((v) => v.valeur as number);
  const bas = Math.min(0, ...valeurs);
  const haut = Math.max(reference + MARGE_ORANGE_PTS * 2, ...valeurs, 10);
  return { bas, haut: haut <= bas ? bas + 10 : haut };
}

export function BlocCapaciteB({ societe, reglage: ctrl, onReglage }: PropsBloc) {
  const [reglage, setReglage] = useReglage({ reglage: ctrl, onReglage });
  const reference = valeurReference(reglage);
  const vs = verdicts(societe, reference);
  const bornes = BORNES[reglage.type];
  const { bas, haut } = domaine(vs, reference);
  const idRange = useId();
  const reserve = vs.filter((v) => v.statut === "reserve").length;

  const pos = (v: number) => ((v - bas) / (haut - bas)) * 100;
  const posZero = pos(0);
  const posRef = pos(reference);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-bold leading-snug tracking-tight text-zinc-100 sm:text-[19px]">
            {TITRE_BLOC}
          </h2>
          <p className="mt-1 text-[13px] text-zinc-400">{synthese(vs, reference, reglage.type)}</p>
        </div>
        <InfoMethode />
      </header>

      {/* Réglage : deux onglets pour la référence, un curseur pour la valeur. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5">
        <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Choix de la référence">
          {(["sans_risque", "inflation"] as TypeReference[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={reglage.type === t}
              onClick={() => setReglage({ ...reglage, type: t })}
              className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                reglage.type === t ? "bg-cyan-400/15 text-cyan-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {libelleReference(t)}
            </button>
          ))}
        </div>
        <InfoReference type={reglage.type} />
        <span className="font-mono text-[16px] font-bold tabular-nums text-cyan-200">{formatPct(reference)}</span>
        <input
          id={idRange}
          type="range"
          min={bornes.min}
          max={bornes.max}
          step={bornes.pas}
          value={reference}
          aria-label={`${libelleReference(reglage.type)} en pourcentage`}
          onChange={(e) => {
            const v = Number(e.target.value);
            setReglage(
              reglage.type === "sans_risque" ? { ...reglage, sansRisque: v } : { ...reglage, inflation: v }
            );
          }}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/12 accent-cyan-300 sm:min-w-[180px]"
        />
        <span className="font-mono text-[11px] text-zinc-500">
          {formatPct(bornes.min, 0)} à {formatPct(bornes.max, 0)}
        </span>
      </div>

      {/* La règle. Le trait du taux traverse les quatre lignes. */}
      <div className="relative mt-5">
        <ul className="space-y-3">
          {vs.map((v) => {
            const c = COULEURS[v.statut];
            const t = TEXTES_RATIOS[v.cle];
            const valeur = v.valeur ?? 0;
            const gauche = v.statut === "reserve" ? posZero : Math.min(posZero, pos(valeur));
            const largeur = v.statut === "reserve" ? 100 - posZero : Math.abs(pos(valeur) - posZero);
            return (
              <li key={v.cle} className="sm:flex sm:items-center sm:gap-3">
                <span className="flex items-center gap-1.5 sm:w-44 sm:shrink-0">
                  <span className="font-mono text-[11px] font-bold text-zinc-500">{t.sigle}</span>
                  <span className="truncate text-[13px] text-zinc-300">{t.titre}</span>
                  <InfoRatio cle={v.cle} couleur={c.trait} />
                </span>
                <span className="relative mt-1.5 block h-8 flex-1 overflow-hidden rounded-md border border-white/[0.06] bg-black/40 sm:mt-0">
                  {/* Trait du taux, répété dans la piste pour rester visible sur téléphone. */}
                  <span
                    className="absolute inset-y-0 z-10 w-px"
                    style={{ left: `${posRef}%`, backgroundColor: "#67e8f9" }}
                    aria-hidden
                  />
                  {v.statut === "absent" ? (
                    <span className="absolute inset-0 flex items-center gap-1.5 px-2 text-[12px] text-zinc-400">
                      Non disponible
                      <InfoAbsence />
                    </span>
                  ) : (
                    <>
                      <span
                        className="absolute inset-y-[5px] rounded-[3px]"
                        style={{
                          left: `${gauche}%`,
                          width: `${Math.max(largeur, 0.6)}%`,
                          backgroundColor: c.trait,
                          opacity: v.statut === "reserve" ? 0.35 : 0.85,
                          backgroundImage:
                            v.statut === "reserve"
                              ? "repeating-linear-gradient(135deg, rgba(0,0,0,0.45) 0 5px, transparent 5px 10px)"
                              : undefined,
                        }}
                        aria-hidden
                      />
                      <span
                        className="absolute inset-y-0 z-20 flex items-center px-2 font-mono text-[12.5px] font-bold tabular-nums"
                        style={{
                          left: v.statut === "reserve" ? `${posZero}%` : `${Math.min(gauche + largeur, 88)}%`,
                          color: c.texte,
                        }}
                      >
                        {affichageValeur(v)}
                        {v.ecart !== null && (
                          <span className="ml-1.5 font-sans text-[11px] font-medium text-zinc-400">
                            {formatEcart(v.ecart)}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {/* Graduation sous la règle. */}
        <div className="mt-2 sm:flex sm:gap-3">
          <span className="hidden sm:block sm:w-44 sm:shrink-0" />
          <div className="relative h-4 flex-1">
            <span className="absolute text-[10.5px] text-zinc-600" style={{ left: `${posZero}%` }}>
              0 %
            </span>
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap text-[10.5px] font-semibold text-cyan-300"
              style={{ left: `${posRef}%` }}
            >
              {formatPct(reference)}
            </span>
            <span className="absolute right-0 text-[10.5px] text-zinc-600">
              {formatPct(haut, 0)}
            </span>
          </div>
        </div>
      </div>

      <BandeauReserve nombre={reserve} />

      <p className="mt-3 text-[11.5px] text-zinc-500">
        Dernier exercice clos {societe.exercice ?? "non précisé"}
        {societe.cloture ? `, arrêté au ${societe.cloture}` : ""}.
      </p>
    </section>
  );
}
