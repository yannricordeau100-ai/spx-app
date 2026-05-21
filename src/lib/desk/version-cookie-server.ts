/**
 * version-cookie-server.ts — lecture server-only du cookie
 * `mettrik:version` via `next/headers`.
 *
 * À importer UNIQUEMENT depuis Server Components, route handlers, ou
 * server actions. Pour la version client, voir `use-app-version.ts`.
 *
 * Les types + helpers purs sont dans `version-cookie.ts`.
 */

import { cookies } from "next/headers";
import { parseAppVersion, VERSION_COOKIE, DEFAULT_APP_VERSION, type AppVersion } from "./version-cookie";

// Re-exports pour usage server-side simple (évite double import)
export {
  VERSION_COOKIE,
  VERSION_OPTIONS,
  DEFAULT_APP_VERSION,
  parseAppVersion,
  versionToHubPath,
  detectVersionFromPath,
} from "./version-cookie";
export type { AppVersion } from "./version-cookie";

/**
 * Lit le cookie `mettrik:version` côté server. Retourne la version
 * sélectionnée OU la version par défaut V1.9.5 (Yann 21 mai 2026).
 */
export async function readAppVersion(): Promise<AppVersion> {
  const c = await cookies();
  const raw = c.get(VERSION_COOKIE)?.value ?? null;
  return parseAppVersion(raw) ?? DEFAULT_APP_VERSION;
}
