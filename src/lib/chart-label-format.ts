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

/**
 * Une unite est "physique" si elle n est ni monetaire, ni une magnitude nue
 * (M, Mds, K, T, B), ni un pourcentage : MW, GWh, tonnes, unites, abonnes,
 * magasins... Sur ces unites, le compact k/M est ambigu.
 */
const MONEY_LIKE_RE = /[$\u20ac\u00a3]|\b(USD|EUR|GBP|CHF|JPY|DKK|INR|NOK|SEK|KRW|CAD|AUD|HKD|CNY|BRL|MXN|PLN|ZAR|TWD|SGD|ILS|TRY|THB|NZD|RMB|RUB|CZK|HUF|IDR|MYR|kr)\b/i;
const BARE_MAGNITUDE_UNIT_RE = /^(mds?|m|k|t|b)$/i;

function isPhysicalUnitLabel(unit?: string): boolean {
  const u = String(unit ?? "").trim();
  if (!u) return false;
  if (u === "%" || u.includes("%")) return false;
  if (MONEY_LIKE_RE.test(u)) return false;
  if (BARE_MAGNITUDE_UNIT_RE.test(u)) return false;
  return true;
}

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
  // Yann 24 aout 2026 (screen NEE "6,3 k" sous un axe "MW") : le compact "k"
  // n a de sens que sur une unite monetaire ou une magnitude nue. Sur une
  // unite physique (MW, GWh, tonnes, unites, abonnes...) il se lit comme un
  // prefixe d unite ("6,3 kMW") et contredit l axe, qui lui affiche 6 000 en
  // clair. On ecrit donc le nombre en entier.
  // Plafond a 100 000 : au-dela le nombre entier devient trop long pour les
  // series denses, le compact reprend la main.
  if (isPhysicalUnitLabel(unit) && maxAbs < 100_000) {
    return v.toLocaleString("fr-FR", { maximumFractionDigits: maxAbs < 100 ? 1 : 0 });
  }
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
  // Yann 28 juillet 2026 : JAMAIS plus d'un chiffre apres la virgule sur un
  // label de graphique, quelle que soit la magnitude (avant : 2 decimales
  // sous 1, ce qui donnait "0,41" et allongeait les labels).
  let decimals: number;
  if (maxAbs < 100) decimals = 1;
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
export function getChartLabelRotation(): number {
  // Yann 28 juillet 2026 : plus AUCUN label oblique sur les graphiques. La
  // lisibilite passe par la reduction de la taille de police (cf
  // getChartLabelFontSize), jamais par la rotation.
  return 0;
}

/**
 * Taille de police recommandée pour les labels, décroissante avec la densité
 * de points. Complète la rotation quand elle ne suffit pas.
 */
export function getChartLabelFontSize(nPoints: number): number {
  // Yann 28 juillet 2026 : les labels restent horizontaux, donc c'est la
  // taille qui absorbe la densite.
  // Yann 8 août 2026 : +1pt sur toutes les densités (le plot a été élargi de
  // ~57px via PAD_LEFT/PAD_RIGHT, l'espace par barre absorbe la hausse).
  if (nPoints <= 8) return 14;
  if (nPoints <= 12) return 12;
  if (nPoints <= 16) return 10.5;
  if (nPoints <= 22) return 9.5;
  if (nPoints <= 30) return 8.5;
  return 7.5;
}
