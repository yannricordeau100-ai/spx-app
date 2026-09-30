/**
 * Yann 30 sept 2026 : liste par defaut des societes 100 % visibles en gratuit,
 * servie tant que la section (floutage, visibles-gratuit) n existe pas en base.
 * Module sans dependance serveur : importable cote client comme cote serveur.
 */
export const VISIBLES_GRATUIT_DEFAUT: readonly string[] = ["GOOGL", "GOOG", "META", "BKNG", "AAPL", "NFLX"];

/** Message affiche quand un palier gratuit ou anonyme vise une societe hors liste. */
export const MESSAGE_OFFRE_PREMIUM = "Disponible avec l'offre Premium";
