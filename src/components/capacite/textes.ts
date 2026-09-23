import type { CleRatio, TypeReference } from "./modele";

/**
 * Explications du « i » : écrites pour une personne qui n'a jamais lu un bilan.
 * Règle de rédaction : une phrase de définition, puis un exemple chiffré avec
 * une boulangerie, toujours la même, pour que les mesures se comparent
 * entre elles. Aucun mot de jargon sans traduction immédiate.
 */

export type Texte = { titre: string; sigle: string; phrase: string; exemple: string };

export const TEXTES_RATIOS: Record<CleRatio, Texte> = {
  roe: {
    titre: "Retour sur capitaux propres",
    sigle: "ROE",
    phrase:
      "Ce que rapporte, chaque année, l'argent apporté par les actionnaires. C'est la mesure la plus proche du point de vue de celui qui achète l'action.",
    exemple:
      "Vous mettez 100 euros dans une boulangerie. À la fin de l'année elle a gagné 12 euros de bénéfice. Le retour sur capitaux propres est de 12 pour cent.",
  },
  roa: {
    titre: "Retour sur actifs",
    sigle: "ROA",
    phrase:
      "Ce que rapporte tout ce que la société possède : les murs, le four, les stocks, l'argent en caisse. Il montre si l'outil de travail est bien utilisé.",
    exemple:
      "La boulangerie possède au total 200 euros de four, de stock et de caisse, et elle gagne 12 euros dans l'année. Le retour sur actifs est de 6 pour cent, soit 12 divisé par 200.",
  },
  roic: {
    titre: "Retour sur capital investi",
    sigle: "ROIC",
    phrase:
      "Ce que rapporte l'argent réellement mis au travail dans l'activité : celui des actionnaires plus celui emprunté à la banque, une fois l'impôt payé. C'est la mesure préférée des investisseurs de long terme.",
    exemple:
      "Vous mettez 100 euros et la banque prête 100 euros, soit 200 euros investis. La boulangerie dégage 20 euros de bénéfice une fois l'impôt payé. Le retour sur capital investi est de 10 pour cent.",
  },
  roce: {
    titre: "Retour sur capitaux employés",
    sigle: "ROCE",
    phrase:
      "Très proche du précédent, mais mesuré avant impôt. Il sert surtout à comparer deux sociétés du même métier, sans que la fiscalité de chaque pays ne brouille la comparaison.",
    exemple:
      "Les mêmes 200 euros employés dans la boulangerie dégagent 30 euros de bénéfice d'exploitation, avant impôt. Le retour sur capitaux employés est de 15 pour cent.",
  },
};

export const TEXTES_REFERENCES: Record<TypeReference, Texte> = {
  sans_risque: {
    titre: "Taux sans risque",
    sigle: "Référence",
    phrase:
      "C'est ce que rapporte un placement considéré comme sans danger, en pratique un emprunt d'État à dix ans. Il sert de point de comparaison : une société doit rapporter davantage, sinon prendre un risque n'a pas de sens.",
    exemple:
      "L'emprunt d'État rapporte 5 pour cent par an, sans souci. Une société qui ne dégage que 4 pour cent vous fait porter tous les risques du métier pour gagner moins qu'en dormant.",
  },
  inflation: {
    titre: "Taux d'inflation",
    sigle: "Référence",
    phrase:
      "C'est la perte de valeur de la monnaie, qui se traduit concrètement par la hausse des prix. Il sert à savoir si un gain affiché est un vrai gain, ou seulement de l'argent qui a perdu de la valeur.",
    exemple:
      "Avec une inflation de 3 pour cent, un panier de courses à 100 euros l'an dernier en coûte 103 cette année. Une société qui rapporte 2 pour cent vous appauvrit, malgré un gain apparent.",
  },
};

/** Réserve affichée dès qu'un ratio dépasse 100 pour cent. */
export const TEXTE_RESERVE = {
  titre: "Pourquoi ce chiffre est à lire avec réserve",
  phrase:
    "Ce ratio dépasse 100 pour cent. Cela ne veut pas dire que la société est cent fois meilleure : cela veut dire que le capital investi est devenu presque nul, souvent après des rachats d'actions massifs, un financement par la dette ou des actifs déjà amortis. Le calcul divise alors par un tout petit nombre et s'envole.",
  exemple:
    "La boulangerie gagne toujours 12 euros, mais son propriétaire a repris 99 des 100 euros qu'il avait mis. Le retour affiché devient 1 200 pour cent. Rien n'a changé dans le fournil.",
  conclusion: "Le chiffre est affiché tel que publié, mais il n'est pas comparable à un taux et cette mesure n'est pas comptée comme un avantage.",
};

/** Texte affiché quand la donnée n'existe pas. Jamais de zéro ni de tiret seul. */
export const TEXTE_ABSENT =
  "Cette mesure n'est pas publiée pour cette société, ou notre source ne la calcule pas. Nous préférons l'écrire plutôt que d'afficher un chiffre qui n'existe pas.";

export function texteMethode(margePts: number): string {
  return `Vert : la mesure dépasse la référence d'au moins ${margePts} points. Orange : elle est au dessus, mais de moins de ${margePts} points, un avantage trop mince pour être tenu pour acquis d'un exercice à l'autre. Rouge : elle est sous la référence.`;
}
