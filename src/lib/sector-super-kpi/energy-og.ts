/**
 * Sector Super-KPIs — ENERGY OIL & GAS V1.9.5
 *
 * 2 super-KPIs sectoriels pour majors et indépendants pétrole et gaz
 * (XOM, CVX, BP, SHEL, TTE, COP, EOG, SLB, OXY, EQT, MPC, VLO, PSX, etc.) :
 *   1. reservesLife        : nb d'années de production restantes (Stratégie)
 *   2. upstreamCashMargin  : Op Cash Flow par baril équivalent pétrole (Profitabilité)
 *
 * Convention identique à src/lib/super-kpi.ts :
 *   - Chaque fonction retourne un objet SuperKpi complet.
 *   - i18n via mini-dictionnaire SECTOR_STRINGS (EN + FR obligatoires).
 *   - Pas d'em-dash dans les narratives FR.
 */

import type { Company, KPI } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";

export type SuperKpiTier = "premium" | "solid" | "average" | "below" | "na";

export type SuperKpiCategory =
  | "Croissance"
  | "Profitabilité"
  | "Risque"
  | "Stratégie"
  | "Composite";

export type SuperKpi = {
  id: string;
  name: string;
  category: SuperKpiCategory;
  value: number | null;
  display: string;
  tier: SuperKpiTier;
  color: string;
  tierLabel: string;
  gaugePct: number;
  inputs: string[];
  formula: string;
  interpretation: string;
  benchmark: string;
};

const TIER_COLOR: Record<SuperKpiTier, string> = {
  premium: "#10b981",
  solid: "#84cc16",
  average: "#f59e0b",
  below: "#f43f5e",
  na: "#71717a",
};

/* ═════════════════════════════════════════════════════════════════════
 *  i18n strings sector-specific
 * ═════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string; de?: string };

function pickLoc(s: LocalizedString, locale: Locale): string {
  const rec = s as Record<string, string | undefined>;
  if (rec[locale]) return rec[locale]!;
  const base = locale.split("-")[0];
  if (rec[base]) return rec[base]!;
  return s.en;
}

const TIER_LABEL: Record<SuperKpiTier, LocalizedString> = {
  premium: { en: "Premium", fr: "Premium", de: "Premium" },
  solid:   { en: "Solid",   fr: "Solide",  de: "Solide" },
  average: { en: "Average", fr: "Moyen",   de: "Mittel" },
  below:   { en: "Below",   fr: "Faible",  de: "Schwach" },
  na:      { en: "N/A",     fr: "Non applicable", de: "Nicht anwendbar" },
};

export const SECTOR_STRINGS = {
  na_data: {
    en: "Required data not available for this energy company.",
    fr: "Données nécessaires non disponibles pour cette société pétrolière et gazière.",
  },

  // Reserves Life
  rl_name: {
    en: "Reserves Life",
    fr: "Durée de vie des réserves",
  },
  rl_formula: {
    en: "Proved Reserves / Annual Production",
    fr: "Réserves prouvées / Production annuelle",
  },
  rl_benchmark: {
    en: ">= 15 yrs premium · >= 10 yrs solid · >= 5 yrs average · < 5 yrs below",
    fr: ">= 15 ans premium, >= 10 ans solide, >= 5 ans moyen, < 5 ans faible",
  },
  rl_interp_premium: {
    en: "Exceptional reserves runway. The company can sustain current production for more than 15 years without new discoveries. Strong strategic optionality on the long cycle.",
    fr: "Horizon de réserves exceptionnel. La société peut soutenir la production actuelle plus de 15 ans sans nouvelles découvertes. Optionalité stratégique forte sur le cycle long.",
  },
  rl_interp_solid: {
    en: "Solid reserves visibility. Around 10 to 15 years of production secured. Comfortable position to navigate exploration and capex cycles.",
    fr: "Visibilité solide sur les réserves. Environ 10 à 15 ans de production sécurisés. Position confortable pour traverser les cycles d'exploration et de capex.",
  },
  rl_interp_average: {
    en: "Average reserves life. 5 to 10 years of runway requires steady reserve replacement to avoid production decline.",
    fr: "Durée de vie moyenne des réserves. 5 à 10 ans d'horizon exigent un renouvellement régulier pour éviter le déclin de la production.",
  },
  rl_interp_below: {
    en: "Tight reserves runway, less than 5 years. Urgent need for new discoveries or acquisitions to sustain the production base.",
    fr: "Horizon de réserves tendu, moins de 5 ans. Besoin urgent de découvertes ou d'acquisitions pour soutenir la base de production.",
  },

  // Upstream Cash Margin
  ucm_name: {
    en: "Upstream Cash Margin",
    fr: "Marge cash upstream",
  },
  ucm_formula: {
    en: "Operating Cash Flow / Production ($ per boe)",
    fr: "Cash Flow opérationnel / Production ($ par boe)",
  },
  ucm_benchmark: {
    en: ">= $35 /boe premium · >= $25 /boe solid · >= $15 /boe average · < $15 /boe below",
    fr: ">= 35 $/boe premium, >= 25 $/boe solide, >= 15 $/boe moyen, < 15 $/boe faible",
  },
  ucm_interp_premium: {
    en: "Best-in-class cash conversion per barrel. The company turns each produced boe into substantial operating cash, signal of low breakeven and high-quality assets.",
    fr: "Conversion cash par baril best-in-class. La société transforme chaque boe produit en cash opérationnel substantiel, signal d'un point mort bas et d'actifs de qualité.",
  },
  ucm_interp_solid: {
    en: "Solid cash margin per barrel. Comfortable spread above the cash breakeven, robust ability to fund capex and shareholder returns through the cycle.",
    fr: "Marge cash par baril solide. Écart confortable au-dessus du point mort cash, capacité robuste à financer capex et redistributions à travers le cycle.",
  },
  ucm_interp_average: {
    en: "Average upstream cash margin. The business funds itself but with limited buffer if oil and gas prices weaken further.",
    fr: "Marge cash upstream moyenne. L'activité s'autofinance mais avec une marge limitée si les prix du pétrole et du gaz se dégradent davantage.",
  },
  ucm_interp_below: {
    en: "Cash margin under pressure. Each produced barrel generates limited operating cash, signal of high breakeven or weak realized prices.",
    fr: "Marge cash sous pression. Chaque baril produit génère peu de cash opérationnel, signal d'un point mort élevé ou de prix réalisés faibles.",
  },
};

/* ═════════════════════════════════════════════════════════════════════
 *  Helpers
 * ═════════════════════════════════════════════════════════════════════ */

