/**
 * Style d ecriture de l axe Y des graphiques (Yann 13 oct 2026).
 *
 * Point unique : le style actif se lit dans style-axe-y.json (champ « actif »),
 * partage avec scripts/style_axe_y.py (KPI moyen terme). Valeurs :
 *   - actuel : ecriture d avant le 13 oct (police systeme a chasse fixe) ;
 *   - A, B, C : les trois propositions de /concepts/axe-y.
 *
 * Tant que « actif » vaut « actuel », les graphiques en ligne sortent a
 * l identique (memes attributs SVG). Activer A, B ou C demande aussi de
 * charger la police correspondante dans src/app/layout.tsx (voir
 * docs/rapports-session-2026-10/axe-y-13oct.md).
 */
import { createContext, useContext, type CSSProperties } from "react";
import REGLAGE from "./style-axe-y.json";

export type IdStyleAxeY = "actuel" | "A" | "B" | "C";

export type StyleAxeY = {
  id: IdStyleAxeY;
  nom: string;
  parti: string;
  graduation: {
    /** Valeur de l attribut SVG font-family (repli si la variable CSS manque). */
    famille: string;
    /** Police reelle via style CSS (variable next/font), null = attribut seul. */
    familleCss: string | null;
    poids: number;
    couleur: string;
    /** Multiplicateur de la taille d origine du graphique. */
    echelle: number;
    css?: CSSProperties;
    /** Largeur moyenne d un chiffre en em (sert aux reserves de marge). */
    chasse: number;
    /** Vrai signe moins (U+2212) et espace fine avant %. */
    typo: boolean;
    /** Trait de graduation dessine contre l axe (longueur en unites SVG). */
    trait: null | { longueur: number; couleur: string; epaisseur: number };
  };
  entete: {
    disposition: "haut" | "vertical";
    famille: string;
    familleCss: string | null;
    poids: number;
    couleur: string;
    echelle: number;
    css?: CSSProperties;
    /** Developpe les abreviations (« Mds $ » -> « en milliards de $ »). */
    developpe: boolean;
    /** Petites capitales composees a la main (capitales reduites, interlettrage). */
    capitales: boolean;
    /** Trait de plume sous l en-tete. */
    souligne: boolean;
  };
};

const MONO = "ui-monospace, monospace";

export const STYLES_AXE_Y: Record<IdStyleAxeY, StyleAxeY> = {
  actuel: {
    id: "actuel",
    nom: "En ligne aujourd’hui",
    parti: "Police système à chasse fixe (SF Mono sur Mac, Consolas sur Windows), unité écrite en haut de l’axe.",
    graduation: { famille: MONO, familleCss: null, poids: 500, couleur: "#e4e4e7", echelle: 1, chasse: 0.62, typo: false, trait: null },
    entete: { disposition: "haut", famille: MONO, familleCss: null, poids: 600, couleur: "#e4e4e7", echelle: 1, developpe: false, capitales: false, souligne: false },
  },
  A: {
    id: "A",
    nom: "A · Graveur condensé",
    parti: "La police d’affichage de Mettrik (Bricolage Grotesque) resserrée sur son axe de largeur, chiffres tabulaires, unité composée en petites capitales et posée debout le long de l’axe, comme sur une règle gravée.",
    graduation: {
      famille: "Bricolage Grotesque, sans-serif",
      familleCss: "var(--font-axe-a), sans-serif",
      poids: 560,
      couleur: "#e4e4e7",
      echelle: 1.06,
      css: { fontVariationSettings: "'wdth' 75, 'opsz' 14", fontFeatureSettings: "'tnum' 1, 'lnum' 1", letterSpacing: "0.01em" },
      chasse: 0.47,
      typo: true,
      trait: null,
    },
    entete: {
      disposition: "vertical",
      famille: "Bricolage Grotesque, sans-serif",
      familleCss: "var(--font-axe-a), sans-serif",
      poids: 620,
      couleur: "#b4b4bc",
      echelle: 0.86,
      css: { fontVariationSettings: "'wdth' 88, 'opsz' 12", letterSpacing: "0.16em" },
      developpe: false,
      capitales: true,
      souligne: false,
    },
  },
  B: {
    id: "B",
    nom: "B · Registre",
    parti: "Chiffres elzéviriens (qui montent et descendent comme dans un livre) d’un serif calligraphique, Alegreya, petits traits de graduation dessinés contre l’axe et unité écrite en toutes lettres en italique : un rapport annuel imprimé, pas un tableau de bord.",
    graduation: {
      famille: "Alegreya, Georgia, serif",
      familleCss: "var(--font-axe-b), Georgia, serif",
      poids: 520,
      couleur: "#e4e4e7",
      echelle: 1.06,
      css: { fontFeatureSettings: "'tnum' 1" },
      chasse: 0.52,
      typo: true,
      trait: { longueur: 7, couleur: "#71717a", epaisseur: 1.2 },
    },
    entete: {
      disposition: "haut",
      famille: "Alegreya, Georgia, serif",
      familleCss: "var(--font-axe-b), Georgia, serif",
      poids: 480,
      couleur: "#d4d4d8",
      echelle: 1.15,
      css: { fontStyle: "italic" },
      developpe: true,
      capitales: false,
      souligne: false,
    },
  },
  C: {
    id: "C",
    nom: "C · Carnet d’analyste",
    parti: "Recursive réglée sur son axe « casual » : chiffres au tracé de feutre, unité écrite en cursive penchée et soulignée d’un trait de plume violet, comme une annotation à la main sur un graphique imprimé.",
    graduation: {
      famille: "Recursive, sans-serif",
      familleCss: "var(--font-axe-c), sans-serif",
      poids: 520,
      couleur: "#e4e4e7",
      echelle: 1.02,
      css: { fontVariationSettings: "'CASL' 1, 'MONO' 0, 'CRSV' 0, 'slnt' 0", fontFeatureSettings: "'tnum' 1" },
      chasse: 0.58,
      typo: true,
      trait: null,
    },
    entete: {
      disposition: "haut",
      famille: "Recursive, sans-serif",
      familleCss: "var(--font-axe-c), sans-serif",
      poids: 600,
      couleur: "#e4e4e7",
      echelle: 1.05,
      css: { fontVariationSettings: "'CASL' 1, 'MONO' 0, 'CRSV' 1, 'slnt' -9" },
      developpe: false,
      capitales: false,
      souligne: true,
    },
  },
};

