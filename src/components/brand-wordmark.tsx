"use client";

/**
 * BrandWordmark — wordmark "Mettrik AI" canonique du projet.
 *
 * Depuis le 18 mai 2026 (Logo Lab), ce composant délègue au registry
 * `WORDMARK_VARIANTS` la variante visuelle choisie par Yann via
 * `/sandbox/logo-lab`. La sélection est lue dans `src/data/active-wordmark.json`
 * (id stable, ex `logo-mtk-v1.1`).
 *
 * API préservée pour ne pas casser les callers existants :
 *   - size : "sm" | "md" | "lg"
 *   - animated : booléen (entrée animée des lettres / pulse)
 *   - showRail : trace le rail iridescent sous le wordmark
 *   - showSubtitle : "KPI Intelligence" en mono uppercase
 *   - className : pour le wrapper externe
 */

import activeWordmark from "@/data/active-wordmark.json";
import {
  getWordmarkVariant,
  type WordmarkSize,
} from "@/components/wordmark-variants";

type Props = {
  size?: WordmarkSize;
  animated?: boolean;
  showRail?: boolean;
  showSubtitle?: boolean;
  className?: string;
};

export function BrandWordmark({
  size = "lg",
  animated,
  showRail = true,
  showSubtitle = false,
  className = "",
}: Props) {
  const Variant = getWordmarkVariant(activeWordmark.id);
  return (
    <Variant
      size={size}
      animated={animated}
      showRail={showRail}
      showSubtitle={showSubtitle}
      className={className}
    />
  );
}
