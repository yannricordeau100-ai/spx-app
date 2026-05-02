/**
 * Helpers de formatage : nombre + unité, locale-aware.
 *
 * RÈGLES (cf. CLAUDE.md §6) :
 * - FR : virgule décimale + espace milliers ("1 858,12")
 * - EN : point décimal + virgule milliers ("1,858.12")
 * - Espace insécable U+202F entre chiffre et symbole "$" / "%" / "Md".
 *
 * Pour TimeFraction (par seconde / minute / etc.) :
 * - Le nombre affiché doit être >= 1 quand possible.
 * - Si valeur < 1 dans une unité donnée, on rescale automatiquement
 *   ($B -> $M -> $K -> $) jusqu'à atteindre une valeur >= 1.
 * - Toujours 2 décimales après la virgule (sauf entiers > 1000 où on garde
 *   la précision de l'unité).
 */

export type Locale = "fr" | "en";

const NBSP = " "; // narrow no-break space, sépare chiffre / unité

/** Échelle d'unités monétaires triée du + grand au + petit. */
const MONEY_SCALE = [
  { unit: "$T",  factor: 1e12 },
  { unit: "$B",  factor: 1e9 },
  { unit: "$M",  factor: 1e6 },
  { unit: "$K",  factor: 1e3 },
  { unit: "$",   factor: 1 },
  { unit: "$¢",  factor: 0.01 },
] as const;

/** Idem sans préfixe $ (pour milliards / millions purs). */
const COUNT_SCALE = [
  { unit: "T",   factor: 1e12 },
  { unit: "B",   factor: 1e9 },
  { unit: "M",   factor: 1e6 },
  { unit: "K",   factor: 1e3 },
  { unit: "",    factor: 1 },
] as const;

function isMoneyUnit(u: string): boolean {
  return /^\$/.test(u);
}
function isCountUnit(u: string): boolean {
  return ["B", "M", "K", "T"].includes(u);
}

/** Trouve l'unité courante dans l'échelle, retourne {unit, factor}. */
function findInScale(scale: readonly { unit: string; factor: number }[], u: string) {
  return scale.find((s) => s.unit === u) ?? null;
}

/**
 * Donne la valeur ABSOLUE (en unité de base) à partir d'une value + unit.
 * Ex : (58.71, "$B") -> 58.71e9 dollars
 *      (175, "M")    -> 175e6 unités
 *      (32, "%")     -> 32 (% reste tel quel)
 */
export function toAbsolute(value: number, unit: string): number {
  if (isMoneyUnit(unit)) {
    const m = findInScale(MONEY_SCALE, unit);
    return m ? value * m.factor : value;
  }
  if (isCountUnit(unit)) {
    const m = findInScale(COUNT_SCALE, unit);
    return m ? value * m.factor : value;
  }
  return value;
}

/**
 * Rescale une valeur ABSOLUE vers une unité avec valeur >= 1.
 * Ex : 1.86 dollars (absolute) -> { value: 1.86, unit: "$" }
 *      0.005 dollars            -> { value: 0.50, unit: "$¢" }   (cents)
 *      1858000 dollars          -> { value: 1.86, unit: "$M" }
 *
 * Si la valeur est exactement 0 ou < 0.01 cent, on retourne en unité de base.
 */
export function rescaleForReadability(absoluteValue: number, originalUnit: string): { value: number; unit: string } {
  if (!Number.isFinite(absoluteValue) || absoluteValue === 0) {
    return { value: absoluteValue, unit: originalUnit };
  }
  const sign = absoluteValue < 0 ? -1 : 1;
  const abs = Math.abs(absoluteValue);

  // Pour units argent
  if (isMoneyUnit(originalUnit)) {
    for (const s of MONEY_SCALE) {
      const scaled = abs / s.factor;
      if (scaled >= 1) return { value: sign * scaled, unit: s.unit };
    }
    // valeur très petite : on prend la dernière unité ($¢)
    const last = MONEY_SCALE[MONEY_SCALE.length - 1];
    return { value: sign * (abs / last.factor), unit: last.unit };
  }
  // Pour units count
  if (isCountUnit(originalUnit)) {
    for (const s of COUNT_SCALE) {
      const scaled = abs / s.factor;
      if (scaled >= 1) return { value: sign * scaled, unit: s.unit };
    }
    const last = COUNT_SCALE[COUNT_SCALE.length - 1];
    return { value: sign * (abs / last.factor), unit: last.unit };
  }
  // Autre (% / ratio / texte) : on garde l'unité d'origine, valeur telle quelle
  return { value: absoluteValue, unit: originalUnit };
}

/**
 * Formate un nombre selon locale, 2 décimales, espace milliers.
 * FR : "1 858,12"   EN : "1,858.12"
 */
export function formatNumber(value: number, locale: Locale, options?: { decimals?: number }): string {
  if (!Number.isFinite(value)) return String(value);
  const decimals = options?.decimals ?? 2;
  // Intl.NumberFormat fait la bonne chose en FR (espace insécable + virgule)
  // et EN (virgule milliers + point décimal).
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formate une unité pour affichage : "$B" -> "Mds $" (FR), "B$" (EN).
 * Ne touche pas si déjà formatée ou symbole simple.
 */
export function formatUnitLabel(unit: string, locale: Locale): string {
  const map: Record<string, { fr: string; en: string }> = {
    "$T": { fr: "Bn $",  en: "T$" },     // Trillion
    "$B": { fr: "Mds $", en: "B$" },
    "$M": { fr: "M $",   en: "M$" },
    "$K": { fr: "K $",   en: "K$" },
    "$":  { fr: "$",     en: "$" },
    "$¢": { fr: "¢",     en: "¢" },
    "T":  { fr: "Bn",    en: "T" },
    "B":  { fr: "Mds",   en: "B" },
    "M":  { fr: "M",     en: "M" },
    "K":  { fr: "K",     en: "K" },
    "%":  { fr: "%",     en: "%" },
    "":   { fr: "",      en: "" },
  };
  return map[unit]?.[locale] ?? unit;
}

/**
 * Formate complet : nombre + unité, scaled pour readability.
 * Ex: (1.86, "$") FR  -> "1,86 $"
 *     (1858, "M$") FR -> "1 858,00 M $"  -> en réalité on rescale à "1,86 Mds $"
 *     (0.005, "$") FR -> "0,50 ¢"
 */
export function formatValueWithUnit(absoluteValue: number, originalUnit: string, locale: Locale, opts?: { decimals?: number; rescale?: boolean }): string {
  const rescale = opts?.rescale ?? true;
  const decimals = opts?.decimals ?? 2;
  const { value: scaledValue, unit: scaledUnit } = rescale
    ? rescaleForReadability(absoluteValue, originalUnit)
    : { value: absoluteValue, unit: originalUnit };

  const numStr = formatNumber(scaledValue, locale, { decimals });
  const unitLabel = formatUnitLabel(scaledUnit, locale);
  if (!unitLabel) return numStr;
  return `${numStr}${NBSP}${unitLabel}`;
}
