/**
 * Senate stock trades — données déclarées sous le STOCK Act 2012
 * (chaque sénateur US doit déclarer ses transactions sous 45 jours).
 *
 * Source live recommandée pour V1.5 :
 *   - Senate Stock Watcher (JSON public, GitHub) : senatestockwatcher.com
 *   - Capitol Trades API (REST JSON, free tier généreux) : capitoltrades.com
 *
 * Pour V1, données démo représentatives (volumes et profils plausibles
 * basés sur les patterns historiques observés). À brancher sur l'API
 * réelle dès que le fetcher est posé.
 */

export type SenateTrade = {
  senator: string;
  party: "R" | "D" | "I";
  state: string;
  ticker: string;
  type: "Purchase" | "Sale";
  /** Borne basse de la fourchette déclarée (en USD). */
  amount_low: number;
  /** Borne haute de la fourchette déclarée (en USD). */
  amount_high: number;
  /** Date de la transaction (ISO). */
  date: string;
  /** Délai entre transaction et déclaration (jours). >45 = late filing. */
  filing_lag_days: number;
};

const MOCK: Record<string, SenateTrade[]> = {
  GOOGL: [
    { senator: "T. Daines", party: "R", state: "MT", ticker: "GOOGL", type: "Purchase", amount_low: 1001, amount_high: 15000, date: "2026-03-15", filing_lag_days: 8 },
    { senator: "J. Hagerty", party: "R", state: "TN", ticker: "GOOGL", type: "Sale", amount_low: 50001, amount_high: 100000, date: "2026-02-22", filing_lag_days: 12 },
    { senator: "S. Whitehouse", party: "D", state: "RI", ticker: "GOOGL", type: "Purchase", amount_low: 15001, amount_high: 50000, date: "2026-01-30", filing_lag_days: 22 },
    { senator: "M. McCaul", party: "R", state: "TX", ticker: "GOOGL", type: "Purchase", amount_low: 100001, amount_high: 250000, date: "2025-12-18", filing_lag_days: 6 },
    { senator: "T. Carper", party: "D", state: "DE", ticker: "GOOGL", type: "Sale", amount_low: 1001, amount_high: 15000, date: "2025-11-09", filing_lag_days: 38 },
  ],
  META: [
    { senator: "M. McCaul", party: "R", state: "TX", ticker: "META", type: "Purchase", amount_low: 50001, amount_high: 100000, date: "2026-04-02", filing_lag_days: 9 },
    { senator: "T. Daines", party: "R", state: "MT", ticker: "META", type: "Purchase", amount_low: 1001, amount_high: 15000, date: "2026-03-08", filing_lag_days: 14 },
    { senator: "J. Hickenlooper", party: "D", state: "CO", ticker: "META", type: "Sale", amount_low: 15001, amount_high: 50000, date: "2026-02-14", filing_lag_days: 7 },
    { senator: "S. Capito", party: "R", state: "WV", ticker: "META", type: "Purchase", amount_low: 1001, amount_high: 15000, date: "2025-12-05", filing_lag_days: 18 },
  ],
  MSCI: [
    { senator: "T. Carper", party: "D", state: "DE", ticker: "MSCI", type: "Purchase", amount_low: 1001, amount_high: 15000, date: "2026-02-26", filing_lag_days: 11 },
    { senator: "M. Crapo", party: "R", state: "ID", ticker: "MSCI", type: "Purchase", amount_low: 15001, amount_high: 50000, date: "2025-11-20", filing_lag_days: 33 },
  ],
  SPGI: [
    { senator: "S. Whitehouse", party: "D", state: "RI", ticker: "SPGI", type: "Purchase", amount_low: 15001, amount_high: 50000, date: "2026-03-22", filing_lag_days: 6 },
    { senator: "J. Hagerty", party: "R", state: "TN", ticker: "SPGI", type: "Purchase", amount_low: 50001, amount_high: 100000, date: "2026-01-12", filing_lag_days: 19 },
    { senator: "T. Daines", party: "R", state: "MT", ticker: "SPGI", type: "Sale", amount_low: 1001, amount_high: 15000, date: "2025-10-28", filing_lag_days: 4 },
  ],
  CAT: [
    { senator: "M. McCaul", party: "R", state: "TX", ticker: "CAT", type: "Purchase", amount_low: 100001, amount_high: 250000, date: "2026-04-08", filing_lag_days: 11 },
    { senator: "S. Capito", party: "R", state: "WV", ticker: "CAT", type: "Purchase", amount_low: 15001, amount_high: 50000, date: "2026-03-01", filing_lag_days: 16 },
    { senator: "J. Manchin", party: "I", state: "WV", ticker: "CAT", type: "Sale", amount_low: 50001, amount_high: 100000, date: "2026-01-19", filing_lag_days: 28 },
    { senator: "M. Crapo", party: "R", state: "ID", ticker: "CAT", type: "Purchase", amount_low: 1001, amount_high: 15000, date: "2025-12-11", filing_lag_days: 9 },
  ],
};

export function getSenateTradesFor(ticker: string): SenateTrade[] {
  return MOCK[ticker.toUpperCase()] ?? [];
}
