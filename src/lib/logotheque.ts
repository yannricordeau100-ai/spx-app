/**
 * Logothèque Mettrik (Yann 31 août 2026).
 *
 * Avant : un seul logo actif pour tout le site (src/data/active-wordmark.json),
 * plus deux <img> PNG codés en dur dans la page de maintenance et la home.
 * Changer le logo d'un seul endroit était impossible sans toucher au code.
 *
 * Maintenant : un registre d'EMPLACEMENTS. Chaque emplacement du site
 * (page de maintenance, logo de la home, bouton retour d'une page société...)
 * pointe vers une variante de la logothèque. Le réglage est stocké en base
 * (desk_page_content, page_key "logotheque") donc modifiable depuis le
 * sandbox sans redéploiement.
 *
 * Une valeur absente = héritage de la variante globale
 * (src/data/active-wordmark.json), donc l'ancien comportement.
 */

export type EmplacementLogo = {
  /** Clé stable stockée en base. Ne jamais renommer. */
  id: string;
  /** Libellé montré dans le sandbox. */
  label: string;
  /** Où ça se voit exactement, en clair. */
  ou: string;
};

/**
 * TOUS les endroits du site où un logo Mettrik est affiché et pilotable.
 * Ajouter un emplacement ici + poser <LogoMettrik emplacement="..."> suffit :
 * la page sandbox le liste automatiquement.
 *
 * Deux endroits sont volontairement absents. Les écrans de connexion et de
 * compte n affichent aucun logo aujourd hui. La signature des exports PNG est
 * dessinée sur un canvas à partir d une image, pas d un composant React :
 * elle ne peut afficher que le PNG de marque, aucune autre variante.
 */
export const EMPLACEMENTS: EmplacementLogo[] = [
  {
    id: "maintenance",
    label: "Page de pré-lancement",
    ou: "mettrik.ai en mode maintenance, gros logo centré",
  },
  {
    id: "home",
    label: "Logo de la page d'accueil",
    ou: "Bandeau titre de la home publique",
  },
  {
    id: "retour-societe",
    label: "Bouton retour (page société)",
    ou: "Coin haut gauche d'une fiche société, cliquable vers la home",
  },
  {
    id: "tarifs",
    label: "Page des tarifs",
    ou: "En-tête de /pricing et de son jumeau sandbox",
  },
];

export const IDS_EMPLACEMENTS = EMPLACEMENTS.map((e) => e.id);

/** Réglage complet : emplacement -> id de variante de la logothèque. */
export type ReglagesLogotheque = Record<string, string>;

/**
 * Variante à utiliser pour un emplacement donné.
 * Ordre : réglage propre à l'emplacement, sinon variante globale.
 */
export function varianteDe(
  emplacement: string,
  reglages: ReglagesLogotheque | null | undefined,
  varianteGlobale: string,
): string {
  const choisi = reglages?.[emplacement];
  return typeof choisi === "string" && choisi.length > 0 ? choisi : varianteGlobale;
}

/** Garde-fou : ne garde que des couples (emplacement connu, variante non vide). */
export function nettoieReglages(brut: unknown): ReglagesLogotheque {
  if (!brut || typeof brut !== "object") return {};
  const sortie: ReglagesLogotheque = {};
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (!IDS_EMPLACEMENTS.includes(cle)) continue;
    if (typeof valeur !== "string" || valeur.length === 0) continue;
    sortie[cle] = valeur;
  }
  return sortie;
}
