/**
 * Helpers devise + taux de change pour le simulateur dividendes.
 *
 * Choix API : frankfurter.app (alimenté par les taux ECB, gratuit, pas de
 * clé API, stable depuis 2017, idéal pour un usage UI client). Endpoint :
 *   https://api.frankfurter.app/latest?from=USD&to=EUR
 *
 * Si l'API tombe : fallback sur 1.0 (= afficher dans la devise source).
 */

export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CHF",
  "JPY",
  "CAD",
  "AUD",
  "SEK",
  "DKK",
  "NOK",
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "CHF",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  SEK: "kr",
  DKK: "kr",
  NOK: "kr",
};

/** Devise native d'une société à partir du ticker (ou suffixe d'exchange). */
export function getTickerCurrency(ticker: string): Currency {
  // Suffixes Bourse → devise
  const upper = ticker.toUpperCase();
  if (upper.endsWith(".PA") || upper.endsWith(".AS") || upper.endsWith(".BR") || upper.endsWith(".LS")) return "EUR";
  if (upper.endsWith(".DE") || upper.endsWith(".VI") || upper.endsWith(".HE") || upper.endsWith(".MC") || upper.endsWith(".MI")) return "EUR";
  if (upper.endsWith(".L")) return "GBP";
  if (upper.endsWith(".SW")) return "CHF";
  if (upper.endsWith(".T")) return "JPY";
  if (upper.endsWith(".TO") || upper.endsWith(".V")) return "CAD";
  if (upper.endsWith(".AX")) return "AUD";
  if (upper.endsWith(".ST")) return "SEK";
  if (upper.endsWith(".CO")) return "DKK";
  if (upper.endsWith(".OL")) return "NOK";
  // Default : NYSE / NASDAQ → USD
  return "USD";
}

/**
 * Mapping ISO 3166-1 alpha-2 country code → devise supportée par Mettrik.
 * Utilisé par la détection auto serveur (header `x-vercel-ip-country`).
 *
 * Pays avec leur propre devise dans nos 10 supportées : USD, EUR, GBP, CHF,
 * JPY, CAD, AUD, SEK, DKK, NOK.
 *
 * Tout pays NON listé ici tombe sur le fallback continent (cf
 * getCurrencyForCountry ci-dessous) :
 *   - Europe → EUR
 *   - Amérique → USD
 *   - Asie → USD
 *   - Océanie → USD
 *   - Afrique → EUR
 *   - Moyen-Orient → USD
 */
export const COUNTRY_TO_CURRENCY: Record<string, Currency> = {
  // EUR (zone euro + bonus Vatican / Monaco / etc.)
  AD: "EUR", AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR",
  ES: "EUR", FI: "EUR", FR: "EUR", GR: "EUR", IE: "EUR", IT: "EUR",
  LT: "EUR", LU: "EUR", LV: "EUR", MC: "EUR", MT: "EUR", NL: "EUR",
  PT: "EUR", SI: "EUR", SK: "EUR", SM: "EUR", VA: "EUR", AX: "EUR",
  // Pays européens hors zone euro mais avec leur propre devise
  GB: "GBP", IM: "GBP", JE: "GBP", GG: "GBP", GI: "GBP",
  CH: "CHF", LI: "CHF",
  SE: "SEK",
  DK: "DKK", FO: "DKK",
  NO: "NOK", SJ: "NOK",
  // Amérique
  US: "USD", CA: "CAD",
  PR: "USD", VI: "USD", GU: "USD", AS: "USD", MP: "USD", // territoires US
  BM: "USD", BS: "USD", PA: "USD", SV: "USD", EC: "USD", // dollarisés
  // Asie
  JP: "JPY",
  HK: "USD", SG: "USD", // dollarisés / fortement liés
  // Océanie
  AU: "AUD", NZ: "AUD", // NZ utilise NZD pas dans nos 10, fallback AUD géo
  CC: "AUD", CX: "AUD", NF: "AUD", KI: "AUD", NR: "AUD", TV: "AUD",
  // ─── Override Yann 10 mai 2026 : pays à cheval Europe/Asie + Caucase
  // + Caspienne. Yann tranche : ces pays utilisent EUR malgré leur région
  // techniquement non-européenne. Cohérent avec une présence
  // commerciale/touristique forte vers l'Europe.
  RU: "EUR", TR: "EUR", GE: "EUR", AM: "EUR", AZ: "EUR", KZ: "EUR",
};

