/**
 * Sector Super-KPIs — SEMIS V1.9.5
 *
 * 2 super-KPIs sectoriels pour semiconducteurs (NVDA, TSM, AVGO, AMD, QCOM,
 * MU, AMAT, LRCX, KLAC, 36 stés) :
 *   1. dataCenterMix         : part du revenu Data Center / AI (Stratégie)
 *   2. capexIntensityVsGross : Capex / Gross Profit (Risque)
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
    en: "Required data not available for this semiconductor company.",
    fr: "Données nécessaires non disponibles pour cette société de semiconducteurs.",
  },

  // Data Center Mix
  dc_name: {
    en: "Data Center / AI Mix",
    fr: "Mix Data Center / IA",
  },
  dc_formula: {
    en: "Data Center (or AI) Revenue / Total Revenue",
    fr: "Revenu Data Center (ou IA) / Revenu total",
  },
  dc_benchmark: {
    en: ">= 60 % premium · >= 35 % solid · >= 15 % average · < 15 % below",
    fr: ">= 60 % premium, >= 35 % solide, >= 15 % moyen, < 15 % faible",
  },
  dc_interp_premium: {
    en: "Massive exposure to the AI / Data Center super-cycle. The company captures the bulk of hyperscaler capex and benefits fully from the AI infrastructure build-out.",
    fr: "Exposition massive au super-cycle IA / Data Center. La société capte la majeure partie du capex hyperscaler et profite pleinement du deploiement des infrastructures IA.",
  },
  dc_interp_solid: {
    en: "Solid strategic positioning on Data Center / AI. A meaningful share of revenue benefits from the secular growth driver of the sector.",
    fr: "Positionnement strategique solide sur Data Center / IA. Une part significative du revenu beneficie du moteur de croissance seculaire du secteur.",
  },
  dc_interp_average: {
    en: "Average Data Center / AI exposure. The company participates in the trend but remains dependent on more cyclical end-markets (PC, mobile, auto, consumer).",
    fr: "Exposition Data Center / IA moyenne. La société participe au mouvement mais reste dependante de marches finaux plus cycliques (PC, mobile, auto, consumer).",
  },
  dc_interp_below: {
    en: "Low Data Center / AI exposure. The company misses the main growth driver of the sector and remains highly dependent on cyclical legacy markets.",
    fr: "Exposition Data Center / IA faible. La société rate le moteur de croissance principal du secteur et reste fortement dependante de marches legacy cycliques.",
  },

  // Capex Intensity vs Gross Profit
  ci_name: {
    en: "Capex Intensity vs Gross Profit",
    fr: "Intensité Capex vs Marge brute",
  },
  ci_formula: {
    en: "Capex / Gross Profit (or Revenue * Gross Margin)",
    fr: "Capex / Marge brute (ou Revenu * Marge brute)",
  },
  ci_benchmark: {
    en: "< 15 % premium · < 25 % solid · < 35 % average · >= 35 % below (capital heavy)",
    fr: "< 15 % premium, < 25 % solide, < 35 % moyen, >= 35 % faible (lourd en capital)",
  },
  ci_interp_premium: {
    en: "Very capital-light model. Each unit of gross profit requires little reinvestment, freeing up strong free cash flow for capital return or M&A. Fabless or fab-light profile.",
    fr: "Modele tres peu capitalistique. Chaque unite de marge brute necessite peu de reinvestissement, ce qui libere un cash flow disponible solide pour la redistribution ou les acquisitions. Profil fabless ou fab-light.",
  },
  ci_interp_solid: {
    en: "Solid capital intensity. The company reinvests reasonably to sustain its competitive position while preserving an attractive cash conversion profile.",
    fr: "Intensite capitalistique solide. La société reinvestit raisonnablement pour maintenir sa position competitive tout en preservant un profil de conversion cash attractif.",
  },
  ci_interp_average: {
    en: "Average capital intensity for the sector. Significant capex is required to stay in the technology race, which limits free cash flow conversion.",
    fr: "Intensite capitalistique moyenne pour le secteur. Un capex significatif est necessaire pour rester dans la course technologique, ce qui limite la conversion en cash flow disponible.",
  },
  ci_interp_below: {
    en: "Capital-heavy profile. A very large share of gross profit is absorbed by capex, structurally exposing free cash flow to demand cycles. Typical of pure-play foundries and memory.",
    fr: "Profil lourd en capital. Une tres grosse part de la marge brute est absorbee par le capex, exposant structurellement le cash flow disponible aux cycles de demande. Typique des foundries pure-play et de la memoire.",
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
 *  1. Data Center / AI Mix
 * ═════════════════════════════════════════════════════════════════════ */

