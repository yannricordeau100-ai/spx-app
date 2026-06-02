/**
 * Sector Super-KPIs — REIT V1.9.5
 *
 * 2 super-KPIs sectoriels pour REITs (PLD, AMT, EQIX, SPG, WELL, O, PSA, EXR,
 * etc., 27 sociétés) :
 *   1. ffoPerSharGrowth  : croissance CAGR 5 ans du FFO per Share (Croissance)
 *   2. occupancyPremium  : taux d'occupation au-dessus de la moyenne (Stratégie)
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
    en: "Required data not available for this REIT.",
    fr: "Données nécessaires non disponibles pour ce REIT.",
  },

  // FFO per Share Growth (CAGR 5 ans)
  ffo_name: {
    en: "FFO per Share Growth",
    fr: "Croissance FFO par action",
  },
  ffo_formula: {
    en: "CAGR 5y of Funds From Operations per Share (master REIT growth metric)",
    fr: "CAGR 5 ans du FFO par action (metrique maitresse de croissance REIT)",
  },
  ffo_benchmark: {
    en: ">= 8 %/yr premium · >= 5 %/yr solid · >= 3 %/yr average · < 3 %/yr below",
    fr: ">= 8 %/an premium, >= 5 %/an solide, >= 3 %/an moyen, < 3 %/an faible",
  },
  ffo_interp_premium: {
    en: "Exceptional FFO per share growth. The REIT compounds cash flow per unit at top-tier pace through acquisitions, development pipeline, and embedded rent escalators. Strong dividend growth visibility.",
    fr: "Croissance du FFO par action exceptionnelle. Le REIT compose le cash-flow par titre a un rythme de premier plan grace aux acquisitions, au pipeline de developpement et aux indexations de loyers integrees. Forte visibilite sur la croissance du dividende.",
  },
  ffo_interp_solid: {
    en: "Solid FFO per share growth. The REIT delivers a reliable cash flow per unit expansion trajectory above the sector average. Quality real estate platform with disciplined capital allocation.",
    fr: "Croissance solide du FFO par action. Le REIT delivre une trajectoire d'expansion du cash-flow par titre fiable au-dessus de la moyenne du secteur. Plateforme immobiliere de qualite avec allocation de capital disciplinee.",
  },
  ffo_interp_average: {
    en: "Average FFO per share growth. Cash flow per unit expansion driven by contractual rent steps and modest portfolio rotation, in line with the REIT sector mean.",
    fr: "Croissance moyenne du FFO par action. Expansion du cash-flow par titre portee par les paliers de loyers contractuels et une rotation de portefeuille modeste, en ligne avec la moyenne du secteur REIT.",
  },
  ffo_interp_below: {
    en: "Weak FFO per share growth. Limited organic growth and dilutive equity issuance pressure per-unit cash flow. Dividend growth visibility is constrained.",
    fr: "Croissance du FFO par action faible. La croissance organique limitee et les emissions d'actions dilutives pesent sur le cash-flow par titre. La visibilite sur la croissance du dividende est contrainte.",
  },

  // Occupancy Premium
  occ_name: {
    en: "Occupancy Premium",
    fr: "Premium d'occupation",
  },
  occ_formula: {
    en: "Portfolio occupancy rate (leased space / total leasable space)",
    fr: "Taux d'occupation du portefeuille (surface louee / surface louable totale)",
  },
  occ_benchmark: {
    en: ">= 96 % premium · >= 93 % solid · >= 90 % average · < 90 % below",
    fr: ">= 96 % premium, >= 93 % solide, >= 90 % moyen, < 90 % faible",
  },
  occ_interp_premium: {
    en: "Outstanding occupancy. The REIT operates near full lease-up with strong tenant demand and pricing power, evidence of premium asset quality and resilient locations.",
    fr: "Occupation remarquable. Le REIT opere proche du plein remplissage avec une forte demande locative et un pouvoir de fixation des prix, signe d'actifs de qualite premium et de localisations resilientes.",
  },
  occ_interp_solid: {
    en: "Solid occupancy. Healthy tenant retention and leasing momentum support stable cash flow generation and limited downtime risk on the portfolio.",
    fr: "Occupation solide. La bonne retention des locataires et la dynamique de commercialisation soutiennent une generation de cash-flow stable et limitent le risque de vacance sur le portefeuille.",
  },
  occ_interp_average: {
    en: "Average occupancy. The portfolio runs in line with sector norms, with normal turnover and standard absorption velocity. No structural overperformance.",
    fr: "Occupation moyenne. Le portefeuille opere en ligne avec les normes du secteur, avec une rotation normale et une vitesse d'absorption standard. Pas de surperformance structurelle.",
  },
  occ_interp_below: {
    en: "Weak occupancy. The portfolio carries meaningful vacancy, signaling tenant attrition, weaker locations, or asset quality issues that drag on cash flow and FFO.",
    fr: "Occupation faible. Le portefeuille porte une vacance significative, signalant une attrition des locataires, des localisations plus faibles ou des problemes de qualite d'actifs qui pesent sur le cash-flow et le FFO.",
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
 *  1. FFO per Share Growth (CAGR 5 ans)
 * ═════════════════════════════════════════════════════════════════════ */

