/**
 * Yann 15 mai 2026 : templates traduits pour `interpretStructured`.
 * Couvre les 6 locales supportées (fr / en / en-GB / de / de-CH / nl).
 *
 * Pourquoi un fichier séparé : les templates sont longs et la duplication
 * dans data.ts rendrait la fonction illisible. Tous les templates retournent
 * du HTML (balises <strong>, <em>) car le bloc Interprétation utilise
 * dangerouslySetInnerHTML côté UI.
 *
 * Convention : utiliser les placeholders `{var}` dans les strings statiques,
 * pas des template literals dynamiques (plus simple à traduire à l'avenir
 * via LLM ou batch script).
 */

export type InterpLocale =
  | "fr"
  | "en"
  | "en-GB"
  | "de"
  | "de-CH"
  | "nl";

/** Locale → BCP47 pour `toLocaleString` (séparateur décimal, milliers). */
const NUM_LOCALE: Record<InterpLocale, string> = {
  "fr":    "fr-FR",
  "en":    "en-US",
  "en-GB": "en-GB",
  "de":    "de-DE",
  "de-CH": "de-CH",
  "nl":    "nl-NL",
};

export function numLocale(l: InterpLocale): string {
  return NUM_LOCALE[l] ?? "fr-FR";
}

/** Suffix "% / an" → "% / Jahr" / "% / year" / etc. */
const PER_YEAR: Record<InterpLocale, string> = {
  "fr":    "% / an",
  "en":    "% / year",
  "en-GB": "% / year",
  "de":    "% / Jahr",
  "de-CH": "% / Jahr",
  "nl":    "% / jaar",
};

export function perYear(l: InterpLocale): string {
  return PER_YEAR[l] ?? PER_YEAR.fr;
}

/* ────────────────────────────── LEAD ────────────────────────────── */

/**
 * lead("Apple", "iPhone revenue", "201,2", "Mds $", "+8,2 %", "richTrend html", " Détail : <em>…</em>")
 *   FR → "Le KPI <strong>iPhone revenue</strong> de <strong>Apple</strong> : <strong>201,2 Mds $</strong> (+8,2 % <em>YoY</em>). RichTrend…"
 *   DE → "Der KPI <strong>iPhone revenue</strong> von <strong>Apple</strong>: <strong>201,2 Mds $</strong> (+8,2 % <em>YoY</em>). RichTrend…"
 */
export function leadSentence(
  locale: InterpLocale,
  company: string,
  kpi: string,
  value: string,
  unit: string,
  yoy: string,
  trend: string,
  tail: string
): string {
  const trendCapitalized = trend.charAt(0).toUpperCase() + trend.slice(1);
  switch (locale) {
    case "en":
    case "en-GB":
      return `The <strong>${kpi}</strong> KPI of <strong>${company}</strong>: <strong>${value} ${unit}</strong> (${yoy} <em>YoY</em>). ${trendCapitalized}.${tail}`;
    case "de":
    case "de-CH":
      return `Der KPI <strong>${kpi}</strong> von <strong>${company}</strong>: <strong>${value} ${unit}</strong> (${yoy} <em>YoY</em>). ${trendCapitalized}.${tail}`;
    case "nl":
      return `De KPI <strong>${kpi}</strong> van <strong>${company}</strong>: <strong>${value} ${unit}</strong> (${yoy} <em>YoY</em>). ${trendCapitalized}.${tail}`;
    case "fr":
    default:
      return `Le KPI <strong>${kpi}</strong> de <strong>${company}</strong> : <strong>${value} ${unit}</strong> (${yoy} <em>YoY</em>). ${trendCapitalized}.${tail}`;
  }
}

/* ────────────────────────── TREND BITS ────────────────────────── */

export function cagrTrendBit(locale: InterpLocale, pctSigned: string): string {
  // pctSigned déjà formaté avec signe et suffix locale ex "+22,4 % / an"
  switch (locale) {
    case "en":
    case "en-GB":
      return `compound growth of <strong>${pctSigned}</strong> over the period`;
    case "de":
    case "de-CH":
      return `Wachstum von <strong>${pctSigned}</strong> über den Zeitraum`;
    case "nl":
      return `samengestelde groei van <strong>${pctSigned}</strong> over de periode`;
    case "fr":
    default:
      return `croissance composée de <strong>${pctSigned}</strong> sur la période`;
  }
}

