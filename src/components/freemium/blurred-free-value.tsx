"use client";

/**
 * BlurredFreeValue — affiche la valeur réelle avec un filtre CSS blur
 * par-dessus quand la sté est verrouillée pour le tier free.
 *
 * Yann (26 mai 2026) — refonte : ancien comportement = remplace par
 * placeholder ████ + cadenas + lien upgrade = catastrophe visuelle
 * (cases grises, repositionnement). Maintenant : on garde le texte
 * réel mais on applique `filter: blur(5px)` + select-none. Pas de
 * cadenas. Pas de Link. Le bloc garde EXACTEMENT sa taille et sa
 * position. Le visuel est cohérent et fluide.
 *
 * Trade-off honnêteté : le chiffre brut EST dans le HTML quand bloqué.
 * Pour un user déterminé via DevTools, c'est lisible. Mais l'objectif
 * Yann V1 = expérience visuelle propre, pas inviolabilité crypto. Pour
 * V2 si vraiment inviolable nécessaire, basculer en rendu SSR avec
 * placeholder côté serveur conditionné au tier (jamais sérialiser la
 * vraie valeur).
 */

import { useFreemiumTier, isTickerLockedForTier } from "@/lib/freemium/context";

type Props = {
  /** Valeur réelle à afficher (chiffre, % ou string formatée). */
  value: string | number | null | undefined;
  /** Suffix (ex " Mds $", " %", " ans"). Affiché à côté de la valeur. */
  suffix?: string;
  /** Override : force le floutage (true) ou la lisibilité (false). Si undefined, auto via contexte + ticker. */
  blocked?: boolean;
  /** Ticker de la sté courante (utilisé si blocked=undefined pour décider). */
  ticker?: string;
  /** Classe CSS appliquée. */
  className?: string;
};

export function BlurredFreeValue({
  value,
  suffix = "",
  blocked,
  ticker,
  className,
}: Props) {
  const tier = useFreemiumTier();
  const isBlocked = blocked ?? (ticker ? isTickerLockedForTier(ticker, tier) : tier === "free" || tier === "anon");

  if (!isBlocked) {
    return <span className={className}>{value ?? "—"}{suffix}</span>;
  }

  // Bloqué : valeur réelle gardée mais floutée par-dessus + select-none.
  // Pas de cadenas, pas de lien, pas de modification de position/taille.
  return (
    <span
      className={className}
      style={{
        filter: "blur(6px)",
        WebkitUserSelect: "none",
        userSelect: "none",
        pointerEvents: "none",
      }}
      aria-hidden
      data-freemium-blocked-value
    >
      {value ?? "—"}{suffix}
    </span>
  );
}
