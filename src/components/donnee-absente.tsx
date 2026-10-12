"use client";

/**
 * Donnée absente parce que NON PUBLIÉE (Yann, 13 oct 2026).
 *
 * Trois formes, un seul vocabulaire (src/lib/donnees-absentes.ts) :
 *  - « carte » : à la place d un bloc ou d un onglet ;
 *  - « ligne » : une ligne sobre dans un bloc (moat, clients) ;
 *  - « valeur » : un mot à la place d une valeur (snapshot, pastille).
 *
 * Style volontairement distinct d une zone floutée (texte net, bord en
 * pointillé, teinte neutre) et du carton « Disponible bientôt » (pas de vert,
 * pas d horloge). Chaque famille d absence a son petit dessin animé, lent et
 * continu, sans clignotement ; animation coupée si le visiteur a demandé moins
 * de mouvement.
 */
import { motion, useReducedMotion } from "motion/react";
import { ABSENCES, type AbsenceId, type MotifAbsence } from "@/lib/donnees-absentes";

const TRAIT = "#a1a1aa";
const DOUX = "rgba(161,161,170,0.35)";

function boucle(duree: number, reduit: boolean) {
  return reduit ? { duration: 0 } : { duration: duree, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const };
}

/** Petit dessin animé, propre à chaque famille d absence. */
export function MotifAnime({ motif, accent = "#a78bfa", taille = 28 }: { motif: MotifAbsence; accent?: string; taille?: number }) {
  const reduit = Boolean(useReducedMotion());
  const commun = { width: taille, height: taille, viewBox: "0 0 32 32", fill: "none", "aria-hidden": true } as const;
  const sw = 1.6;
  switch (motif) {
    case "globe":
      // Méridien qui tourne lentement autour d un globe, sans tranche.
      return (
        <svg {...commun}>
          <circle cx="16" cy="16" r="11" stroke={TRAIT} strokeWidth={sw} />
          <line x1="5" y1="16" x2="27" y2="16" stroke={DOUX} strokeWidth={sw} />
          <motion.ellipse cx="16" cy="16" ry="11" stroke={accent} strokeWidth={sw}
            initial={{ rx: 10 }} animate={{ rx: reduit ? 5 : [10, 1.5, 10] }}
            transition={reduit ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: "easeInOut" }} />
        </svg>
      );
    case "segment":
      // Une seule barre qui se remplit d un bout à l autre : une seule activité.
      return (
        <svg {...commun}>
          <rect x="4" y="12" width="24" height="8" rx="4" stroke={TRAIT} strokeWidth={sw} />
          <motion.rect x="6" y="14" height="4" rx="2" fill={accent}
            initial={{ width: 0, opacity: 0.5 }} animate={{ width: 20, opacity: reduit ? 0.9 : [0.55, 0.95, 0.55] }}
            transition={reduit ? { duration: 0 } : { width: { duration: 1.4, ease: "easeOut" }, opacity: { duration: 6, repeat: Infinity, ease: "easeInOut" } }} />
        </svg>
      );
    case "holding":
      // Participations reliées à la holding par des liens qui circulent.
      return (
        <svg {...commun}>
          <rect x="12" y="4" width="8" height="7" rx="2" stroke={TRAIT} strokeWidth={sw} />
          {[7, 16, 25].map((x) => (
            <g key={x}>
              <motion.line x1="16" y1="11" x2={x} y2="22" stroke={accent} strokeWidth={1.2} strokeDasharray="2 2.5"
                animate={{ strokeDashoffset: reduit ? 0 : [0, -9] }} transition={reduit ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: "linear" }} />
              <circle cx={x} cy="25" r="3" stroke={TRAIT} strokeWidth={sw} />
            </g>
          ))}
        </svg>
      );
    case "cible":
      // Cible dont l anneau extérieur, en pointillé, tourne très lentement.
      return (
        <svg {...commun}>
          <circle cx="16" cy="16" r="3" fill={DOUX} />
          <circle cx="16" cy="16" r="7.5" stroke={TRAIT} strokeWidth={sw} />
          <motion.circle cx="16" cy="16" r="12" stroke={accent} strokeWidth={sw} strokeDasharray="3 4"
            animate={{ rotate: reduit ? 0 : 360 }} transition={reduit ? { duration: 0 } : { duration: 40, repeat: Infinity, ease: "linear" }} />
        </svg>
      );
    case "calendrier":
      return (
        <svg {...commun}>
          <rect x="5" y="7" width="22" height="20" rx="3" stroke={TRAIT} strokeWidth={sw} />
          <line x1="5" y1="12" x2="27" y2="12" stroke={TRAIT} strokeWidth={sw} />
          <motion.rect x="12.5" y="16" width="7" height="6" rx="1.5" stroke={accent} strokeWidth={1.2} strokeDasharray="2 2"
            animate={{ opacity: reduit ? 0.8 : [0.35, 0.9, 0.35] }} transition={boucle(7, reduit)} />
        </svg>
      );
    case "drapeau":
      // Document avec un petit fanion qui ondule : émetteur étranger.
      return (
        <svg {...commun}>
          <path d="M7 5h12l6 6v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke={TRAIT} strokeWidth={sw} />
          <line x1="10" y1="9" x2="10" y2="23" stroke={TRAIT} strokeWidth={1.2} />
          <motion.path d="M10 9.5h8l-2 2.5 2 2.5h-8" fill={accent} fillOpacity={0.5} stroke={accent} strokeWidth={1}
            style={{ transformBox: "fill-box", transformOrigin: "0% 50%" }}
            animate={{ skewY: reduit ? 0 : [0, -7, 0] }} transition={reduit ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: "easeInOut" }} />
        </svg>
      );
    case "enveloppe":
      // Plusieurs personnes fondues en un seul montant.
      return (
        <svg {...commun}>
          <rect x="5" y="19" width="22" height="7" rx="3.5" stroke={TRAIT} strokeWidth={sw} />
          {[9, 16, 23].map((x, i) => (
            <motion.circle key={x} cy="11" r="2.6" fill={i === 1 ? accent : DOUX}
              initial={{ cx: x }} animate={{ cx: reduit ? x : [x, 16, x] }}
              transition={reduit ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: "easeInOut" }} />
          ))}
        </svg>
      );
    case "jalon":
      // Un premier jalon posé, la suite de la frise encore à tracer.
      return (
        <svg {...commun}>
          <line x1="4" y1="16" x2="12" y2="16" stroke={TRAIT} strokeWidth={sw} />
          <motion.line x1="12" y1="16" x2="28" y2="16" stroke={DOUX} strokeWidth={sw} strokeDasharray="2 3"
            animate={{ strokeDashoffset: reduit ? 0 : [0, -10] }} transition={reduit ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: "linear" }} />
          <motion.circle cx="10" cy="16" r="3.5" fill={accent}
            animate={{ opacity: reduit ? 1 : [0.65, 1, 0.65] }} transition={boucle(6, reduit)} />
        </svg>
      );
    case "micro":
      // Micro dont les ondes s éteignent doucement.
      return (
        <svg {...commun}>
          <rect x="12.5" y="5" width="7" height="13" rx="3.5" stroke={TRAIT} strokeWidth={sw} />
          <path d="M9 15a7 7 0 0 0 14 0M16 22v5" stroke={TRAIT} strokeWidth={sw} strokeLinecap="round" />
          <motion.path d="M5 10a12 12 0 0 0 0 10M27 10a12 12 0 0 1 0 10" stroke={accent} strokeWidth={1.3} strokeLinecap="round"
            animate={{ opacity: reduit ? 0.25 : [0.6, 0.08, 0.6] }} transition={boucle(8, reduit)} />
        </svg>
      );
    case "piece":
      return (
        <svg {...commun}>
          <circle cx="16" cy="16" r="11" stroke={TRAIT} strokeWidth={sw} />
          <motion.circle cx="16" cy="16" r="7" stroke={accent} strokeWidth={1.3} strokeDasharray="2.5 3"
            animate={{ rotate: reduit ? 0 : -360 }} transition={reduit ? { duration: 0 } : { duration: 30, repeat: Infinity, ease: "linear" }} />
        </svg>
      );
    case "lunette":
      // Loupe qui balaie lentement un horizon vide.
      return (
        <svg {...commun}>
          <line x1="3" y1="24" x2="29" y2="24" stroke={DOUX} strokeWidth={sw} strokeDasharray="2 3" />
          <motion.g animate={{ x: reduit ? 0 : [-4, 4, -4] }} transition={reduit ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: "easeInOut" }}>
            <circle cx="14" cy="13" r="6" stroke={accent} strokeWidth={sw} />
            <line x1="18.5" y1="17.5" x2="22" y2="21" stroke={TRAIT} strokeWidth={sw} strokeLinecap="round" />
          </motion.g>
        </svg>
      );
    case "anneau":
      return (
        <svg {...commun}>
          <circle cx="16" cy="16" r="11" stroke={DOUX} strokeWidth={3} />
          <motion.circle cx="16" cy="16" r="11" stroke={accent} strokeWidth={3} strokeDasharray="4 6" strokeLinecap="round"
            animate={{ rotate: reduit ? 0 : 360 }} transition={reduit ? { duration: 0 } : { duration: 36, repeat: Infinity, ease: "linear" }} />
        </svg>
      );
    case "fusion":
      // Deux sociétés qui s approchent sans jamais fusionner.
      return (
        <svg {...commun}>
          <motion.circle cy="16" r="6" stroke={TRAIT} strokeWidth={sw} initial={{ cx: 9 }} animate={{ cx: reduit ? 9 : [9, 12, 9] }}
            transition={reduit ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: "easeInOut" }} />
          <motion.circle cy="16" r="6" stroke={accent} strokeWidth={sw} initial={{ cx: 23 }} animate={{ cx: reduit ? 23 : [23, 20, 23] }}
            transition={reduit ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        </svg>
      );
  }
}

