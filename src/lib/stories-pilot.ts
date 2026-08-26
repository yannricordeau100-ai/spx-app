/**
 * Sociétés du pilote "Stories rangées" (Yann 26 août 2026).
 *
 * Dix sociétés, dix secteurs différents, chacune parmi les plus fournies en
 * stories de son secteur. Le nouveau bloc (onglets par famille + tri) n'est
 * actif que sur elles ; partout ailleurs le carrousel historique reste en
 * place, le temps de valider la mise en forme.
 */
export const STORIES_PILOT_TICKERS = new Set([
  "AXON", // Technologie — 69 stories
  "AVB",  // Immobilier — 68
  "AES",  // Services aux collectivités — 68
  "BAX",  // Santé — 58
  "AIG",  // Finance — 57
  "CRH",  // Matériaux — 52
  "CVX",  // Énergie — 45
  "DIS",  // Communication — 44
  "F",    // Consommation discrétionnaire — 40
  "META", // Services de communication — 36
]);

export function isStoriesPilot(ticker: string): boolean {
  return STORIES_PILOT_TICKERS.has((ticker ?? "").toUpperCase());
}