export function peakTrendBit(locale: InterpLocale, pctBelowPeak: string): string {
  // pctBelowPeak ex "16 %"
  switch (locale) {
    case "en":
    case "en-GB":
      return `currently <strong>${pctBelowPeak}</strong> below the historical peak`;
    case "de":
    case "de-CH":
      return `derzeit <strong>${pctBelowPeak}</strong> unter dem historischen Höchstwert`;
    case "nl":
      return `momenteel <strong>${pctBelowPeak}</strong> onder de historische piek`;
    case "fr":
    default:
      return `actuellement <strong>${pctBelowPeak}</strong> sous le pic historique`;
  }
}

export function joinAnd(locale: InterpLocale): string {
  switch (locale) {
    case "en":
    case "en-GB":
      return " and ";
    case "de":
    case "de-CH":
      return " und ";
    case "nl":
      return " en ";
    case "fr":
    default:
      return " et ";
  }
}

/* ─────────────────────── TREND FALLBACK SIGNALS ─────────────────── */

export function trendSignalShortHistory(locale: InterpLocale, kpiName: string): string {
  const k = kpiName.toLowerCase();
  switch (locale) {
    case "en":
    case "en-GB":
      return `data available for ${k}, insufficient history to interpret the trend`;
    case "de":
    case "de-CH":
      return `Daten verfügbar für ${k}, unzureichende Historie zur Trendinterpretation`;
    case "nl":
      return `data beschikbaar voor ${k}, onvoldoende historie om de trend te interpreteren`;
    case "fr":
    default:
      return `donnée disponible pour ${k}, historique insuffisant pour interpréter la tendance`;
  }
}

export function trendSignalUnknown(locale: InterpLocale): string {
  switch (locale) {
    case "en":
    case "en-GB":
      return "to be analysed";
    case "de":
    case "de-CH":
      return "zu analysieren";
    case "nl":
      return "te analyseren";
    case "fr":
    default:
      return "à analyser";
  }
}

export type TrendCategory =
  | "strong_up"
  | "moderate_up"
  | "slowdown"
  | "downtrend"
  | "stable"
  | "mixed";

const TREND_LABELS: Record<TrendCategory, Record<InterpLocale, string>> = {
  strong_up: {
    "fr":    "tendance haussière soutenue sur la période",
    "en":    "sustained upward trend over the period",
    "en-GB": "sustained upward trend over the period",
    "de":    "anhaltender Aufwärtstrend über den Zeitraum",
    "de-CH": "anhaltender Aufwärtstrend über den Zeitraum",
    "nl":    "aanhoudende opwaartse trend over de periode",
  },
  moderate_up: {
    "fr":    "croissance modérée mais constante",
    "en":    "moderate but steady growth",
    "en-GB": "moderate but steady growth",
    "de":    "moderates, aber stetiges Wachstum",
    "de-CH": "moderates, aber stetiges Wachstum",
    "nl":    "gematigde maar gestage groei",
  },
  slowdown: {
    "fr":    "ralentissement récent malgré une tendance positive sur la période",
    "en":    "recent slowdown despite a positive trend over the period",
    "en-GB": "recent slowdown despite a positive trend over the period",
    "de":    "jüngste Verlangsamung trotz positivem Trend über den Zeitraum",
    "de-CH": "jüngste Verlangsamung trotz positivem Trend über den Zeitraum",
    "nl":    "recente vertraging ondanks een positieve trend over de periode",
  },
  downtrend: {
    "fr":    "trajectoire baissière à surveiller",
    "en":    "downward trajectory to monitor",
    "en-GB": "downward trajectory to monitor",
    "de":    "abwärtsgerichtete Entwicklung zu beobachten",
    "de-CH": "abwärtsgerichtete Entwicklung zu beobachten",
    "nl":    "neerwaartse trend om in de gaten te houden",
  },
  stable: {
    "fr":    "stabilité sur la période, peu de mouvement",
    "en":    "stable over the period, little movement",
    "en-GB": "stable over the period, little movement",
    "de":    "Stabilität über den Zeitraum, wenig Bewegung",
    "de-CH": "Stabilität über den Zeitraum, wenig Bewegung",
    "nl":    "stabiel over de periode, weinig beweging",
  },
  mixed: {
    "fr":    "évolution mixte selon la période observée",
    "en":    "mixed evolution depending on the period observed",
    "en-GB": "mixed evolution depending on the period observed",
    "de":    "gemischte Entwicklung je nach beobachtetem Zeitraum",
    "de-CH": "gemischte Entwicklung je nach beobachtetem Zeitraum",
    "nl":    "gemengde evolutie afhankelijk van de waargenomen periode",
  },
};

export function trendSignalByCategory(locale: InterpLocale, cat: TrendCategory): string {
  return TREND_LABELS[cat][locale] ?? TREND_LABELS[cat].fr;
}

/* ───────────────────────── DETAIL PREFIX ───────────────────────── */

