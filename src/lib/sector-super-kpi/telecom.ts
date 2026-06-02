/**
 * Sector Super-KPIs — TELECOM V1.9.5
 *
 * 2 super-KPIs sectoriels pour telecom (VZ, T, TMUS, BCE, BT, DTE, ORA, etc.,
 * 14 societes) :
 *   1. postpaidArpuExpansion : YoY growth ARPU postpaid (Croissance)
 *   2. fiberConvergenceMix   : % subscribers convergents fiber+mobile (Strategie)
 *
 * Convention identique a src/lib/super-kpi.ts :
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
    en: "Required data not available for this telecom operator.",
    fr: "Donnees necessaires non disponibles pour cet operateur telecom.",
  },

  // Postpaid ARPU Expansion (YoY)
  pae_name: {
    en: "Postpaid ARPU Expansion",
    fr: "Expansion ARPU postpaid",
  },
  pae_formula: {
    en: "Year-over-year growth of Postpaid ARPU (or ARPU/ARPA fallback)",
    fr: "Croissance annuelle (YoY) de l'ARPU postpaid (ou repli ARPU/ARPA)",
  },
  pae_benchmark: {
    en: ">= 5 % premium · >= 2 % solid · >= 0 % average · < 0 % below",
    fr: ">= 5 % premium, >= 2 % solide, >= 0 % moyen, < 0 % faible",
  },
  pae_interp_premium: {
    en: "Exceptional postpaid ARPU expansion. The operator successfully upsells customers toward premium plans (5G, unlimited, family bundles) and protects pricing power against competitive intensity. Strong revenue visibility.",
    fr: "Expansion ARPU postpaid exceptionnelle. L'operateur reussit a faire monter les clients en gamme (5G, illimite, bundles familiaux) et protege son pricing power face a l'intensite concurrentielle. Forte visibilite sur les revenus.",
  },
  pae_interp_solid: {
    en: "Solid postpaid ARPU growth. The operator maintains pricing discipline above inflation, a positive signal in a sector traditionally exposed to price erosion.",
    fr: "Croissance ARPU postpaid solide. L'operateur maintient une discipline tarifaire au-dessus de l'inflation, signal positif dans un secteur traditionnellement expose a l'erosion des prix.",
  },
  pae_interp_average: {
    en: "Average ARPU growth. The operator preserves revenue per user but lacks pricing momentum. Acceptable performance in a mature market.",
    fr: "Croissance ARPU moyenne. L'operateur preserve son revenu par utilisateur mais manque de momentum tarifaire. Performance acceptable sur un marche mature.",
  },
  pae_interp_below: {
    en: "ARPU contraction. Strong competitive pressure or downgrade to cheaper plans. Revenue growth will need to come from subscriber gains or adjacent services. Warning signal on pricing power.",
    fr: "Contraction de l'ARPU. Pression concurrentielle forte ou downgrade vers des plans moins chers. La croissance des revenus devra venir des gains d'abonnes ou des services adjacents. Signal d'alerte sur le pricing power.",
  },

  // Fiber Convergence Mix
  fcm_name: {
    en: "Fiber Convergence Mix",
    fr: "Mix convergence fibre",
  },
  fcm_formula: {
    en: "Convergent subscribers (fiber + mobile) / Total subscribers * 100",
    fr: "Abonnes convergents (fibre + mobile) / Abonnes totaux * 100",
  },
  fcm_benchmark: {
    en: ">= 40 % premium · >= 25 % solid · >= 15 % average · < 15 % below",
    fr: ">= 40 % premium, >= 25 % solide, >= 15 % moyen, < 15 % faible",
  },
  fcm_interp_premium: {
    en: "Convergence-leading operator. A very high share of subscribers takes a fiber + mobile bundle, structurally reducing churn and lifting ARPU per household. Defensive competitive moat.",
    fr: "Operateur leader sur la convergence. Une tres forte part des abonnes a un bundle fibre + mobile, ce qui reduit structurellement le churn et eleve l'ARPU par foyer. Moat concurrentiel defensif.",
  },
  fcm_interp_solid: {
    en: "Solid convergent base. The fixed-mobile strategy is paying off and provides a credible defense against pure-play mobile or fiber competitors.",
    fr: "Base convergente solide. La strategie fixe-mobile porte ses fruits et offre une defense credible contre les concurrents mobile-only ou fibre-only.",
  },
  fcm_interp_average: {
    en: "Convergence under way but still minority of the base. Significant upside potential if the operator accelerates cross-sell between fixed and mobile.",
    fr: "Convergence en cours mais encore minoritaire sur la base. Potentiel d'amelioration significatif si l'operateur accelere le cross-sell entre fixe et mobile.",
  },
  fcm_interp_below: {
    en: "Weak convergence. The operator is exposed to higher churn and ARPU erosion versus convergent competitors. Capex effort on fiber rollout or M&A often required to catch up.",
    fr: "Convergence faible. L'operateur est expose a un churn plus eleve et a une erosion ARPU face aux concurrents convergents. Un effort capex sur le deploiement fibre ou du M&A est souvent necessaire pour rattraper.",
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return `${num} ${suffix}`;
}

function formatYoY(value: number, locale: Locale): string {
  const sign = value > 0 ? "+" : "";
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${sign}${num} %`;
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. Postpaid ARPU Expansion (YoY)
 * ═════════════════════════════════════════════════════════════════════ */

