"use client";

/**
 * <LogoMettrik emplacement="home" /> — logo Mettrik piloté par la logothèque.
 *
 * Chaque endroit du site déclare SON emplacement. La variante affichée vient
 * du réglage enregistré dans le sandbox (/sandbox/logotheque) ; s'il n'y en a
 * pas, on retombe sur la variante globale de src/data/active-wordmark.json.
 *
 * Le premier rendu utilise la variante globale (connue au build) : pas d'écran
 * vide, pas de saut de mise en page. Le réglage réel arrive juste après via
 * /api/logotheque, chargé UNE seule fois par page et partagé entre toutes les
 * instances du composant.
 */

import { useEffect, useState } from "react";
import activeWordmark from "@/data/active-wordmark.json";
import {
  getWordmarkVariant,
  type WordmarkSize,
} from "@/components/wordmark-variants";
import { varianteDe, nettoieReglages, type ReglagesLogotheque } from "@/lib/logotheque";

let cache: ReglagesLogotheque | null = null;
let enCours: Promise<ReglagesLogotheque> | null = null;
const abonnes = new Set<(r: ReglagesLogotheque) => void>();

function chargeUneFois(): Promise<ReglagesLogotheque> {
  if (cache) return Promise.resolve(cache);
  if (enCours) return enCours;
  enCours = fetch("/api/logotheque")
    .then((r) => (r.ok ? r.json() : { reglages: {} }))
    .then((j) => nettoieReglages(j?.reglages))
    .catch(() => ({}) as ReglagesLogotheque)
    .then((r) => {
      cache = r;
      abonnes.forEach((f) => f(r));
      return r;
    });
  return enCours;
}

/** Invalide le cache après un enregistrement depuis le sandbox. */
export function rafraichitLogotheque(reglages: ReglagesLogotheque) {
  cache = nettoieReglages(reglages);
  enCours = null;
  abonnes.forEach((f) => f(cache!));
}

/**
 * Rendu PNG à largeur libre. La page de maintenance et la home affichent le
 * logo bien plus grand que la taille "lg" du registre (640 px de large contre
 * 132 px de haut). On garde donc leur rendu exact tant que la variante choisie
 * est un PNG ; toute autre variante repasse par le composant du registre.
 */
function PngLibre({
  largeur,
  hauteur,
  className,
}: {
  largeur?: string;
  hauteur?: string;
  className: string;
}) {
  const dim = hauteur ? { height: hauteur, width: "auto" } : { width: largeur, height: "auto" };
  return (
    <span
      className={`wordmark-png-v2 relative block ${className}`}
      style={hauteur ? { height: hauteur, lineHeight: 0, fontSize: 0 } : undefined}
    >
      <img
        src="/brand/mettrik-ai-white-purple.png"
        alt="Mettrik AI"
        className="wordmark-png-dark preserve-colors block select-none"
        style={dim}
        draggable={false}
      />
      <img
        src="/brand/mettrik-ai-black-purple.png"
        alt=""
        aria-hidden
        className="wordmark-png-light preserve-colors absolute inset-0 hidden select-none"
        style={dim}
        draggable={false}
      />
      <style>{`
        html[data-theme="light"] .wordmark-png-dark { display: none; }
        html[data-theme="light"] .wordmark-png-light { display: block !important; position: static !important; }
      `}</style>
    </span>
  );
}

type Props = {
  emplacement: string;
  size?: WordmarkSize;
  animated?: boolean;
  showRail?: boolean;
  showSubtitle?: boolean;
  className?: string;
  /** Largeur CSS imposée quand la variante retenue est un PNG. */
  largeurPng?: string;
  /** Hauteur CSS imposée quand la variante retenue est un PNG (prioritaire). */
  hauteurPng?: string;
};

export function LogoMettrik({
  emplacement,
  size = "lg",
  animated,
  showRail = true,
  showSubtitle = false,
  className = "",
  largeurPng,
  hauteurPng,
}: Props) {
  const [reglages, setReglages] = useState<ReglagesLogotheque | null>(cache);

  useEffect(() => {
    let vivant = true;
    const maj = (r: ReglagesLogotheque) => {
      if (vivant) setReglages(r);
    };
    abonnes.add(maj);
    void chargeUneFois();
    return () => {
      vivant = false;
      abonnes.delete(maj);
    };
  }, []);

  const id = varianteDe(emplacement, reglages, activeWordmark.id);
  if ((largeurPng || hauteurPng) && id.startsWith("logo-mtk-png")) {
    return <PngLibre largeur={largeurPng} hauteur={hauteurPng} className={className} />;
  }
  const Variante = getWordmarkVariant(id);
  return (
    <Variante
      size={size}
      animated={animated}
      showRail={showRail}
      showSubtitle={showSubtitle}
      className={className}
    />
  );
}
