/**
 * Données absentes PARCE QU ELLES NE SONT PAS PUBLIÉES (Yann, 13 oct 2026).
 *
 * Une donnée peut manquer pour deux raisons très différentes :
 *  - la société ne la publie pas (ou elle n a pas de sens pour elle) : la fiche
 *    le DIT, avec un texte et une petite animation propres à chaque cas, pour
 *    que l investisseur sache que ce n est ni un oubli ni un problème ;
 *  - la donnée n a pas encore été relevée : rien ne change, le bloc reste
 *    masqué comme avant (jamais d affirmation qui pourrait être fausse).
 *
 * Seul le serveur décide qu une absence est « publiée » (donnees-absentes-serveur.ts,
 * à partir de marques posées dans les données). Ce fichier, sans aucune donnée
 * par société, regroupe les textes affichés : tous les blocs les réutilisent.
 * Règles d écriture : français, phrases courtes, ton neutre et factuel, aucun
 * vocabulaire de fabrication interne, aucun tiret long.
 */

/** Motif de l animation, un par famille d absence (voir donnee-absente.tsx). */
export type MotifAbsence =
  | "globe"       // répartition géographique
  | "segment"     // une seule activité
  | "holding"     // holding sans chiffre d affaires propre
  | "cible"       // taille de marché
  | "calendrier"  // année non documentée
  | "drapeau"     // société étrangère
  | "enveloppe"   // rémunération publiée en global seulement
  | "jalon"       // première évaluation
  | "micro"       // pas de conférence de résultats
  | "piece"       // pas de dividende
  | "lunette"     // pas de graphique extérieur
  | "anneau"      // part des clients non publiée
  | "fusion";     // aucun rachat

export type AbsenceId =
  | "geo_marche_unique"
  | "geo_par_segment"
  | "segment_unique"
  | "holding_sans_ca"
  | "tam_sans_etude"
  | "fondation_non_documentee"
  | "ipo_non_documentee"
  | "etranger_gouvernance"
  | "remuneration_globale"
  | "moat_premiere_evaluation"
  | "sans_conference"
  | "conference_suspendue"
  | "sans_dividende"
  | "these_sans_graphique"
  | "clients_non_publies"
  | "rachats_aucun";

export type TexteAbsence = {
  /** Titre court de la carte. */
  titre: string;
  /** Explication, une ou deux phrases. */
  texte: string;
  /** Version très courte pour une pastille ou une ligne de tableau. */
  court: string;
  /** Petite étiquette au-dessus du titre : dit que l absence est normale. */
  mention: string;
  motif: MotifAbsence;
};

