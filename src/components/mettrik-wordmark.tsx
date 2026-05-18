"use client";

/**
 * MettrikWordmark — wordmark utilisé historiquement sur /maintenance et
 * autres pages secondaires. Depuis Logo Lab (18 mai 2026), il délègue
 * comme BrandWordmark à la variante active choisie par Yann via
 * `/sandbox/logo-lab` (id stocké dans `src/data/active-wordmark.json`).
 *
 * API préservée :
 *   - size : "sm" | "md" | "lg"
 *   - showRail : trace le rail iridescent sous le wordmark
 *   - showSubtitle : "KPI Intelligence" en mono uppercase
 */

import activeWordmark from "@/data/active-wordmark.json";
import {
  getWordmarkVariant,
  type WordmarkSize,
} from "@/components/wordmark-variants";

export function MettrikWordmark({
  size = "lg",
  showRail = true,
  showSubtitle = false,
}: {
  size?: WordmarkSize;
  showRail?: boolean;
  showSubtitle?: boolean;
}) {
  const Variant = getWordmarkVariant(activeWordmark.id);
  return (
    <Variant
      size={size}
      showRail={showRail}
      showSubtitle={showSubtitle}
    />
  );
}