const ID_ACTIF = (REGLAGE as { actif?: string }).actif;
export const STYLE_AXE_Y_ACTIF: IdStyleAxeY =
  ID_ACTIF === "A" || ID_ACTIF === "B" || ID_ACTIF === "C" ? ID_ACTIF : "actuel";

/** Contexte : seule la page /concepts/axe-y le change, pour comparer. */
export const StyleAxeYContext = createContext<IdStyleAxeY>(STYLE_AXE_Y_ACTIF);

export function useStyleAxeY(): StyleAxeY {
  return STYLES_AXE_Y[useContext(StyleAxeYContext)] ?? STYLES_AXE_Y.actuel;
}

/** Attributs SVG d une graduation. En « actuel » : strictement les attributs d avant. */
export function attrsGraduation(s: StyleAxeY, taille: number) {
  const g = s.graduation;
  return {
    fontSize: s.id === "actuel" ? taille : Math.round(taille * g.echelle * 10) / 10,
    fontWeight: g.poids,
    fill: g.couleur,
    fontFamily: g.famille,
    ...(g.familleCss ? { style: { fontFamily: g.familleCss, ...g.css } as CSSProperties } : {}),
    "data-axe-y": s.id === "actuel" ? undefined : "graduation",
  };
}

/** Attributs SVG de l en-tete d unite. */
export function attrsEntete(s: StyleAxeY, taille: number, poids = 600) {
  const e = s.entete;
  return {
    fontSize: s.id === "actuel" ? taille : Math.round(taille * e.echelle * 10) / 10,
    fontWeight: s.id === "actuel" ? poids : e.poids,
    fill: e.couleur,
    fontFamily: e.famille,
    ...(e.familleCss ? { style: { fontFamily: e.familleCss, ...e.css } as CSSProperties } : {}),
    "data-axe-y": s.id === "actuel" ? undefined : "entete",
  };
}

/** Texte d une graduation : vrai signe moins, espace fine insecable avant %. */
export function texteGraduation(s: StyleAxeY, t: string): string {
  if (!s.graduation.typo) return t;
  return t.replace(/^-/, "−").replace(/[  ]%$/, " %");
}

const MOTS_ECHELLE: Record<string, string> = {
  Mds: "milliards",
  M: "millions",
  Bln: "billions",
  K: "milliers",
};

/** Texte de l en-tete : abreviation developpee pour le style B (francais seulement). */
export function texteEntete(s: StyleAxeY, h: string, locale = "fr"): string {
  if (!s.entete.developpe || !h || !String(locale).startsWith("fr")) return h;
  const m = h.match(/^(Mds|M|Bln|K)(?:\s+(.+))?$/);
  if (m) return `en ${MOTS_ECHELLE[m[1]]}${m[2] ? ` de ${m[2]}` : ""}`;
  if (h.startsWith("%")) return `en ${h}`;
  return `en ${h.charAt(0).toLowerCase()}${h.slice(1)}`;
}

/**
 * Reserve a gauche pour une unite ecrite debout (style A) : largeur des
 * graduations + interligne de l unite. 0 pour tout style dont l unite est en haut.
 */
export function reserveUniteDebout(s: StyleAxeY, tailleEntete: number): number {
  return s.entete.disposition === "vertical" ? Math.ceil(tailleEntete * s.entete.echelle * 1.6) : 0;
}

/** Largeur estimee de la plus longue graduation, avec la chasse du style. */
export function largeurGraduations(s: StyleAxeY, textes: string[], taille: number): number {
  const n = Math.max(1, ...textes.map((t) => t.length));
  return n * taille * (s.id === "actuel" ? 0.62 : s.graduation.echelle * s.graduation.chasse);
}