function findKpi(kpis: KPI[] | undefined, names: string[]): KPI | undefined {
  if (!kpis || kpis.length === 0) return undefined;
  const lower = names.map((n) => n.toLowerCase());
  return kpis.find((k) => {
    const candidates = [
      k.short,
      k.name_fr,
      (k as KPI & { name_en?: string }).name_en,
    ]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => v.toLowerCase());
    return candidates.some((c) => lower.some((target) => c.includes(target)));
  });
}

function parseNumber(value: KPI["value"] | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value
      .replace(/ /g, " ")
      .replace(/\s+/g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.\-+]/g, "");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function naSuperKpi(
  id: string,
  name: string,
  category: SuperKpiCategory,
  locale: Locale,
  formula: string,
  benchmark: string,
): SuperKpi {
  return {
    id,
    name,
    category,
    value: null,
    display: "N/A",
    tier: "na",
    color: TIER_COLOR.na,
    tierLabel: pickLoc(TIER_LABEL.na, locale),
    gaugePct: 0,
    inputs: [],
    formula,
    interpretation: pickLoc(SECTOR_STRINGS.na_data, locale),
    benchmark,
  };
}

function formatYears(value: number, locale: Locale): string {
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return locale === "fr" ? `${num} ans` : `${num} yrs`;
}

function formatDollarsPerBoe(value: number, locale: Locale): string {
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `$${num} /boe`;
}

/**
 * Production unit inference helper.
 * Accepted upstream KPI units:
 *   - kboe/d, kboe/j, mboe/d, mboe/j (thousand boe per day)
 *   - mboe (annual Mboe = million boe)
 *   - boe/d, boe/j (single boe per day, rare)
 * Returns annualized production in kboe (thousand boe per year).
 */
function annualizeProduction(value: number, unit: string | undefined): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = (unit ?? "").toLowerCase().trim();
  // kboe/d or mboe/d (thousand boe/day, both spellings)
  if (
    u.includes("kboe/d") || u.includes("kboe/j") ||
    u.includes("mboe/d") || u.includes("mboe/j") ||
    u.includes("kboepd") || u.includes("mboepd")
  ) {
    // value en milliers de boe par jour
    return value * 365; // kboe par an
  }
  // Mboe (millions of boe per year, annual)
  if (u.includes("mboe") || u.includes("mmboe")) {
    return value * 1000; // convert Mboe to kboe
  }
  // boe/d (single barrels)
  if (u.includes("boe/d") || u.includes("boe/j") || u.includes("boepd")) {
    return (value * 365) / 1000; // boe/d → kboe/an
  }
  // Fallback: assume kboe/d (most common reporting unit for majors)
  return value * 365;
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. Reserves Life (Stratégie)
 * ═════════════════════════════════════════════════════════════════════ */

const RESERVES_NAMES = [
  "Proved Reserves",
  "1P Reserves",
  "Reserves",
  "Réserves prouvées",
  "Reserves Mboe",
];

const PRODUCTION_NAMES = [
  "Production",
  "Total Production",
  "Upstream Production",
  "Daily Production",
  "Oil and Gas Production",
];

