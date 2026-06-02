/**
 * Sector Super-KPIs — TRAVEL-HOSPITALITY V1.9.5
 *
 * 2 super-KPIs sectoriels pour travel & hospitality (LUV, UAL, DAL, AAL,
 * NCLH, RCL, CCL, MAR, HLT, IHG, 7 stés) :
 *   1. revparMomentum         : croissance RevPAR (hotels) / RASM (airlines) YoY (Croissance)
 *   2. loadFactorEfficiency   : Load Factor / Occupancy / Capacity Utilization (Profitabilité)
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
    en: "Required data not available for this travel or hospitality company.",
    fr: "Données nécessaires non disponibles pour cette société travel ou hospitality.",
  },

  // RevPAR / RASM Momentum
  revpar_name: {
    en: "RevPAR / RASM Momentum",
    fr: "Momentum RevPAR / RASM",
  },
  revpar_formula: {
    en: "RevPAR (hotels) / Net Yield per Pax/Day (cruise) / RASM (airlines), YoY change %",
    fr: "RevPAR (hotels) / Net Yield par Pax/Jour (cruise) / RASM (airlines), variation YoY %",
  },
  revpar_benchmark: {
    en: ">= 8 % premium · >= 4 % solid · >= 0 % average · < 0 % below",
    fr: ">= 8 % premium, >= 4 % solide, >= 0 % moyen, < 0 % faible",
  },
  revpar_interp_premium: {
    en: "Very strong unit revenue momentum. Pricing power and demand support a clear above-cycle expansion, driving high incremental margin on largely fixed capacity.",
    fr: "Momentum de revenu unitaire tres fort. Le pricing power et la demande soutiennent une expansion clairement au-dessus du cycle, generant une marge incrementale elevee sur une capacite largement fixe.",
  },
  revpar_interp_solid: {
    en: "Solid unit revenue growth. Yield or RevPAR rises in line with mid-cycle expectations, signalling balanced supply and demand and constructive pricing discipline.",
    fr: "Croissance solide du revenu unitaire. Le yield ou RevPAR progresse en ligne avec les attentes de mi-cycle, signalant un equilibre offre-demande et une discipline de pricing constructive.",
  },
  revpar_interp_average: {
    en: "Average unit revenue trend. RevPAR or yield is broadly flat, partly absorbing cost inflation but offering limited operating leverage for the period.",
    fr: "Tendance de revenu unitaire moyenne. Le RevPAR ou yield est globalement stable, absorbant en partie l'inflation des couts mais offrant un effet de levier operationnel limite sur la periode.",
  },
  revpar_interp_below: {
    en: "Negative unit revenue momentum. Yield or RevPAR declines, sign of overcapacity, weak demand or aggressive discounting, with direct pressure on operating margin.",
    fr: "Momentum de revenu unitaire negatif. Le yield ou RevPAR recule, signe de sur-capacite, de demande faible ou de remises agressives, avec une pression directe sur la marge operationnelle.",
  },

  // Load Factor / Occupancy Efficiency
  load_name: {
    en: "Load Factor Efficiency",
    fr: "Efficacité Load Factor",
  },
  load_formula: {
    en: "Load Factor (airlines) / Occupancy (hotels) / Capacity Utilization (cruise), latest %",
    fr: "Load Factor (airlines) / Taux d'occupation (hotels) / Utilisation capacité (cruise), dernière %",
  },
  load_benchmark: {
    en: ">= 85 % premium · >= 78 % solid · >= 70 % average · < 70 % below",
    fr: ">= 85 % premium, >= 78 % solide, >= 70 % moyen, < 70 % faible",
  },
  load_interp_premium: {
    en: "Excellent capacity utilization. Seats, rooms or berths are filled at near-peak levels, maximizing the spread between fixed cost base and unit revenue.",
    fr: "Utilisation de capacite excellente. Sieges, chambres ou cabines sont remplis a un niveau quasi-maximal, maximisant l'ecart entre la base de couts fixes et le revenu unitaire.",
  },
  load_interp_solid: {
    en: "Solid utilization level. Capacity is well absorbed and supports healthy unit economics, with a comfortable buffer above the breakeven occupancy threshold.",
    fr: "Niveau d'utilisation solide. La capacite est bien absorbee et soutient une economie unitaire saine, avec une marge confortable au-dessus du seuil d'occupation de rentabilite.",
  },
  load_interp_average: {
    en: "Average utilization. Capacity absorption is acceptable but leaves limited room for unit cost dilution, exposing margin to any further demand softness.",
    fr: "Utilisation moyenne. L'absorption de capacite est acceptable mais laisse peu de marge pour diluer les couts unitaires, exposant la marge a toute degradation supplementaire de la demande.",
  },
  load_interp_below: {
    en: "Weak capacity utilization. Empty seats, rooms or berths weigh on unit economics, with material risk of operating losses if the gap to breakeven is not closed.",
    fr: "Utilisation de capacite faible. Sieges, chambres ou cabines vides pesent sur l'economie unitaire, avec un risque significatif de pertes operationnelles si l'ecart au seuil de rentabilite n'est pas reduit.",
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

function getHistory(kpi: KPI | undefined): number[] {
  if (!kpi) return [];
  const h = (kpi as KPI & { history?: unknown }).history;
  if (!Array.isArray(h)) return [];
  return h.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
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

function formatPct1(value: number, locale: Locale): string {
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${num} %`;
}

function formatPct0(value: number, locale: Locale): string {
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return `${num} %`;
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. RevPAR / RASM Momentum
 * ═════════════════════════════════════════════════════════════════════ */

