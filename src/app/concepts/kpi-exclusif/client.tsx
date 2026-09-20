"use client";

import { useState } from "react";
import { Sparkles, Lock, ChevronDown, Info } from "lucide-react";

/**
 * Concept demande par Yann le 20 sept 2026 : signaler en haut d une page societe
 * qu elle contient un ou plusieurs indicateurs introuvables ailleurs, avec la
 * precision « aucune plateforme grand public » ecrite en petit dessous.
 * Cinq propositions, de la plus discrete a la plus explicite. Aucune n est
 * posee sur les pages reelles tant que Yann n a pas choisi.
 */

const SOCIETES: { ticker: string; nom: string; kpis: string[] }[] = [
  { ticker: "NFLX", nom: "Netflix", kpis: ["Heures visionnées (semestriel)", "Part du programmatique hors direct", "Événements en direct réalisés"] },
  { ticker: "AAPL", nom: "Apple", kpis: ["Base installée d’appareils actifs", "Visiteurs hebdomadaires de l’App Store"] },
  { ticker: "PLTR", nom: "Palantir", kpis: ["Requêtes API hebdomadaires sur AIP", "Revenu moyen des 20 premiers clients"] },
];

const NOTE = "Aucune plateforme grand public ne publie cet indicateur.";

function EnTete({ nom, ticker }: { nom: string; ticker: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] font-display text-[15px] font-bold text-zinc-200">
        {ticker.slice(0, 2)}
      </div>
      <div>
        <div className="font-display text-[22px] font-bold leading-tight tracking-tight text-zinc-50">{nom}</div>
        <div className="font-mono text-[11.5px] uppercase tracking-wider text-zinc-500">
          {ticker} · Services de communication
        </div>
      </div>
    </div>
  );
}

/* A : ligne pleine largeur, la plus sobre. */
function VarianteA({ s }: { s: (typeof SOCIETES)[number] }) {
  return (
    <div>
      <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.07] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 shrink-0 text-violet-300" />
          <span className="text-[13px] text-violet-100">
            Cette page contient {s.kpis.length > 1 ? `${s.kpis.length} indicateurs introuvables` : "un indicateur introuvable"} ailleurs.
          </span>
        </div>
        <p className="mt-1 pl-[22px] text-[10.5px] text-violet-200/50">{NOTE}</p>
      </div>
      <div className="mt-4">
        <EnTete nom={s.nom} ticker={s.ticker} />
      </div>
    </div>
  );
}

/* B : pastille posee a droite du nom de la societe, sans bloc separe. */
function VarianteB({ s }: { s: (typeof SOCIETES)[number] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <EnTete nom={s.nom} ticker={s.ticker} />
      <div className="text-right">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[12px] font-medium text-violet-100">
          <Lock className="size-3" />
          {s.kpis.length > 1 ? `${s.kpis.length} indicateurs exclusifs` : "1 indicateur exclusif"}
        </span>
        <p className="mt-1 text-[10.5px] text-zinc-500">{NOTE}</p>
      </div>
    </div>
  );
}

/* C : encadre qui nomme les indicateurs concernes. */
function VarianteC({ s }: { s: (typeof SOCIETES)[number] }) {
  return (
    <div>
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-r from-violet-500/[0.12] to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-violet-300" />
          <span className="font-display text-[14px] font-bold text-zinc-50">
            {s.kpis.length > 1 ? "Indicateurs que vous ne trouverez pas ailleurs" : "Un indicateur que vous ne trouverez pas ailleurs"}
          </span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-[24px]">
          {s.kpis.map((k) => (
            <li key={k} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11.5px] text-zinc-200">
              {k}
            </li>
          ))}
        </ul>
        <p className="mt-2 pl-[24px] text-[10.5px] text-zinc-500">{NOTE}</p>
      </div>
      <div className="mt-4">
        <EnTete nom={s.nom} ticker={s.ticker} />
      </div>
    </div>
  );
}

