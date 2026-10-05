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
  if (pas === 0) return false;
  return pas <= 1 || (nReel - 1 - i) % pas === 0;
}

/**
 * Trimestres decimes : un pas de 3 donne T1 T4 T3 T2 (incoherent). On ne garde
 * que les pas 1, 2 et 4 (meme trimestre repete) ; au-dela (0) les trimestres
 * sont masques et seules les annees de la bande du bas restent affichees.
 */
export function pasTrimestres(pas: number, labels: string[]): number {
  if (pas <= 1) return pas;
  const trim = labels.some((l) => /^([TQ][1-4]|[SH][12])\s+\d{2,4}$/.test(l ?? ""));
  if (!trim) return pas;
  if (pas === 2) return 2;
  if (pas <= 4) return 4;
  return 0;
}
