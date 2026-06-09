/**
 * Sector Super-KPIs — AUTO V1.9.5
 *
 * 2 super-KPIs sectoriels pour automobile (TSLA, F, GM, STLA, BMW, MBG, VOW,
 * RACE, 20 stés) :
 *   1. evMixGrowth         : croissance du mix EV (BEV + PHEV) (Stratégie)
 *   2. vehicleAspMomentum  : YoY ASP / Average Selling Price (Profitabilité)
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
    en: "Required data not available for this automotive company.",
    fr: "Données nécessaires non disponibles pour cette société automobile.",
  },

  // EV Mix Growth
  ev_name: {
    en: "EV Mix Growth",
    fr: "Croissance du mix EV",
  },
  ev_formula: {
    en: "(BEV + PHEV) Volume / Total Vehicle Volume, YoY change",
    fr: "Volume (BEV + PHEV) / Volume total de véhicules, variation YoY",
  },
  ev_benchmark: {
    en: ">= 30 % premium · >= 15 % solid · >= 7 % average · < 7 % below",
    fr: ">= 30 % premium, >= 15 % solide, >= 7 % moyen, < 7 % faible",
  },
  ev_interp_premium: {
    en: "Leading position in the EV transition. The electrified mix represents a dominant share of volumes and captures the structural premium of the BEV / PHEV cycle.",
    fr: "Position de leader dans la transition EV. Le mix electrifie represente une part dominante des volumes et capte la prime structurelle du cycle BEV / PHEV.",
  },
  ev_interp_solid: {
    en: "Solid trajectory on the EV mix. The company is materially advancing on electrification and progressively reducing its exposure to legacy ICE cycles.",
    fr: "Trajectoire solide sur le mix EV. La société progresse de maniere significative sur l'electrification et reduit progressivement son exposition aux cycles ICE legacy.",
  },
  ev_interp_average: {
    en: "Average exposure to the EV transition. Electrification is under way but remains a minority of the mix, exposing the company to ICE market normalization.",
    fr: "Exposition moyenne a la transition EV. L'electrification est engagee mais reste minoritaire dans le mix, exposant la société a la normalisation des marches ICE.",
  },
  ev_interp_below: {
    en: "Lagging on the EV transition. The electrified mix remains marginal, which leaves the company structurally vulnerable to the BEV / PHEV adoption ramp by competitors.",
    fr: "En retard sur la transition EV. Le mix electrifie reste marginal, ce qui laisse la société structurellement vulnerable a la montee en puissance BEV / PHEV des concurrents.",
  },

  // Vehicle ASP Momentum
  asp_name: {
    en: "Vehicle ASP Momentum",
    fr: "Momentum ASP véhicule",
  },
  asp_formula: {
    en: "Average Selling Price, YoY change %",
    fr: "Prix de vente moyen, variation YoY %",
  },
  asp_benchmark: {
    en: ">= 5 % premium · >= 2 % solid · >= 0 % average · < 0 % below",
    fr: ">= 5 % premium, >= 2 % solide, >= 0 % moyen, < 0 % faible",
  },
  asp_interp_premium: {
    en: "Very strong pricing power. ASP rises well above inflation, fed by mix-up, premium models or successful EV positioning. Direct support to operating margin.",
    fr: "Pricing power tres fort. L'ASP progresse bien au-dessus de l'inflation, porte par le mix-up, les modeles premium ou un positionnement EV reussi. Soutien direct a la marge operationnelle.",
  },
  asp_interp_solid: {
    en: "Solid pricing momentum. ASP grows in line with or slightly above inflation, signalling a controlled discount discipline and a balanced mix.",
    fr: "Momentum pricing solide. L'ASP progresse en ligne ou legerement au-dessus de l'inflation, signalant une discipline de remise maitrisee et un mix equilibre.",
  },
  asp_interp_average: {
    en: "Average ASP momentum. Pricing stabilizes or grows modestly, partly offsetting cost inflation but leaving little room for margin expansion.",
    fr: "Momentum ASP moyen. Le pricing se stabilise ou progresse modestement, compensant en partie l'inflation des couts mais laissant peu de marge pour une expansion de marge.",
  },
  asp_interp_below: {
    en: "Negative pricing momentum. ASP declines, sign of mix-down, aggressive discounts or competitive pressure, especially on EVs. Risk of margin compression.",
    fr: "Momentum pricing negatif. L'ASP recule, signe de mix-down, de remises agressives ou de pression concurrentielle, en particulier sur les EV. Risque de compression de marge.",
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

function formatPts1Signed(value: number, locale: Locale): string {
  const sign = value >= 0 ? "+" : "";
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  const suffix = locale.startsWith("fr") ? "pts YoY" : "pts YoY";
  return `${sign}${num} ${suffix}`;
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. EV Mix Growth
 * ═════════════════════════════════════════════════════════════════════ */

