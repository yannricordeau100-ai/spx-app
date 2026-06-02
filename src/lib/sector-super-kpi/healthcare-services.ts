/**
 * Sector Super-KPIs — HEALTHCARE-SERVICES V1.9.5
 *
 * 2 super-KPIs sectoriels pour assureurs santé, hospital chains, med devices
 * (UNH, CI, HUM, ELV, CVS, HCA, IDXX, DXCM, ALGN, RMD, PODD, HSIC, etc.) :
 *   1. medicalLossRatio        : MLR / Benefit Cost Ratio (Profitabilité)
 *   2. careUtilizationGrowth   : CAGR 5 ans volume de soins / membres (Croissance)
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
    en: "Required data not available for this healthcare company.",
    fr: "Données nécessaires non disponibles pour cette société de santé.",
  },

  // Medical Loss Ratio (MLR / BCR)
  mlr_name: {
    en: "Medical Loss Ratio",
    fr: "Ratio de sinistralité médicale",
  },
  mlr_formula: {
    en: "Medical claims paid / Premiums earned (%)",
    fr: "Sinistres médicaux payés / Primes acquises (%)",
  },
  mlr_benchmark: {
    en: "82-85 % premium (ACA sweet spot) · 85-88 % solid · 80-82 % or 88-92 % average · < 80 % or > 92 % below",
    fr: "82 a 85 % premium (zone optimale ACA), 85 a 88 % solide, 80 a 82 % ou 88 a 92 % moyen, < 80 % ou > 92 % faible",
  },
  mlr_interp_premium: {
    en: "Optimal medical loss ratio. Above the 80/85 % ACA regulatory floor with enough margin for underwriting profitability. Best-in-class signal for a health insurer.",
    fr: "Ratio de sinistralité optimal. Au-dessus du plancher reglementaire ACA 80/85 % avec une marge suffisante pour la rentabilité de souscription. Signal best-in-class pour un assureur santé.",
  },
  mlr_interp_solid: {
    en: "Solid medical loss ratio. The insurer keeps a reasonable margin while remaining well above the regulatory minimum.",
    fr: "Ratio de sinistralité solide. L'assureur conserve une marge raisonnable tout en restant largement au-dessus du minimum réglementaire.",
  },
  mlr_interp_average: {
    en: "Average medical loss ratio. Either too low (regulatory rebate risk under ACA) or too high (margin under pressure from rising medical costs).",
    fr: "Ratio de sinistralité moyen. Soit trop bas (risque de remboursement réglementaire ACA), soit trop élevé (marge sous pression par la hausse des couts médicaux).",
  },
  mlr_interp_below: {
    en: "Concerning medical loss ratio. Below 80 % triggers ACA rebates back to members; above 92 % signals structural unprofitability requiring pricing or care management actions.",
    fr: "Ratio de sinistralité préoccupant. Sous 80 % declenche des remboursements ACA aux assurés, au-dessus de 92 % signale une perte structurelle exigeant des actions tarifaires ou de gestion des soins.",
  },

  // Care Utilization Growth (CAGR 5y members/lives/patient days)
  cug_name: {
    en: "Care Utilization Growth",
    fr: "Croissance du volume de soins",
  },
  cug_formula: {
    en: "5-year CAGR of Members / Lives Covered / Patient Days",
    fr: "CAGR 5 ans des Membres / Vies couvertes / Journées patients",
  },
  cug_benchmark: {
    en: ">= 8 %/y premium · >= 5 %/y solid · >= 2 %/y average · < 2 %/y below",
    fr: ">= 8 %/an premium, >= 5 %/an solide, >= 2 %/an moyen, < 2 %/an faible",
  },
  cug_interp_premium: {
    en: "Exceptional volume growth on covered lives or patient days. Strong commercial momentum and market share gains in the healthcare services landscape.",
    fr: "Croissance exceptionnelle du volume de vies couvertes ou de journées patients. Forte dynamique commerciale et gains de parts de marché dans le paysage des services de santé.",
  },
  cug_interp_solid: {
    en: "Solid volume growth above sector average. Sustainable demographic and commercial dynamic.",
    fr: "Croissance de volume solide au-dessus de la moyenne sectorielle. Dynamique demographique et commerciale durable.",
  },
  cug_interp_average: {
    en: "Average volume growth, broadly in line with US population growth and sector trends.",
    fr: "Croissance de volume moyenne, globalement en ligne avec la croissance demographique américaine et les tendances sectorielles.",
  },
  cug_interp_below: {
    en: "Weak volume growth. The company is losing share or facing structural headwinds (member attrition, regional market saturation).",
    fr: "Croissance de volume faible. La société perd des parts ou subit des vents contraires structurels (attrition de membres, saturation regionale).",
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

function formatPct(value: number, locale: Locale): string {
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${num} %`;
}

function formatCagr(value: number, locale: Locale): string {
  const sign = value > 0 ? "+" : "";
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  if (locale === "fr") {
    return `${sign}${num} %/an`;
  }
  return `${sign}${num} %/y`;
}

function computeCagr(history: number[] | undefined): number | null {
  if (!history || history.length < 2) return null;
  const clean = history.filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (clean.length < 2) return null;
  const first = clean[0];
  const last = clean[clean.length - 1];
  const periods = clean.length - 1;
  if (first <= 0 || last <= 0) return null;
  const ratio = last / first;
  const cagr = Math.pow(ratio, 1 / periods) - 1;
  return Number.isFinite(cagr) ? cagr * 100 : null;
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. Medical Loss Ratio (MLR / Benefit Cost Ratio)
 * ═════════════════════════════════════════════════════════════════════ */

