"use client";

import { useEffect } from "react";

/**
 * Force window scroll à (0, 0) à chaque mount du composant.
 *
 * Yann 26 mai 2026 : la page /pricing chargeait avec le scroll
 * positionné sur le bloc "plan détaillé" en bas (browser scroll
 * restoration). Ce composant client neutralise ce comportement et
 * garantit que l'utilisateur voit le hero + le toggle Mensuel/Annuel
 * en premier.
 */
export function ScrollToTopOnMount() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Désactive la restoration browser le temps de notre forçage
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
  return null;
}
