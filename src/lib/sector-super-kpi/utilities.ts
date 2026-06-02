/**
 * Sector Super-KPIs — UTILITIES V1.9.5
 *
 * 2 super-KPIs sectoriels pour utilities régulées (NEE, DUK, SO, AEP, XEL,
 * EIX, D, PEG, etc., 37 sociétés) :
 *   1. rateBaseGrowth   : croissance CAGR 5 ans du Rate Base (Croissance)
 *   2. renewablesShare  : part de capacité renouvelable sur capacité totale (Stratégie)
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
    en: "Required data not available for this utility.",
    fr: "Données nécessaires non disponibles pour cette utility.",
  },

  // Rate Base Growth (CAGR 5 ans)
  rbg_name: {
    en: "Rate Base Growth",
    fr: "Croissance du Rate Base",
  },
  rbg_formula: {
    en: "CAGR 5y of regulated Rate Base (capital eligible for regulated return)",
    fr: "CAGR 5 ans du Rate Base regule (capital eligible au rendement regule)",
  },
  rbg_benchmark: {
    en: ">= 8 %/yr premium · >= 6 %/yr solid · >= 4 %/yr average · < 4 %/yr below",
    fr: ">= 8 %/an premium, >= 6 %/an solide, >= 4 %/an moyen, < 4 %/an faible",
  },
  rbg_interp_premium: {
    en: "Exceptional rate base growth. The utility is investing heavily in regulated assets (grid, renewables, transmission), securing strong visibility on future EPS growth at the allowed return on equity.",
    fr: "Croissance du rate base exceptionnelle. L'utility investit massivement dans les actifs regules (reseau, renouvelables, transport), securisant une forte visibilite sur la croissance future du BPA au taux de rendement autorise.",
  },
  rbg_interp_solid: {
    en: "Solid rate base growth. The capex plan supports a reliable EPS growth trajectory above the sector average. Quality regulated profile.",
    fr: "Croissance solide du rate base. Le plan capex soutient une trajectoire de croissance BPA fiable au-dessus de la moyenne du secteur. Profil regule de qualite.",
  },
  rbg_interp_average: {
    en: "Average rate base growth. EPS growth driven by replacement capex and steady regulated investment, in line with the utility sector mean.",
    fr: "Croissance moyenne du rate base. Croissance BPA portee par le capex de renouvellement et un investissement regule regulier, en ligne avec la moyenne du secteur utilities.",
  },
  rbg_interp_below: {
    en: "Weak rate base growth. Limited regulated capex plan, EPS growth will likely depend on cost control or non-regulated activities. Modest visibility.",
    fr: "Croissance du rate base faible. Plan capex regule limite, la croissance BPA reposera probablement sur la maitrise des couts ou les activites non regulees. Visibilite modeste.",
  },

  // Renewables Share
  rs_name: {
    en: "Renewables Share",
    fr: "Part renouvelable",
  },
  rs_formula: {
    en: "Renewable installed capacity / Total installed capacity * 100",
    fr: "Capacite installee renouvelable / Capacite installee totale * 100",
  },
  rs_benchmark: {
    en: ">= 60 % premium · >= 40 % solid · >= 20 % average · < 20 % below",
    fr: ">= 60 % premium, >= 40 % solide, >= 20 % moyen, < 20 % faible",
  },
  rs_interp_premium: {
    en: "Highly decarbonized generation mix. The utility is a leader in the energy transition, well-positioned for ESG capital flows and tightening climate regulation.",
    fr: "Mix de production tres decarbonne. L'utility est leader sur la transition energetique, bien positionnee pour les flux de capitaux ESG et le durcissement de la reglementation climat.",
  },
  rs_interp_solid: {
    en: "Solid renewable share. The utility has built a credible transition trajectory and limits its exposure to fossil regulatory and carbon-price risk.",
    fr: "Part renouvelable solide. L'utility a construit une trajectoire de transition credible et limite son exposition au risque reglementaire fossile et au prix du carbone.",
  },
  rs_interp_average: {
    en: "Average renewable share. Transition under way but a significant portion of the mix remains exposed to fossil fuels and carbon costs.",
    fr: "Part renouvelable moyenne. Transition en cours mais une part significative du mix reste exposee aux fossiles et aux couts du carbone.",
  },
  rs_interp_below: {
    en: "Mix dominated by fossil fuels. Strong exposure to carbon costs, stranded asset risk, and ESG investor pressure. Major capex effort required to catch up.",
    fr: "Mix domine par les fossiles. Forte exposition aux couts du carbone, risque d'actifs echoues et pression des investisseurs ESG. Effort capex majeur necessaire pour rattraper.",
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

function extractHistory(kpi: KPI | undefined): number[] {
  if (!kpi) return [];
  const k = kpi as KPI & {
    history?: Array<{ value?: number | string | null }> | Record<string, number | string | null>;
    values?: Array<{ value?: number | string | null }> | Record<string, number | string | null>;
  };
  const raw = k.history ?? k.values;
  if (!raw) return [];
  const items: Array<number | string | null | undefined> = (Array.isArray(raw)
    ? (raw as unknown[]).map((r) => (typeof r === "object" && r !== null && "value" in r ? (r as { value: unknown }).value : r)) as Array<number | string | null | undefined>
    : (Object.values(raw) as Array<number | string | null | undefined>));
  const out: number[] = [];
  for (const it of items) {
    const n = parseNumber(it as KPI["value"]);
    if (n !== null) out.push(n);
  }
  return out;
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

function formatPct(value: number, locale: Locale, suffix: string): string {
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${num} ${suffix}`;
}

function formatPerYear(value: number, locale: Locale): string {
  const sign = value > 0 ? "+" : "";
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${sign}${num} %/${locale === "fr" ? "an" : "yr"}`;
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. Rate Base Growth (CAGR 5 ans)
 * ═════════════════════════════════════════════════════════════════════ */

