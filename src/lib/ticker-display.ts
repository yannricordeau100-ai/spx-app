/**
 * Helper d'affichage de ticker — masquage des suffixes de place boursière
 * (.PA / .DE / .L / .SW / .AS / .MI / etc.) SAUF si un doublon "short"
 * existe dans l'univers (cas multi-classes / dual-listing).
 *
 * Règles (Yann 21 mai 2026) :
 *  1. Si le ticker ne contient pas de "." → on retourne tel quel.
 *  2. Si le ticker est dans `ALWAYS_KEEP_FULL_TICKERS` (liste explicite
 *     de doublons connus type ASML/ASMLF, GOOG/GOOGL, BRK.A/BRK.B, etc.)
 *     → on garde le ticker complet.
 *  3. Si le shortTicker (= ticker sans suffixe) existe ailleurs dans
 *     `allTickers` (dual listing ou homonyme) → on garde le ticker
 *     complet pour distinguer (ex : ROG.SW vs ROG).
 *  4. Sinon → on retourne le shortTicker (ex : NESN.SW → NESN).
 *
 * IMPORTANT : ce helper n'affecte QUE l'affichage. Les URLs, datasets,
 * routes et tickers techniques (TICKER_ALIASES, _merged.json, etc.)
 * restent inchangés. Le ticker complet (avec suffixe) reste la clé
 * canonique côté code.
 */

/** Suffixes de place boursière à retirer pour le ticker affiché. */
export const EXCHANGE_SUFFIXES = [
  ".SW", ".PA", ".L", ".DE", ".AS", ".ST", ".CO", ".MI", ".MC",
  ".HE", ".OL", ".T", ".HK", ".TO", ".AX", ".BR", ".LS", ".VI",
  ".IR", ".SS", ".F",
] as const;

/**
 * Doublons explicites (Yann 21 mai 2026) : ces tickers DOIVENT garder
 * leur ticker complet pour distinguer la classe d'action ou le marché
 * de cotation, même si aucun doublon "short" n'est calculé dynamiquement.
 *
 * - ASML / ASMLF : ADR NL vs OTC pink sheet
 * - GOOG / GOOGL : classes A vs C Alphabet
 * - BRK.A / BRK.B : classes A vs B Berkshire Hathaway
 * - FOX / FOXA : classes A vs B Fox Corporation
 * - NWS / NWSA : classes A vs B News Corp
 * - UA / UAA : classes A vs C Under Armour
 *
 * Note : pour BRK.A / BRK.B etc., on garde le "." dans l'affichage.
 */
export const ALWAYS_KEEP_FULL_TICKERS = new Set<string>([
  "ASML", "ASMLF",
  "GOOG", "GOOGL",
  "BRK.A", "BRK.B",
  "FOX", "FOXA",
  "NWS", "NWSA",
  "UA", "UAA",
]);

/**
 * Calcule le ticker court (sans suffixe de place boursière).
 * Retourne `null` si le ticker ne contient pas de suffixe reconnu.
 */
function computeShortTicker(ticker: string): string | null {
  const up = ticker.toUpperCase();
  // BRK.A / BRK.B : on ne strip pas le ".A" / ".B" (ce ne sont pas des
  // suffixes de place boursière). On les laisse passer ici, ils seront
  // gérés par ALWAYS_KEEP_FULL_TICKERS.
  if (!up.includes(".")) return null;
  for (const suf of EXCHANGE_SUFFIXES) {
    if (up.endsWith(suf)) {
      const short = up.slice(0, -suf.length);
      return short.length > 0 ? short : null;
    }
  }
  return null;
}

/**
 * Retourne le ticker à AFFICHER (= tel qu'il doit apparaître à l'écran).
 *
 * @param ticker Ticker technique complet (ex : "NESN.SW", "MC.PA", "AAPL").
 * @param allTickers Set des tickers présents dans l'univers (case-insensitive,
 *                   normalisés UPPERCASE recommandé). Utilisé pour détecter
 *                   les doublons.
 */
export function displayTicker(
  ticker: string,
  allTickers: Set<string> | ReadonlySet<string>,
): string {
  if (!ticker) return ticker;
  const up = ticker.toUpperCase();

  // Règle 2 : exceptions explicites → toujours garder le ticker complet
  if (ALWAYS_KEEP_FULL_TICKERS.has(up)) return up;

  // Règle 1 : pas de "." → pas de suffixe à masquer
  const short = computeShortTicker(up);
  if (!short) return up;

  // Règle 3 : si le short existe ailleurs dans l'univers → garder le complet
  // (ex : ROG.SW gardé si ROG existe aussi)
  if (allTickers.has(short)) return up;

  // Règle 4 : suffixe masqué
  return short;
}

/**
 * Variante pratique : construit le Set d'allTickers depuis une liste de
 * tickers + applique `displayTicker`. Utile quand on a juste une liste.
 */
export function buildTickerSet(tickers: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const t of tickers) {
    if (t) set.add(t.toUpperCase());
  }
  return set;
}
