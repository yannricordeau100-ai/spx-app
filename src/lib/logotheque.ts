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

/**
 * Images de MARQUE fournies par Yann (fichiers réels du dépôt), avec la liste
 * exhaustive de leurs usages produit et hors site. Le back-office est
 * volontairement exclu de ces listes (Yann 2 sept 2026).
 */
export type AssetMarque = {
  /** Clé stable stockée en base. Ne jamais renommer. */
  id: string;
  label: string;
  /** URL publique de l image (servie par Next). */
  src: string;
  fichier: string;
  /** Fond conseillé pour l aperçu dans le sandbox. */
  fondClair?: boolean;
  usages: string[];
  orphelin?: boolean;
};

export const ASSETS_MARQUE: AssetMarque[] = [
  {
    id: "png-fond-sombre",
    label: "Logo Mettrik AI (fond sombre)",
    src: "/brand/mettrik-ai-white-purple.png",
    fichier: "public/brand/mettrik-ai-white-purple.png",
    usages: [
      "Logo actif du site : page d'accueil, bouton retour des pages société, page des tarifs, page de pré-lancement",
      "Signature des PNG téléchargés depuis les graphs (bouton Télécharger)",
      "Signature des PNG des stories partagées",
      "En-tête de tous les emails clients (onboarding, activation de compte, mot de passe...)",
    ],
  },
  {
    id: "png-fond-clair",
    label: "Logo Mettrik AI (fond clair)",
    src: "/brand/mettrik-ai-black-purple.png",
    fichier: "public/brand/mettrik-ai-black-purple.png",
    fondClair: true,
    usages: [
      "Signature des PNG téléchargés en thème clair",
      "Variante claire du logo actif (réserve)",
    ],
  },
  {
    id: "og-cover",
    label: "Image de partage des liens",
    src: "/og-cover.png",
    fichier: "public/og-cover.png",
    usages: [
      "Hors site : aperçu du lien mettrik.ai partagé (X, LinkedIn, iMessage, WhatsApp...)",
    ],
  },
  {
    id: "favicon",
    label: "Favicon",
    src: "/favicon.ico",
    fichier: "src/app/favicon.ico",
    usages: ["Icône d'onglet du navigateur, sur toutes les pages du site"],
  },
  {
    id: "mini-logo",
    label: "Mini logo M",
    src: "/brand-mini-logo.png",
    fichier: "public/brand-mini-logo.png",
    usages: ["Plus utilisé nulle part : ancien cachet des exports PNG"],
    orphelin: true,
  },
  {
    id: "mini-logo-grille",
    label: "Mini logo M (planche)",
    src: "/brand-mini-logo-grid.png",
    fichier: "public/brand-mini-logo-grid.png",
    usages: ["Plus utilisé nulle part : planche de travail du mini logo"],
    orphelin: true,
  },
];

export const IDS_ASSETS = ASSETS_MARQUE.map((a) => a.id);

/** Éléments retirés de la logothèque par Yann (croix / suppression multiple).
 *  Retrait d affichage persisté en base : aucun fichier n est détruit, un
 *  élément retiré peut être restauré depuis la page. */
export type MasquesLogotheque = {
  variantes: string[];
  assets: string[];
};

export function nettoieMasques(brut: unknown): MasquesLogotheque {
  const vide: MasquesLogotheque = { variantes: [], assets: [] };
  if (!brut || typeof brut !== "object") return vide;
  const b = brut as Record<string, unknown>;
  const liste = (v: unknown, bornes?: string[]) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.length > 0 && (!bornes || bornes.includes(x)))
      : [];
  return {
    variantes: liste(b.variantes),
    assets: liste(b.assets, IDS_ASSETS),
  };
}

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
