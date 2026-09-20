"use client";

import { useEffect, useState } from "react";
import { Sparkles, Lock, Info } from "lucide-react";

/**
 * Bandeau « introuvable ailleurs » (Yann 20 et 21 sept 2026).
 *
 * Signale en haut d une fiche que la page contient des indicateurs qu aucune
 * plateforme grand public ne publie. Yann : ne JAMAIS indiquer leur nombre.
 *
 * Tant qu une variante n est pas choisie, le bandeau ne s affiche que sur
 * demande, par le parametre d URL « bandeau=A » a « bandeau=D », pour juger le
 * rendu sur les vraies pages et non sur une maquette. Une fois la variante
 * retenue, il suffira de fixer VARIANTE_RETENUE ci dessous.
 */

export const TICKERS_EXCLUSIFS = ["NFLX", "AAPL", "PLTR", "MC.PA", "RMS.PA", "TTE.PA"];

/** null tant que Yann n a pas tranche. */
const VARIANTE_RETENUE: "A" | "B" | "C" | "D" | null = null;

const PHRASE = "Cette page contient des indicateurs introuvables ailleurs.";
const NOTE = "Aucune plateforme grand public ne les publie.";

export function BandeauExclusif({ ticker }: { ticker: string }) {
  const [variante, setVariante] = useState<string | null>(VARIANTE_RETENUE);

  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get("bandeau");
      if (v && ["A", "B", "C", "D"].includes(v.toUpperCase())) setVariante(v.toUpperCase());
    } catch {
      /* URL illisible : on garde la variante retenue */
    }
  }, []);

  if (!variante) return null;
  if (!TICKERS_EXCLUSIFS.includes((ticker ?? "").toUpperCase())) return null;

  if (variante === "A") {
    return (
      <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-500/[0.07] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 shrink-0 text-violet-300" />
          <span className="text-[13px] text-violet-100">{PHRASE}</span>
        </div>
        <p className="mt-1 pl-[22px] text-[10.5px] text-violet-200/50">{NOTE}</p>
      </div>
    );
  }

  if (variante === "B") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[12px] font-medium text-violet-100">
          <Lock className="size-3" />
          Indicateurs exclusifs
        </span>
        <span className="text-[10.5px] text-zinc-500">{NOTE}</span>
      </div>
    );
  }

  if (variante === "C") {
    return (
      <div className="mt-3 rounded-xl border border-white/[0.08] bg-gradient-to-r from-violet-500/[0.12] to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-violet-300" />
          <span className="font-display text-[14px] font-bold text-zinc-50">
            Des indicateurs que vous ne trouverez pas ailleurs
          </span>
        </div>
        <p className="mt-1 pl-[24px] text-[10.5px] text-zinc-500">{NOTE}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-y border-violet-400/20 bg-violet-500/[0.06] px-4 py-1.5">
      <Info className="size-3 shrink-0 self-center text-violet-300" />
      <span className="text-[11.5px] font-medium text-violet-100">{PHRASE}</span>
      <span className="text-[10px] text-violet-200/45">{NOTE}</span>
    </div>
  );
}