export function detailPrefix(locale: InterpLocale, signal: string): string {
  switch (locale) {
    case "en":
    case "en-GB":
      return ` Detail: <em>${signal}</em>`;
    case "de":
    case "de-CH":
      return ` Detail: <em>${signal}</em>`;
    case "nl":
      return ` Detail: <em>${signal}</em>`;
    case "fr":
    default:
      return ` Détail : <em>${signal}</em>`;
  }
}

/* ───────────────────────── BULLETS LABELS ───────────────────────── */

export const BULLET_LABELS = {
  driver: {
    "fr":    "Moteur de croissance",
    "en":    "Growth driver",
    "en-GB": "Growth driver",
    "de":    "Wachstumstreiber",
    "de-CH": "Wachstumstreiber",
    "nl":    "Groeimotor",
  },
  risk: {
    "fr":    "Point de vigilance",
    "en":    "Point of concern",
    "en-GB": "Point of concern",
    "de":    "Risikofaktor",
    "de-CH": "Risikofaktor",
    "nl":    "Aandachtspunt",
  },
  cash: {
    "fr":    "Génération de cash",
    "en":    "Cash generation",
    "en-GB": "Cash generation",
    "de":    "Cash-Generierung",
    "de-CH": "Cash-Generierung",
    "nl":    "Kasgeneratie",
  },
  future: {
    "fr":    "À surveiller prochainement",
    "en":    "To watch soon",
    "en-GB": "To watch soon",
    "de":    "Demnächst zu beobachten",
    "de-CH": "Demnächst zu beobachten",
    "nl":    "Binnenkort in de gaten te houden",
  },
} as const;

export function bulletLabel(
  locale: InterpLocale,
  key: keyof typeof BULLET_LABELS
): string {
  return BULLET_LABELS[key][locale] ?? BULLET_LABELS[key].fr;
}

/* ──────────────── BULLET BODIES (KPI-driven) ──────────────── */

/**
 * "<strong>{KPI}</strong> à 25,3 Mds $ (+8 %). {signal}."
 *  → DE "<strong>{KPI}</strong> bei 25,3 Mds $ (+8 %). {signal}."
 */
export function bulletBodyKpi(
  locale: InterpLocale,
  kpiName: string,
  value: string,
  unit: string,
  yoy: string,
  signal: string
): string {
  const valuePart = `<strong>${kpiName}</strong>`;
  const numPart = `${value} ${unit}`;
  const signalSafe = signal && signal.trim() ? ` ${signal}.` : "";
  switch (locale) {
    case "en":
    case "en-GB":
      return `${valuePart} at ${numPart} (${yoy}).${signalSafe}`;
    case "de":
    case "de-CH":
      return `${valuePart} bei ${numPart} (${yoy}).${signalSafe}`;
    case "nl":
      return `${valuePart} op ${numPart} (${yoy}).${signalSafe}`;
    case "fr":
    default:
      return `${valuePart} à ${numPart} (${yoy}).${signalSafe}`;
  }
}

/* ──────────────────── FUTURE BULLET BODY ──────────────────── */

export function futureBulletBody(locale: InterpLocale, kpiName: string): string {
  const k = `<strong>${kpiName}</strong>`;
  switch (locale) {
    case "en":
    case "en-GB":
      return `Three possible scenarios for ${k}: (1) <strong>acceleration</strong> that would validate the momentum, (2) <strong>stabilisation</strong> around the current level, (3) <strong>reversal</strong> that would break the trend. The market will adjust the valuation according to the scenario observed.`;
    case "de":
    case "de-CH":
      return `Drei mögliche Szenarien für ${k}: (1) <strong>Beschleunigung</strong>, die das Momentum bestätigen würde, (2) <strong>Stabilisierung</strong> auf dem aktuellen Niveau, (3) <strong>Trendumkehr</strong>, die den Trend brechen würde. Der Markt wird die Bewertung gemäß dem beobachteten Szenario anpassen.`;
    case "nl":
      return `Drie mogelijke scenario's voor ${k}: (1) <strong>versnelling</strong> die het momentum zou bevestigen, (2) <strong>stabilisatie</strong> rond het huidige niveau, (3) <strong>ommekeer</strong> die de trend zou breken. De markt zal de waardering aanpassen aan het waargenomen scenario.`;
    case "fr":
    default:
      return `Trois scénarios possibles pour ${k} : (1) <strong>accélération</strong> qui validerait le momentum, (2) <strong>stabilisation</strong> autour du niveau actuel, (3) <strong>retournement</strong> qui casserait la tendance. Le marché ajustera la valorisation en fonction du scénario observé.`;
  }
}
