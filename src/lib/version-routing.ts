/**
 * version-routing.ts — version courante de l'app.
 *
 * Source unique de vérité pour les routes versionnées (pricing, contact,
 * etc.). Les pages utilitaires sous `/sandbox/<version>/...` importent
 * ce constant pour leur navigation, ce qui permet de basculer toute
 * l'app vers la version suivante en modifiant UNE seule valeur.
 *
 * Yann 25 mai 2026 : V1.9.5 = version courante = doit refléter la
 * dernière itération publishable des sés audit a-f + g-m clean_all.
 */

export const LATEST_VERSION_SLUG = "v1-9-5";

/** Liste des slugs versions valides (pour validation, sitemap, etc.). */
export const VERSION_SLUGS = [
  "v1-7-5",
  "v1-8",
  "v1-9-5",
] as const;

export type VersionSlug = (typeof VERSION_SLUGS)[number];

/** Construit une URL versionnée à partir d'un sous-chemin. */
export function versionedHref(subPath: string): string {
  const clean = subPath.startsWith("/") ? subPath.slice(1) : subPath;
  return `/sandbox/${LATEST_VERSION_SLUG}/${clean}`;
}

/** Slug version "humain" : "v1-9-5" → "V1.9.5". */
export function formatVersionLabel(slug: string = LATEST_VERSION_SLUG): string {
  return slug.replace(/^v/, "V").replace(/-/g, ".");
}