/**
 * Carte d absence. `texte` remplace le texte par défaut (ex commentaire publié
 * propre à la société) ; `liste` ajoute des puces (ex éléments non publiés).
 */
export function DonneeAbsente({
  id,
  variante = "carte",
  accent,
  texte,
  liste,
  sansTexte = false,
  className = "",
}: {
  id: AbsenceId;
  variante?: "carte" | "ligne";
  accent?: string;
  texte?: string | null;
  liste?: string[];
  /** Ligne : titre seul, quand le bloc affiche deja une explication propre a la societe. */
  sansTexte?: boolean;
  className?: string;
}) {
  const a = ABSENCES[id];
  const reduit = Boolean(useReducedMotion());
  const corps = texte && texte.trim() ? texte : a.texte;
  if (variante === "ligne") {
    return (
      <div role="note" data-donnee-absente={id} className={`flex items-center gap-2.5 ${className}`}>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.02]">
          <MotifAnime motif={a.motif} accent={accent} taille={20} />
        </span>
        <span className="min-w-0 text-[12px] leading-snug text-zinc-400">
          <span className="font-semibold text-zinc-200">{a.titre}</span>
          {!sansTexte && <><span className="text-zinc-500"> · </span>{corps}</>}
        </span>
      </div>
    );
  }
  return (
    <motion.div
      role="note"
      aria-label={a.titre}
      data-donnee-absente={id}
      initial={reduit ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-xl border border-dashed border-white/[0.13] bg-white/[0.015] p-4 sm:p-5 ${className}`}
    >
      {/* Mobile : dessin et titre sur une ligne, texte sur toute la largeur dessous. */}
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] sm:size-12">
          <MotifAnime motif={a.motif} accent={accent} />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{a.mention}</div>
          <div className="mt-0.5 text-[14.5px] font-semibold leading-snug text-zinc-100">{a.titre}</div>
        </div>
      </div>
      <div className="mt-2 sm:pl-[60px]">
        <p className="text-[13px] leading-relaxed text-zinc-400">{corps}</p>
        {liste && liste.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-[13px] leading-relaxed text-zinc-400">
            {liste.map((l) => (
              <li key={l} className="flex gap-2"><span aria-hidden className="text-zinc-600">·</span><span>{l}</span></li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

/** Mot court à la place d une valeur (snapshot, pastille), avec son explication au survol. */
export function ValeurAbsente({ id, accent }: { id: AbsenceId; accent?: string }) {
  const a = ABSENCES[id];
  return (
    <span data-donnee-absente={id} title={a.texte} className="inline-flex cursor-help items-center justify-end gap-1.5 text-zinc-400">
      <MotifAnime motif={a.motif} accent={accent} taille={14} />
      <span>{a.court}</span>
    </span>
  );
}
