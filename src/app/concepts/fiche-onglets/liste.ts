/** Styles d'onglets, hors module client pour etre lisibles par les pages serveur. */
export type StyleId = "souligne" | "pilules" | "vertical" | "icones-compteurs" | "app-mobile" | "cartes";

export type StyleOnglets = {
  slug: StyleId;
  nom: string;
  phrase: string;
  explication: string;
  forts: string[];
  limites: string[];
  mobile: string;
};

export const STYLES: StyleOnglets[] = [
  {
    slug: "souligne",
    nom: "Onglets soulignés collants",
    phrase: "La barre classique à soulignement, qui reste collée en haut de l'écran pendant le défilement.",
    explication:
      "Une rangée de libellés sobres avec un trait coloré sous l'onglet actif, posée juste sous l'en-tête et les rangs. Au défilement elle se colle en haut de l'écran, donc on change de partie sans remonter.",
    forts: ["Convention connue de tout le monde, aucune explication à donner", "Reste accessible en permanence grâce au collage en haut", "Très sobre, proche du reste de la fiche actuelle"],
    limites: ["Une douzaine de libellés débordent vite sur écran étroit", "Peu d'information en plus du nom (ni icône ni compteur)"],
    mobile: "La barre défile horizontalement au doigt, avec un dégradé sur les bords pour montrer qu'il y a une suite, et l'onglet actif se recentre tout seul.",
  },
  {
    slug: "pilules",
    nom: "Pilules segmentées",
    phrase: "Un bloc arrondi de pilules avec une pastille qui glisse d'un onglet à l'autre.",
    explication:
      "Les onglets forment un contrôle segmenté en forme de gélule, la pastille de l'onglet actif se déplace avec une animation. Le rendu est moderne et compact, proche d'un réglage d'application.",
    forts: ["Effet de glissement agréable, retour visuel immédiat", "Compact : tient sur une seule ligne sans trait ni séparateur", "Se marie bien avec la rangée de rangs en pilules au-dessus"],
    limites: ["Moins lisible quand les libellés sont longs", "Ne reste pas collé en haut : il faut remonter pour changer de partie"],
    mobile: "Le bloc de pilules défile horizontalement, sans retour à la ligne, et la pastille active se recentre dans la fenêtre.",
  },
  {
    slug: "vertical",
    nom: "Onglets verticaux à gauche",
    phrase: "Une colonne de sections à gauche, le contenu à droite, comme un menu de documentation.",
    explication:
      "La liste des parties se place en colonne, collée sous l'en-tête, avec une barre colorée sur l'onglet actif. Le contenu garde toute la hauteur et toute la largeur restante, ce qui convient bien à un grand écran.",
    forts: ["Toutes les parties sont visibles d'un coup, sans défilement latéral", "Idéal pour douze onglets et plus, la colonne se prolonge sans limite", "Rappelle le rail de navigation actuel de la fiche"],
    limites: ["Prend environ 220 px de largeur au contenu", "Demande une adaptation spécifique sur téléphone"],
    mobile: "La colonne se replie en un seul bouton « Section : … » qui déroule la liste complète, puis se referme après le choix.",
  },
  {
    slug: "icones-compteurs",
    nom: "Onglets à icônes et compteurs",
    phrase: "Chaque onglet porte une icône et un petit chiffre : nombre de KPI, de stories, de risques.",
    explication:
      "Les onglets sont répartis sur toute la largeur, icône au-dessus du nom, avec une pastille de compteur quand la partie contient des éléments dénombrables. On voit où il y a de la matière avant de cliquer.",
    forts: ["Les compteurs informent avant le clic (par exemple le nombre de risques)", "Les icônes se repèrent plus vite que les mots", "Bon équilibre entre densité et lisibilité"],
    limites: ["Plus haut qu'une simple ligne de texte", "Tous les onglets n'ont pas de compteur pertinent"],
    mobile: "La barre défile horizontalement avec des onglets de largeur fixe, icône au-dessus du libellé, compteurs conservés.",
  },
  {
    slug: "app-mobile",
    nom: "Barre défilante façon application",
    phrase: "Une barre d'icônes fixée en bas de l'écran, avec glissement du doigt pour changer de partie.",
    explication:
      "Les onglets quittent le haut de la page et se posent en bas, comme la barre d'une application. Sur téléphone on peut aussi balayer le contenu vers la gauche ou la droite pour passer à la partie voisine.",
    forts: ["Zone du pouce : l'onglet se touche sans lâcher le téléphone d'une main", "Le balayage latéral du contenu change de partie", "Sur ordinateur, la barre devient un dock flottant centré en bas"],
    limites: ["Cache le bas de la page (réservé par une marge)", "Les onglets ne sont pas dans la zone de lecture habituelle, moins découvrable sur ordinateur"],
    mobile: "Pensé d'abord pour le mobile : barre fixe en bas à défilement horizontal, balayage gauche et droite sur le contenu.",
  },
  {
    slug: "cartes",
    nom: "Cartes-onglets en grille",
    phrase: "Une grille de cartes avec titre et aperçu, qui se replie en une ligne une fois la partie choisie.",
    explication:
      "Chaque partie est une carte avec son icône, son titre et une phrase d'aperçu tirée des vraies données. Au choix, la grille se replie en ruban pour laisser le contenu, et un bouton la rouvre.",
    forts: ["Sert aussi de sommaire : on voit ce que contient chaque partie", "Très lisible pour un nouveau visiteur", "Les aperçus mettent en avant les chiffres clés de la société"],
    limites: ["Occupe beaucoup de hauteur tant qu'elle est ouverte", "Un clic de plus pour rouvrir la grille et changer de partie"],
    mobile: "La grille passe sur deux colonnes ; une fois la partie choisie, elle se replie en une bande qui défile horizontalement.",
  },
];

export function styleParSlug(slug: StyleId): StyleOnglets {
  return STYLES.find((s) => s.slug === slug) as StyleOnglets;
}

export const SOCIETES_DEMO = ["GOOGL", "MC.PA"];
