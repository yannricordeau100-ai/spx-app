/**
 * Style d ecriture de l axe Y des graphiques (Yann 13 oct 2026).
 *
 * Point unique : le style actif se lit dans style-axe-y.json (champ « actif »),
 * partage avec scripts/style_axe_y.py (KPI moyen terme). Valeurs :
 *   - actuel : ecriture d avant le 13 oct (police systeme a chasse fixe) ;
 *   - A, B, C : les trois propositions du 13 oct (refusees par Yann) ;
 *   - D, E, F, G : les quatre propositions du 14 oct (/concepts/axe-y).
 *
 * Tant que « actif » vaut « actuel », les graphiques en ligne sortent a
 * l identique (memes attributs SVG). Activer un autre style demande aussi de
 * charger la police correspondante dans src/app/layout.tsx (voir
 * docs/rapports-session-2026-10/axe-y-13oct.md).
 */
import { createContext, useContext, type CSSProperties } from "react";
import REGLAGE from "./style-axe-y.json";

export type IdStyleAxeY = "actuel" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "sobre";
export const IDS_STYLE_AXE_Y: IdStyleAxeY[] = ["actuel", "A", "B", "C", "D", "E", "F", "G", "sobre"];

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
    /**
     * Placement des chiffres (14 oct 2026) :
     *   - gauche (defaut) : colonne de chiffres a gauche du trace ;
     *   - trace : chaque ligne de grille se prolonge jusqu au bord en trait
     *     plein, le chiffre est pose dessus, sans colonne d axe (E) ;
     *   - regle : regle graduee fine, seules 3 valeurs ecrites (F).
     */
    placement?: "gauche" | "trace" | "regle";
    /** Variable CSS de la police (export PNG : police embarquee). */
    variableCss?: string;
  };
  entete: {
    /**
     * haut : au dessus de l axe ; vertical : debout (A) ; cartouche : dans une
     * plaque au sommet de l axe (D) ; integre : collee a la plus haute
     * graduation, « 30 Mds $ » (E) ; regle : au sommet de la regle (F).
     */
    disposition: "haut" | "vertical" | "cartouche" | "integre" | "regle";
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
    /** Repere colore pose devant l unite (G). */
    repere?: string;
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
  D: {
    id: "D",
    nom: "D · Plaque de signalétique",
    parti: "National Park, police dessinée d’après les panneaux de bois fraisés des parcs nationaux américains : chiffres pleins et ronds, lisibles de loin. L’unité n’est plus une légende flottante : c’est une plaque posée au sommet de l’axe, comme le panneau qui dit ce que l’on mesure.",
    graduation: {
      famille: "National Park, sans-serif",
      familleCss: "var(--font-axe-d), sans-serif",
      variableCss: "--font-axe-d",
      poids: 560,
      couleur: "#e4e4e7",
      echelle: 1.02,
      css: { fontFeatureSettings: "'tnum' 1" },
      chasse: 0.58,
      typo: true,
      trait: null,
      placement: "gauche",
    },
    entete: {
      disposition: "cartouche",
      famille: "National Park, sans-serif",
      familleCss: "var(--font-axe-d), sans-serif",
      poids: 660,
      couleur: "#f4f4f5",
      echelle: 0.96,
      css: { letterSpacing: "0.03em" },
      developpe: false,
      capitales: false,
      souligne: false,
    },
  },
  E: {
    id: "E",
    nom: "E · Chiffres dans le tracé",
    parti: "Plus de colonne d’axe séparée : chaque ligne de grille se prolonge jusqu’au bord en un trait plein, et le chiffre est posé dessus, comme dans un journal économique imprimé. L’unité se lit avec le chiffre du haut (« 30 Mds $ »), il n’y a plus d’étiquette à part. Signika, police de signalétique, réglée sur son axe de grade (GRAD −24) pour un trait plus fin en clair sur sombre.",
    graduation: {
      famille: "Signika, sans-serif",
      familleCss: "var(--font-axe-e), sans-serif",
      variableCss: "--font-axe-e",
      poids: 520,
      couleur: "#d4d4d8",
      echelle: 0.92,
      css: { fontVariationSettings: "'GRAD' -24", fontFeatureSettings: "'tnum' 1" },
      chasse: 0.52,
      typo: true,
      trait: { longueur: 10, couleur: "#a1a1aa", epaisseur: 1.2 },
      placement: "trace",
    },
    entete: {
      disposition: "integre",
      famille: "Signika, sans-serif",
      familleCss: "var(--font-axe-e), sans-serif",
      poids: 400,
      couleur: "#a1a1aa",
      echelle: 0.92,
      css: { fontVariationSettings: "'GRAD' -24" },
      developpe: false,
      capitales: false,
      souligne: false,
    },
  },
  F: {
    id: "F",
    nom: "F · Règle graduée",
    parti: "Une règle fine à la place de l’axe : un trait par ligne de grille, quatre petits traits entre deux, et seulement trois valeurs écrites (le bas, le milieu, le haut). Chiffres en Commissioner réglée au maximum de son axe d’évasement (FLAR 100) : les fins de traits s’élargissent comme une gravure au burin sur une règle d’acier. L’unité coiffe la règle.",
    graduation: {
      famille: "Commissioner, sans-serif",
      familleCss: "var(--font-axe-f), sans-serif",
      variableCss: "--font-axe-f",
      poids: 480,
      couleur: "#e4e4e7",
      echelle: 1.04,
      css: { fontVariationSettings: "'FLAR' 100, 'VOLM' 0, 'slnt' 0" },
      chasse: 0.56,
      typo: true,
      trait: { longueur: 9, couleur: "#a1a1aa", epaisseur: 1.1 },
      placement: "regle",
    },
    entete: {
      disposition: "regle",
      famille: "Commissioner, sans-serif",
      familleCss: "var(--font-axe-f), sans-serif",
      poids: 520,
      couleur: "#a1a1aa",
      echelle: 0.95,
      css: { fontVariationSettings: "'FLAR' 100, 'VOLM' 0, 'slnt' 0" },
      developpe: false,
      capitales: false,
      souligne: false,
    },
  },
  G: {
    id: "G",
    nom: "G · Chasse fixe Mettrik",
    parti: "Une chasse fixe réglée pour Mettrik à partir de Sono, police libre à largeur variable : chiffres en MONO 1 (tous de même largeur, alignés à l’unité près), graisse 440, et l’unité dans la même famille en MONO 0 (proportionnelle), précédée du repère violet de Mettrik. Une seule famille, deux réglages, une signature que personne d’autre n’a.",
    graduation: {
      famille: "Sono, monospace",
      familleCss: "var(--font-axe-g), monospace",
      variableCss: "--font-axe-g",
      poids: 440,
      couleur: "#e4e4e7",
      echelle: 0.96,
      css: { fontVariationSettings: "'MONO' 1" },
      chasse: 0.6,
      typo: true,
      trait: null,
      placement: "gauche",
    },
    entete: {
      disposition: "haut",
      famille: "Sono, sans-serif",
      familleCss: "var(--font-axe-g), sans-serif",
      poids: 520,
      couleur: "#d4d4d8",
      echelle: 1.0,
      css: { fontVariationSettings: "'MONO' 0" },
      developpe: false,
      capitales: false,
      souligne: false,
      repere: "#a78bfa",
    },
  },
  sobre: {
    id: "sobre",
    nom: "Sobre",
    parti: "Meme disposition que l axe d avant (chiffres a gauche, unite en haut), seule la police change : Public Sans, une sans-serif libre tres lisible en petit, chiffres tabulaires, virgule francaise nette. Decision de Yann du 14 oct 2026.",
    graduation: {
      famille: "Public Sans, sans-serif",
      familleCss: "var(--font-axe-sobre), sans-serif",
      variableCss: "--font-axe-sobre",
      poids: 500,
      couleur: "#e4e4e7",
      echelle: 1,
      css: { fontFeatureSettings: "'tnum' 1, 'lnum' 1" },
      chasse: 0.6,
      typo: true,
      trait: null,
      placement: "gauche",
    },
    entete: {
      disposition: "haut",
      famille: "Public Sans, sans-serif",
      familleCss: "var(--font-axe-sobre), sans-serif",
      poids: 600,
      couleur: "#e4e4e7",
      echelle: 1,
      css: { fontFeatureSettings: "'tnum' 1, 'lnum' 1" },
      developpe: false,
      capitales: false,
      souligne: false,
    },
  },
};

