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
 *
 * Note (Yann 25 mai 2026) : suédois (sv) et danois (da) retirés —
 * volumes utilisateurs trop faibles pour justifier maintenance i18n.
 */
export type Locale = "en" | "en-GB" | "fr" | "de" | "de-CH" | "nl";

/**
 * Familles linguistiques pour le regroupement visuel du LanguageDropdown
 * (règle Yann 17 mai 2026 nuit) :
 *
 *   "english"     : EN-US + EN-GB (variantes anglaises)
 *   "romance"     : FR (et toute autre langue romane future)
 *   "germanic"    : DE + DE-CH + NL (NL est germanique occidental, cousine
 *                   directe de l'allemand → groupée avec)
 *
 * Template pour ajout futur d'une langue : DOIT inclure une `family` dans
 * LOCALE_META + figurer dans la const LOCALE_FAMILIES_ORDER ci-dessous.
 * Le LanguageDropdown applique le regroupement automatiquement.
 */
export type LocaleFamily = "english" | "romance" | "germanic";

/**
 * Ordre d'affichage des familles dans le dropdown (haut → bas).
 * EN d'abord car défaut international, puis FR (audience principale Yann),
 * puis germanique.
 */
export const LOCALE_FAMILIES_ORDER: LocaleFamily[] = [
  "english",
  "romance",
  "germanic",
];

/** Libellés FR très courts des familles, affichés en header de groupe. */
export const LOCALE_FAMILY_LABEL: Record<LocaleFamily, string> = {
  english: "English",
  romance: "Romance",
  germanic: "Germanique",
};

/**
 * Liste ordonnée par population du pays principal (approx 2025) :
 *   EN-US   : 335M
 *   FR      : 305M (FR + BE + CH + CA-fr + LU + MC + Afrique)
 *   DE      : 95M (DE + AT)
 *   NL      : 24M (NL + BE-nl)
 *   EN-GB   : 67M (UK)
 *   DE-CH   : 5M (CH-de)
 *
 * Cet ordre est utilisé pour les fallbacks et la priorité de détection
 * automatique. L'affichage visuel du dropdown est lui regroupé par famille
 * linguistique (cf LOCALE_FAMILIES_ORDER ci-dessus).
 */
export const LOCALES: Locale[] = ["en", "fr", "de", "nl", "en-GB", "de-CH"];

/** Métadonnées d'affichage (drapeau emoji + nom dans la langue + famille). */
export const LOCALE_META: Record<Locale, { flag: string; nativeName: string; populationOrder: number; family: LocaleFamily }> = {
  "en":    { flag: "🇺🇸", nativeName: "English",          populationOrder: 1, family: "english" },
  "en-GB": { flag: "🇬🇧", nativeName: "English (UK)",     populationOrder: 5, family: "english" },
  "fr":    { flag: "🇫🇷", nativeName: "Français",         populationOrder: 2, family: "romance" },
  "de":    { flag: "🇩🇪", nativeName: "Deutsch",          populationOrder: 3, family: "germanic" },
  "de-CH": { flag: "🇨🇭", nativeName: "Schweizerdeutsch", populationOrder: 6, family: "germanic" },
  "nl":    { flag: "🇳🇱", nativeName: "Nederlands",       populationOrder: 4, family: "germanic" },
};

/**
 * Ordre intra-famille pour l'affichage (utilisé par le LanguageDropdown).
 * Modifie cet array si tu ajoutes une variante (ex: en-AU dans english).
 */
// Yann 29 mai 2026 : Phase 1 V1 → désactivation UI des 7 langues autres
// que FR. Les dictionnaires EN/DE/NL/EN-GB/DE-CH restent en code (pour V2
// future), mais le LanguageDropdown n'affiche QUE le français. Cf MISSION B.
export const LOCALES_BY_FAMILY: Record<LocaleFamily, Locale[]> = {
  english: [],
  romance: ["fr"],
  germanic: [],
};

