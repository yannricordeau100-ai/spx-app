/**
 * Super-KPIs sectoriels Hardware V1.9.5
 *
 * Sociétés concernées (bucket hardware, 10 stés) :
 *   AAPL, ANET, AXON, CIEN, CSCO, DELL, GRMN, HPQ, IBM, LOGN.SW
 *
 * 2 super-KPIs propres au secteur :
 *   1. servicesRecurringMix    — % du revenu venant des services (Stratégie)
 *   2. installedBaseValue      — CAGR 5 ans de la base installée (Croissance)
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

  // Services Recurring Mix
  services_name: {
    en: "Services Recurring Mix",
    fr: "Part services récurrents",
  },
  services_formula: {
    en: "Services Revenue / Total Revenue x 100",
    fr: "Revenu services / Revenu total x 100",
  },
  services_benchmark: {
    en: "≥ 25% = premium · 15-25 = solid · 8-15 = average · < 8 = below",
    fr: "≥ 25 % = premium · 15-25 = solide · 8-15 = moyen · < 8 = faible",
  },
  services_display: {
    en: "{n} %",
    fr: "{n} %",
  },
  services_interp_premium: {
    en: "Exceptional services mix: more than 25% of revenue is recurring. Strong protection against hardware cycle volatility and high software-like margins.",
    fr: "Mix services exceptionnel : plus de 25 % du revenu est récurrent. Forte protection contre la volatilité du cycle hardware et marges proches du logiciel.",
  },
  services_interp_solid: {
    en: "Solid services mix (15 to 25% of revenue). Meaningful recurring stream that softens hardware cyclicality.",
    fr: "Mix services solide (15 à 25 % du revenu). Flux récurrent significatif qui amortit la cyclicité du hardware.",
  },
  services_interp_average: {
    en: "Average services mix (8 to 15% of revenue). Recurring share still modest, exposure to hardware cycle remains dominant.",
    fr: "Mix services moyen (8 à 15 % du revenu). Part récurrente encore modeste, exposition au cycle hardware reste dominante.",
  },
  services_interp_below: {
    en: "Services below 8% of revenue. Business almost fully exposed to hardware one-shot sales and pricing cycles.",
    fr: "Services inférieurs à 8 % du revenu. Activité quasi entièrement exposée aux ventes hardware ponctuelles et aux cycles de prix.",
  },

  // Installed Base Value (CAGR 5 ans)
  base_name: {
    en: "Installed Base Growth",
    fr: "Croissance base installée",
  },
  base_formula: {
    en: "Compound annual growth rate of installed base over 5 years",
    fr: "Taux de croissance annuel composé de la base installée sur 5 ans",
  },
  base_benchmark: {
    en: "≥ 8% = premium · 5-8 = solid · 2-5 = average · < 2 = below",
    fr: "≥ 8 % = premium · 5-8 = solide · 2-5 = moyen · < 2 = faible",
  },
  base_display: {
    en: "+{n} %/yr",
    fr: "+{n} %/an",
  },
  base_interp_premium: {
    en: "Installed base growing above 8% per year. Strong future revenue visibility via services, refresh cycles and ecosystem lock-in.",
    fr: "Base installée en croissance supérieure à 8 % par an. Forte visibilité sur le revenu futur via services, cycles de renouvellement et verrouillage écosystème.",
  },
  base_interp_solid: {
    en: "Installed base growing 5 to 8% per year. Healthy expansion that supports recurring services and replacement demand.",
    fr: "Base installée en croissance de 5 à 8 % par an. Expansion saine qui soutient les services récurrents et la demande de renouvellement.",
  },
  base_interp_average: {
    en: "Installed base growing 2 to 5% per year. Modest expansion, future revenue mostly relies on share gains and pricing.",
    fr: "Base installée en croissance de 2 à 5 % par an. Expansion modeste, le revenu futur dépend surtout des gains de parts et du prix.",
  },
  base_interp_below: {
    en: "Installed base growing less than 2% per year. Limited compounding effect, structural exposure to refresh cycles only.",
    fr: "Base installée en croissance inférieure à 2 % par an. Effet de compounding limité, exposition structurelle aux seuls cycles de renouvellement.",
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
 *  1. Services Recurring Mix (%)
 * ═════════════════════════════════════════════════════════════════════ */