const POSTPAID_ARPU_NAMES = [
  "Postpaid ARPU",
  "ARPU Postpaid",
  "Postpaid Phone ARPU",
  "ARPU postpaye",
  "ARPU postpayé",
];

const ARPU_FALLBACK_NAMES = [
  "ARPU",
  "ARPA",
  "Average Revenue Per User",
  "Average Revenue Per Account",
  "Revenu moyen par utilisateur",
  "Revenu moyen par abonne",
];

export function postpaidArpuExpansion(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.pae_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.pae_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.pae_name, locale);

  // Prefer Postpaid ARPU, then ARPU/ARPA fallback
  let kpi = findKpi(c.kpis, POSTPAID_ARPU_NAMES);
  if (kpi == null) kpi = findKpi(c.kpis, ARPU_FALLBACK_NAMES);
  const history = extractHistory(kpi);

  if (kpi == null || history.length < 2) {
    return naSuperKpi(
      "postpaidArpuExpansion",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  // YoY = last vs previous
  const last = history[history.length - 1];
  const prev = history[history.length - 2];

  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev <= 0) {
    return naSuperKpi(
      "postpaidArpuExpansion",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  const yoy = ((last - prev) / prev) * 100;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (yoy >= 5) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.pae_interp_premium, locale);
  } else if (yoy >= 2) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.pae_interp_solid, locale);
  } else if (yoy >= 0) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.pae_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.pae_interp_below, locale);
  }

  // Gauge : -5 %/yr = 0, +10 %/yr = 100
  const clamped = Math.max(-5, Math.min(10, yoy));
  const gaugePct = ((clamped + 5) / 15) * 100;

  return {
    id: "postpaidArpuExpansion",
    name,
    category: "Croissance",
    value: yoy,
    display: formatYoY(yoy, locale),
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
 *  2. Fiber Convergence Mix (% convergent subscribers)
 * ═════════════════════════════════════════════════════════════════════ */

const CONVERGENT_NAMES = [
  "Convergent Subscribers",
  "Convergent Customers",
  "FMC Subscribers",
  "Fixed-Mobile Convergent",
  "Abonnes convergents",
  "Abonnés convergents",
  "Clients convergents",
];

const FIBER_NAMES = [
  "Fiber Subscribers",
  "FTTH Subscribers",
  "Fibre Subscribers",
  "Broadband Subscribers",
  "Fiber Customers",
  "Abonnes fibre",
  "Abonnés fibre",
];

const TOTAL_SUBSCRIBERS_NAMES = [
  "Total Subscribers",
  "Subscribers",
  "Total Customers",
  "Connections",
  "Mobile Subscribers",
  "Abonnes totaux",
  "Abonnés totaux",
  "Total abonnes",
];

const CONVERGENCE_SHARE_NAMES = [
  "Convergence Mix",
  "Convergence Rate",
  "% Convergent",
  "Convergence Share",
  "Taux de convergence",
];

export function fiberConvergenceMix(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.fcm_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.fcm_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.fcm_name, locale);

  // First try a direct convergence-share KPI
  const directKpi = findKpi(c.kpis, CONVERGENCE_SHARE_NAMES);
  const directValue = parseNumber(directKpi?.value);

  let share: number | null = null;
  const inputs: string[] = [];

  if (directKpi != null && directValue != null) {
    share = directValue;
    inputs.push(directKpi.short);
  } else {
    // Then convergent subscribers / total
    let numerKpi = findKpi(c.kpis, CONVERGENT_NAMES);
    // Fallback to fiber subscribers as proxy for convergence base
    if (numerKpi == null) numerKpi = findKpi(c.kpis, FIBER_NAMES);
    const totalKpi = findKpi(c.kpis, TOTAL_SUBSCRIBERS_NAMES);
    const numer = parseNumber(numerKpi?.value);
    const total = parseNumber(totalKpi?.value);
    if (numerKpi != null && totalKpi != null && numer != null && total != null && total > 0) {
      share = (numer / total) * 100;
      inputs.push(numerKpi.short, totalKpi.short);
    }
  }

  if (share == null || !Number.isFinite(share)) {
    return naSuperKpi(
      "fiberConvergenceMix",
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
  if (share >= 40) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.fcm_interp_premium, locale);
  } else if (share >= 25) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.fcm_interp_solid, locale);
  } else if (share >= 15) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.fcm_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.fcm_interp_below, locale);
  }

  // Gauge : 0 % = 0, 60 % = 100 (linear, saturates at premium ceiling)
  const gaugePct = Math.max(0, Math.min(100, (share / 60) * 100));

  return {
    id: "fiberConvergenceMix",
    name,
    category: "Stratégie",
    value: share,
    display: formatPct(share, locale, "%"),
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
    id: "postpaidArpuExpansion",
    category: "Croissance" as SuperKpiCategory,
    compute: postpaidArpuExpansion,
  },
  {
    id: "fiberConvergenceMix",
    category: "Stratégie" as SuperKpiCategory,
    compute: fiberConvergenceMix,
  },
];
