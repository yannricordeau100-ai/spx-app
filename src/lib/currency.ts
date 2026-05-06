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
  if (lang.includes("sv")) return "SEK";
  if (lang.includes("da")) return "DKK";
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
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
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
