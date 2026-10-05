/** Liste des concepts, hors module client pour etre lisible par les pages serveur. */
export const CONCEPTS: { slug: string; nom: string; phrase: string }[] = [
  { slug: "mur", nom: "Mur de cartes éditoriales", phrase: "Toutes les stories visibles d'un coup en grille, filtres de famille et de tri à gauche, clic pour ouvrir la carte en grand." },
  { slug: "lecteur", nom: "Lecteur à deux panneaux", phrase: "La liste des stories à gauche, le détail (chiffre, graphique, texte) à droite, navigation aux flèches du clavier." },
  { slug: "frise", nom: "Frise défilante avec aperçu", phrase: "Une bande horizontale de vignettes à faire défiler ; le survol ou le clic affiche l'aperçu complet au-dessus." },
  { slug: "fil", nom: "Fil d'actualité", phrase: "Un fil vertical daté, posts larges avec graphique intégré, sommaire collant par famille." },
  { slug: "diaporama", nom: "Diaporama plein bloc", phrase: "Une grande diapositive horizontale avec pause et reprise, barre de progression et rangée de vignettes." },
  { slug: "carrousel", nom: "Carrousel à focus central", phrase: "Trois cartes dont la centrale est agrandie ; cliquer une carte latérale la recentre, avec lecture automatique." },
];