const EV_VOLUME_NAMES = [
  "EV Sales",
  "BEV Production",
  "Electrified Vehicles",
  "EV Volume",
  "BEV Sales",
  "BEV Volume",
  "BEV + PHEV",
  "Electric Vehicles",
  "Ventes EV",
  "Production BEV",
  "Véhicules électrifiés",
];

const TOTAL_VEHICLE_NAMES = [
  "Total Vehicles",
  "Vehicle Sales",
  "Total Sales Volume",
  "Vehicle Production",
  "Total Deliveries",
  "Deliveries",
  "Unit Sales",
  "Volumes",
  "Véhicules totaux",
  "Livraisons",
];

export function evMixGrowth(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.ev_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.ev_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.ev_name, locale);

  const evKpi = findKpi(c.kpis, EV_VOLUME_NAMES);
  const totKpi = findKpi(c.kpis, TOTAL_VEHICLE_NAMES);
  const ev = parseNumber(evKpi?.value);
  const tot = parseNumber(totKpi?.value);

  // Garde-fou part/mix : EV / Total véhicules est ∈ [0, 100], même période.
  // > 120 % = bug d'input (volumes mal appariés, unités) → N/A. 100-120 % → 100.
  const currentMixRaw = ev != null && tot != null && tot > 0 ? (ev / tot) * 100 : null;
  if (evKpi == null || totKpi == null || ev == null || tot == null || tot <= 0 || currentMixRaw == null || currentMixRaw < 0 || currentMixRaw > 120) {
    return naSuperKpi(
      "evMixGrowth",
      name,
      "Stratégie",
      locale,
      formula,
      benchmark,
    );
  }

  const currentMixPct = Math.min(100, currentMixRaw);

  // Tentative de calcul d'un YoY mix : on récupère l'history des deux KPIs
  // et on compare le mix actuel au mix de l'année précédente.
  const evHist = getHistory(evKpi);
  const totHist = getHistory(totKpi);
  let yoyPts: number | null = null;
  if (evHist.length >= 1 && totHist.length >= 1) {
    const prevEv = evHist[evHist.length - 1];
    const prevTot = totHist[totHist.length - 1];
    if (prevTot > 0) {
      const prevMix = (prevEv / prevTot) * 100;
      yoyPts = currentMixPct - prevMix;
    }
  }

  // Le tier est basé sur le niveau de mix actuel (proxy de la trajectoire).
  const value = currentMixPct;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (value >= 30) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.ev_interp_premium, locale);
  } else if (value >= 15) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.ev_interp_solid, locale);
  } else if (value >= 7) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.ev_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.ev_interp_below, locale);
  }

  // Gauge : 0 % = 0, >= 50 % = 100
  const gaugePct = value <= 0 ? 0 : value >= 50 ? 100 : Math.max(0, Math.min(100, (value / 50) * 100));

  const display = yoyPts != null
    ? formatPts1Signed(yoyPts, locale)
    : formatPct0(value, locale);

  return {
    id: "evMixGrowth",
    name,
    category: "Stratégie",
    value,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [evKpi.short, totKpi.short],
    formula,
    interpretation,
    benchmark,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  2. Vehicle ASP Momentum
 * ═════════════════════════════════════════════════════════════════════ */

const ASP_NAMES = [
  "ASP",
  "Average Selling Price",
  "Average Transaction Price",
  "ATP",
  "Prix de vente moyen",
  "Prix moyen",
];

export function vehicleAspMomentum(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.asp_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.asp_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.asp_name, locale);

  const aspKpi = findKpi(c.kpis, ASP_NAMES);
  const asp = parseNumber(aspKpi?.value);

  if (aspKpi == null || asp == null) {
    return naSuperKpi(
      "vehicleAspMomentum",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  const hist = getHistory(aspKpi);
  if (hist.length < 1) {
    return naSuperKpi(
      "vehicleAspMomentum",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  const prev = hist[hist.length - 1];
  if (prev == null || prev <= 0) {
    return naSuperKpi(
      "vehicleAspMomentum",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  const value = ((asp - prev) / prev) * 100;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (value >= 5) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.asp_interp_premium, locale);
  } else if (value >= 2) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.asp_interp_solid, locale);
  } else if (value >= 0) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.asp_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.asp_interp_below, locale);
  }

  // Gauge centrée : map [-10 %, +10 %] → [0, 100]
  const gaugePct = Math.max(0, Math.min(100, ((value + 10) / 20) * 100));

  const sign = value >= 0 ? "+" : "";
  const display = `${sign}${formatPct1(value, locale)}`;

  return {
    id: "vehicleAspMomentum",
    name,
    category: "Profitabilité",
    value,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [aspKpi.short],
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
    id: "evMixGrowth",
    category: "Stratégie" as SuperKpiCategory,
    compute: evMixGrowth,
  },
  {
    id: "vehicleAspMomentum",
    category: "Profitabilité" as SuperKpiCategory,
    compute: vehicleAspMomentum,
  },
];
