"use client";

/**
 * Point de montage unique de la bulle de support (Yann 21 sept 2026).
 *
 * Trois garde-fous :
 *   1. chargement dynamique sans rendu serveur, la bulle ne pèse pas sur le
 *      premier affichage de la page ;
 *   2. montage différé au premier temps mort du navigateur ;
 *   3. barrière d'erreur : si quoi que ce soit casse dans la bulle, la page
 *      qui la porte continue de fonctionner et la bulle disparaît.
 */

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

const SupportBubble = dynamic(() => import("./support-bubble").then((m) => m.SupportBubble), {
  ssr: false,
  loading: () => null,
});

class BarriereSupport extends Component<{ children: ReactNode }, { casse: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { casse: false };
  }

  static getDerivedStateFromError() {
    return { casse: true };
  }

  componentDidCatch(erreur: unknown) {
    // Volontairement silencieux pour le visiteur : la page reste intacte.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[support] bulle désactivée après une erreur", erreur);
    }
  }

  render() {
    if (this.state.casse) return null;
    return this.props.children;
  }
}

type FenetreAvecRepos = Window & {
  requestIdleCallback?: (rappel: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (identifiant: number) => void;
};

export function SupportLauncher() {
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let minuteur = 0;
    let repos = 0;
    const fenetre = window as FenetreAvecRepos;
    try {
      if (typeof fenetre.requestIdleCallback === "function") {
        repos = fenetre.requestIdleCallback(() => setPret(true), { timeout: 2500 });
      } else {
        minuteur = window.setTimeout(() => setPret(true), 1200);
      }
    } catch {
      minuteur = window.setTimeout(() => setPret(true), 1200);
    }
    return () => {
      if (minuteur) window.clearTimeout(minuteur);
      if (repos && typeof fenetre.cancelIdleCallback === "function") fenetre.cancelIdleCallback(repos);
    };
  }, []);

  if (!pret) return null;
  return (
    <BarriereSupport>
      <SupportBubble />
    </BarriereSupport>
  );
}

export default SupportLauncher;
