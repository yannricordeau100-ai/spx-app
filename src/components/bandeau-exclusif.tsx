"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Bandeau « KPI exclusifs Mettrik AI » (Yann 20 et 21 sept 2026).
 *
 * Style retenu : la ligne encadree. Pose juste au dessus de la rangee des
 * chips de rang, avec un petit espace au dessus et au dessous. La couleur
 * reprend l accent de la societe, celui qui colore deja le ticker.
 * Yann : ne JAMAIS indiquer le nombre d indicateurs concernes.
 *
 * Sociétés concernees : liste ci dessous pour l instant, un onglet de saisie
 * viendra quand Yann aura valide le rendu. Le parametre d URL « bandeau=1 »
 * force l affichage sur n importe quelle societe, pour juger sur une vraie
 * page ; « bandeau=0 » le masque.
 */

export const TICKERS_EXCLUSIFS = ["NFLX", "AAPL", "PLTR", "MC.PA", "RMS.PA", "TTE.PA"];

const PHRASE = "Cette société a un ou plusieurs KPI exclusifs à Mettrik AI";
const NOTE = "Aucune plateforme grand public ne les propose.";

export function BandeauExclusif({ ticker, accent }: { ticker: string; accent: string }) {
  const [force, setForce] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get("bandeau");
      if (v === "1") setForce(true);
      if (v === "0") setForce(false);
    } catch {
      /* URL illisible : on garde la liste */
    }
  }, []);

  const dansLaListe = TICKERS_EXCLUSIFS.includes((ticker ?? "").toUpperCase());
  const visible = force === null ? dansLaListe : force;
  if (!visible) return null;

  return (
    <div
      className="mb-2 mt-2.5 rounded-xl border px-3.5 py-2"
      style={{ borderColor: `${accent}59`, background: `${accent}14` }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 shrink-0" style={{ color: accent }} />
        <span className="text-[12.5px] font-medium" style={{ color: accent }}>
          {PHRASE}
        </span>
      </div>
      <p className="mt-0.5 pl-[22px] text-[10.5px] text-zinc-500">{NOTE}</p>
    </div>
  );
}
