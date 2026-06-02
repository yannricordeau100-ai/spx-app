/**
 * Super-KPIs sectoriels Biotech V1.9.5
 *
 * Sociétés concernées (bucket biotech, 10 stés) :
 *   ABVX, AMGN, ARGX, BIIB, BMRN, INCY, MRNA, NBIX, REGN, VRTX
 *
 * 2 super-KPIs propres au secteur :
 *   1. cashRunwayMonths   — durée de vie du cash avant épuisement (Risque)
 *   2. pipelinePerEmployee — densité de programmes cliniques (Stratégie)
 *
 * Règles communes :
 *   - EN canonical, FR traduction
 *   - Pas d'em-dash dans les strings FR
 *   - Vocabulaire FR strict (Mettrik)
 */

import type { Company, KPI } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import type { SuperKpi, SuperKpiTier } from "@/lib/super-kpi";

/* ═════════════════════════════════════════════════════════════════════
 *  i18n
 * ═════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string };

function pickLoc(s: LocalizedString, locale: Locale): string {
  const rec = s as Record<string, string | undefined>;
  if (rec[locale]) return rec[locale]!;
  const base = locale.split("-")[0];
  if (rec[base]) return rec[base]!;
  return s.en;
}

const TIER_COLOR: Record<SuperKpiTier, string> = {
  premium: "#10b981",
  solid: "#84cc16",
  average: "#f59e0b",
  below: "#f43f5e",
  na: "#71717a",
};

const TIER_LABEL: Record<SuperKpiTier, LocalizedString> = {
  premium: { en: "Premium", fr: "Premium" },
  solid:   { en: "Solid",   fr: "Solide" },
  average: { en: "Average", fr: "Moyen" },
  below:   { en: "Below",   fr: "Faible" },
  na:      { en: "N/A",     fr: "Non applicable" },
};

export const SECTOR_STRINGS = {
  // Generic
  na_data: {
    en: "Required data not available for this company.",
    fr: "Données nécessaires non disponibles pour cette société.",
  },
  na_missing_prefix: {
    en: "Cannot compute. Missing inputs: ",
    fr: "Calcul impossible. KPIs manquants : ",
  },

  // Cash Runway
  runway_name: {
    en: "Cash Runway",
    fr: "Autonomie de trésorerie",
  },
  runway_formula: {
    en: "Cash / Monthly Burn Rate (months)",
    fr: "Trésorerie / Burn rate mensuel (mois)",
  },
  runway_formula_profitable: {
    en: "Company is profitable: no burn rate",
    fr: "Société rentable : pas de burn rate",
  },
  runway_benchmark: {
    en: "Profitable or ≥ 36 months = premium · 24-36 = solid · 12-24 = average · < 12 = below",
    fr: "Rentable ou ≥ 36 mois = premium · 24-36 = solide · 12-24 = moyen · < 12 = faible",
  },
  runway_display_profitable: {
    en: "Profitable",
    fr: "Rentable",
  },
  runway_display_months: {
    en: "{n} months",
    fr: "{n} mois",
  },
  runway_interp_profitable: {
    en: "The company is profitable and finances itself without raising capital. No runway risk, full strategic flexibility.",
    fr: "La société est rentable et s'autofinance sans levée de capital. Aucun risque d'autonomie, flexibilité stratégique totale.",
  },
  runway_interp_premium: {
    en: "Cash runway exceeds 36 months. The company has time to advance its pipeline without short-term financing pressure.",
    fr: "L'autonomie de trésorerie dépasse 36 mois. La société a le temps d'avancer son pipeline sans pression de financement à court terme.",
  },
  runway_interp_solid: {
    en: "Cash runway between 24 and 36 months. Comfortable horizon but a capital raise will likely be needed within 2-3 years.",
    fr: "Autonomie entre 24 et 36 mois. Horizon confortable mais une levée de capital sera probablement nécessaire d'ici 2 à 3 ans.",
  },
  runway_interp_average: {
    en: "Cash runway between 12 and 24 months. Capital raise window opening, dilution risk in the short term.",
    fr: "Autonomie entre 12 et 24 mois. Fenêtre de levée qui s'ouvre, risque de dilution à court terme.",
  },
  runway_interp_below: {
    en: "Cash runway below 12 months. Critical: capital raise imminent, strong dilution risk or asset sale.",
    fr: "Autonomie inférieure à 12 mois. Critique : levée imminente, risque fort de dilution ou cession d'actifs.",
  },

  // Pipeline per Employee
  pipeline_name: {
    en: "Pipeline per Employee",
    fr: "Pipeline par employé",
  },
  pipeline_formula: {
    en: "Pipeline programs / (Headcount / 1000)",
    fr: "Programmes pipeline / (Effectif / 1000)",
  },
  pipeline_benchmark: {
    en: "≥ 4 = premium · 2-4 = solid · 1-2 = average · < 1 = below",
    fr: "≥ 4 = premium · 2-4 = solide · 1-2 = moyen · < 1 = faible",
  },
  pipeline_display: {
    en: "{n} programs / 1000 hc",
    fr: "{n} programmes/1000 hc",
  },
  pipeline_interp_premium: {
    en: "Exceptional R&D density: more than 4 clinical programs per 1000 employees. Lean structure focused on pipeline.",
    fr: "Densité R&D exceptionnelle : plus de 4 programmes cliniques pour 1000 employés. Structure resserrée centrée sur le pipeline.",
  },
  pipeline_interp_solid: {
    en: "Solid R&D density (2 to 4 programs per 1000 employees). Operating model focused on biotech research.",
    fr: "Densité R&D solide (2 à 4 programmes pour 1000 employés). Modèle opérationnel orienté recherche biotech.",
  },
  pipeline_interp_average: {
    en: "Average R&D density (1 to 2 programs per 1000 employees). Significant share of commercial / industrial structure.",
    fr: "Densité R&D moyenne (1 à 2 programmes pour 1000 employés). Part importante de structure commerciale ou industrielle.",
  },
  pipeline_interp_below: {
    en: "R&D density below 1 program per 1000 employees. Operating model more commercial than research-driven.",
    fr: "Densité R&D inférieure à 1 programme pour 1000 employés. Modèle opérationnel plus commercial que de recherche.",
  },
} as const;

/* ═════════════════════════════════════════════════════════════════════
 *  Helpers
 * ═════════════════════════════════════════════════════════════════════ */