const MLR_NAMES = [
  "Medical Loss Ratio",
  "MLR",
  "Benefit Cost Ratio",
  "Medical Care Ratio",
  "Ratio de sinistralité médicale",
  "Ratio de sinistralite medicale",
];

export function medicalLossRatio(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.mlr_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.mlr_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.mlr_name, locale);

  const kpi = findKpi(c.kpis, MLR_NAMES);
  const value = parseNumber(kpi?.value);

  if (kpi == null || value == null) {
    return naSuperKpi(
      "medicalLossRatio",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  let tier: SuperKpiTier;
  let interpretation: string;
  if (value >= 82 && value <= 85) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.mlr_interp_premium, locale);
  } else if (value > 85 && value <= 88) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.mlr_interp_solid, locale);
  } else if ((value >= 80 && value < 82) || (value > 88 && value <= 92)) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.mlr_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.mlr_interp_below, locale);
  }

  // Gauge : distance from optimal 83.5 % center, 0 distance = 100, >= 15 pts = 0
  const distance = Math.abs(value - 83.5);
  const gaugePct = distance >= 15 ? 0 : Math.max(0, Math.min(100, ((15 - distance) / 15) * 100));

  return {
    id: "medicalLossRatio",
    name,
    category: "Profitabilité",
    value,
    display: formatPct(value, locale),
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
 *  2. Care Utilization Growth (CAGR 5y members / lives / patient days)
 * ═════════════════════════════════════════════════════════════════════ */

const UTILIZATION_NAMES = [
  "Members",
  "Lives Covered",
  "Patient Days",
  "Membres",
  "Vies couvertes",
  "Journées patients",
  "Journees patients",
];

export function careUtilizationGrowth(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.cug_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.cug_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.cug_name, locale);

  const kpi = findKpi(c.kpis, UTILIZATION_NAMES);
  const cagr = computeCagr(kpi?.history);

  if (kpi == null || cagr == null) {
    return naSuperKpi(
      "careUtilizationGrowth",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  let tier: SuperKpiTier;
  let interpretation: string;
  if (cagr >= 8) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.cug_interp_premium, locale);
  } else if (cagr >= 5) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.cug_interp_solid, locale);
  } else if (cagr >= 2) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.cug_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.cug_interp_below, locale);
  }

  // Gauge : 0 %/y = 0, >= 12 %/y = 100
  const gaugePct = cagr <= 0 ? 0 : cagr >= 12 ? 100 : Math.max(0, Math.min(100, (cagr / 12) * 100));

  return {
    id: "careUtilizationGrowth",
    name,
    category: "Croissance",
    value: cagr,
    display: formatCagr(cagr, locale),
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
    id: "medicalLossRatio",
    category: "Profitabilité" as SuperKpiCategory,
    compute: medicalLossRatio,
  },
  {
    id: "careUtilizationGrowth",
    category: "Croissance" as SuperKpiCategory,
    compute: careUtilizationGrowth,
  },
];
