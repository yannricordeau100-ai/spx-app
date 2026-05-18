/**
 * version-cookie.ts — système de "version sélectionnée" Mettrik.
 *
 * Yann veut pouvoir choisir une version (V1.7, V1.7.5, V1.8) via un panel
 * de réglages : ce choix est persisté dans un cookie `mettrik:version` et
 * détermine quelles sociétés sont visibles sur la home `/` ainsi que sur
 * les autres pages globales (concepts, populaire-investisseurs, etc.).
 *
 * Ce fichier est PUR (pas de cookies()/headers() de next) → safe à
 * importer côté client ET côté server. La version "server-only" (lecture
 * du cookie via `next/headers`) est dans `version-cookie-server.ts`.
 *
 * Le hook client + les setters sont dans `use-app-version.ts`.
 */

export type AppVersion = "v1-7" | "v1-7-5" | "v1-8" | null;

export const VERSION_COOKIE = "mettrik:version";

export const VERSION_OPTIONS: ReadonlyArray<{ value: AppVersion; label: string }> = [
  { value: "v1-7", label: "V1.7" },
  { value: "v1-7-5", label: "V1.7.5" },
  { value: "v1-8", label: "V1.8" },
];

const VALID_VERSIONS: ReadonlySet<Exclude<AppVersion, null>> = new Set([
  "v1-7",
  "v1-7-5",
  "v1-8",
]);

/**
 * Valide un input (cookie raw, query param, etc.) et retourne la version
 * canonique. null si invalide ou absent.
 */
export function parseAppVersion(s: string | null | undefined): AppVersion {
  if (!s) return null;
  if (VALID_VERSIONS.has(s as Exclude<AppVersion, null>)) {
    return s as AppVersion;
  }
  return null;
}

/**
 * Retourne le path du hub correspondant à une version.
 * Pour `null` → renvoie le hub central `/sandbox`.
 */
export function versionToHubPath(v: AppVersion): string {
  if (v === null) return "/sandbox";
  return `/sandbox/${v}`;
}

/**
 * Détecte la version actuellement consultée à partir du pathname.
 * Ordre important : v1-7-5 doit matcher AVANT v1-7 (préfixe commun).
 */
export function detectVersionFromPath(pathname: string): AppVersion {
  if (pathname.startsWith("/sandbox/v1-8")) return "v1-8";
  if (pathname.startsWith("/sandbox/v1-7-5")) return "v1-7-5";
  if (pathname.startsWith("/sandbox/v1-7")) return "v1-7";
  return null;
}
