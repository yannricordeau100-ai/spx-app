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

import { useState, type ReactNode } from "react";
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

  const enLabel = nameEn || short || nameFr;
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
  const tooltip = titleLang === "fr" ? tooltipFr : tooltipEn;

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