const REVPAR_NAMES = [
  "RevPAR",
  "Revenue per Available Room",
  "Net Yield per Pax/Day",
  "Net Yield",
  "Yield per Pax",
  "RASM",
  "Revenue per ASM",
  "Unit Revenue",
  "PRASM",
  "TRASM",
  "Revenu par chambre disponible",
  "Yield par passager",
];

export function revparMomentum(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.revpar_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.revpar_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.revpar_name, locale);

  const kpi = findKpi(c.kpis, REVPAR_NAMES);
  const current = parseNumber(kpi?.value);

  if (kpi == null || current == null) {
    return naSuperKpi(
      "revparMomentum",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  const hist = getHistory(kpi);
  if (hist.length < 1) {
    return naSuperKpi(
      "revparMomentum",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  const prev = hist[hist.length - 1];
  if (prev == null || prev <= 0) {
    return naSuperKpi(
      "revparMomentum",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  const value = ((current - prev) / prev) * 100;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (value >= 8) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.revpar_interp_premium, locale);
  } else if (value >= 4) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.revpar_interp_solid, locale);
  } else if (value >= 0) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.revpar_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.revpar_interp_below, locale);
  }

  // Gauge centrée : map [-10 %, +15 %] → [0, 100]
  const gaugePct = Math.max(0, Math.min(100, ((value + 10) / 25) * 100));

  const sign = value >= 0 ? "+" : "";
  const display = `${sign}${formatPct1(value, locale)}`;

  return {
    id: "revparMomentum",
    name,
    category: "Croissance",
    value,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [kpi.short],
    formula,
    interpretation,
    benchmark,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  2. Load Factor / Occupancy Efficiency
 * ═════════════════════════════════════════════════════════════════════ */

const LOAD_FACTOR_NAMES = [
  "Load Factor",
  "Passenger Load Factor",
  "PLF",
  "Occupancy",
  "Occupancy Rate",
  "Hotel Occupancy",
  "Capacity Utilization",
  "Capacity Util",
  "Berth Utilization",
  "Occupation",
  "Taux d'occupation",
  "Coefficient de remplissage",
];

export function loadFactorEfficiency(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.load_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.load_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.load_name, locale);

  const kpi = findKpi(c.kpis, LOAD_FACTOR_NAMES);
  const raw = parseNumber(kpi?.value);

  if (kpi == null || raw == null) {
    return naSuperKpi(
      "loadFactorEfficiency",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  // Normalise : si on récupère une valeur <= 1, on assume une fraction.
  const value = raw <= 1 ? raw * 100 : raw;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (value >= 85) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.load_interp_premium, locale);
  } else if (value >= 78) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.load_interp_solid, locale);
  } else if (value >= 70) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.load_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.load_interp_below, locale);
  }

  // Gauge : map [50 %, 95 %] → [0, 100]
  const gaugePct = Math.max(0, Math.min(100, ((value - 50) / 45) * 100));

  const display = formatPct0(value, locale);

  return {
    id: "loadFactorEfficiency",
    name,
    category: "Profitabilité",
    value,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [kpi.short],
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
    id: "revparMomentum",
    category: "Croissance" as SuperKpiCategory,
    compute: revparMomentum,
  },
  {
    id: "loadFactorEfficiency",
    category: "Profitabilité" as SuperKpiCategory,
    compute: loadFactorEfficiency,
  },
];