export function servicesRecurringMix(company: Company, locale: Locale = "en"): SuperKpi {
  const id = "hardware.services_recurring_mix";
  const name = pickLoc(SECTOR_STRINGS.services_name, locale);
  const category: SuperKpi["category"] = "Stratégie";

  const servicesKpi = findKpi(company, [
    "Services Revenue",
    "Services",
    "Services Rev",
    "Revenu services",
    "Software & Services",
    "Recurring Revenue",
  ]);
  const revenueKpi = findKpi(company, [
    "Revenue",
    "Total Revenue",
    "Net Revenue",
    "Net Sales",
    "Revenu",
    "Revenu total",
    "Chiffre d'affaires",
  ]);

  const missing: string[] = [];
  if (!servicesKpi) missing.push("Services Revenue");
  if (!revenueKpi) missing.push("Total Revenue");
  if (missing.length > 0) {
    return naResult(id, name, category, locale, missing);
  }

  const services = toNumber(servicesKpi!.value);
  const revenue = toNumber(revenueKpi!.value);

  if (services === null || revenue === null || revenue <= 0) {
    return naResult(id, name, category, locale, missing);
  }

  // Garde-fou part/mix : Services / Revenue est ∈ [0, 100], même période.
  // > 120 % = bug d'input (mauvais appariement, unités) → N/A.
  const rawValue = (services / revenue) * 100;
  if (!Number.isFinite(rawValue) || rawValue < 0 || rawValue > 120) {
    return naResult(id, name, category, locale, missing);
  }
  const value = Math.min(100, rawValue);

  let tier: SuperKpiTier;
  let interp: LocalizedString;
  if (value >= 25) {
    tier = "premium";
    interp = SECTOR_STRINGS.services_interp_premium;
  } else if (value >= 15) {
    tier = "solid";
    interp = SECTOR_STRINGS.services_interp_solid;
  } else if (value >= 8) {
    tier = "average";
    interp = SECTOR_STRINGS.services_interp_average;
  } else {
    tier = "below";
    interp = SECTOR_STRINGS.services_interp_below;
  }

  const gaugePct = Math.max(0, Math.min(100, (value / 40) * 100));
  const displayTpl = pickLoc(SECTOR_STRINGS.services_display, locale);
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
    inputs: [servicesKpi!.short, revenueKpi!.short],
    formula: pickLoc(SECTOR_STRINGS.services_formula, locale),
    interpretation: pickLoc(interp, locale),
    benchmark: pickLoc(SECTOR_STRINGS.services_benchmark, locale),
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  2. Installed Base Value (CAGR 5 ans, %)
 * ═════════════════════════════════════════════════════════════════════ */

export function installedBaseValue(company: Company, locale: Locale = "en"): SuperKpi {
  const id = "hardware.installed_base_value";
  const name = pickLoc(SECTOR_STRINGS.base_name, locale);
  const category: SuperKpi["category"] = "Croissance";

  const baseKpi =
    findKpi(company, ["Installed Base", "Base installée"]) ||
    findKpi(company, ["Active Devices", "Appareils actifs", "Active Users", "Utilisateurs actifs"]) ||
    findKpi(company, ["Active Installed Base", "Connected Devices", "Subscribers"]);

  const missing: string[] = [];
  if (!baseKpi) missing.push("Installed Base / Active Devices / Active Users");
  if (missing.length > 0) {
    return naResult(id, name, category, locale, missing);
  }

  const history = Array.isArray(baseKpi!.history) ? baseKpi!.history : [];
  if (history.length < 2) {
    return naResult(id, name, category, locale, missing);
  }

  // CAGR on the most recent 5-year window (or whatever is available).
  const windowSize = Math.min(history.length, 6); // 6 points = 5 year intervals
  const start = history.length - windowSize;
  const first = history[start];
  const last = history[history.length - 1];

  if (
    first === null ||
    last === null ||
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    first <= 0 ||
    last <= 0
  ) {
    return naResult(id, name, category, locale, missing);
  }

  const years = windowSize - 1;
  if (years <= 0) {
    return naResult(id, name, category, locale, missing);
  }

  const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;

  let tier: SuperKpiTier;
  let interp: LocalizedString;
  if (cagr >= 8) {
    tier = "premium";
    interp = SECTOR_STRINGS.base_interp_premium;
  } else if (cagr >= 5) {
    tier = "solid";
    interp = SECTOR_STRINGS.base_interp_solid;
  } else if (cagr >= 2) {
    tier = "average";
    interp = SECTOR_STRINGS.base_interp_average;
  } else {
    tier = "below";
    interp = SECTOR_STRINGS.base_interp_below;
  }

  const gaugePct = Math.max(0, Math.min(100, (cagr / 12) * 100));
  const displayTpl = pickLoc(SECTOR_STRINGS.base_display, locale);
  const display = displayTpl.replace("{n}", fmtNumber(cagr, locale, 1));

  return {
    id,
    name,
    category,
    value: cagr,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [baseKpi!.short],
    formula: pickLoc(SECTOR_STRINGS.base_formula, locale),
    interpretation: pickLoc(interp, locale),
    benchmark: pickLoc(SECTOR_STRINGS.base_benchmark, locale),
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  Registry
 * ═════════════════════════════════════════════════════════════════════ */

export const SECTOR_KPIS = [
  {
    id: "hardware.services_recurring_mix",
    name_en: "Services Recurring Mix",
    name_fr: "Part services récurrents",
    category: "Stratégie" as const,
    compute: servicesRecurringMix,
  },
  {
    id: "hardware.installed_base_value",
    name_en: "Installed Base Growth",
    name_fr: "Croissance base installée",
    category: "Croissance" as const,
    compute: installedBaseValue,
  },
] as const;
