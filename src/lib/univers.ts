import CLEAN from "@/data/v1-9-5-clean-all-tickers.json";

/** Yann 13 sept 2026 : nombre de societes en ligne, calcule depuis la liste de visibilite (plus jamais un « 666 » en dur). */
export const NB_SOCIETES: number = ((CLEAN as { tickers?: string[] }).tickers ?? []).length;