export const DEFAULT_LOCALE: Locale = "fr";

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
  // ─── Français : pays officiellement francophones ───
  FR: "fr", MC: "fr", LU: "fr",
  // Belgique : co-officielle nl/fr/de — on met "fr" par défaut (règle Yann
  // 10 mai 2026 : tout pays francophone → fr). User peut switcher.
  BE: "fr",
  // Suisse : 4 langues officielles (de, fr, it, rmsh). On met "de-CH" par
  // défaut (majorité 62 % du pays). User en CH-fr peut switcher en 1 clic.
  CH: "de-CH",
  // Canada : officiellement bilingue. Yann a précisé "IP francophone : fr",
  // mais CA-anglo est majoritaire (~75 %). On met "en" par défaut, QC peut
  // switcher en 1 clic.
  CA: "en",
  // Pays africains francophones (langue officielle française)
  BF: "fr", BI: "fr", BJ: "fr", CD: "fr", CF: "fr", CG: "fr", CI: "fr",
  CM: "fr", DJ: "fr", DZ: "fr", GA: "fr", GN: "fr", GQ: "fr", HT: "fr",
  KM: "fr", MA: "fr", MG: "fr", ML: "fr", MR: "fr", MU: "fr", NE: "fr",
  RE: "fr", RW: "fr", SC: "fr", SN: "fr", TD: "fr", TG: "fr", TN: "fr",
  VU: "fr", YT: "fr", GP: "fr", MQ: "fr", GF: "fr", PM: "fr", PF: "fr",
  NC: "fr", WF: "fr",

  // ─── Allemand : pays officiellement germanophones ───
  DE: "de", AT: "de", LI: "de",

  // ─── Néerlandais ───
  NL: "nl",
  // Curaçao + Aruba + Sint Maarten + BES → néerlandais
  AW: "nl", CW: "nl", SX: "nl", BQ: "nl", SR: "nl",

  // ─── English UK (variante) ───
  GB: "en-GB", IE: "en-GB",
  IM: "en-GB", JE: "en-GB", GG: "en-GB", GI: "en-GB",
  // Pays du Commonwealth historique anglo-britannique → variante UK
  AU: "en-GB", NZ: "en-GB",
  ZA: "en-GB", IN: "en-GB", PK: "en-GB", BD: "en-GB", LK: "en-GB",
  MY: "en-GB", SG: "en-GB", HK: "en-GB",
  // Carraïbes Commonwealth
  JM: "en-GB", BB: "en-GB", TT: "en-GB", BS: "en-GB", BZ: "en-GB",
  AG: "en-GB", DM: "en-GB", LC: "en-GB", VC: "en-GB", GD: "en-GB",
  KN: "en-GB", AI: "en-GB", BM: "en-GB", VG: "en-GB", KY: "en-GB",
  MS: "en-GB", TC: "en-GB", FK: "en-GB", SH: "en-GB",
  // Afrique anglo
  KE: "en-GB", NG: "en-GB", GH: "en-GB", UG: "en-GB", TZ: "en-GB",
  ZM: "en-GB", ZW: "en-GB", BW: "en-GB", MW: "en-GB", NA: "en-GB",
  SZ: "en-GB", LS: "en-GB", LR: "en-GB", SL: "en-GB", GM: "en-GB",
  // Pacifique anglo (note : VU = Vanuatu reste en "fr" plus haut, langue
  // officielle co-enregistrée avec l'anglais et le bislama)
  FJ: "en-GB", PG: "en-GB", SB: "en-GB", TO: "en-GB",
  WS: "en-GB", KI: "en-GB", TV: "en-GB", NR: "en-GB", PW: "en-GB",
  CK: "en-GB", NU: "en-GB",

  // ─── Tout le reste : en (US par défaut) ───
  // États-Unis, Asie non-anglophone, Moyen-Orient, Amérique latine,
  // Russie, Europe de l'Est non couverte ci-dessus, etc.
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
