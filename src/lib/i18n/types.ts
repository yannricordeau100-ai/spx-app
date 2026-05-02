/**
 * Types & constantes de l'i18n Mettrik.
 *
 * Locales supportées : "fr" (français), "en" (anglais).
 * EN = défaut visiteur sans préférence (visiteurs internationaux).
 * FR = défaut pour visiteurs depuis FR/BE/CH/LU/MC.
 */
export type Locale = "fr" | "en";
export const LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Pays dont la langue par défaut est le français. Utilisé par la
 * détection auto via le header `x-vercel-ip-country`.
 */
export const FRENCH_COUNTRIES = new Set([
  "FR", "BE", "CH", "LU", "MC", "CA", // CA = Canada (Québec inclus, fallback FR)
]);

export const COOKIE_NAME = "NEXT_LOCALE";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

/** Devine la locale depuis un code pays ISO. */
export function localeFromCountry(country: string | null | undefined): Locale {
  if (!country) return DEFAULT_LOCALE;
  return FRENCH_COUNTRIES.has(country.toUpperCase()) ? "fr" : "en";
}

/** Valide qu'une string est bien une Locale connue (sinon retourne null). */
export function asLocale(value: string | undefined | null): Locale | null {
  if (!value) return null;
  return (LOCALES as string[]).includes(value) ? (value as Locale) : null;
}
