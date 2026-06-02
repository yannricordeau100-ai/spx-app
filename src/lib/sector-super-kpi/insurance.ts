/**
 * Sector Super-KPIs — INSURANCE V1.9.5
 *
 * 2 super-KPIs sectoriels pour assureurs (AIG, MET, PRU, AON, ALL, AXA,
 * ZURN, CB, BRO, AJG, etc.) :
 *   1. underwritingDiscipline : Combined Ratio (Profitabilité)
 *   2. solvencyMargin         : marge Solvabilité 2 au-dessus du seuil 100 % (Risque)
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
    en: "Required data not available for this insurer.",
    fr: "Données nécessaires non disponibles pour cet assureur.",
  },

  // Underwriting Discipline (Combined Ratio)
  ud_name: {
    en: "Underwriting Discipline",
    fr: "Discipline de souscription",
  },
  ud_formula: {
    en: "Combined Ratio (Losses + Expenses) / Net Premiums Earned",
    fr: "Ratio combiné (Sinistres + Frais) / Primes nettes acquises",
  },
  ud_benchmark: {
    en: "< 90 % premium · 90-95 % solid · 95-100 % average · >= 100 % below (underwriting loss)",
    fr: "< 90 % premium, 90 a 95 % solide, 95 a 100 % moyen, >= 100 % faible (perte technique)",
  },
  ud_interp_premium: {
    en: "Exceptional underwriting discipline. The insurer earns money on the technical side before any investment income. Best-in-class signal across the P&C industry.",
    fr: "Discipline de souscription exceptionnelle. L'assureur gagne de l'argent sur la partie technique avant tout produit financier. Signal best-in-class dans l'industrie IARD.",
  },
  ud_interp_solid: {
    en: "Solid underwriting profitability. Pricing covers claims and expenses with a margin. Robust insurance model.",
    fr: "Rentabilité technique solide. La tarification couvre sinistres et frais avec une marge. Modele assurantiel robuste.",
  },
  ud_interp_average: {
    en: "Technical break-even. The insurer relies on investment income to deliver overall profitability. Average level for the sector.",
    fr: "Equilibre technique. L'assureur s'appuie sur les produits financiers pour delivrer la rentabilite globale. Niveau moyen pour le secteur.",
  },
  ud_interp_below: {
    en: "Underwriting loss: claims and expenses exceed earned premiums. Pricing or claims management must be reviewed.",
    fr: "Perte technique : les sinistres et frais depassent les primes acquises. Tarification ou gestion des sinistres a revoir.",
  },

  // Solvency Margin (Solvency II)
  sm_name: {
    en: "Solvency Margin",
    fr: "Marge de solvabilite",
  },
  sm_formula: {
    en: "Solvency II Ratio - 100 % regulatory minimum",
    fr: "Ratio Solvabilite 2 - 100 % minimum reglementaire",
  },
  sm_benchmark: {
    en: ">= 120 pts premium (>=220 % total) · >= 80 pts solid · >= 50 pts average · < 50 pts below",
    fr: ">= 120 pts premium (>=220 % total), >= 80 pts solide, >= 50 pts moyen, < 50 pts faible",
  },
  sm_interp_premium: {
    en: "Very large capital buffer above the regulatory minimum. The insurer can absorb a major shock and retains full strategic optionality (M&A, dividends, buybacks).",
    fr: "Coussin de capital tres important au-dessus du minimum reglementaire. L'assureur peut absorber un choc majeur et conserve toute son optionalite strategique (M&A, dividendes, rachats).",
  },
  sm_interp_solid: {
    en: "Comfortable capital buffer. The insurer is solidly above the regulatory threshold, with room for capital return without supervisor pressure.",
    fr: "Coussin de capital confortable. L'assureur est solidement au-dessus du seuil reglementaire, avec une marge de manoeuvre pour redistribuer du capital sans pression du superviseur.",
  },
  sm_interp_average: {
    en: "Average solvency. Margin sufficient to cover usual stress scenarios but limited room for major capital return.",
    fr: "Solvabilite moyenne. Marge suffisante pour couvrir les scenarios de stress usuels mais marge limitee pour redistribuer fortement.",
  },
  sm_interp_below: {
    en: "Tight solvency margin. Limited shock absorption capacity, supervisor will likely demand a recovery plan if conditions deteriorate.",
    fr: "Marge de solvabilite tendue. Capacite limitee a absorber un choc, le superviseur peut demander un plan de retablissement en cas de deterioration.",
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
      .replace(/ /g, " ")
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

function formatPts(value: number, locale: Locale): string {
  const sign = value > 0 ? "+" : "";
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  if (locale === "fr") {
    return `${sign}${num} pts au-dessus 100%`;
  }
  return `${sign}${num} pts above 100%`;
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. Underwriting Discipline (Combined Ratio)
 * ═════════════════════════════════════════════════════════════════════ */

const COMBINED_RATIO_NAMES = [
  "Combined Ratio",
  "P&C Combined Ratio",
  "Underwriting Combined Ratio",
  "Ratio combine",
  "Ratio combiné",
];

export function underwritingDiscipline(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.ud_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.ud_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.ud_name, locale);

  const kpi = findKpi(c.kpis, COMBINED_RATIO_NAMES);
  const value = parseNumber(kpi?.value);

  if (kpi == null || value == null) {
    return naSuperKpi(
      "underwritingDiscipline",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  let tier: SuperKpiTier;
  let interpretation: string;
  if (value < 90) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.ud_interp_premium, locale);
  } else if (value < 95) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.ud_interp_solid, locale);
  } else if (value < 100) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.ud_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.ud_interp_below, locale);
  }

  // Gauge : < 85 = 100, 85-110 = interpole 100->0, >= 110 = 0
  const gaugePct = value <= 85 ? 100 : value >= 110 ? 0 : Math.max(0, Math.min(100, ((110 - value) / 25) * 100));

  return {
    id: "underwritingDiscipline",
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
 *  2. Solvency Margin (Solvency II ratio - 100 %)
 * ═════════════════════════════════════════════════════════════════════ */

const SOLVENCY_NAMES = [
  "Solvency II Ratio",
  "Solvency Ratio",
  "Risk-Based Capital",
  "Ratio Solvabilite 2",
  "Ratio Solvabilité 2",
];

export function solvencyMargin(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.sm_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.sm_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.sm_name, locale);

  const kpi = findKpi(c.kpis, SOLVENCY_NAMES);
  const raw = parseNumber(kpi?.value);

  if (kpi == null || raw == null) {
    return naSuperKpi(
      "solvencyMargin",
      name,
      "Risque",
      locale,
      formula,
      benchmark,
    );
  }

  const margin = raw - 100;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (margin >= 120) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.sm_interp_premium, locale);
  } else if (margin >= 80) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.sm_interp_solid, locale);
  } else if (margin >= 50) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.sm_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.sm_interp_below, locale);
  }

  // Gauge : 0 pts = 0, >= 150 pts = 100
  const gaugePct = margin <= 0 ? 0 : margin >= 150 ? 100 : Math.max(0, Math.min(100, (margin / 150) * 100));

  return {
    id: "solvencyMargin",
    name,
    category: "Risque",
    value: margin,
    display: formatPts(margin, locale),
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
    id: "underwritingDiscipline",
    category: "Profitabilité" as SuperKpiCategory,
    compute: underwritingDiscipline,
  },
  {
    id: "solvencyMargin",
    category: "Risque" as SuperKpiCategory,
    compute: solvencyMargin,
  },
];
