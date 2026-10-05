/** Liste des concepts, hors module client pour etre lisible par les pages serveur. */
export const CONCEPTS: { slug: string; nom: string; phrase: string }[] = [
  { slug: "multiples", nom: "Petits multiples", phrase: "Une grille dense : sparkline sur 13 trimestres, bande de valeurs habituelles et alerte quand le dernier point sort de la bande." },
  { slug: "carte-thermique", nom: "Carte thermique", phrase: "Trimestre x KPI : la croissance annuelle de chaque case se lit à la couleur, la dérive d'un indicateur saute aux yeux." },
  { slug: "frise", nom: "Frise des publications", phrase: "Un grand graphique trimestriel interactif, avec les publications et événements réels de la société posés sur l'axe du temps." },
  { slug: "double-niveau", nom: "Cartes à double niveau", phrase: "Chaque carte donne la valeur puis son contexte : rang dans son propre historique, écart à la moyenne, régularité." },
  { slug: "recit", nom: "Vue récit", phrase: "La variation expliquée : une phrase de lecture et un pont trimestre après trimestre entre N-1 et le dernier chiffre." },
  { slug: "comparatif", nom: "Comparatif sur un même axe", phrase: "Netflix et LVMH sur le même axe de croissance annuelle : qui accélère, qui freine, indicateur par indicateur." },
];