export function reservesLife(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.rl_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.rl_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.rl_name, locale);

  const reservesKpi = findKpi(c.kpis, RESERVES_NAMES);
  const productionKpi = findKpi(c.kpis, PRODUCTION_NAMES);

  const reservesRaw = parseNumber(reservesKpi?.value);
  const productionRaw = parseNumber(productionKpi?.value);

  if (reservesKpi == null || productionKpi == null || reservesRaw == null || productionRaw == null) {
    return naSuperKpi(
      "reservesLife",
      name,
      "Stratégie",
      locale,
      formula,
      benchmark,
    );
  }

  // Reserves expected in Mboe (million boe). If unit is Bboe/Gboe, scale up.
  const reservesUnit = (reservesKpi.unit ?? "").toLowerCase();
  let reservesMboe = reservesRaw;
  if (reservesUnit.includes("bboe") || reservesUnit.includes("gboe")) {
    reservesMboe = reservesRaw * 1000; // Bboe → Mboe
  }
  // Convert Mboe to kboe to match annualized production unit
  const reservesKboe = reservesMboe * 1000;

  // Annualize production into kboe/year
  const productionKboePerYear = annualizeProduction(productionRaw, productionKpi.unit);
  if (productionKboePerYear == null || productionKboePerYear <= 0) {
    return naSuperKpi(
      "reservesLife",
      name,
      "Stratégie",
      locale,
      formula,
      benchmark,
    );
  }

  const years = reservesKboe / productionKboePerYear;

  if (!Number.isFinite(years) || years <= 0) {
    return naSuperKpi(
      "reservesLife",
      name,
      "Stratégie",
      locale,
      formula,
      benchmark,
    );
  }

  let tier: SuperKpiTier;
  let interpretation: string;
  if (years >= 15) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.rl_interp_premium, locale);
  } else if (years >= 10) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.rl_interp_solid, locale);
  } else if (years >= 5) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.rl_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.rl_interp_below, locale);
  }

  // Gauge: 0 yrs → 0, >= 25 yrs → 100
  const gaugePct = years <= 0 ? 0 : years >= 25 ? 100 : Math.max(0, Math.min(100, (years / 25) * 100));

  return {
    id: "reservesLife",
    name,
    category: "Stratégie",
    value: years,
    display: formatYears(years, locale),
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [reservesKpi.short, productionKpi.short],
    formula,
    interpretation,
    benchmark,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  2. Upstream Cash Margin (Profitabilité)
 * ═════════════════════════════════════════════════════════════════════ */

const OP_CF_NAMES = [
  "Op Cash Flow",
  "Operating Cash Flow",
  "Cash Flow from Operations",
  "Cash Flow opérationnel",
  "CFO",
];

export function upstreamCashMargin(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.ucm_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.ucm_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.ucm_name, locale);

  const cfKpi = findKpi(c.kpis, OP_CF_NAMES);
  const productionKpi = findKpi(c.kpis, PRODUCTION_NAMES);

  const cfRaw = parseNumber(cfKpi?.value);
  const productionRaw = parseNumber(productionKpi?.value);

  if (cfKpi == null || productionKpi == null || cfRaw == null || productionRaw == null) {
    return naSuperKpi(
      "upstreamCashMargin",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  // Op CF expected in $M (millions). If unit is Mds $ or Bn $, scale up.
  const cfUnit = (cfKpi.unit ?? "").toLowerCase();
  let cfMillions = cfRaw;
  if (cfUnit.includes("mds") || cfUnit.includes("bn") || cfUnit.includes("b$") || cfUnit.includes("$b") || cfUnit.includes("billion")) {
    cfMillions = cfRaw * 1000; // Mds $ → M $
  }

  // Annualize production into boe/year
  const productionKboePerYear = annualizeProduction(productionRaw, productionKpi.unit);
  if (productionKboePerYear == null || productionKboePerYear <= 0) {
    return naSuperKpi(
      "upstreamCashMargin",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }
  // Convert kboe/year → boe/year
  const productionBoePerYear = productionKboePerYear * 1000;

  // $M × 1_000_000 / boe = $ / boe
  const dollarsPerBoe = (cfMillions * 1_000_000) / productionBoePerYear;

  if (!Number.isFinite(dollarsPerBoe)) {
    return naSuperKpi(
      "upstreamCashMargin",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  let tier: SuperKpiTier;
  let interpretation: string;
  if (dollarsPerBoe >= 35) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.ucm_interp_premium, locale);
  } else if (dollarsPerBoe >= 25) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.ucm_interp_solid, locale);
  } else if (dollarsPerBoe >= 15) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.ucm_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.ucm_interp_below, locale);
  }

  // Gauge: 0 $/boe → 0, >= 50 $/boe → 100
  const gaugePct = dollarsPerBoe <= 0 ? 0 : dollarsPerBoe >= 50 ? 100 : Math.max(0, Math.min(100, (dollarsPerBoe / 50) * 100));

  return {
    id: "upstreamCashMargin",
    name,
    category: "Profitabilité",
    value: dollarsPerBoe,
    display: formatDollarsPerBoe(dollarsPerBoe, locale),
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [cfKpi.short, productionKpi.short],
    formula,
    interpretation,
    benchmark,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  Registry
 * ═════════════════════════════════════════════════════════════════════ */

export const SECTOR_KPIS = [
  {
    id: "reservesLife",
    category: "Stratégie" as SuperKpiCategory,
    compute: reservesLife,
  },
  {
    id: "upstreamCashMargin",
    category: "Profitabilité" as SuperKpiCategory,
    compute: upstreamCashMargin,
  },
];
