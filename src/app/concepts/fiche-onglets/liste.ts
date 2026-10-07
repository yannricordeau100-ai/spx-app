/** Styles d'onglets, hors module client pour etre lisibles par les pages serveur. */
export type StyleId =
  | "souligne" | "pilules" | "vertical" | "icones-compteurs" | "app-mobile" | "cartes"
  | "cartes-compactes"
  | "rail-icones" | "rail-survol" | "rail-legende" | "rail-groupes" | "rail-progression" | "rail-flottant";

/** Largeur reservee au rail fixe (px, ecrans md et plus). Absent = pas de rail. */
export const RAIL_PX: Partial<Record<StyleId, number>> = {
  "rail-icones": 56,
  "rail-survol": 56,
  "rail-legende": 76,
  "rail-groupes": 64,
  "rail-progression": 72,
  "rail-flottant": 68,
};

export const NOUVEAUX: StyleId[] = ["cartes-compactes", "rail-icones", "rail-survol", "rail-legende", "rail-groupes", "rail-progression", "rail-flottant"];

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
  {
    slug: "cartes-compactes",
    nom: "Cartes-onglets en grille compacte",
    phrase: "La grille de cartes, mais très basse : icône et titre sur la même ligne, une carte = une seule ligne.",
    explication:
      "Même idée que les cartes-onglets, en version dense : chaque carte tient sur une seule ligne avec l'icône à gauche, le titre à côté et le compteur à droite. La grille reste ouverte en permanence et occupe deux à trois rangées fines au lieu d'un grand bloc.",
    forts: ["Toutes les parties visibles d'un coup pour une hauteur minimale", "Aucun clic de plus pour changer de partie : la grille ne se replie pas", "Les compteurs restent visibles, l'aperçu complet apparaît au survol"],
    limites: ["Plus de phrase d'aperçu sous le titre, donc moins de rôle de sommaire", "Les titres longs sont raccourcis avec des points de suspension sur les petites cartes"],
    mobile: "Deux colonnes de cartes d'une ligne chacune, six rangées au plus, sans défilement latéral.",
  },
  {
    slug: "rail-icones",
    nom: "Rail d'icônes avec info-bulle",
    phrase: "Une colonne d'icônes seules collée au bord gauche de la fenêtre, nom en info-bulle au survol.",
    explication:
      "Un rail fixe de 56 px, du haut au bas de la fenêtre, comme la barre d'une application. Il est hors du contenu, qui prend toute la largeur restante. Chaque icône affiche son nom dans une info-bulle au survol ; l'onglet actif porte un trait de la couleur de la société.",
    forts: ["Perte de largeur minimale : 56 px seulement", "Toujours visible, quelle que soit la position de défilement", "Très sobre, familier pour qui utilise des applications"],
    limites: ["Les icônes seules demandent un apprentissage ou un survol", "Pas de survol sur téléphone, donc pas d'info-bulle"],
    mobile: "Le rail devient une barre d'icônes fixée en bas de l'écran, avec défilement horizontal.",
  },
  {
    slug: "rail-survol",
    nom: "Rail qui s'élargit au survol",
    phrase: "Icônes au repos, noms complets qui se déploient par-dessus le contenu quand la souris approche.",
    explication:
      "Au repos le rail ne fait que 56 px, le contenu n'est pas déplacé. Au survol ou au clavier, le rail s'élargit à 232 px et révèle les noms et les compteurs, en se superposant au contenu sans le décaler.",
    forts: ["Le meilleur des deux mondes : étroit au repos, explicite à l'usage", "Le contenu ne bouge pas pendant l'élargissement", "Les noms et compteurs sont lisibles sans info-bulle"],
    limites: ["L'élargissement peut se déclencher par erreur en passant la souris", "Sur tactile, il n'y a pas de survol"],
    mobile: "Barre d'icônes fixée en bas ; un appui sur l'icône active affiche son nom à côté.",
  },
  {
    slug: "rail-legende",
    nom: "Rail icône + nom court",
    phrase: "Un rail un peu plus large avec, sous chaque icône, un nom court toujours visible.",
    explication:
      "Rail fixe de 76 px : l'icône puis un nom court en dessous (Aperçu, KPI, Stories, Risques…). Rien à survoler, tout est lisible immédiatement. Les compteurs sont gardés sous forme de petite pastille.",
    forts: ["Aucune ambiguïté : l'icône et son nom sont toujours visibles", "Pas besoin de survol, donc identique à l'écran tactile", "Les noms courts évitent la coupure des libellés longs"],
    limites: ["20 px de plus de largeur que le rail d'icônes seules", "Les noms sont abrégés, certains perdent en précision"],
    mobile: "Barre fixée en bas, icône au-dessus du nom court, défilement horizontal.",
  },
  {
    slug: "rail-groupes",
    nom: "Rail à groupes et séparateurs",
    phrase: "Les onglets rangés en trois familles : Analyse, Données, Société, séparées par des traits.",
    explication:
      "Rail fixe de 64 px où les icônes sont regroupées sous un petit titre de famille. Analyse (vue d'ensemble, thèse, risques, IA), Données (indicateurs, KPI court et moyen terme, résultats, sources) et Société (marché, gouvernance), avec l'onglet Admin isolé en bas du rail.",
    forts: ["Donne une logique de lecture à douze onglets", "Les séparateurs aident à retrouver une partie vite", "L'onglet Admin est clairement à part"],
    limites: ["Le classement en familles est un choix éditorial discutable", "Hauteur plus grande : les petits écrans peuvent faire défiler le rail"],
    mobile: "Un bouton rond en bas à droite ouvre un tiroir qui liste les trois familles avec leurs onglets.",
  },
  {
    slug: "rail-progression",
    nom: "Rail avec progression de lecture et compteurs",
    phrase: "Rail à compteurs avec une jauge de lecture de la partie et des pastilles « déjà vu ».",
    explication:
      "Rail fixe de 72 px. Un rang « 3/11 » rappelle la position, chaque onglet affiche son compteur de KPI, stories ou risques, et une pastille signale les parties déjà consultées. Une jauge verticale sur le bord du rail se remplit pendant le défilement de la partie en cours.",
    forts: ["On sait où on en est : parties vues, avancement dans la partie", "Les compteurs informent avant le clic", "Encourage à parcourir toute la fiche"],
    limites: ["Plus chargé visuellement que les autres rails", "Les parties vues ne sont pas mémorisées au rechargement"],
    mobile: "Barre fixée en bas avec compteurs et pastilles, une fine ligne de progression de lecture au-dessus.",
  },
  {
    slug: "rail-flottant",
    nom: "Rail flottant translucide",
    phrase: "Une capsule de verre dépoli flottant à gauche, qui laisse deviner la page derrière.",
    explication:
      "Le rail n'est plus une bande : c'est une capsule translucide arrondie, légèrement détachée du bord de la fenêtre, avec un flou d'arrière-plan. L'onglet actif est une pastille colorée qui glisse. Le nom apparaît en info-bulle au survol.",
    forts: ["Rendu très moderne, léger visuellement", "Le contenu reste perceptible derrière le verre", "Pastille active animée, repère clair"],
    limites: ["Moins collé au bord, donc un peu moins « application » que les autres rails", "Le flou peut alourdir les vieux appareils"],
    mobile: "Capsule flottante horizontale au centre bas de l'écran, avec défilement des icônes.",
  },
];

export function styleParSlug(slug: StyleId): StyleOnglets {
  return STYLES.find((s) => s.slug === slug) as StyleOnglets;
}

export const SOCIETES_DEMO = ["GOOGL", "MC.PA"];
