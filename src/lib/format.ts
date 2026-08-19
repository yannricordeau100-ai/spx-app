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

/**
 * Yann 17 mai 2026 (Phase 2 D1) : normalisation centrale unités formatées
 * (FR / EU) vers RAW ($T/$B/$M/$K). Avant ce mapping, `isMoneyUnit("Mds $")`
 * renvoyait false → `toAbsolute`/`rescaleForReadability` retournaient la
 * value/unit unchanged silencieusement, ce qui faisait que /jour /minute
 * sur GOOGL Cloud (unit dataset="Mds $") ne bougeait pas les valeurs.
 *
 * Toutes les devises non-USD sont mappées vers les bruts $T/$B/$M/$K
 * (treating all currencies as numeric magnitudes) — les facteurs 1e9/1e6
 * sont identiques quelle que soit la devise. Le caller (chart-cycle) garde
 * l'unité d'affichage display via chartAxisHeader ("Mds $", "Mds €", etc).
 */
const RAW_UNIT_NORMALIZE: Record<string, string> = {
  // USD / EUR / GBP formatés
  "Mds $": "$B", "Mds €": "$B", "Mds £": "$B",
  "M $":   "$M", "M €":   "$M", "M £":   "$M",
  "K $":   "$K", "K €":   "$K", "K £":   "$K",
  // 16 devises non-USD/EUR/GBP supplémentaires
  "Mds CHF": "$B", "Mds JPY": "$B", "Mds EUR": "$B",
  "Mds DKK": "$B", "Mds INR": "$B", "Mds NOK": "$B",
  "Mds SEK": "$B", "Mds KRW": "$B", "Mds CAD": "$B",
  "Mds AUD": "$B", "Mds HKD": "$B", "Mds CNY": "$B",
  "Mds BRL": "$B", "Mds MXN": "$B", "Mds PLN": "$B",
  "Mds ZAR": "$B",
  // Magnitudes pures
  "Mds": "B",
  // "M" → "M" identité (déjà raw côté COUNT_SCALE)
};

/** Helper interne : normalise une unité formatée FR vers la version brute
 *  pour lookup dans MONEY_SCALE / COUNT_SCALE. Identité si pas matchée. */
/**
 * Yann 18 août 2026 (screen AVGO "15,0 k" sous un axe "M$") : les unités
 * écrites SANS espace ("M$", "M€", "Md€") ou avec un code devise en magnitude
 * M/K ("M USD", "M CHF") n'étaient pas reconnues comme monétaires : aucun
 * rescale M -> Mds n'était appliqué et les labels tombaient sur le compact
 * générique "k". Défaut systémique : 450 stés, 4 100+ séries.
 * `canonicalMoneyUnit` ramène toutes ces écritures à la forme canonique
 * "<magnitude> <devise>" avant lookup. Les unités non monétaires qui
 * ressemblent à une devise (MBOE, MMBF, MMSF...) sont protégées par la
 * liste blanche CURRENCY_CODES.
 */
const CURRENCY_CODES = new Set([
  "USD", "EUR", "GBP", "CHF", "JPY", "DKK", "INR", "NOK", "SEK", "KRW",
  "CAD", "AUD", "HKD", "CNY", "BRL", "MXN", "PLN", "ZAR", "TWD", "SGD",
  "ILS", "TRY", "THB", "NZD", "RMB", "RUB", "CZK", "HUF", "IDR", "MYR",
]);

function canonicalMoneyUnit(u: string): string | null {
  const s = String(u).trim().replace(/\s+/g, " ");
  const m = s.match(/^(Mds|Md|M|K|T)\s?(\$|€|£|[A-Z]{3})$/);
  if (!m) return null;
  const mag = m[1] === "Md" ? "Mds" : m[1];
  const cur = m[2];
  if (!/^[$€£]$/.test(cur) && !CURRENCY_CODES.has(cur)) return null;
  return `${mag} ${cur}`;
}

/** Magnitude canonique -> unité RAW ($T/$B/$M/$K). */
const MAGNITUDE_TO_RAW: Record<string, string> = {
  Mds: "$B",
  M: "$M",
  K: "$K",
  T: "$T",
};

function toRawUnit(u: string): string {
  if (u == null) return u;
  const trimmed = String(u).trim();
  const direct = RAW_UNIT_NORMALIZE[trimmed];
  if (direct) return direct;
  const canon = canonicalMoneyUnit(trimmed);
  if (canon) {
    const mapped = RAW_UNIT_NORMALIZE[canon];
    if (mapped) return mapped;
    const mag = canon.split(" ")[0];
    const raw = MAGNITUDE_TO_RAW[mag];
    if (raw) return raw;
  }
  return u;
}

function isMoneyUnit(u: string): boolean {
  if (u == null) return false;
  const trimmed = String(u).trim();
  if (/^\$/.test(trimmed) || trimmed in RAW_UNIT_NORMALIZE) return true;
  return canonicalMoneyUnit(trimmed) != null;
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
  const raw = toRawUnit(unit);
  if (isMoneyUnit(raw)) {
    const m = findInScale(MONEY_SCALE, raw);
    return m ? value * m.factor : value;
  }
  if (isCountUnit(raw)) {
    const m = findInScale(COUNT_SCALE, raw);
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
  // Yann 17 mai 2026 : on normalise l'unit en RAW pour le lookup, mais on
  // retourne TOUJOURS en RAW ($T/$B/$M/$K ou T/B/M/K). Le caller décide du
  // formatage display (chartAxisHeader / formatUnit en data.ts gèrent raw
  // → display FR "Mds $", "Mds €", etc).
  const raw = toRawUnit(originalUnit);

  // Pour units argent
  if (isMoneyUnit(raw)) {
    for (const s of MONEY_SCALE) {
      const scaled = abs / s.factor;
      if (scaled >= 1) return { value: sign * scaled, unit: s.unit };
    }
    // valeur très petite : on prend la dernière unité ($¢)
    const last = MONEY_SCALE[MONEY_SCALE.length - 1];
    return { value: sign * (abs / last.factor), unit: last.unit };
  }
  // Pour units count
  if (isCountUnit(raw)) {
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
    minimumFractionDigits: 0,
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
