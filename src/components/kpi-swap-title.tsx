"use client";

/**
 * KpiSwapTitle (Yann 5 juin 2026)
 *
 * Petit composant utilitaire qui rend le titre d'un KPI (hero du graph
 * ou ligne du tableau Indicateurs clés) avec la possibilité de basculer
 * en live entre français et anglais d'un simple clic. Re-clic = retour.
 *
 * Comportement :
 * - Le state local `titleLang` détermine quelle version est affichée
 *   (`fr` → name_fr, `en` → name_en ou fallback `short`).
 * - L'état part de la langue passée en `defaultLang` (par défaut la
 *   locale active de l'app : fr si user FR, en sinon).
 * - Au clic sur le titre, on toggle entre 'fr' et 'en'.
 * - Si une `timeFraction` non-annuelle est fournie, on ajoute le suffixe
 *   "par semaine / per week / par jour / per day / etc." dans la même
 *   langue que le titre. Source FR : dictionary.ts clé timefrac.suffix.X.
 * - Le composant n'écrit rien dans le dataset et ne touche pas à la
 *   locale globale de l'app. Modification purement visuelle locale.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { TimeFraction } from "@/components/charts/time-fraction-toggle";

/** Suffixes temps FR ↔ EN, alignés avec dictionary.ts (timefrac.suffix.*). */
const TIME_SUFFIX: Record<Exclude<TimeFraction, "year">, { fr: string; en: string }> = {
  month: { fr: "par mois", en: "per month" },
  week: { fr: "par semaine", en: "per week" },
  day: { fr: "par jour", en: "per day" },
  hour: { fr: "par heure", en: "per hour" },
  minute: { fr: "par minute", en: "per minute" },
  second: { fr: "par seconde", en: "per second" },
};

export type TitleLang = "fr" | "en";

/** 28 sept 2026 (Yann, O « ffo_ps_annuel ») : jamais un code technique comme
 *  titre anglais. Le code court ne sert que s il ressemble a un vrai libelle. */
/** 7 oct 2026 (Yann, « Rd Intensity ») : un name_en qui n est que l identifiant
 *  technique remis en capitales initiales (CAHIER_RD_INTENSITY -> « Rd Intensity »)
 *  n est pas un libelle anglais : il ne s affiche jamais. */
export function nomEnTechnique(nameEn?: string | null, short?: string | null): boolean {
  if (!nameEn || !short) return false;
  const n = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (n(nameEn) !== n(short.replace(/^CAHIER_/, ""))) return false;
  return /^CAHIER_/.test(short) || /^[A-Z][a-z0-9]*( [A-Z][a-z0-9]*)+$/.test(nameEn) && /[_-]/.test(short);
}

export function libelleAnglais(nameEn?: string | null, short?: string | null, nameFr?: string | null): string {
  if (nameEn && nameEn.trim() && !nomEnTechnique(nameEn, short)) return nameEn;
  const c = (short ?? "").trim();
  const estCode = !c || /_/.test(c) || /^[A-Z0-9]+$/.test(c) || !/[A-Z]/.test(c);
  return !estCode ? c : (nameFr ?? c);
}

export function KpiSwapTitle({
  nameFr,
  nameEn,
  short,
  defaultLang = "fr",
  timeFraction,
  className,
  suffixClassName,
  tooltipFr = "Cliquer pour basculer FR/EN",
  tooltipEn = "Click to switch FR/EN",
  /**
   * Permet aux parents de réagir au toggle (ex : pour synchroniser
   * d'autres titres). Optionnel.
   */
  onLangChange,
  children,
}: {
  nameFr: string;
  nameEn?: string;
  /** Code court (fallback EN si name_en absent — c'est l'EN par défaut). */
  short?: string;
  defaultLang?: TitleLang;
  timeFraction?: TimeFraction;
  className?: string;
  suffixClassName?: string;
  tooltipFr?: string;
  tooltipEn?: string;
  onLangChange?: (next: TitleLang) => void;
  /** Permet d'insérer du contenu adjacent (tooltip "i", badges, etc.). */
  children?: ReactNode;
}) {
  const [titleLang, setTitleLang] = useState<TitleLang>(defaultLang);

  const enLabel = libelleAnglais(nameEn, short, nameFr);
  const label = titleLang === "fr" ? nameFr : enLabel;

  const suffix = timeFraction && timeFraction !== "year"
    ? TIME_SUFFIX[timeFraction as Exclude<TimeFraction, "year">]
    : null;
  const suffixLabel = suffix ? suffix[titleLang] : null;

  const handleClick = (e?: { stopPropagation?: () => void }) => {
    // Si le parent (KpiRow par ex.) a un onClick global, le clic sur le
    // titre ne doit PAS déclencher la promotion / navigation parent.
    e?.stopPropagation?.();
    setTitleLang((prev) => {
      const next: TitleLang = prev === "fr" ? "en" : "fr";
      onLangChange?.(next);
      return next;
    });
  };

  // Tooltip dans la langue courante (cohérent avec ce que l'utilisateur voit).
  // 26 sept 2026 : l infobulle suit la langue du SITE, pas celle du titre
  // affiche (un visiteur francais lisait « Click to switch FR/EN »).
  // Langue du site lue apres l hydratation (evite un ecart serveur/client).
  const [siteFr, setSiteFr] = useState(false);
  useEffect(() => {
    setSiteFr((document.documentElement.lang || "fr").startsWith("fr"));
  }, []);
  const tooltip = siteFr ? tooltipFr : titleLang === "fr" ? tooltipFr : tooltipEn;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => handleClick(e)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            handleClick();
          }
        }}
        title={tooltip}
        aria-label={tooltip}
        className={`cursor-pointer select-none transition-colors hover:text-white ${className ?? ""}`}
      >
        {label}
        {suffixLabel && (
          <span className={suffixClassName}>
            {" "}
            {suffixLabel}
          </span>
        )}
      </span>
      {children}
    </>
  );
}
