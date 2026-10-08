/**
 * Doublons multi-classes de l univers (une seule entree par societe dans la
 * recherche). Deplace depuis src/app/sandbox/v1-9-5/page.tsx le 8 oct 2026
 * pour etre partage avec la recherche serveur (src/lib/recherche-societes.ts).
 */
export const TICKER_DEDUP_ALIASES: Record<string, string> = {
  GOOG: "GOOGL",
  "BRK.A": "BRK-B",
  "BRK-A": "BRK-B",
  "BRK.B": "BRK-B",
  FOX: "FOXA",
  NWSA: "NWS",
  UAA: "UA",
  ASMLF: "ASML",
  ABBNY: "ABBN.SW",
  ABLZF: "ABBN.SW",
  DTEGY: "DTEGF",
  ADTTF: "ATEYY",
  BPAQF: "BP",
  "BP.L": "BP",
  "NDA-DK.CO": "NDA-FI.HE",
  EDPFY: "EDP.LS",
  BCLYF: "BARC.L",
  BBVXF: "BBVA",
};
