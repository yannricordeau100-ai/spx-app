"use client";

/**
 * Proposition B : balance et face à face animé.
 *
 * On choisit un critère, la balance penche et les deux camps se font face.
 * La prop `compact` réduit à trois critères et resserre la mise en page pour
 * un bloc de page d’accueil.
 *
 * Côté Mettrik : uniquement des points forts. Côté Bloomberg : uniquement du
 * factuel public et sourçable, sans jugement de valeur.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Building2, ArrowRight } from "lucide-react";

type Critere = {
  cle: string;
  titre: string;
  mettrikTitre: string;
  mettrikPoints: string[];
  bloombergTitre: string;
  bloombergPoints: string[];
  court?: boolean;
};

const CRITERES: Critere[] = [
  {
    cle: "couverture",
    titre: "Couverture",
    mettrikTitre: "671 sociétés des grands indices",
    mettrikPoints: [
      "S&P 500, CAC 40, DAX 40, AEX 25, SMI, SOX",
      "Des indicateurs métier extraits des documents officiels",
      "Dix ans d’historique trimestriel",
    ],
    bloombergTitre: "Univers mondial",
    bloombergPoints: [
      "Très large couverture de marchés et de classes d’actifs",
      "Données de marché en temps réel",
    ],
    court: true,
  },
  {
    cle: "lecture",
    titre: "Lecture",
    mettrikTitre: "Une fiche par société",
    mettrikPoints: [
      "Un indicateur vedette mis en avant",
      "Les risques notés et la gouvernance",
      "Le positionnement en intelligence artificielle",
      "Une anti-thèse d’investissement",
    ],
    bloombergTitre: "Environnement professionnel",
    bloombergPoints: [
      "Écrans denses, navigation par codes de fonction",
      "Formation dédiée proposée par l’éditeur",
    ],
    court: true,
  },
  {
    cle: "fraicheur",
    titre: "Mise à jour",
    mettrikTitre: "Automatique après chaque publication",
    mettrikPoints: [
      "La fiche se rafraîchit seule après les résultats trimestriels",
      "Rien à relancer, rien à retélécharger",
    ],
    bloombergTitre: "Flux continu",
    bloombergPoints: ["Données de marché et dépêches diffusées en continu"],
  },
  {
    cle: "machine",
    titre: "Accès machine",
    mettrikTitre: "Deux modes d’accès à venir",
    mettrikPoints: [
      "Une interface de programmation (API)",
      "Une connexion aux assistants par le protocole MCP",
    ],
    bloombergTitre: "Interface de programmation",
    bloombergPoints: ["Réservée aux abonnés du terminal"],
  },
  {
    cle: "prix",
    titre: "Prix",
    mettrikTitre: "Abonnement grand public",
    mettrikPoints: [
      "Le tarif d’un service en ligne",
      "Accessible à un particulier, sans engagement de salle de marché",
    ],
    bloombergTitre: "Licence professionnelle",
    bloombergPoints: [
      "Plusieurs dizaines de milliers de dollars par an et par poste",
      "Fourchette publique de 24 000 à 30 000 dollars, fiche Wikipédia « Bloomberg Terminal »",
    ],
    court: true,
  },
  {
    cle: "acces",
    titre: "Mise en route",
    mettrikTitre: "Le navigateur suffit",
    mettrikPoints: [
      "Aucune installation, aucun poste dédié",
      "Interface en français",
    ],
    bloombergTitre: "Poste dédié",
    bloombergPoints: [
      "Logiciel installé et licence nominative",
      "Interface et documentation principalement en anglais",
    ],
  },
];

function Balance({ penche }: { penche: boolean }) {
  return (
    <div className="relative mx-auto h-16 w-full max-w-[280px] sm:h-20 sm:max-w-[340px]">
      <svg viewBox="0 0 340 90" className="h-full w-full" aria-hidden="true">
        {/* Socle */}
        <path d="M156 84 L184 84 L176 62 L164 62 Z" fill="rgba(255,255,255,0.10)" />
        <rect x="168" y="24" width="4" height="40" rx="2" fill="rgba(255,255,255,0.18)" />
        <motion.g
          animate={{ rotate: penche ? -9 : 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 12 }}
          style={{ originX: "170px", originY: "26px" }}
        >
          <rect x="44" y="23" width="252" height="5" rx="2.5" fill="rgba(167,139,250,0.55)" />
          {/* Plateau Mettrik */}
          <line x1="66" y1="26" x2="66" y2="48" stroke="rgba(167,139,250,0.45)" strokeWidth="1.5" />
          <ellipse cx="66" cy="52" rx="34" ry="7" fill="rgba(139,92,246,0.28)" stroke="rgba(167,139,250,0.7)" strokeWidth="1.5" />
          {/* Plateau Bloomberg */}
          <line x1="274" y1="26" x2="274" y2="48" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          <ellipse cx="274" cy="52" rx="34" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
        </motion.g>
        <circle cx="170" cy="26" r="6" fill="rgba(167,139,250,0.85)" />
      </svg>
    </div>
  );
}

