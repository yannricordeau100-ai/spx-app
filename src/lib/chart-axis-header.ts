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

/**
 * Yann 15 mai 2026 : locale param ajouté pour traduire "en Milliards"
 * et "en Millions" selon la langue. Default = "fr" (rétro-compat).
 */
type AxisLocale = "fr" | "en" | "en-GB" | "de" | "de-CH" | "nl" | "sv" | "da";

const SCALE_WORDS: Record<AxisLocale, { B: string; M: string }> = {
  "fr":    { B: "en Milliards",  M: "en Millions" },
  "en":    { B: "in Billions",   M: "in Millions" },
  "en-GB": { B: "in Billions",   M: "in Millions" },
  "de":    { B: "in Milliarden", M: "in Millionen" },
  "de-CH": { B: "in Milliarden", M: "in Millionen" },
  "nl":    { B: "in miljarden",  M: "in miljoenen" },
  "sv":    { B: "i miljarder",   M: "i miljoner" },
  "da":    { B: "i milliarder",  M: "i millioner" },
};

export function chartAxisHeader(unit: string, locale: AxisLocale = "fr"): string {
  const w = SCALE_WORDS[locale] ?? SCALE_WORDS.fr;
  switch (unit) {
    // Formats bruts (rare, vient des datasets non encore traités par formatUnit)
    case "$B": return `$ ${w.B}`;
    case "$M": return `$ ${w.M}`;
    case "B":  return w.B;
    case "€B": return `€ ${w.B}`;
    case "€M": return `€ ${w.M}`;
    case "£B": return `£ ${w.B}`;
    case "£M": return `£ ${w.M}`;
    // Formats déjà rendus par formatUnit() — le cas le plus fréquent
    case "Mds $": return `$ ${w.B}`;
    case "M $":   return `$ ${w.M}`;
    case "Mds €": return `€ ${w.B}`;
    case "M €":   return `€ ${w.M}`;
    case "Mds £": return `£ ${w.B}`;
    case "M £":   return `£ ${w.M}`;
    case "Mds CHF": return `CHF ${w.B}`;
    case "Mds JPY": return `JPY ${w.B}`;
    case "Mds EUR": return `EUR ${w.B}`;
    case "Mds DKK": return `DKK ${w.B}`;
    case "Mds INR": return `INR ${w.B}`;
    case "Mds NOK": return `NOK ${w.B}`;
    case "Mds SEK": return `SEK ${w.B}`;
    case "Mds": return w.B;
    case "M":   return w.M;
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
