import type { Locale } from "./types";

/**
 * Yann 29 mai 2026 — Phase 1 V1 : FR-only.
 *
 * Toutes les autres langues (EN, DE, NL, EN-GB, DE-CH, SV, DA) sont
 * désactivées au niveau UI. Le dictionnaire EN/DE reste en code pour
 * une V2 multi-locale future, mais à ce jour aucun chemin URL ne
 * change la locale active.
 *
 * `getServerLocale()` retourne donc TOUJOURS "fr". Plus aucune lecture
 * du cookie NEXT_LOCALE ni du préfixe `/fr/...`.
 */
export async function getServerLocale(): Promise<Locale> {
  return "fr";
}
