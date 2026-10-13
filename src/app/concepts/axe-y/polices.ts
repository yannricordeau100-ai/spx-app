/**
 * Polices des 3 propositions d axe Y (13 oct 2026). Chargees par next/font, qui
 * les heberge avec le site (aucun appel a Google depuis le navigateur).
 * Apres le choix de Yann : deplacer le chargeur retenu dans src/app/layout.tsx
 * (meme nom de variable CSS) et supprimer les deux autres.
 */
import { Bricolage_Grotesque, Alegreya, Recursive, National_Park, Signika, Commissioner, Sono } from "next/font/google";

// A : Bricolage Grotesque variable, axes largeur (wdth 75-100) et taille optique.
export const policeAxeA = Bricolage_Grotesque({
  variable: "--font-axe-a",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  axes: ["wdth", "opsz"],
});

// B : Alegreya variable (Huerta Tipografica), chiffres elzeviriens par defaut,
// romain et italique. Literata et EB Garamond ecartees : la version servie n a
// pas de chiffres elzeviriens.
export const policeAxeB = Alegreya({
  variable: "--font-axe-b",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  style: ["normal", "italic"],
});

// C : Recursive variable, axes casual (CASL), cursive (CRSV), chasse fixe (MONO), pente.
export const policeAxeC = Recursive({
  variable: "--font-axe-c",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  axes: ["CASL", "CRSV", "MONO", "slnt"],
});

// 14 oct 2026 : 4 nouvelles propositions (A, B, C refusees par Yann).
// D : National Park (Jeremy Shellhorn et etudiants de l universite du Kansas),
// dessinee d apres les panneaux de bois fraises des parcs nationaux americains.
export const policeAxeD = National_Park({
  variable: "--font-axe-d",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
});

// E : Signika (Anna Giedrys), dessinee pour la signaletique ; axe de grade (GRAD)
// qui affine le trait sans changer la chasse (texte clair sur fond sombre).
export const policeAxeE = Signika({
  variable: "--font-axe-e",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  axes: ["GRAD"],
});

// F : Commissioner (Kostas Bartsokas), axe d evasement (FLAR) : empattements
// evases comme une gravure au burin sur une regle d acier.
export const policeAxeF = Commissioner({
  variable: "--font-axe-f",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  axes: ["FLAR", "VOLM", "slnt"],
});

// G : Sono (Tyler Finck), axe MONO de 0 (proportionnelle) a 1 (chasse fixe).
export const policeAxeG = Sono({
  variable: "--font-axe-g",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  axes: ["MONO"],
});

export const variablesPolicesAxeY = [policeAxeA, policeAxeB, policeAxeC, policeAxeD, policeAxeE, policeAxeF, policeAxeG]
  .map((p) => p.variable)
  .join(" ");
