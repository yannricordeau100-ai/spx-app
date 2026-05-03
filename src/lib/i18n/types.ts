/**
 * Types & constantes de l'i18n Mettrik.
 *
 * Locales supportées (par ordre de population approximative des pays
 * principaux qui les parlent) :
 *   en    : anglais US (défaut, fallback international)
 *   en-GB : anglais UK (variante orthographe + monnaie)
 *   fr    : français (FR, BE, CH-fr, LU, MC, CA-fr)
 *   de    : allemand (DE, AT)
 *   de-CH : allemand suisse
 *   nl    : néerlandais (NL, BE-nl)
 *   sv    : suédois (SE, FI partiellement)
 *   da    : danois (DK)
 */
export type Locale = "en" | "en-GB" | "fr" | "de" | "de-CH" | "nl" | "sv" | "da";

/**
 * Liste ordonnée par population du pays principal (approx 2025) :
 *   EN-US   : 335M
 *   FR      : 305M (FR + BE + CH + CA-fr + LU + MC + Afrique)
 *   DE      : 95M (DE + AT)
 *   NL      : 24M (NL + BE-nl)
 *   EN-GB   : 67M (UK)
 *   SV      : 10M (SE)
 *   DA      : 6M (DK)
 *   DE-CH   : 5M (CH-de)
 */
export const LOCALES: Locale[] = ["en", "fr", "de", "nl", "en-GB", "sv", "da", "de-CH"];

/** Métadonnées d'affichage (drapeau emoji + nom dans la langue). */
export const LOCALE_META: Record<Locale, { flag: string; nativeName: string; populationOrder: number }> = {
  "en":    { flag: "🇺🇸", nativeName: "English",        populationOrder: 1 },
  "fr":    { flag: "🇫🇷", nativeName: "Français",       populationOrder: 2 },
  "de":    { flag: "🇩🇪", nativeName: "Deutsch",        populationOrder: 3 },
  "nl":    { flag: "🇳🇱", nativeName: "Nederlands",     populationOrder: 4 },
  "en-GB": { flag: "🇬🇧", nativeName: "English (UK)",   populationOrder: 5 },
  "sv":    { flag: "🇸🇪", nativeName: "Svenska",        populationOrder: 6 },
  "da":    { flag: "🇩🇰", nativeName: "Dansk",          populationOrder: 7 },
  "de-CH": { flag: "🇨🇭", nativeName: "Schweizerdeutsch", populationOrder: 8 },
};

export const DEFAULT_LOCALE: Locale = "en";

/**
 * Mapping pays → locale par défaut. Utilisé par la détection auto via
 * le header `x-vercel-ip-country` (provided par Vercel Edge en prod).
 *
 * Ordre de fallback dans la détection :
 *   1. URL prefix (/fr/...) -> source de vérité absolue
 *   2. Cookie NEXT_LOCALE (préférence user explicite)
 *   3. IP -> pays -> locale via cette table
 *   4. Header Accept-Language (OS / browser)
 *   5. DEFAULT_LOCALE (en)
 */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // Français
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  // Suisse : franco majoritaire dans région ouest, allemand majoritaire
  // dans la majorité du pays. On met "de-CH" mais le user peut switcher.
  CH: "de-CH",
  // Canada : francophone Québec, mais anglo majoritaire global. EN par défaut.
  CA: "en",
  // Allemand
  DE: "de", AT: "de", LI: "de",
  // Néerlandais
  NL: "nl",
  // Suédois
  SE: "sv", FI: "sv", // Finlande co-officielle SV
  // Danois
  DK: "da",
  // UK English
  GB: "en-GB", IE: "en-GB",
  // Tout le reste = en (défaut). USA, AU, NZ, IN, etc.
};

export const COOKIE_NAME = "NEXT_LOCALE";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

/** Devine la locale depuis un code pays ISO. */
export function localeFromCountry(country: string | null | undefined): Locale {
  if (!country) return DEFAULT_LOCALE;
  return COUNTRY_TO_LOCALE[country.toUpperCase()] ?? DEFAULT_LOCALE;
}

/** Devine la locale depuis le header Accept-Language. */
export function localeFromAcceptLanguage(al: string | null | undefined): Locale | null {
  if (!al) return null;
  const first = al.split(",")[0]?.trim().toLowerCase() ?? "";
  // Match exact (ex: "fr-fr", "en-gb")
  if (first.startsWith("fr")) return "fr";
  if (first.startsWith("de-ch")) return "de-CH";
  if (first.startsWith("de")) return "de";
  if (first.startsWith("nl")) return "nl";
  if (first.startsWith("sv")) return "sv";
  if (first.startsWith("da")) return "da";
  if (first.startsWith("en-gb") || first.startsWith("en-uk")) return "en-GB";
  if (first.startsWith("en")) return "en";
  return null;
}

/** Valide qu'une string est bien une Locale connue (sinon retourne null). */
export function asLocale(value: string | undefined | null): Locale | null {
  if (!value) return null;
  return (LOCALES as string[]).includes(value) ? (value as Locale) : null;
}

/** Retourne la version 2 lettres simple (pour /fr/, /en/ URLs). */
export function localeToUrlPrefix(locale: Locale): string {
  // Pour les variantes (de-CH, en-GB), on garde le prefix court de la base.
  // On distingue via cookie. URL = "fr" ou "de" ou "en" simple.
  if (locale === "de-CH") return "de";
  if (locale === "en-GB") return "en";
  return locale;
}