const FFO_PER_SHARE_NAMES = [
  "FFO per Share",
  "Core FFO per Share",
  "AFFO per Share",
  "Funds From Operations per Share",
  "FFO par action",
  "FFO/action",
];

export function ffoPerSharGrowth(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.ffo_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.ffo_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.ffo_name, locale);

  const kpi = findKpi(c.kpis, FFO_PER_SHARE_NAMES);
  const history = extractHistory(kpi);

  if (kpi == null || history.length < 2) {
    return naSuperKpi(
      "ffoPerSharGrowth",
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
      "ffoPerSharGrowth",
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
    interpretation = pickLoc(SECTOR_STRINGS.ffo_interp_premium, locale);
  } else if (cagr >= 5) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.ffo_interp_solid, locale);
  } else if (cagr >= 3) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.ffo_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.ffo_interp_below, locale);
  }

  // Gauge : 0 %/yr = 0, >= 12 %/yr = 100
  const gaugePct = cagr <= 0 ? 0 : cagr >= 12 ? 100 : Math.max(0, Math.min(100, (cagr / 12) * 100));

  return {
    id: "ffoPerSharGrowth",
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
 *  2. Occupancy Premium (% occupation portefeuille)
 * ═════════════════════════════════════════════════════════════════════ */

const OCCUPANCY_NAMES = [
  "Occupancy",
  "Occupancy Rate",
  "Same-Store Occupancy",
  "Same Store Occupancy",
  "Portfolio Occupancy",
  "Taux d'occupation",
  "Occupation",
];

export function occupancyPremium(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.occ_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.occ_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.occ_name, locale);

  const kpi = findKpi(c.kpis, OCCUPANCY_NAMES);
  const value = parseNumber(kpi?.value);

  if (kpi == null || value == null || !Number.isFinite(value)) {
    return naSuperKpi(
      "occupancyPremium",
      name,
      "Stratégie",
      locale,
      formula,
      benchmark,
    );
  }

  // Clamp occupancy to [0, 100]
  const occ = Math.max(0, Math.min(100, value));

  let tier: SuperKpiTier;
  let interpretation: string;
  if (occ >= 96) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.occ_interp_premium, locale);
  } else if (occ >= 93) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.occ_interp_solid, locale);
  } else if (occ >= 90) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.occ_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.occ_interp_below, locale);
  }

  // Gauge : map [80, 100] occupancy -> [0, 100] gauge
  const gaugePct = occ <= 80 ? 0 : Math.max(0, Math.min(100, ((occ - 80) / 20) * 100));

  return {
    id: "occupancyPremium",
    name,
    category: "Stratégie",
    value: occ,
    display: formatPct(occ, locale, "%"),
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
    id: "ffoPerSharGrowth",
    category: "Croissance" as SuperKpiCategory,
    compute: ffoPerSharGrowth,
  },
  {
    id: "occupancyPremium",
    category: "Stratégie" as SuperKpiCategory,
    compute: occupancyPremium,
  },
];
