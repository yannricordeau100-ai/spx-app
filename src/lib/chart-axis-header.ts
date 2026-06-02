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
 * Sortie : forme COURTE "Mds" / "M" pour l'axe Y (Yann 2 juin 2026 v9 :
 * inversion de la décision précédente, le verbose "en Milliards" prenait
 * trop de place et n'aidait pas la lecture). Format : "Mds $", "M €",
 * "Mds CHF" etc., aligné sur CLAUDE.md §6 (B$ -> Mds $).
 */

/**
 * Yann 15 mai 2026 : locale param ajouté pour traduire "en Milliards"
 * et "en Millions" selon la langue. Default = "fr" (rétro-compat).
 */
type AxisLocale = "fr" | "en" | "en-GB" | "de" | "de-CH" | "nl";

// Yann 17 mai 2026 (v2) : ajout T (Trillions) et K (Milliers) pour couvrir
// les rescales d'unité time-fraction (ex /minute = $K, /year d'une méga-sté = $T).
// Yann 2 juin 2026 v9 : forme COURTE (Mds/M) pour l'axe Y, aligné CLAUDE.md §6.
const SCALE_WORDS: Record<AxisLocale, { T: string; B: string; M: string; K: string }> = {
  "fr":    { T: "Bln",  B: "Mds", M: "M",   K: "K" },
  "en":    { T: "Tn",   B: "Bn",  M: "M",   K: "K" },
  "en-GB": { T: "Tn",   B: "Bn",  M: "M",   K: "K" },
  "de":    { T: "Bio",  B: "Mrd", M: "Mio", K: "Tsd" },
  "de-CH": { T: "Bio",  B: "Mrd", M: "Mio", K: "Tsd" },
  "nl":    { T: "Bln",  B: "mld", M: "mln", K: "K" },
};

export function chartAxisHeader(unit: string, locale: AxisLocale = "fr"): string {
  const w = SCALE_WORDS[locale] ?? SCALE_WORDS.fr;
  // Yann 16 mai 2026 : normalisation pré-switch pour absorber les formats
  // mixtes "B $", "B €", "M $", "M €" (avec espace, sortie de certains
  // pipelines LLM non normalisés par formatUnit). On les remappe sur les
  // clés canoniques avant le switch principal.
  const normalized = unit?.trim();
  const map: Record<string, string> = {
    "B $": "Mds $",
    "B €": "Mds €",
    "B £": "Mds £",
    "M $": "M $",
    "M €": "M €",
    "M £": "M £",
    "B CHF": "Mds CHF",
    "B JPY": "Mds JPY",
    "B EUR": "Mds EUR",
    "B DKK": "Mds DKK",
    "B INR": "Mds INR",
    "B NOK": "Mds NOK",
    "B SEK": "Mds SEK",
    "B KRW": "Mds KRW",
    "B CAD": "Mds CAD",
    "B AUD": "Mds AUD",
    "B HKD": "Mds HKD",
    "B CNY": "Mds CNY",
    "B BRL": "Mds BRL",
    "B MXN": "Mds MXN",
    "B PLN": "Mds PLN",
    "B ZAR": "Mds ZAR",
  };
  const u = map[normalized] ?? normalized;
  switch (u) {
    // Yann 2 juin 2026 v9 : format "Mds $" (scale first, currency last)
    // conforme CLAUDE.md §6 (B$ -> Mds $). Avant : "$ en Milliards".
    case "$T": return `${w.T} $`;
    case "$B": return `${w.B} $`;
    case "$M": return `${w.M} $`;
    case "$K": return `${w.K} $`;
    case "T":  return w.T;
    case "B":  return w.B;
    case "K":  return w.K;
    case "€B": return `${w.B} €`;
    case "€M": return `${w.M} €`;
    case "£B": return `${w.B} £`;
    case "£M": return `${w.M} £`;
    // Formats déjà rendus par formatUnit() — le cas le plus fréquent
    case "Mds $": return `${w.B} $`;
    case "M $":   return `${w.M} $`;
    case "Mds €": return `${w.B} €`;
    case "M €":   return `${w.M} €`;
    case "Mds £": return `${w.B} £`;
    case "M £":   return `${w.M} £`;
    case "Mds CHF": return `${w.B} CHF`;
    case "Mds JPY": return `${w.B} JPY`;
    case "Mds EUR": return `${w.B} EUR`;
    case "Mds DKK": return `${w.B} DKK`;
    case "Mds INR": return `${w.B} INR`;
    case "Mds NOK": return `${w.B} NOK`;
    case "Mds SEK": return `${w.B} SEK`;
    case "Mds KRW": return `${w.B} KRW`;
    case "Mds CAD": return `${w.B} CAD`;
    case "Mds AUD": return `${w.B} AUD`;
    case "Mds HKD": return `${w.B} HKD`;
    case "Mds CNY": return `${w.B} CNY`;
    case "Mds BRL": return `${w.B} BRL`;
    case "Mds MXN": return `${w.B} MXN`;
    case "Mds PLN": return `${w.B} PLN`;
    case "Mds ZAR": return `${w.B} ZAR`;
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
  const n = unit?.trim() ?? "";
  return [
    "$T", "$B", "$M", "$K", "$", "T", "B", "M", "K",
    "€B", "€M", "£B", "£M",
    "Mds $", "M $", "Mds €", "M €", "Mds £", "M £",
    "Mds CHF", "Mds JPY", "Mds EUR", "Mds DKK", "Mds INR",
    "Mds NOK", "Mds SEK", "Mds KRW", "Mds CAD", "Mds AUD",
    "Mds HKD", "Mds CNY", "Mds BRL", "Mds MXN", "Mds PLN", "Mds ZAR",
    "Mds",
    // Yann 16 mai 2026 : formats "B X" avec espace (non normalisés)
    "B $", "B €", "B £",
    "B CHF", "B JPY", "B EUR", "B DKK", "B INR", "B NOK", "B SEK",
    "B KRW", "B CAD", "B AUD", "B HKD", "B CNY", "B BRL", "B MXN",
    "B PLN", "B ZAR",
  ].includes(n);
}
