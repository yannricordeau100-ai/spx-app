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
import { parseAppVersion, VERSION_COOKIE, type AppVersion } from "./version-cookie";

// Re-exports pour usage server-side simple (évite double import)
export {
  VERSION_COOKIE,
  VERSION_OPTIONS,
  parseAppVersion,
  versionToHubPath,
  detectVersionFromPath,
} from "./version-cookie";
export type { AppVersion } from "./version-cookie";

/**
 * Lit le cookie `mettrik:version` côté server. Retourne la version
 * sélectionnée ou null si absent / invalide.
 */
export async function readAppVersion(): Promise<AppVersion> {
  const c = await cookies();
  const raw = c.get(VERSION_COOKIE)?.value ?? null;
  return parseAppVersion(raw);
}
