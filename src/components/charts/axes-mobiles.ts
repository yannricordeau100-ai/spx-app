/**
 * Aides communes aux axes des graphiques sur mobile (5 oct 2026).
 * Le viewBox (~920 unites) est rendu autour de 340 px : un facteur AF_AXES
 * ramene les etiquettes d axes a ~9 a 10 px reels, et les etiquettes en
 * trop sont decimees (une sur N) pour ne jamais se chevaucher.
 */
export const AF_AXES = 1.8;

/** Pas de decimation : 1 = tout afficher, N = une etiquette sur N. */
export function pasEtiquettes(mobile: boolean, largeurDispo: number, caracteres: number, fontSize: number): number {
  if (!mobile || largeurDispo <= 0) return 1;
  const besoin = caracteres * 0.62 * fontSize + 10;
  return Math.max(1, Math.ceil(besoin / largeurDispo));
}

/** Garde l etiquette i ? On part du point le plus recent, qui garde la sienne. */
export function garde(i: number, nReel: number, pas: number): boolean {
  return pas <= 1 || (nReel - 1 - i) % pas === 0;
}