const RATE_BASE_NAMES = [
  "Rate Base",
  "Regulated Rate Base",
  "Rate Base Total",
  "Base tarifaire",
];

export function rateBaseGrowth(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.rbg_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.rbg_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.rbg_name, locale);

  const kpi = findKpi(c.kpis, RATE_BASE_NAMES);
  const history = extractHistory(kpi);

  if (kpi == null || history.length < 2) {
    return naSuperKpi(
      "rateBaseGrowth",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  // Use up to 6 points (5 year intervals) to compute CAGR
  const series = history.slice(-6);
  const first = series[0];
  const last = series[series.length - 1];
  const years = series.length - 1;

  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0 || years < 1) {
    return naSuperKpi(
      "rateBaseGrowth",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (cagr >= 8) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.rbg_interp_premium, locale);
  } else if (cagr >= 6) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.rbg_interp_solid, locale);
  } else if (cagr >= 4) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.rbg_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.rbg_interp_below, locale);
  }

  // Gauge : 0 %/yr = 0, >= 12 %/yr = 100
  const gaugePct = cagr <= 0 ? 0 : cagr >= 12 ? 100 : Math.max(0, Math.min(100, (cagr / 12) * 100));

  return {
    id: "rateBaseGrowth",
    name,
    category: "Croissance",
    value: cagr,
    display: formatPerYear(cagr, locale),
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
 *  2. Renewables Share (% capacité renouvelable)
 * ═════════════════════════════════════════════════════════════════════ */

const RENEWABLES_NAMES = [
  "Renewables Capacity",
  "Renewable Capacity",
  "Renewable Generation",
  "Renewables Generation",
  "Capacite renouvelable",
  "Capacité renouvelable",
];

const TOTAL_CAPACITY_NAMES = [
  "Total Capacity",
  "Installed Capacity",
  "Total Installed Capacity",
  "Total Generation",
  "Net Generation",
  "Capacite totale",
  "Capacité totale",
];

const RENEWABLES_SHARE_NAMES = [
  "Renewables Share",
  "Renewable Share",
  "% Renewables",
  "Part renouvelable",
];

export function renewablesShare(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.rs_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.rs_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.rs_name, locale);

  // First try to find a direct "Renewables Share" KPI
  const directKpi = findKpi(c.kpis, RENEWABLES_SHARE_NAMES);
  const directValue = parseNumber(directKpi?.value);

  let share: number | null = null;
  const inputs: string[] = [];

  if (directKpi != null && directValue != null) {
    share = directValue;
    inputs.push(directKpi.short);
  } else {
    const renewKpi = findKpi(c.kpis, RENEWABLES_NAMES);
    const totalKpi = findKpi(c.kpis, TOTAL_CAPACITY_NAMES);
    const renew = parseNumber(renewKpi?.value);
    const total = parseNumber(totalKpi?.value);
    if (renewKpi != null && totalKpi != null && renew != null && total != null && total > 0) {
      share = (renew / total) * 100;
      inputs.push(renewKpi.short, totalKpi.short);
    }
  }

  if (share == null || !Number.isFinite(share)) {
    return naSuperKpi(
      "renewablesShare",
      name,
      "Stratégie",
      locale,
      formula,
      benchmark,
    );
  }

  // Clamp share to [0, 100]
  share = Math.max(0, Math.min(100, share));

  let tier: SuperKpiTier;
  let interpretation: string;
  if (share >= 60) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.rs_interp_premium, locale);
  } else if (share >= 40) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.rs_interp_solid, locale);
  } else if (share >= 20) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.rs_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.rs_interp_below, locale);
  }

  // Gauge : 0 % = 0, 100 % = 100 (linear)
  const gaugePct = share;

  return {
    id: "renewablesShare",
    name,
    category: "Stratégie",
    value: share,
    display: formatPct(share, locale, locale === "fr" ? "% renouv" : "% renew"),
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
    id: "rateBaseGrowth",
    category: "Croissance" as SuperKpiCategory,
    compute: rateBaseGrowth,
  },
  {
    id: "renewablesShare",
    category: "Stratégie" as SuperKpiCategory,
    compute: renewablesShare,
  },
];
