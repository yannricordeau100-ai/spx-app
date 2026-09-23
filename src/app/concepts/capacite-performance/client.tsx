"use client";

import { useState } from "react";
import { BlocCapaciteA } from "@/components/capacite/bloc-capacite-a";
import { BlocCapaciteB } from "@/components/capacite/bloc-capacite-b";
import { BlocCapaciteC } from "@/components/capacite/bloc-capacite-c";
import {
  DEFAUT_INFLATION,
  DEFAUT_SANS_RISQUE,
  MARGE_ORANGE_PTS,
  formatPct,
  type CapaciteSociete,
  type ReglageReference,
} from "@/components/capacite/modele";
import { useReferenceMemorisee } from "@/components/capacite/use-reference";

const DESIGNS = [
  {
    id: "A" as const,
    titre: "Le verdict en toutes lettres",
    parti:
      "La phrase de synthèse passe avant les chiffres. Réglage discret en une ligne de texte, quatre lignes sobres en dessous. Densité maximale, aucun effet.",
  },
  {
    id: "B" as const,
    titre: "La règle graduée",
    parti:
      "Une règle horizontale commune et un trait qui marque le taux. Le message se lit à la position des barres, la couleur ne fait que confirmer. Le curseur déplace le trait en direct.",
  },
  {
    id: "C" as const,
    titre: "Les quatre cadrans",
    parti:
      "Quatre cadrans avec un repère gravé à la position du taux. La version la plus démonstrative, réglage au doigt par pas.",
  },
];

export function CapacitePerformanceClient({
  societes,
  tickerInitial = null,
  reglageImpose = null,
}: {
  societes: CapaciteSociete[];
  tickerInitial?: string | null;
  reglageImpose?: ReglageReference | null;
}) {
  const [reglage, setReglage] = useReferenceMemorisee(reglageImpose);
  const [ticker, setTicker] = useState(
    (tickerInitial && societes.some((s) => s.ticker === tickerInitial) ? tickerInitial : societes[0]?.ticker) ?? ""
  );
  const societe = societes.find((s) => s.ticker === ticker) ?? societes[0];

  if (!societe) {
    return <main className="p-8 text-zinc-300">Aucune donnée de rentabilité chargée.</main>;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight">
          Capacité théorique de la société à performer selon le taux sans risque ou l'inflation
        </h1>
        <p className="mt-1 max-w-3xl text-[14px] text-zinc-400">
          Trois designs du même bloc, avec les vraies données de huit sociétés. Le bloc se placera juste au dessus de
          la thèse d&apos;investissement. Le réglage est partagé entre les trois designs sur cette page, il est
          mémorisé d&apos;une visite à l&apos;autre dans le navigateur.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {societes.map((s) => (
            <button
              key={s.ticker}
              type="button"
              onClick={() => setTicker(s.ticker)}
              aria-pressed={s.ticker === societe.ticker}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                s.ticker === societe.ticker
                  ? "border-violet-400/60 bg-violet-400/10 text-violet-100"
                  : "border-white/10 text-zinc-300 hover:border-violet-400/40 hover:text-violet-100"
              }`}
            >
              {s.nom}
              <span className="ml-1.5 font-mono text-[11px] text-zinc-500">{s.ticker}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-10">
          {DESIGNS.map((d) => (
            <section key={d.id}>
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-violet-300">
                  Design {d.id}
                </span>
                <span className="text-[15px] font-semibold text-zinc-100">{d.titre}</span>
                <span className="max-w-2xl text-[12.5px] text-zinc-500">{d.parti}</span>
              </div>
              {d.id === "A" && <BlocCapaciteA societe={societe} reglage={reglage} onReglage={setReglage} />}
              {d.id === "B" && <BlocCapaciteB societe={societe} reglage={reglage} onReglage={setReglage} />}
              {d.id === "C" && <BlocCapaciteC societe={societe} reglage={reglage} onReglage={setReglage} />}
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-[13px] leading-relaxed text-zinc-400">
          <h2 className="text-[15px] font-semibold text-zinc-100">Règles appliquées dans les trois designs</h2>
          <ul className="mt-2 space-y-1.5">
            <li>
              Valeurs par défaut : taux sans risque {formatPct(DEFAUT_SANS_RISQUE)} (emprunt d&apos;État américain à
              dix ans, 4,96 % au 22 septembre 2026, source Trésor américain, arrondi au demi point) et inflation{" "}
              {formatPct(DEFAUT_INFLATION)} (hausse des prix sur douze mois aux États-Unis, 3,4 % en août 2026, source
              Bureau of Labor Statistics du 11 septembre 2026, arrondi au point).
            </li>
            <li>
              Vert à partir de {MARGE_ORANGE_PTS} points au dessus du taux, orange entre le taux et {MARGE_ORANGE_PTS}{" "}
              points, rouge en dessous.
            </li>
            <li>
              Au delà de 100 pour cent, le chiffre n&apos;est pas affiché : la mention « supérieur à 100 % » remplace
              la valeur et la mesure n&apos;est jamais comptée comme un avantage.
            </li>
            <li>Une mesure absente s&apos;écrit « non disponible », jamais un zéro ni un tiret.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