function findKpi(company: Company, candidates: string[]): KPI | null {
  if (!company?.kpis) return null;
  const wanted = candidates.map((c) => c.toLowerCase().trim());
  for (const k of company.kpis) {
    const short = (k.short || "").toLowerCase().trim();
    const nameFr = (k.name_fr || "").toLowerCase().trim();
    const nameEn = (k.name_en || "").toLowerCase().trim();
    if (wanted.includes(short) || wanted.includes(nameFr) || wanted.includes(nameEn)) {
      return k;
    }
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.\-]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmtFr(n: number, decimals = 1): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtEn(n: number, decimals = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtNumber(n: number, locale: Locale, decimals = 1): string {
  const base = locale.split("-")[0];
  return base === "fr" ? fmtFr(n, decimals) : fmtEn(n, decimals);
}

function naResult(
  id: string,
  name: string,
  category: SuperKpi["category"],
  locale: Locale,
  missing: string[],
): SuperKpi {
  const msg =
    missing.length > 0
      ? pickLoc(SECTOR_STRINGS.na_missing_prefix, locale) + missing.join(", ")
      : pickLoc(SECTOR_STRINGS.na_data, locale);
  return {
    id,
    name,
    category,
    value: null,
    display: "n.d.",
    tier: "na",
    color: TIER_COLOR.na,
    tierLabel: pickLoc(TIER_LABEL.na, locale),
    gaugePct: 0,
    inputs: [],
    formula: "",
    interpretation: msg,
    benchmark: "",
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. Cash Runway (months)
 * ═════════════════════════════════════════════════════════════════════ */

export function cashRunwayMonths(company: Company, locale: Locale = "en"): SuperKpi {
  const id = "biotech.cash_runway_months";
  const name = pickLoc(SECTOR_STRINGS.runway_name, locale);
  const category: SuperKpi["category"] = "Risque";

  const cashKpi = findKpi(company, ["Cash", "Total Cash", "Cash & Equivalents", "Trésorerie"]);
  const lossKpi =
    findKpi(company, ["Operating Loss", "Op Loss", "Perte opérationnelle"]) ||
    findKpi(company, ["Net Loss", "Net Income", "Résultat net"]);

  const missing: string[] = [];
  if (!cashKpi) missing.push("Cash");
  if (!lossKpi) missing.push("Operating Loss / Net Loss");
  if (missing.length > 0) {
    return naResult(id, name, category, locale, missing);
  }

  const cash = toNumber(cashKpi!.value);
  const lossOrIncome = toNumber(lossKpi!.value);

  if (cash === null || lossOrIncome === null) {
    return naResult(id, name, category, locale, missing);
  }

  const inputs = [cashKpi!.short, lossKpi!.short];

  // Profitable case: net income or operating result > 0 (no burn)
  if (lossOrIncome > 0) {
    return {
      id,
      name,
      category,
      value: null,
      display: pickLoc(SECTOR_STRINGS.runway_display_profitable, locale),
      tier: "premium",
      color: TIER_COLOR.premium,
      tierLabel: pickLoc(TIER_LABEL.premium, locale),
      gaugePct: 100,
      inputs,
      formula: pickLoc(SECTOR_STRINGS.runway_formula_profitable, locale),
      interpretation: pickLoc(SECTOR_STRINGS.runway_interp_profitable, locale),
      benchmark: pickLoc(SECTOR_STRINGS.runway_benchmark, locale),
    };
  }

  const annualBurn = Math.abs(lossOrIncome);
  if (annualBurn === 0) {
    return naResult(id, name, category, locale, missing);
  }

  const months = (cash * 12) / annualBurn;

  let tier: SuperKpiTier;
  let interp: LocalizedString;
  if (months >= 36) {
    tier = "premium";
    interp = SECTOR_STRINGS.runway_interp_premium;
  } else if (months >= 24) {
    tier = "solid";
    interp = SECTOR_STRINGS.runway_interp_solid;
  } else if (months >= 12) {
    tier = "average";
    interp = SECTOR_STRINGS.runway_interp_average;
  } else {
    tier = "below";
    interp = SECTOR_STRINGS.runway_interp_below;
  }

  const gaugePct = Math.max(0, Math.min(100, (months / 48) * 100));
  const displayTpl = pickLoc(SECTOR_STRINGS.runway_display_months, locale);
  const display = displayTpl.replace("{n}", fmtNumber(months, locale, 0));

  return {
    id,
    name,
    category,
    value: months,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs,
    formula: pickLoc(SECTOR_STRINGS.runway_formula, locale),
    interpretation: pickLoc(interp, locale),
    benchmark: pickLoc(SECTOR_STRINGS.runway_benchmark, locale),
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  2. Pipeline per Employee (per 1000 headcount)
 * ═════════════════════════════════════════════════════════════════════ */

export function pipelinePerEmployee(company: Company, locale: Locale = "en"): SuperKpi {
  const id = "biotech.pipeline_per_employee";
  const name = pickLoc(SECTOR_STRINGS.pipeline_name, locale);
  const category: SuperKpi["category"] = "Stratégie";

  const pipelineKpi =
    findKpi(company, ["Pipeline Programs", "Pipeline"]) ||
    findKpi(company, ["Phase 3 Pipeline", "Phase 3"]) ||
    findKpi(company, ["R&D Pipeline", "RD Pipeline"]);

  const headcountKpi = findKpi(company, ["Headcount", "Employees", "Effectif", "Effectifs"]);

  const missing: string[] = [];
  if (!pipelineKpi) missing.push("Pipeline Programs");
  if (!headcountKpi) missing.push("Headcount");
  if (missing.length > 0) {
    return naResult(id, name, category, locale, missing);
  }

  const pipeline = toNumber(pipelineKpi!.value);
  const headcount = toNumber(headcountKpi!.value);

  if (pipeline === null || headcount === null || headcount <= 0) {
    return naResult(id, name, category, locale, missing);
  }

  const value = pipeline / (headcount / 1000);

  let tier: SuperKpiTier;
  let interp: LocalizedString;
  if (value >= 4) {
    tier = "premium";
    interp = SECTOR_STRINGS.pipeline_interp_premium;
  } else if (value >= 2) {
    tier = "solid";
    interp = SECTOR_STRINGS.pipeline_interp_solid;
  } else if (value >= 1) {
    tier = "average";
    interp = SECTOR_STRINGS.pipeline_interp_average;
  } else {
    tier = "below";
    interp = SECTOR_STRINGS.pipeline_interp_below;
  }

  const gaugePct = Math.max(0, Math.min(100, (value / 6) * 100));
  const displayTpl = pickLoc(SECTOR_STRINGS.pipeline_display, locale);
  const display = displayTpl.replace("{n}", fmtNumber(value, locale, 1));

  return {
    id,
    name,
    category,
    value,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [pipelineKpi!.short, headcountKpi!.short],
    formula: pickLoc(SECTOR_STRINGS.pipeline_formula, locale),
    interpretation: pickLoc(interp, locale),
    benchmark: pickLoc(SECTOR_STRINGS.pipeline_benchmark, locale),
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  Registry
 * ═════════════════════════════════════════════════════════════════════ */

export const SECTOR_KPIS = [
  {
    id: "biotech.cash_runway_months",
    name_en: "Cash Runway",
    name_fr: "Autonomie de trésorerie",
    category: "Risque" as const,
    compute: cashRunwayMonths,
  },
  {
    id: "biotech.pipeline_per_employee",
    name_en: "Pipeline per Employee",
    name_fr: "Pipeline par employé",
    category: "Stratégie" as const,
    compute: pipelinePerEmployee,
  },
] as const;
