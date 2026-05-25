"use client";

/**
 * BlurredFreeText — wrap les blocs de texte "plus-value" (PV) pour les
 * cacher en mode free. Visible en premium/max.
 *
 * Yann (25 mai 2026) : règle stricte = NE PAS flouter les chiffres seuls
 * (déjà couvert par BlurredFreeValue), NI le texte structurel (labels,
 * sectors, headers, dates). Wrap UNIQUEMENT le texte qui apporte la
 * plus-value (interprétation, signal, rationale, body story, etc.).
 *
 * Stratégie : floutage CSS + select-none + pointer-events-none. Le texte
 * EST encore dans le HTML (contrairement à BlurredFreeValue inviolable)
 * car il s'agit d'analyse rédactionnelle large : pas critique de cacher
 * le texte brut, seulement empêcher la lecture confortable. Pour V2 si
 * Yann veut inviolable strict, on rend `***` côté SSR.
 */

import { useFreemiumTier, isTickerLockedForTier } from "@/lib/freemium/context";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Override : force le floutage (true) ou la lisibilité (false). Si undefined, auto via contexte + ticker. */
  blocked?: boolean;
  /** Ticker de la sté courante (utilisé si blocked=undefined pour décider). */
  ticker?: string;
  /** Classe CSS appliquée (s'applique dans les 2 modes). */
  className?: string;
  /** Tag wrapper (défaut span). Utiliser "div" si le contenu est bloc. */
  as?: "span" | "div" | "p";
};

export function BlurredFreeText({
  children,
  blocked,
  ticker,
  className,
  as = "span",
}: Props) {
  const tier = useFreemiumTier();
  const isBlocked = blocked ?? (ticker ? isTickerLockedForTier(ticker, tier) : tier === "free" || tier === "anon");

  const Tag = as;
  if (!isBlocked) {
    return <Tag className={className}>{children}</Tag>;
  }

  // Bloqué : floute le contenu + désactive sélection/click. Premium CTA via
  // un cursor pointer + title (pas de modale modale-bloquante pour ne pas
  // gêner la lecture page).
  return (
    <Tag
      className={`${className ?? ""} relative cursor-pointer select-none`}
      style={{
        filter: "blur(5px)",
        WebkitUserSelect: "none",
        userSelect: "none",
        pointerEvents: "none",
      }}
      aria-hidden
      data-freemium-blocked-text
      title="Premium pour voir cette analyse"
    >
      {children}
    </Tag>
  );
}
