"use client";

/**
 * Proposition C : bande de cartes empilables.
 *
 * Les six arguments sont des cartes empilées en éventail. On clique une carte,
 * elle passe devant et se déplie en deux moitiés : Mettrik à gauche, Bloomberg
 * à droite. La prop `compact` garde trois cartes et une hauteur réduite pour
 * la page d’accueil.
 *
 * Côté Mettrik : uniquement des points forts. Côté Bloomberg : uniquement du
 * factuel public et sourçable.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Building2, Layers, Check } from "lucide-react";

type Carte = {
  cle: string;
  numero: string;
  titre: string;
  accroche: string;
  mettrik: string[];
  bloomberg: string[];
  cle3?: boolean;
};

const CARTES: Carte[] = [
  {
    cle: "couverture",
    numero: "01",
    titre: "Couverture",
    accroche: "671 sociétés des grands indices",
    mettrik: [
      "S&P 500, CAC 40, DAX 40, AEX 25, SMI et SOX",
      "Des indicateurs métier extraits des documents officiels",
      "Dix ans d’historique trimestriel",
    ],
    bloomberg: [
      "Univers mondial très large",
      "Données de marché en temps réel",
    ],
    cle3: true,
  },
  {
    cle: "lecture",
    numero: "02",
    titre: "Lisibilité",
    accroche: "Une fiche par société",
    mettrik: [
      "Un indicateur vedette mis en avant",
      "Les risques notés, la gouvernance",
      "Le positionnement en intelligence artificielle",
      "Une anti-thèse d’investissement",
    ],
    bloomberg: [
      "Environnement professionnel dense",
      "Navigation par codes de fonction",
    ],
    cle3: true,
  },
  {
    cle: "fraicheur",
    numero: "03",
    titre: "Fraîcheur",
    accroche: "Mise à jour automatique",
    mettrik: [
      "La fiche se rafraîchit après chaque publication de résultats",
      "Aucune relance manuelle",
    ],
    bloomberg: ["Diffusion continue des données de marché et des dépêches"],
  },
  {
    cle: "machine",
    numero: "04",
    titre: "Accès machine",
    accroche: "API et protocole MCP à venir",
    mettrik: [
      "Une interface de programmation (API)",
      "Une connexion aux assistants par le protocole MCP",
    ],
    bloomberg: ["Interface de programmation réservée aux abonnés du terminal"],
  },
  {
    cle: "prix",
    numero: "05",
    titre: "Prix",
    accroche: "Abonnement grand public",
    mettrik: [
      "Le tarif d’un service en ligne",
      "Pensé pour un particulier, pas pour une salle de marché",
    ],
    bloomberg: [
      "Plusieurs dizaines de milliers de dollars par an et par poste",
      "Fourchette publique de 24 000 à 30 000 dollars, fiche Wikipédia",
    ],
    cle3: true,
  },
  {
    cle: "acces",
    numero: "06",
    titre: "Mise en route",
    accroche: "Le navigateur suffit",
    mettrik: ["Aucune installation, aucun poste dédié", "Interface en français"],
    bloomberg: [
      "Logiciel dédié et licence nominative",
      "Interface et documentation principalement en anglais",
    ],
  },
];

export function VsBloombergC({ compact = false }: { compact?: boolean }) {
  const cartes = compact ? CARTES.filter((c) => c.cle3) : CARTES;
  const [active, setActive] = useState<number>(0);

  return (
    <section className="w-full bg-[#050507] text-zinc-100">
      <div className={`mx-auto w-full max-w-5xl px-4 ${compact ? "py-8" : "py-14"} sm:px-6`}>
        {!compact && (
          <header className="mb-7 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-cyan-200">
              <Layers className="size-3" />
              Six cartes
            </span>
            <h2 className="font-display mt-3 text-[26px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[34px]">
              Pourquoi Mettrik, et pas un terminal
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400 sm:text-[15px]">
              Une carte par argument. Cliquez pour la faire passer devant.
            </p>
          </header>
        )}

        {/* Onglets numérotés */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {cartes.map((c, i) => {
            const estActive = i === active;
            return (
              <button
                key={c.cle}
                type="button"
                onClick={() => setActive(i)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all sm:text-[12.5px] ${
                  estActive
                    ? "border border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                    : "border border-white/10 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                }`}
              >
                <span className="font-mono text-[10px] opacity-70">{c.numero}</span>
                {c.titre}
              </button>
            );
          })}
        </div>

        {/* Pile de cartes */}
        <div className={`relative ${compact ? "h-[420px] sm:h-[280px]" : "h-[470px] sm:h-[320px]"}`}>
          {cartes.map((c, i) => {
            const offset = (i - active + cartes.length) % cartes.length;
            const devant = offset === 0;
            return (
              <motion.button
                key={c.cle}
                type="button"
                onClick={() => setActive(i)}
                animate={{
                  y: offset * 10,
                  scale: 1 - offset * 0.035,
                  opacity: offset > 3 ? 0 : 1 - offset * 0.18,
                  zIndex: cartes.length - offset,
                }}
                transition={{ type: "spring", stiffness: 180, damping: 22 }}
                className={`absolute inset-x-0 top-0 cursor-pointer overflow-hidden rounded-2xl border text-left ${
                  devant
                    ? "border-cyan-500/30 bg-gradient-to-br from-[#0b1116] to-[#07090c] shadow-[0_18px_50px_-20px_rgba(34,211,238,0.35)]"
                    : "border-white/8 bg-[#08090c]"
                }`}
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="font-mono text-[11px] text-cyan-400/80">{c.numero}</span>
                    <span className="font-display truncate text-[14px] font-bold text-zinc-50 sm:text-[16px]">
                      {c.titre}
                    </span>
                  </div>
                  <span className="hidden truncate text-[11.5px] text-zinc-500 sm:block">
                    {c.accroche}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <div className="border-b border-white/8 bg-violet-500/[0.05] px-4 py-3.5 sm:border-b-0 sm:border-r">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-3.5 shrink-0 text-violet-300" />
                      <span className="font-display text-[12.5px] font-bold text-violet-100">
                        Mettrik AI
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {c.mettrik.map((p) => (
                        <li
                          key={p}
                          className="flex items-start gap-2 text-[12px] leading-snug text-zinc-200 sm:text-[12.5px]"
                        >
                          <Check className="mt-[2px] size-3 shrink-0 text-violet-300" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 shrink-0 text-zinc-500" />
                      <span className="font-display text-[12.5px] font-bold text-zinc-300">
                        Bloomberg Terminal
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {c.bloomberg.map((p) => (
                        <li
                          key={p}
                          className="flex items-start gap-2 text-[12px] leading-snug text-zinc-400 sm:text-[12.5px]"
                        >
                          <span className="mt-[6px] size-1 shrink-0 rounded-full bg-zinc-600" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Autre concurrent direct : aucun */}
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3.5">
          <p className="font-display text-[13px] font-bold text-amber-100 sm:text-[14px]">
            Autre concurrent direct : aucun
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-amber-200/70 sm:text-[12.5px]">
            Aucun autre service ne combine des indicateurs métier extraits des
            documents officiels, une lecture organisée société par société et un
            accès destiné aux machines.
          </p>
        </div>

        <p className="mt-3 text-[10.5px] leading-relaxed text-zinc-600">
          Les points cités sur Bloomberg sont publics et vérifiables. Prix :
          fourchette de 24 000 à 30 000 dollars par an et par poste, fiche
          Wikipédia « Bloomberg Terminal ».
        </p>
      </div>
    </section>
  );
}

export default VsBloombergC;
