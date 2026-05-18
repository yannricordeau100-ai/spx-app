"use client";

/**
 * use-app-version.ts — hook + setters client pour le cookie
 * `mettrik:version` (système de "version sélectionnée" Mettrik).
 *
 * - `useAppVersion()` : lit le cookie au mount et retourne la version.
 * - `setAppVersion(v)` : pose / supprime le cookie + reload la page.
 * - `setAppVersionAndNavigate(v)` : intelligent — si on est déjà sur un
 *   path versionné `/sandbox/v1-X/...`, navigue vers `/sandbox/v1-Y/...`
 *   en gardant le suffixe (ex : page d'une société). Sinon pose le
 *   cookie + reload (la prochaine page lira le cookie côté server).
 *
 * Pour le helper server-side, voir `version-cookie-server.ts`.
 */

import { useEffect, useState } from "react";
import { parseAppVersion, VERSION_COOKIE, type AppVersion } from "./version-cookie";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function writeCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const exp = new Date();
  exp.setDate(exp.getDate() + days);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp.toUTCString()}; path=/; samesite=lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

/**
 * Hook : retourne la version courante posée dans le cookie (ou null).
 * Lit au mount, puis statique pour le reste du render (les setters
 * forcent un reload donc la valeur est toujours fraîche au render).
 */
export function useAppVersion(): AppVersion {
  const [version, setVersion] = useState<AppVersion>(null);
  useEffect(() => {
    const raw = readCookie(VERSION_COOKIE);
    setVersion(parseAppVersion(raw));
  }, []);
  return version;
}

/**
 * Pose ou supprime le cookie de version + reload pour que tous les
 * Server Components relisent la valeur.
 */
export function setAppVersion(v: AppVersion): void {
  if (v === null) {
    deleteCookie(VERSION_COOKIE);
  } else {
    writeCookie(VERSION_COOKIE, v);
  }
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * Pose le cookie ET navigue intelligemment selon la page actuelle :
 *  - sur `/sandbox/v1-X/<rest>` → vers `/sandbox/v1-Y/<rest>`
 *  - sur le hub `/sandbox/v1-X` (ou avec trailing slash) → vers `/sandbox/v1-Y`
 *  - sinon → pose le cookie et reload (la prochaine page lira le cookie)
 *
 * Si la cible est `null` : pas de chemin versionné équivalent → on retombe
 * sur le comportement `setAppVersion` (cookie supprimé + reload).
 */
export function setAppVersionAndNavigate(v: AppVersion): void {
  if (typeof window === "undefined") return;

  if (v === null) {
    setAppVersion(null);
    return;
  }

  // Toujours poser le cookie pour que les pages non versionnées
  // (home, concepts, populaire-investisseurs) reflètent le choix.
  writeCookie(VERSION_COOKIE, v);

  const pathname = window.location.pathname;
  // Ordre important : v1-7-5 doit matcher AVANT v1-7 (préfixe commun)
  const match = pathname.match(/^\/sandbox\/(v1-8|v1-7-5|v1-7)(\/.*)?$/);
  if (match) {
    const rest = match[2] ?? "";
    window.location.href = `/sandbox/${v}${rest}`;
    return;
  }

  // Pas sur un chemin versionné → reload pour relire le cookie côté server.
  window.location.reload();
}
