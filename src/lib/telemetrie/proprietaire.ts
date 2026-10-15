/**
 * Visites de Yann et des outils automatiques (Yann 15 oct 2026).
 *
 * Rien n est jamais supprimé ni refusé à l ingestion pour ces raisons : les
 * événements sont ÉTIQUETÉS (props._moi, props._client) et l analytics les
 * isole à la lecture, interrupteur « Exclure mes visites » (actif par défaut).
 * L exclusion est donc rétroactive : les listes (IP hachées, comptes) vivent en
 * base (desk_page_content, page « telemetrie »), jamais dans le code client.
 *
 * Module SERVEUR uniquement.
 */

/** Cookie posé à chaque visite connectée en propriétaire (ou compte exclu). */
export const COOKIE_PROPRIO = "mtk_owner";
export const COOKIE_PROPRIO_DUREE_S = 365 * 24 * 3600;

/** Robots, outils de vérification (verif-n0-connecte et verif-release passent
 *  par Playwright ou curl), aperçus de liens et services Vercel. */
const ROBOTS = /bot\b|bot\/|crawl|spider|slurp|headless|playwright|puppeteer|lighthouse|vercel|verif-n0|verif-release|curl\/|wget|python-requests|python-urllib|aiohttp|node-fetch|undici|axios|go-http-client|okhttp|java\/|facebookexternalhit|embedly|preview|monitor|uptime|pingdom|scan/i;

/** Navigateur intégré de l application X (Android : « TwitterAndroid » ;
 *  iOS : « Twitter for iPhone » dans certaines versions). */
const APPLI_X = /twitter(android|\sfor\s(iphone|ipad))|\bTwitter\//i;

/** Famille de client déduite de l agent utilisateur (jamais stocké en clair). */
export function familleClient(ua: string | null | undefined, webdriver?: unknown): "robot" | "x" | null {
  const u = ua ?? "";
  if (!u || webdriver === true || ROBOTS.test(u)) return "robot";
  if (APPLI_X.test(u)) return "x";
  return null;
}

/** Ville Vercel (en-tête encodé), bornée. */
export function villeDepuisEntete(v: string | null): string | null {
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 80) || null; } catch { return v.slice(0, 80) || null; }
}
