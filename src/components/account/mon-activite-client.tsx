"use client";

/**
 * Pièces interactives du bloc « Mon activité » (Yann 13 oct 2026) :
 * liste limitée à 5 lignes avec « Voir plus », section repliable sur mobile
 * (toujours ouverte sur ordinateur, sans saut à l affichage), bouton
 * d effacement avec confirmation.
 */
import { Children, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";

export function ListeVoirPlus({ children, max = 5, className = "" }: { children: ReactNode; max?: number; className?: string }) {
  const [tout, setTout] = useState(false);
  const items = Children.toArray(children);
  const visibles = tout ? items : items.slice(0, max);
  return (
    <>
      <ul className={className}>{visibles}</ul>
      {items.length > max && (
        <button
          type="button"
          onClick={() => setTout((v) => !v)}
          className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-violet-300 hover:text-violet-200"
          aria-expanded={tout}
        >
          {tout ? "Voir moins" : `Voir plus (${items.length - max})`}
          <ChevronDown className={`size-3.5 transition-transform ${tout ? "rotate-180" : ""}`} aria-hidden />
        </button>
      )}
    </>
  );
}

/** Repliée par défaut sous 640 px, toujours dépliée au-delà. */
export function Repliable({ titre, sousTitre, icone, children }: { titre: string; sousTitre?: string; icone?: ReactNode; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="min-w-0 rounded-xl border border-[#1f1f1f] bg-[#0c0c0c]">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="flex min-h-11 w-full items-center gap-2.5 px-4 py-3 text-left sm:pointer-events-none sm:cursor-default"
      >
        {icone}
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-zinc-100">{titre}</span>
          {sousTitre && <span className="mt-0.5 block text-[11.5px] text-zinc-500">{sousTitre}</span>}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-zinc-500 transition-transform sm:hidden ${ouvert ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div className={`${ouvert ? "block" : "hidden"} px-4 pb-4 sm:block`}>{children}</div>
    </div>
  );
}

export function BoutonEffacer({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Effacer tout ton historique d’activité ? Les statistiques de cette page repartiront de zéro. Cette action est définitive.")) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-lg border border-rose-500/40 px-3.5 text-[13px] font-semibold text-rose-200 transition-colors hover:bg-rose-500/10"
      >
        Effacer mon historique d’activité
      </button>
    </form>
  );
}

/** Logo de société (même tuile que la recherche ; fond clair si le logo est sombre). */
export function LogoSociete({ ticker }: { ticker: string }) {
  return (
    <span className={`inline-flex size-8 shrink-0 overflow-hidden rounded-lg border ${logoNeedsLightBg(ticker) ? "preserve-colors border-[#e5e5e5] bg-[#fafafa]" : "border-[#1f1f1f] bg-[#0a0a0a]"}`}>
      <CompanyLogo ticker={ticker} />
    </span>
  );
}
