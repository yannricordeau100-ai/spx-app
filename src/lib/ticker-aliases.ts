/**
 * Alias de codes boursiers (Yann 24 sept 2026). Module volontairement minuscule :
 * il est importe par le proxy, qui tourne en bordure et ne doit pas charger
 * src/lib/data.ts en entier. Une seule fiche par societe : l alias redirige.
 */
export const TICKER_ALIASES: Record<string, string> = {
  // Yann 24 sept 2026 : Deutsche Post (DPW.DE) et DHL Group (DHL.DE) sont la
  // meme societe ; l ancienne ligne redirige vers la fiche complete. Henkel
  // (HEN3.DE -> HEN.DE) et Airbus (AIR.DE -> AIR.PA) etaient deja traites.
  "DPW.DE": "DHL.DE",
  GOOG: "GOOGL",
  "BRK.A": "BRK-B",
  "BRK-A": "BRK-B",
  "BRK.B": "BRK-B",
  FOX: "FOXA",
  NWSA: "NWS",
  UAA: "UA",
  // Yann 4 juin 2026 : Alibaba listing HK (9988.HK) renomme en BABA (ADR US).
  "9988.HK": "BABA",
  "9988-HK": "BABA",
  // Yann 2 sept 2026 : une seule ligne par societe dans la recherche.
  // Volkswagen : la fiche complete est VOW.DE ; VOW3 (pref) alias dessus.
  "VOW3.DE": "VOW.DE",
  // Henkel : fiche complete HEN.DE ; HEN3 (pref) alias dessus.
  "HEN3.DE": "HEN.DE",
  // Airbus : double cotation, la fiche canonique est AIR.PA (Paris).
  "AIR.DE": "AIR.PA",
  // Yann 14 sept 2026 : AvalonBay et Equity Residential ont fusionne le
  // 17 aout 2026 dans Vivmark Residential (VMRK). Les anciennes adresses
  // renvoient vers la societe issue de la fusion.
  AVB: "VMRK",
  EQR: "VMRK",
};

/** Vrai si ce code boursier n est qu un alias vers une autre fiche (jamais une societe a part). */
export function estAlias(ticker: string): boolean {
  return Object.prototype.hasOwnProperty.call(TICKER_ALIASES, (ticker ?? "").toUpperCase());
}

/** Fiche canonique d un code (lui meme s il n est pas un alias). Accepte « brk-b » comme « BRK.B ». */
export function ticker_canonique(ticker: string): string {
  const u = (ticker ?? "").toUpperCase();
  return TICKER_ALIASES[u] ?? TICKER_ALIASES[u.replace(/-/g, ".")] ?? u;
}