/**
 * Détecte la devise à utiliser pour un visiteur selon son code pays ISO.
 *
 * Logique :
 *   1. Si le pays a sa propre devise dans nos 10 supportées → on l'utilise.
 *   2. Sinon, fallback selon la région :
 *      - Europe + Afrique → EUR
 *      - Amérique + Asie + Océanie + Moyen-Orient → USD
 *
 * Retourne USD si pays inconnu (fallback global).
 */
export function getCurrencyForCountry(country: string | null | undefined): Currency {
  if (!country) return "USD";
  const upper = country.toUpperCase();
  // 1. Mapping pays direct (a sa propre devise)
  const direct = COUNTRY_TO_CURRENCY[upper];
  if (direct) return direct;
  // 2. Fallback par région — import dynamique pour éviter circular dep
  // (currency.ts ne doit pas dépendre de geo/country-region.ts si le bundle
  //  l'inclut déjà via i18n)
  // Inline minimal : on ré-implante le mapping continent ici en simplifié.
  const EU_PREFIX_NO_OWN = new Set([
    "AL", "BA", "BG", "BY", "CZ", "HR", "HU", "MD", "MK", "ME", "PL",
    "RO", "RS", "UA", "XK",
  ]);
  if (EU_PREFIX_NO_OWN.has(upper)) return "EUR";
  const AF_COUNTRIES = new Set([
    "DZ", "AO", "BJ", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CD",
    "CG", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH",
    "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MA", "MR",
    "MU", "MZ", "NA", "NE", "NG", "RE", "RW", "ST", "SN", "SC", "SL",
    "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "EH", "YT", "ZM",
    "ZW", "SH",
  ]);
  if (AF_COUNTRIES.has(upper)) return "EUR";
  // Tout le reste (Asie, Océanie, Amérique latine, Moyen-Orient) → USD
  return "USD";
}

/**
 * Lit la devise persistée dans le cookie `mettrik:currency` (posé par le
 * proxy serveur via détection IP, ou par le user via le picker).
 *
 * Renvoie null si pas de cookie ou si la valeur n'est pas une devise
 * supportée. Côté client uniquement.
 */
export function getCurrencyFromCookie(): Currency | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)mettrik:currency=([A-Za-z]+)/);
  if (!m) return null;
  const v = m[1].toUpperCase();
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(v)) {
    return v as Currency;
  }
  return null;
}

/**
 * Persiste la devise choisie dans un cookie 1 an. Appelé par le picker
 * dès qu'un user change manuellement.
 */
export function setCurrencyCookie(currency: Currency): void {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `mettrik:currency=${currency}; path=/; max-age=${oneYear}; samesite=lax`;
}

/** Devise du pays de l'utilisateur via navigator.language (côté client uniquement). */
export function getUserCurrency(): Currency {
  if (typeof navigator === "undefined") return "USD";
  const lang = (navigator.language || "en-US").toLowerCase();
  // Pays → devise
  if (lang.includes("fr") || lang.includes("de") || lang.includes("es") || lang.includes("it") || lang.includes("nl") || lang.includes("pt") || lang.includes("fi") || lang.includes("ga") || lang.includes("el")) return "EUR";
  if (lang.includes("en-gb") || lang.includes("en-uk")) return "GBP";
  if (lang.includes("ch") || lang.includes("de-ch") || lang.includes("fr-ch")) return "CHF";
  if (lang.includes("ja")) return "JPY";
  if (lang.includes("en-ca")) return "CAD";
  if (lang.includes("en-au")) return "AUD";
  if (lang.includes("no") || lang.includes("nb") || lang.includes("nn")) return "NOK";
  return "USD";
}

/**
 * Récupère le taux de change `from → to` via frankfurter.app.
 * Cache simple en mémoire par paire (TTL 1 h). Si l'API échoue, retourne 1.
 */
const rateCache = new Map<string, { rate: number; ts: number }>();
const TTL_MS = 60 * 60 * 1000; // 1 h

export async function getExchangeRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1;
  const key = `${from}_${to}`;
  const now = Date.now();
  const cached = rateCache.get(key);
  if (cached && now - cached.ts < TTL_MS) return cached.rate;
  try {
    // Yann (25 mai 2026) : frankfurter.app → 301 vers frankfurter.dev/v1.
    // L'auto-follow fetch peut échouer côté Vercel (env serverless,
    // certificats, timeout, CDN cache). On utilise directement la nouvelle
    // URL canonique pour éviter le redirect.
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`, {
      cache: "no-store",
    });
    if (!res.ok) return 1;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rate = json.rates?.[to] ?? 1;
    rateCache.set(key, { rate, ts: now });
    return rate;
  } catch {
    return 1;
  }
}
