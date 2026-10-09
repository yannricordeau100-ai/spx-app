import { tickersUniversActif } from "@/lib/univers-actif";

/** Yann 13 sept 2026 : nombre de societes en ligne, calcule depuis la liste de visibilite (plus jamais un « 666 » en dur).
 *  9 oct 2026 : univers du deploiement (v1-9-5-clean-all-tickers.json ; niveau 1 : vague sp5001000). */
export const NB_SOCIETES: number = tickersUniversActif().length;
