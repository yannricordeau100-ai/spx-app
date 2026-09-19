"use client";

/**
 * Proposition A : tableau à deux colonnes.
 *
 * Comparatif Mettrik AI / Bloomberg Terminal, pensé pour être posé tel quel
 * dans la page d’accueil. La prop `compact` réduit la densité et ne garde que
 * les quatre lignes les plus parlantes.
 *
 * Règles de contenu :
 *  - côté Mettrik, uniquement des points où Mettrik est bon ;
 *  - côté Bloomberg, uniquement du factuel public et sourçable, sans jugement.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { Check, ChevronDown, Sparkles, Building2 } from "lucide-react";

type Ligne = {
  cle: string;
  critere: string;
  mettrik: string;
  mettrikDetail?: string[];
  bloomberg: string;
  phare?: boolean;
};

const LIGNES: Ligne[] = [
  {
    cle: "couverture",
    critere: "Couverture",
    mettrik: "671 sociétés des grands indices",
    mettrikDetail: [
      "S&P 500, CAC 40, DAX 40, AEX 25, SMI, SOX",
      "Indicateurs métier extraits des documents officiels",
      "Dix ans d’historique trimestriel",
    ],
    bloomberg: "Univers mondial très large, données de marché en temps réel",
    phare: true,
  },
  {
    cle: "lecture",
    critere: "Lecture",
    mettrik: "Une fiche par société, lisible d’un coup d’œil",
    mettrikDetail: [
      "Un indicateur vedette mis en avant",
      "Les risques notés, la gouvernance",
      "Le positionnement en intelligence artificielle",
      "Une anti-thèse d’investissement",
    ],
    bloomberg: "Environnement professionnel dense, navigation par codes de fonction",
    phare: true,
  },
  {
    cle: "fraicheur",
    critere: "Mise à jour",
    mettrik: "Automatique après chaque publication de résultats",
    mettrikDetail: ["Aucune manipulation, la fiche se met à jour seule"],
    bloomberg: "Flux continu de données de marché et de dépêches",
  },
  {
    cle: "machine",
    critere: "Accès machine",
    mettrik: "Deux modes d’accès à venir",
    mettrikDetail: [
      "Interface de programmation (API)",
      "Connexion aux assistants par le protocole MCP",
    ],
    bloomberg: "Interface de programmation réservée aux abonnés du terminal",
  },
  {
    cle: "prix",
    critere: "Prix",
    mettrik: "Abonnement grand public",
    mettrikDetail: ["Le prix d’un service en ligne, pas d’un poste de marché"],
    bloomberg: "Plusieurs dizaines de milliers de dollars par an et par poste",
    phare: true,
  },
  {
    cle: "installation",
    critere: "Mise en route",
    mettrik: "Pas d’installation, le navigateur suffit",
    mettrikDetail: ["Interface en français"],
    bloomberg: "Logiciel dédié et licence nominative",
    phare: true,
  },
];

export function VsBloombergA({ compact = false }: { compact?: boolean }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const lignes = compact ? LIGNES.filter((l) => l.phare) : LIGNES;

  return (
    <section className="w-full bg-[#050507] text-zinc-100">
      <div className={`mx-auto w-full max-w-5xl px-4 ${compact ? "py-8" : "py-14"} sm:px-6`}>
        {!compact && (
          <header className="mb-8 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-violet-200">
              Comparatif
            </span>
            <h2 className="font-display mt-3 text-[26px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[34px]">
              Mettrik AI face au terminal professionnel
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400 sm:text-[15px]">
              Deux outils, deux publics. Voici ce que Mettrik apporte à qui veut
              comprendre une société sans passer par une salle de marché.
            </p>
          </header>
        )}

        {/* En tête des deux colonnes */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
          <div className="hidden sm:block" />
          <div className="rounded-t-xl border border-violet-500/30 bg-gradient-to-b from-violet-500/20 to-violet-500/[0.04] px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-violet-300" />
              <span className="font-display text-[13.5px] font-bold text-violet-100 sm:text-[15px]">
                Mettrik AI
              </span>
            </div>
            <p className="mt-1 text-[10.5px] text-violet-200/70 sm:text-[11.5px]">
              Lecture d’entreprise, en ligne
            </p>
          </div>
          <div className="rounded-t-xl border border-white/10 bg-white/[0.04] px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 shrink-0 text-zinc-400" />
              <span className="font-display text-[13.5px] font-bold text-zinc-200 sm:text-[15px]">
                Bloomberg Terminal
              </span>
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-500 sm:text-[11.5px]">
              Poste de marché professionnel
            </p>
          </div>
        </div>

        {/* Lignes */}
        <div className="mt-2 space-y-2 sm:mt-3 sm:space-y-1.5">
          {lignes.map((l, i) => {
            const estOuvert = ouvert === l.cle;
            const pliable = !compact && !!l.mettrikDetail?.length;
            return (
              <motion.div
                key={l.cle}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.25) }}
                className="rounded-xl border border-white/8 bg-white/[0.015] p-2 sm:grid sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)_minmax(0,1fr)] sm:items-stretch sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0"
              >
                {/* Critère */}
                <div className="px-1 pb-2 sm:flex sm:items-center sm:px-0 sm:pb-0">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                    {l.critere}
                  </span>
                </div>

                {/* Mettrik */}
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-3 sm:rounded-none sm:border-x sm:border-y-0 sm:border-violet-500/25 sm:px-4">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-violet-300" />
                    <span className="text-[13px] font-medium leading-snug text-zinc-100 sm:text-[13.5px]">
                      {l.mettrik}
                    </span>
                  </div>
                  {pliable && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOuvert(estOuvert ? null : l.cle)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-violet-300/80 transition-colors hover:text-violet-200"
                      >
                        {estOuvert ? "Replier" : "Voir le détail"}
                        <ChevronDown
                          className={`size-3 transition-transform ${estOuvert ? "rotate-180" : ""}`}
                        />
                      </button>
                      <motion.div
                        initial={false}
                        animate={{ height: estOuvert ? "auto" : 0, opacity: estOuvert ? 1 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <ul className="space-y-1 pt-2">
                          {l.mettrikDetail?.map((d) => (
                            <li
                              key={d}
                              className="flex items-start gap-1.5 text-[11.5px] leading-snug text-zinc-400"
                            >
                              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-violet-400/70" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Bloomberg */}
                <div className="mt-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-3 sm:mt-0 sm:rounded-none sm:border-x sm:border-y-0 sm:border-white/10 sm:px-4">
                  <span className="text-[12.5px] leading-snug text-zinc-400 sm:text-[13px]">
                    {l.bloomberg}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Autre concurrent direct : aucun */}
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3.5">
          <p className="font-display text-[13px] font-bold text-amber-100 sm:text-[14px]">
            Autre concurrent direct : aucun
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-amber-200/70 sm:text-[12.5px]">
            Aucun autre service ne réunit les trois à la fois : des indicateurs
            métier extraits des documents officiels, une lecture organisée société
            par société, et un accès prévu pour les machines.
          </p>
        </div>

        <p className="mt-3 text-[10.5px] leading-relaxed text-zinc-600">
          Source du prix Bloomberg : fourchette publique de 24 000 à 30 000 dollars
          par an et par poste, citée par la fiche Wikipédia « Bloomberg Terminal ».
          Les éléments retenus sur Bloomberg sont publics et vérifiables.
        </p>
      </div>
    </section>
  );
}

export default VsBloombergA;
