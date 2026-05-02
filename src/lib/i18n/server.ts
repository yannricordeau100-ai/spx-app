import { cookies } from "next/headers";
import { COOKIE_NAME, DEFAULT_LOCALE, asLocale, type Locale } from "./types";

/**
 * Détecte la locale active côté server, avec règles STRICTES (path-based) :
 *   - URL `/fr/<route>` : middleware (proxy.ts) pose le cookie `NEXT_LOCALE=fr`
 *     -> on retourne "fr".
 *   - URL `/<route>`     : pas de cookie posé par le middleware -> on retourne
 *     "en" (défaut), même pour visiteurs FR/BE/CH. C'est volontaire :
 *     l'URL est l'unique source de vérité pour la langue (Yann's choix).
 *
 * L'utilisateur peut override en cliquant le switcher, qui pose le cookie
 * et persiste la préférence. Mais sans action explicite ou /fr URL,
 * la langue par défaut est l'anglais sur les URL non-préfixées.
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const c = await cookies();
    const cookieLoc = asLocale(c.get(COOKIE_NAME)?.value);
    if (cookieLoc) return cookieLoc;
  } catch {}

  return DEFAULT_LOCALE;
}