const ID_ACTIF = (REGLAGE as { actif?: string }).actif;
export const STYLE_AXE_Y_ACTIF: IdStyleAxeY =
  (IDS_STYLE_AXE_Y as string[]).includes(String(ID_ACTIF)) ? (ID_ACTIF as IdStyleAxeY) : "actuel";

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
    // Export PNG (14 oct 2026) : style relu par src/lib/style-axe-y-export.ts.
    "data-axe-y-style": s.id === "actuel" ? undefined : s.id,
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
    "data-axe-y-style": s.id === "actuel" ? undefined : s.id,
  };
}

/**
 * Indices des graduations ECRITES (14 oct 2026). Style « regle » (F) : le bas,
 * le milieu et le haut seulement ; les autres restent des traits. Toutes sinon.
 */
export function graduationsEcrites(s: StyleAxeY, n: number): Set<number> {
  if (s.graduation.placement !== "regle" || n <= 3) return new Set(Array.from({ length: n }, (_, i) => i));
  return new Set([0, Math.round((n - 1) / 2), n - 1]);
}

/** Texte d une graduation : vrai signe moins, espace fine insecable avant %. */
export function texteGraduation(s: StyleAxeY, t: string): string {
  if (!s.graduation.typo) return t;
  // Espace fine insecable des milliers (U+202F) : toLocaleString la pose deja,
  // les autres formats posent parfois une espace normale ou insecable.
  return t.replace(/^-/, "−").replace(/[  ]%$/, " %").replace(/(\d)[  ](?=\d{3}\b)/g, "$1 ");
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
