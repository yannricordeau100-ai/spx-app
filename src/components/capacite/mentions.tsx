"use client";

import { InfoTooltip } from "@/components/info-tooltip";
import { MARGE_ORANGE_PTS, type CleRatio, type TypeReference } from "./modele";
import { TEXTES_RATIOS, TEXTES_REFERENCES, TEXTE_ABSENT, TEXTE_RESERVE, texteMethode } from "./textes";

/** Contenu commun d'un « i » : définition puis exemple chiffré. */
function Contenu({ titre, phrase, exemple }: { titre: string; phrase: string; exemple: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] font-semibold text-zinc-100">{titre}</p>
      <p className="text-zinc-300">{phrase}</p>
      <p className="rounded-md bg-white/[0.04] p-2 text-[12px] text-zinc-400">
        <span className="font-semibold text-zinc-300">Exemple : </span>
        {exemple}
      </p>
    </div>
  );
}

export function InfoRatio({ cle, couleur }: { cle: CleRatio; couleur?: string }) {
  const t = TEXTES_RATIOS[cle];
  return (
    <InfoTooltip color={couleur ?? "#a78bfa"}>
      <Contenu titre={`${t.titre} (${t.sigle})`} phrase={t.phrase} exemple={t.exemple} />
    </InfoTooltip>
  );
}

export function InfoReference({ type, couleur }: { type: TypeReference; couleur?: string }) {
  const t = TEXTES_REFERENCES[type];
  return (
    <InfoTooltip color={couleur ?? "#67e8f9"}>
      <Contenu titre={t.titre} phrase={t.phrase} exemple={t.exemple} />
    </InfoTooltip>
  );
}

export function InfoMethode({ couleur }: { couleur?: string }) {
  return (
    <InfoTooltip color={couleur ?? "#a1a1aa"} align="right">
      <div className="space-y-2">
        <p className="text-[12.5px] font-semibold text-zinc-100">Comment lire les couleurs</p>
        <p className="text-zinc-300">{texteMethode(MARGE_ORANGE_PTS)}</p>
        <p className="rounded-md bg-white/[0.04] p-2 text-[12px] text-zinc-400">
          Les deux mesures viennent des comptes publiés du dernier exercice clos. Elles sont comparées au taux que
          vous choisissez, et à rien d'autre.
        </p>
      </div>
    </InfoTooltip>
  );
}

export function InfoReserve({ couleur }: { couleur?: string }) {
  return (
    <InfoTooltip color={couleur ?? "#a78bfa"} align="right">
      <div className="space-y-2">
        <p className="text-[12.5px] font-semibold text-zinc-100">{TEXTE_RESERVE.titre}</p>
        <p className="text-zinc-300">{TEXTE_RESERVE.phrase}</p>
        <p className="rounded-md bg-white/[0.04] p-2 text-[12px] text-zinc-400">
          <span className="font-semibold text-zinc-300">Exemple : </span>
          {TEXTE_RESERVE.exemple}
        </p>
        <p className="text-zinc-300">{TEXTE_RESERVE.conclusion}</p>
      </div>
    </InfoTooltip>
  );
}

export function InfoAbsence({ couleur }: { couleur?: string }) {
  return (
    <InfoTooltip color={couleur ?? "#a1a1aa"} align="right">
      <div className="space-y-2">
        <p className="text-[12.5px] font-semibold text-zinc-100">Mesure non disponible</p>
        <p className="text-zinc-300">{TEXTE_ABSENT}</p>
      </div>
    </InfoTooltip>
  );
}

/** Bandeau de réserve, posé sous le bloc dès qu'un ratio dépasse 100 pour cent. */
export function BandeauReserve({ nombre }: { nombre: number }) {
  if (nombre <= 0) return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-violet-400/25 bg-violet-400/[0.06] px-3 py-2">
      <span className="mt-[1px] text-[12px] font-semibold text-violet-200">Réserve</span>
      <p className="flex-1 text-[12px] leading-relaxed text-zinc-300">
        {nombre === 1 ? "Une mesure dépasse" : `${nombre} mesures dépassent`} 100 pour cent. Le capital investi de
        cette société est presque nul, si bien que le ratio s'envole et ne se compare plus à un taux. Ces mesures ne
        sont pas comptées comme un avantage.
      </p>
      <InfoReserve />
    </div>
  );
}

export const TITRE_BLOC = "Capacité théorique de la société à performer selon le taux sans risque ou l'inflation";