/* D : ruban fin colle en haut de page, hauteur minimale. */
function VarianteD({ s }: { s: (typeof SOCIETES)[number] }) {
  return (
    <div>
      <div className="-mx-4 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-violet-400/20 bg-violet-500/[0.06] px-4 py-1.5">
        <span className="text-[11.5px] font-medium text-violet-100">
          {s.kpis.length > 1 ? `${s.kpis.length} indicateurs de cette page sont introuvables ailleurs` : "Un indicateur de cette page est introuvable ailleurs"}
        </span>
        <span className="text-[10px] text-violet-200/45">{NOTE}</span>
      </div>
      <div className="mt-4">
        <EnTete nom={s.nom} ticker={s.ticker} />
      </div>
    </div>
  );
}

/* E : badge repliable, la liste s ouvre au clic. */
function VarianteE({ s }: { s: (typeof SOCIETES)[number] }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div>
      <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.07]">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
        >
          <Info className="size-3.5 shrink-0 text-violet-300" />
          <span className="text-[13px] text-violet-100">
            {s.kpis.length > 1 ? `${s.kpis.length} indicateurs introuvables ailleurs` : "Un indicateur introuvable ailleurs"}
          </span>
          <ChevronDown className={`ml-auto size-3.5 text-violet-300 transition-transform ${ouvert ? "rotate-180" : ""}`} />
        </button>
        {ouvert && (
          <ul className="space-y-1 border-t border-violet-400/15 px-4 py-2">
            {s.kpis.map((k) => (
              <li key={k} className="text-[12.5px] text-zinc-200">
                {k}
              </li>
            ))}
          </ul>
        )}
        <p className="px-4 pb-2 pl-[38px] text-[10.5px] text-violet-200/50">{NOTE}</p>
      </div>
      <div className="mt-4">
        <EnTete nom={s.nom} ticker={s.ticker} />
      </div>
    </div>
  );
}

const VARIANTES: { id: string; titre: string; sous: string; rendu: (s: (typeof SOCIETES)[number]) => React.ReactNode }[] = [
  { id: "A", titre: "Ligne pleine largeur", sous: "La plus sobre, ne nomme pas les indicateurs", rendu: (s) => <VarianteA s={s} /> },
  { id: "B", titre: "Pastille à droite du nom", sous: "Ne prend aucune hauteur supplémentaire", rendu: (s) => <VarianteB s={s} /> },
  { id: "C", titre: "Encadré qui nomme les indicateurs", sous: "Le plus explicite, le plus vendeur", rendu: (s) => <VarianteC s={s} /> },
  { id: "D", titre: "Ruban fin en haut de page", sous: "Deux lignes de texte, hauteur minimale", rendu: (s) => <VarianteD s={s} /> },
  { id: "E", titre: "Badge dépliable", sous: "Discret fermé, complet ouvert", rendu: (s) => <VarianteE s={s} /> },
];

export function KpiExclusifClient() {
  const [ticker, setTicker] = useState("NFLX");
  const societe = SOCIETES.find((s) => s.ticker === ticker) ?? SOCIETES[0];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight">Bandeau « introuvable ailleurs »</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-zinc-400">
          Cinq façons de signaler en haut d’une page société qu’elle contient un ou plusieurs indicateurs qu’aucune
          plateforme grand public ne publie. Choisissez une lettre, je la pose sur Netflix, Apple et Palantir.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {SOCIETES.map((s) => (
            <button
              key={s.ticker}
              type="button"
              onClick={() => setTicker(s.ticker)}
              className={`rounded-full border px-3 py-1 text-[12.5px] ${
                ticker === s.ticker
                  ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                  : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
              }`}
            >
              {s.nom}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-8">
          {VARIANTES.map((v) => (
            <section key={v.id}>
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-violet-300">{v.id}</span>
                <span className="text-[14px] font-semibold text-zinc-100">{v.titre}</span>
                <span className="text-[12px] text-zinc-500">{v.sous}</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-5">
                {v.rendu(societe)}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
