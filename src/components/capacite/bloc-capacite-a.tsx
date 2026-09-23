"use client";

/**
 * DESIGN A : « Le verdict en toutes lettres ».
 *
 * Parti pris : le message passe par la phrase, pas par le graphique. Une
 * grande ligne de synthèse en haut répond à la question avant tout chiffre,
 * puis quatre lignes sobres donnent le détail et l'écart en points. Réglage
 * discret, posé sous le titre comme une note de lecture. Zéro effet, densité
 * maximale, lecture en deux secondes.
 */

import { useId } from "react";
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
  type CapaciteSociete,
  type ReglageReference,
  type TypeReference,
} from "./modele";
import { TEXTES_RATIOS } from "./textes";
import { BandeauReserve, InfoAbsence, InfoMethode, InfoRatio, InfoReference, TITRE_BLOC } from "./mentions";
import { useReglage } from "./use-reference";

export type PropsBloc = {
  societe: CapaciteSociete;
  reglage?: ReglageReference;
  onReglage?: (r: ReglageReference) => void;
};

export function BlocCapaciteA({ societe, reglage: ctrl, onReglage }: PropsBloc) {
  const [reglage, setReglage] = useReglage({ reglage: ctrl, onReglage });
  const reference = valeurReference(reglage);
  const vs = verdicts(societe, reference);
  const bornes = BORNES[reglage.type];
  const idSelect = useId();
  const idRange = useId();
  const reserve = vs.filter((v) => v.statut === "reserve").length;

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] font-bold leading-snug tracking-tight text-zinc-100 sm:text-[19px]">
          {TITRE_BLOC}
        </h2>
        <InfoMethode />
      </header>

      {/* Réglage : une ligne de texte où le menu et le curseur remplacent les mots. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-zinc-400">
        <label htmlFor={idSelect}>Comparé au</label>
        <select
          id={idSelect}
          value={reglage.type}
          onChange={(e) => setReglage({ ...reglage, type: e.target.value as TypeReference })}
          className="rounded-md border border-white/12 bg-[#0d0d0d] px-2 py-1 text-[13px] text-zinc-100 outline-none focus:border-violet-400/60"
        >
          <option value="sans_risque">taux sans risque</option>
          <option value="inflation">taux d&apos;inflation</option>
        </select>
        <span className="inline-flex items-center gap-1.5">
          de
          <span className="font-mono text-[14px] font-bold text-cyan-200">{formatPct(reference)}</span>
          <InfoReference type={reglage.type} />
        </span>
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
          className="h-1 w-full min-w-[140px] max-w-[220px] cursor-pointer appearance-none rounded-full bg-white/12 accent-cyan-300"
        />
      </div>

      {/* Le verdict, plus gros que tout le reste. */}
      <p className="mt-5 text-[19px] font-semibold leading-snug text-zinc-100 sm:text-[22px]">
        {synthese(vs, reference, reglage.type)}
      </p>

      <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {vs.map((v) => {
          const c = COULEURS[v.statut];
          const t = TEXTES_RATIOS[v.cle];
          return (
            <li key={v.cle} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span
                className="h-6 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: c.trait }}
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate text-[14px] text-zinc-200">{t.titre}</span>
                <span className="font-mono text-[11px] text-zinc-500">{t.sigle}</span>
                <InfoRatio cle={v.cle} couleur={c.trait} />
              </span>
              <span
                className="font-mono text-[15px] font-bold tabular-nums"
                style={{ color: v.statut === "absent" ? c.texte : c.texte }}
              >
                {affichageValeur(v)}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: c.fond, color: c.texte }}
              >
                {libelleVerdict(v)}
              </span>
              {v.statut === "absent" && <InfoAbsence />}
            </li>
          );
        })}
      </ul>

      <BandeauReserve nombre={reserve} />

      <p className="mt-3 text-[11.5px] text-zinc-500">
        Dernier exercice clos {societe.exercice ?? "non précisé"}
        {societe.cloture ? `, arrêté au ${societe.cloture}` : ""}.
      </p>
    </section>
  );
}