export function VsBloombergB({ compact = false }: { compact?: boolean }) {
  const criteres = compact ? CRITERES.filter((c) => c.court) : CRITERES;
  const [actif, setActif] = useState<string>(criteres[0].cle);
  const courant = criteres.find((c) => c.cle === actif) ?? criteres[0];

  return (
    <section className="w-full bg-[#050507] text-zinc-100">
      <div className={`mx-auto w-full max-w-5xl px-4 ${compact ? "py-8" : "py-14"} sm:px-6`}>
        {!compact && (
          <header className="mb-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-violet-200">
              Face à face
            </span>
            <h2 className="font-display mt-3 text-[26px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[34px]">
              Mettrik AI, Bloomberg Terminal
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400 sm:text-[15px]">
              Choisissez un critère, la balance penche.
            </p>
          </header>
        )}

        <Balance penche={true} />

        {/* Sélecteur de critères */}
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {criteres.map((c) => {
            const estActif = c.cle === courant.cle;
            return (
              <button
                key={c.cle}
                type="button"
                onClick={() => setActif(c.cle)}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-all sm:text-[12.5px] ${
                  estActif
                    ? "bg-violet-500/25 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.35)]"
                    : "border border-white/10 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                }`}
              >
                {c.titre}
              </button>
            );
          })}
        </div>

        {/* Face à face */}
        <div className="mt-5 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`m-${courant.cle}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.28 }}
              className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.14] to-violet-500/[0.03] p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 shrink-0 text-violet-300" />
                <span className="font-display text-[13.5px] font-bold text-violet-100 sm:text-[15px]">
                  Mettrik AI
                </span>
              </div>
              <p className="mt-2.5 text-[15px] font-semibold leading-snug text-zinc-50 sm:text-[17px]">
                {courant.mettrikTitre}
              </p>
              <ul className="mt-3 space-y-1.5">
                {courant.mettrikPoints.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[12px] leading-snug text-zinc-300 sm:text-[13px]">
                    <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-violet-400" />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          {/* Axe central */}
          <div className="flex items-center justify-center sm:w-10">
            <div className="flex items-center gap-2 sm:flex-col">
              <div className="h-px w-8 bg-gradient-to-r from-violet-500/50 to-transparent sm:h-10 sm:w-px sm:bg-gradient-to-b" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">vs</span>
              <div className="h-px w-8 bg-gradient-to-l from-white/20 to-transparent sm:h-10 sm:w-px sm:bg-gradient-to-t" />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`b-${courant.cle}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.28 }}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <Building2 className="size-4 shrink-0 text-zinc-400" />
                <span className="font-display text-[13.5px] font-bold text-zinc-200 sm:text-[15px]">
                  Bloomberg Terminal
                </span>
              </div>
              <p className="mt-2.5 text-[15px] font-semibold leading-snug text-zinc-300 sm:text-[17px]">
                {courant.bloombergTitre}
              </p>
              <ul className="mt-3 space-y-1.5">
                {courant.bloombergPoints.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[12px] leading-snug text-zinc-400 sm:text-[13px]">
                    <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-zinc-600" />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Autre concurrent direct : aucun */}
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <ArrowRight className="size-4 shrink-0 text-amber-300" />
            <span className="font-display whitespace-nowrap text-[13px] font-bold text-amber-100 sm:text-[14px]">
              Autre concurrent direct : aucun
            </span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-amber-200/70 sm:text-[12.5px]">
            Personne d’autre ne réunit indicateurs métier tirés des documents,
            lecture société par société et accès prévu pour les machines.
          </p>
        </div>

        <p className="mt-3 text-center text-[10.5px] leading-relaxed text-zinc-600">
          Éléments Bloomberg publics et vérifiables. Prix : fourchette de 24 000 à
          30 000 dollars par an et par poste, fiche Wikipédia « Bloomberg Terminal ».
        </p>
      </div>
    </section>
  );
}

export default VsBloombergB;
