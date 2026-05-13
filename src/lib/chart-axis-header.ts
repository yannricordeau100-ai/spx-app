/**
 * axisHeader — libellé affiché en haut de l'axe Y des charts (curve, bars,
 * variation). Yann 13 mai 2026 : DRY refactor — l'ancienne implémentation
 * était dupliquée dans 3 composants, ce qui rendait la maintenance fragile
 * (la dernière mise à jour Y-axis Millions/Milliards a oublié des cas dans
 * 1 fichier sur 3 pendant le rolling update).
 *
 * Couvre tous les formats unit qu'on a en data :
 *   - Bruts (sortie SEC EDGAR) : "$B", "$M", "B", "M", "€B", "€M", "£B", "£M"
 *   - Déjà formatés (sortie formatUnit()) : "Mds $", "M $", "Mds €", "M €",
 *     "Mds £", "M £", "Mds CHF", "Mds JPY", "Mds EUR", "Mds DKK", "Mds INR",
 *     "Mds"
 *
 * Sortie : mot complet "Milliards" / "Millions" pour l'axe Y (Yann a
 * explicitement demandé ce verbose, vs l'abréviation utilisée pour les
 * affichages compacts type "23,9 Mds $" à côté de la hero value).
 */

export function chartAxisHeader(unit: string): string {
  switch (unit) {
    // Formats bruts (rare, vient des datasets non encore traités par formatUnit)
    case "$B": return "$ en Milliards";
    case "$M": return "$ en Millions";
    case "B": return "en Milliards";
    case "M": return "en Millions";
    case "€B": return "€ en Milliards";
    case "€M": return "€ en Millions";
    case "£B": return "£ en Milliards";
    case "£M": return "£ en Millions";
    // Formats déjà rendus par formatUnit() — le cas le plus fréquent
    case "Mds $": return "$ en Milliards";
    case "M $": return "$ en Millions";
    case "Mds €": return "€ en Milliards";
    case "M €": return "€ en Millions";
    case "Mds £": return "£ en Milliards";
    case "M £": return "£ en Millions";
    case "Mds CHF": return "CHF en Milliards";
    case "Mds JPY": return "JPY en Milliards";
    case "Mds EUR": return "EUR en Milliards";
    case "Mds DKK": return "DKK en Milliards";
    case "Mds INR": return "INR en Milliards";
    case "Mds NOK": return "NOK en Milliards";
    case "Mds SEK": return "SEK en Milliards";
    case "Mds": return "en Milliards";
    case "M": return "en Millions";
    // Pourcentages / nombres bruts
    case "%": return "%";
    case "% YoY": return "% (YoY)";
    case "$": return "$";
    default: return unit || "";
  }
}

/** True si le unit représente une devise (= ticks Y arrondis à l'entier). */
export function isCurrencyLikeUnit(unit: string): boolean {
  return [
    "$B", "$M", "B", "M",
    "€B", "€M", "£B", "£M",
    "Mds $", "M $", "Mds €", "M €", "Mds £", "M £",
    "Mds CHF", "Mds JPY", "Mds EUR", "Mds DKK", "Mds INR",
    "Mds NOK", "Mds SEK", "Mds",
  ].includes(unit);
}
