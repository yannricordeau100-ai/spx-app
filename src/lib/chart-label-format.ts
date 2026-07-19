/**
 * Formatage universel des labels de charts (points de courbe, dessus de barres,
 * variation, dashboard, répartition, delta).
 *
 * Yann 19 juil 2026 : remplacer TOUTES les fonctions locales
 * `formatBarLabel` / `formatDataPointLabel` / `toLocaleString(...)` disséminées
 * dans les charts par ces 2 helpers pour garantir zéro chevauchement partout,
 * peu importe la disposition des points ou des barres.
 *
 * Règle produit :
 *   - Valeur absolue ≥ 1 000 (peu importe l'unité) → format compact `Xk`, `XM`,
 *     `X Md` avec 1 décimale (ex 358 023 → "358,0 k", 4 895 000 000 → "4,9 Md")
 *   - Valeur < 1 000 → format adaptatif selon la magnitude (marges 12,3 %,
 *     EPS 2,45, unités 0,41)
 *   - Unité `%` conserve TOUJOURS 1 décimale sans compact (les ratios ne se
 *     compriment pas)
 *
 * L'objectif : chaque label tient dans ≤ 6 caractères ("495,6 k", "4,9 Md"),
 * ce qui prévient tout chevauchement quel que soit le nombre de points.
 */

export function formatChartValueLabel(
  v: number,
  dataMax: number,
  unit?: string,
): string {
  if (!Number.isFinite(v)) return "—";
  const isPct = String(unit ?? "").trim() === "%";
  // % : jamais de compact, toujours 1 décimale
  if (isPct) {
    return v.toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: v === 0 ? 0 : 1,
    });
  }
  const abs = Math.abs(v);
  const maxAbs = Math.abs(dataMax);
  // Compact k/M/Md dès que le pic de la série dépasse 1 000 : garantit
  // labels courts sur tout le graphique, homogènes.
  if (maxAbs >= 1000) {
    if (abs >= 1_000_000_000)
      return (
        (v / 1_000_000_000).toLocaleString("fr-FR", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }) + " Md"
      );
    if (abs >= 1_000_000)
      return (
        (v / 1_000_000).toLocaleString("fr-FR", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }) + " M"
      );
    if (abs >= 1000)
      return (
        (v / 1000).toLocaleString("fr-FR", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }) + " k"
      );
    // Valeurs < 1000 dans une série qui pique au-dessus : arrondir entier
    // (elles se lisent dans le contexte des Xk/XM au-dessus).
    return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  }
  // dataMax < 1000 : format adaptatif classique
  let decimals: number;
  if (maxAbs < 1) decimals = 2;
  else if (maxAbs < 100) decimals = 1;
  else decimals = 0;
  return v.toLocaleString("fr-FR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals > 0 ? 1 : 0,
  });
}

/**
 * Rotation à appliquer au label d'un point/barre pour éviter le chevauchement
 * horizontal. Heuristique :
 *   - ≤ 12 points  → horizontal (0°)
 *   - 13-20 points → léger -20°
 *   - 21+ points   → -35°
 *
 * Retourne l'angle en degrés (négatif = penché vers la gauche, sens SVG).
 */
export function getChartLabelRotation(nPoints: number): number {
  if (nPoints <= 12) return 0;
  if (nPoints <= 20) return -20;
  return -35;
}

/**
 * Taille de police recommandée pour les labels, décroissante avec la densité
 * de points. Complète la rotation quand elle ne suffit pas.
 */
export function getChartLabelFontSize(nPoints: number): number {
  if (nPoints <= 12) return 11;
  if (nPoints <= 20) return 10;
  return 9;
}