const DATA_CENTER_NAMES = [
  "Data Center Revenue",
  "Data Center",
  "AI Revenue",
  "Datacenter Revenue",
  "Revenu Data Center",
  "Revenu IA",
];

const REVENUE_NAMES = [
  "Revenue",
  "Total Revenue",
  "Net Revenue",
  "Net Sales",
  "Revenu",
  "Chiffre d'affaires",
];

export function dataCenterMix(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.dc_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.dc_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.dc_name, locale);

  const dcKpi = findKpi(c.kpis, DATA_CENTER_NAMES);
  const revKpi = findKpi(c.kpis, REVENUE_NAMES);
  const dc = parseNumber(dcKpi?.value);
  const rev = parseNumber(revKpi?.value);

  if (dcKpi == null || revKpi == null || dc == null || rev == null || rev <= 0) {
    return naSuperKpi(
      "dataCenterMix",
      name,
      "Stratégie",
      locale,
      formula,
      benchmark,
    );
  }

  const value = (dc / rev) * 100;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (value >= 60) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.dc_interp_premium, locale);
  } else if (value >= 35) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.dc_interp_solid, locale);
  } else if (value >= 15) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.dc_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.dc_interp_below, locale);
  }

  // Gauge : 0 % = 0, >= 80 % = 100
  const gaugePct = value <= 0 ? 0 : value >= 80 ? 100 : Math.max(0, Math.min(100, (value / 80) * 100));

  return {
    id: "dataCenterMix",
    name,
    category: "Stratégie",
    value,
    display: formatPct0(value, locale),
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [dcKpi.short, revKpi.short],
    formula,
    interpretation,
    benchmark,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  2. Capex Intensity vs Gross Profit
 * ═════════════════════════════════════════════════════════════════════ */

const CAPEX_NAMES = [
  "Capex",
  "Capital Expenditure",
  "Capital Expenditures",
  "CapEx",
  "Investissements",
];

const GROSS_PROFIT_NAMES = [
  "Gross Profit",
  "Marge brute",
  "Bénéfice brut",
  "Profit brut",
];

const GROSS_MARGIN_NAMES = [
  "Gross Margin",
  "Marge brute %",
  "Taux de marge brute",
];

export function capexIntensityVsGross(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.ci_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.ci_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.ci_name, locale);

  const capexKpi = findKpi(c.kpis, CAPEX_NAMES);
  const capex = parseNumber(capexKpi?.value);

  if (capexKpi == null || capex == null) {
    return naSuperKpi(
      "capexIntensityVsGross",
      name,
      "Risque",
      locale,
      formula,
      benchmark,
    );
  }

  // Gross Profit direct, sinon Revenue * Gross Margin
  let grossProfit: number | null = null;
  const inputs: string[] = [capexKpi.short];

  const gpKpi = findKpi(c.kpis, GROSS_PROFIT_NAMES);
  const gpVal = parseNumber(gpKpi?.value);
  if (gpKpi != null && gpVal != null) {
    grossProfit = gpVal;
    inputs.push(gpKpi.short);
  } else {
    const revKpi = findKpi(c.kpis, REVENUE_NAMES);
    const gmKpi = findKpi(c.kpis, GROSS_MARGIN_NAMES);
    const rev = parseNumber(revKpi?.value);
    const gm = parseNumber(gmKpi?.value);
    if (revKpi != null && gmKpi != null && rev != null && gm != null) {
      grossProfit = rev * (gm / 100);
      inputs.push(revKpi.short, gmKpi.short);
    }
  }

  if (grossProfit == null || grossProfit <= 0) {
    return naSuperKpi(
      "capexIntensityVsGross",
      name,
      "Risque",
      locale,
      formula,
      benchmark,
    );
  }

  const absCapex = Math.abs(capex);
  const value = (absCapex / grossProfit) * 100;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (value < 15) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.ci_interp_premium, locale);
  } else if (value < 25) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.ci_interp_solid, locale);
  } else if (value < 35) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.ci_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.ci_interp_below, locale);
  }

  // Gauge : <= 10 % = 100, >= 50 % = 0, lineaire entre
  const gaugePct = value <= 10 ? 100 : value >= 50 ? 0 : Math.max(0, Math.min(100, ((50 - value) / 40) * 100));

  return {
    id: "capexIntensityVsGross",
    name,
    category: "Risque",
    value,
    display: formatPct1(value, locale),
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs,
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
    id: "dataCenterMix",
    category: "Stratégie" as SuperKpiCategory,
    compute: dataCenterMix,
  },
  {
    id: "capexIntensityVsGross",
    category: "Risque" as SuperKpiCategory,
    compute: capexIntensityVsGross,
  },
];
