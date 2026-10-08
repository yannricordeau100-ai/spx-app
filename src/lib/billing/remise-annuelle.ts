/**
 * Remise de l abonnement annuel par rapport au mensuel, en pourcentage entier.
 *
 * 8 oct 2026 : formule unique pour tout le site (cartes tarifs, bandeau
 * « jusqu a », legende). Calcul exact sur les montants reels du paiement :
 *   (12 x mensuel - annuel) / (12 x mensuel), arrondi a l entier le plus proche.
 * Plus aucun arrondi force (l ancien « -29 % affiche -30 % » gonflait la remise).
 * Renvoie 0 si la remise n existe pas ou si un montant manque.
 */
export function remiseAnnuellePct(mensuel?: number | null, annuel?: number | null): number {
  if (!mensuel || !annuel || mensuel <= 0 || annuel <= 0) return 0;
  const douzeMois = mensuel * 12;
  if (annuel >= douzeMois) return 0;
  return Math.round(((douzeMois - annuel) / douzeMois) * 100);
}