export const ABSENCES: Record<AbsenceId, TexteAbsence> = {
  geo_marche_unique: {
    titre: "Répartition géographique non publiée",
    texte: "La société exerce l’essentiel de son activité dans un seul pays. Elle ne publie donc pas de répartition géographique de son chiffre d’affaires.",
    court: "Activité dans un seul pays",
    mention: "Non publié par la société",
    motif: "globe",
  },
  geo_par_segment: {
    titre: "Répartition géographique non publiée",
    texte: "La société ne publie pas de répartition géographique distincte : ses segments, organisés par région, en tiennent lieu.",
    court: "Voir la répartition par segment",
    mention: "Non publié par la société",
    motif: "globe",
  },
  segment_unique: {
    titre: "Une seule activité déclarée",
    texte: "La société déclare un seul segment d’activité. Elle ne publie donc pas de répartition de son chiffre d’affaires par activité.",
    court: "Une seule activité",
    mention: "Non publié par la société",
    motif: "segment",
  },
  holding_sans_ca: {
    titre: "Pas de chiffre d’affaires opérationnel",
    texte: "Holding de participations : son résultat provient des sociétés qu’elle détient. Elle ne publie pas de répartition de chiffre d’affaires.",
    court: "Holding sans chiffre d’affaires propre",
    mention: "Sans objet pour cette société",
    motif: "holding",
  },
  tam_sans_etude: {
    titre: "Taille de marché non mesurable",
    texte: "Aucune étude de marché fiable, publiée chaque année et comparable au chiffre d’affaires de ses activités, ne permet de mesurer sa part de marché.",
    court: "Aucune étude fiable",
    mention: "Aucune source fiable",
    motif: "cible",
  },
  fondation_non_documentee: {
    titre: "Année de fondation",
    texte: "L’année de fondation n’est pas documentée dans les publications de la société.",
    court: "non documentée",
    mention: "Non documenté",
    motif: "calendrier",
  },
  ipo_non_documentee: {
    titre: "Introduction en bourse",
    texte: "L’année d’introduction en bourse n’est pas documentée dans les publications de la société.",
    court: "non documentée",
    mention: "Non documenté",
    motif: "calendrier",
  },
  etranger_gouvernance: {
    titre: "Société étrangère cotée aux États-Unis",
    texte: "Elle publie un rapport annuel d’émetteur étranger, sans circulaire de vote américaine. Elle n’est pas tenue d’y publier :",
    court: "Émetteur étranger",
    mention: "Règle des émetteurs étrangers",
    motif: "drapeau",
  },
  remuneration_globale: {
    titre: "Rémunération individuelle non publiée",
    texte: "La société publie seulement un montant global pour l’ensemble de ses dirigeants et administrateurs, pas la rémunération de son dirigeant.",
    court: "Montant global seulement",
    mention: "Non publié par la société",
    motif: "enveloppe",
  },
  moat_premiere_evaluation: {
    titre: "Première évaluation",
    texte: "La note n’a pas encore d’historique.",
    court: "Pas encore d’historique",
    mention: "Pas encore d’historique",
    motif: "jalon",
  },
  sans_conference: {
    titre: "Pas de conférence de résultats",
    texte: "La société ne tient pas de conférence de résultats avec les analystes : elle publie ses résultats par communiqué. Il n’y a donc pas de synthèse de conférence.",
    court: "Pas de conférence",
    mention: "Non tenue par la société",
    motif: "micro",
  },
  conference_suspendue: {
    titre: "Conférences de résultats suspendues",
    texte: "La société a suspendu ses conférences de résultats pendant une opération de rachat ou de fusion. Il n’y a donc pas de synthèse récente.",
    court: "Conférences suspendues",
    mention: "Suspendue par la société",
    motif: "micro",
  },
  sans_dividende: {
    titre: "Pas de dividende",
    texte: "La société ne verse pas de dividende.",
    court: "Aucun",
    mention: "Non versé",
    motif: "piece",
  },
  these_sans_graphique: {
    titre: "Pas de regard extérieur",
    texte: "Aucune source extérieure ne publie de graphique fiable et récent qui éclaire cette thèse.",
    court: "Pas de graphique extérieur",
    mention: "Aucune source fiable",
    motif: "lunette",
  },
  clients_non_publies: {
    titre: "Part des principaux clients non publiée",
    texte: "La société ne publie pas la part de ses principaux clients dans son chiffre d’affaires.",
    court: "Non publiée",
    mention: "Non publié par la société",
    motif: "anneau",
  },
  rachats_aucun: {
    titre: "Aucun rachat",
    texte: "Aucun rachat significatif publié depuis 2016.",
    court: "Aucun rachat",
    mention: "Aucun rachat publié",
    motif: "fusion",
  },
};

/** Éléments de gouvernance qu un émetteur étranger n est pas tenu de publier. */
export type ManqueGouvernance = "remuneration" | "ratio" | "vote";

export const LIBELLES_MANQUE_GOUVERNANCE: Record<ManqueGouvernance, string> = {
  remuneration: "la rémunération individuelle de son dirigeant",
  ratio: "l’écart entre la rémunération du dirigeant et celle du salarié médian",
  vote: "le vote consultatif des actionnaires sur la rémunération",
};

/**
 * Absences établies côté serveur pour la fiche servie. Chaque clé n est posée
 * que si la cause est certaine ; une clé absente = comportement habituel.
 */
export type AbsencesFiche = {
  geo?: Extract<AbsenceId, "geo_marche_unique" | "geo_par_segment" | "holding_sans_ca">;
  segment?: Extract<AbsenceId, "segment_unique" | "holding_sans_ca">;
  tam?: Extract<AbsenceId, "tam_sans_etude">;
  fondation?: Extract<AbsenceId, "fondation_non_documentee">;
  ipo?: Extract<AbsenceId, "ipo_non_documentee">;
  gouvernance?: { id: Extract<AbsenceId, "etranger_gouvernance" | "remuneration_globale">; manque: ManqueGouvernance[] };
  moat?: Extract<AbsenceId, "moat_premiere_evaluation">;
  conference?: Extract<AbsenceId, "sans_conference" | "conference_suspendue">;
  dividende?: Extract<AbsenceId, "sans_dividende">;
};
