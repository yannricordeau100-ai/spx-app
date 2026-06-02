/**
 * Super-KPIs sector-specific — RESTAURANTS (V1.9.5)
 *
 * 2 super-KPIs calibrés sur le business model restauration :
 *   1. restaurantSssg       : Same-Store Sales Growth, KPI maître restaurants,
 *      reflète la croissance organique du parc existant (trafic × ticket)
 *      hors expansion réseau.
 *   2. unitGrowthQuality    : croissance nette du parc en pourcentage du parc
 *      pré-existant, mesure la capacité à ouvrir des unités rentables sans
 *      cannibaliser les comps.
 *
 * Univers cible : 6 stés restaurants (MCD, SBUX, CMG, YUM, DPZ, DRI, QSR,
 * CAVA inclus dans le bucket).
 *
 * i18n : EN + FR obligatoires (règle Yann : EN = canonical).
 * Anti-em-dash dans rationale FR. Vocabulaire FR strict (stés, parc, etc.).
 *
 * IMPORTANT : pas de commit, pas d'edit sur src/lib/super-kpi.ts. Le caller
 * intégrera lui-même les exports `SECTOR_KPIS` et `SECTOR_STRINGS`.
 */

import type { Company } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import type { SuperKpi, SuperKpiTier } from "@/lib/super-kpi";

/* ═══════════════════════════════════════════════════════════════════════
 *  i18n strings — EN canonical, FR traduction. Style anti-em-dash.
 *  ═══════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string };

export const SECTOR_STRINGS = {
  // ── restaurantSssg ────────────────────────────────────────────────
  name_sssg: {
    en: "Same-store sales growth",
    fr: "Croissance des ventes à magasins comparables",
  },
  name_sssg_na: {
    en: "Same-store sales growth (N/A)",
    fr: "Croissance des ventes comparables (N/A)",
  },
  sssg_formula: {
    en: "Same-store / comparable sales growth (year-over-year)",
    fr: "Croissance des ventes à magasins comparables (variation annuelle)",
  },
  sssg_formula_na: {
    en: "Year-over-year growth of sales for restaurants open at least 13 months",
    fr: "Croissance annuelle des ventes pour les restaurants ouverts depuis au moins 13 mois",
  },
  sssg_benchmark: {
    en: "≥ 6 % premium · 3-6 % solid · 0-3 % average · < 0 % below",
    fr: "≥ 6 % premium · 3 à 6 % solide · 0 à 3 % moyen · < 0 % en deçà",
  },
  sssg_benchmark_na: {
    en: "Premium ≥ 6 % year-over-year",
    fr: "Premium si croissance annuelle ≥ 6 %",
  },
  sssg_interp_top: {
    en: "Strong same-store sales growth. The chain combines traffic and ticket gains on the existing fleet, sign of brand momentum, menu pricing power and operational execution.",
    fr: "Croissance forte des ventes comparables. La sté combine gains de trafic et de ticket sur le parc existant, signe de momentum de marque, de pricing power sur le menu et d'exécution opérationnelle.",
  },
  sssg_interp_mid: {
    en: "Solid same-store sales growth in line with quality restaurant operators. Underlying demand healthy, the brand grows organically beyond inflation.",
    fr: "Croissance solide des ventes comparables en ligne avec les meilleurs opérateurs de la restauration. Demande sous-jacente saine, la marque croît organiquement au-delà de l'inflation.",
  },
  sssg_interp_avg: {
    en: "Flat to low same-store sales growth. The chain barely keeps up with menu price increases, traffic is weak. To watch: real traffic, ticket mix.",
    fr: "Croissance des ventes comparables faible ou stable. La sté absorbe à peine les hausses de prix du menu, le trafic est mou. À surveiller : trafic réel, mix ticket.",
  },
  sssg_interp_low: {
    en: "Same-store sales contracting. Structural concern: traffic erosion, the brand is losing relevance or being challenged by competing concepts.",
    fr: "Ventes comparables en contraction. Préoccupation structurelle : érosion du trafic, la marque perd en pertinence ou se fait challenger par des concepts concurrents.",
  },
  sssg_input_value: {
    en: "SSSG",
    fr: "SSSG",
  },

  // ── unitGrowthQuality ─────────────────────────────────────────────
  name_unit_growth: {
    en: "Net unit growth",
    fr: "Croissance nette du parc",
  },
  name_unit_growth_na: {
    en: "Net unit growth (N/A)",
    fr: "Croissance nette du parc (N/A)",
  },
  unit_growth_formula: {
    en: "Net new restaurants / existing fleet (annual)",
    fr: "Nouveaux restaurants nets / parc pré-existant (annuel)",
  },
  unit_growth_formula_na: {
    en: "Net new restaurant openings divided by the pre-existing restaurant base, annualized",
    fr: "Ouvertures nettes de nouveaux restaurants divisées par le parc pré-existant, sur base annuelle",
  },
  unit_growth_benchmark: {
    en: "≥ 6 % premium · 4-6 % solid · 2-4 % average · < 2 % below",
    fr: "≥ 6 % premium · 4 à 6 % solide · 2 à 4 % moyen · < 2 % en deçà",
  },
  unit_growth_benchmark_na: {
    en: "Premium ≥ 6 % net unit growth per year",
    fr: "Premium si croissance nette du parc ≥ 6 % par an",
  },
  unit_growth_interp_top: {
    en: "Aggressive yet disciplined unit expansion. The chain rolls out new restaurants at a fast pace without cannibalizing existing comps, signal of a replicable concept with strong returns on invested capital per unit.",
    fr: "Expansion du parc agressive mais disciplinée. La sté déploie de nouveaux restaurants à un rythme soutenu sans cannibaliser les comps existants, signal d'un concept réplicable avec de forts retours sur capital investi par unité.",
  },
  unit_growth_interp_mid: {
    en: "Solid unit growth in line with mature quick-service standards. Expansion is steady, the development pipeline is healthy.",
    fr: "Croissance solide du parc en ligne avec les standards de la restauration mature. L'expansion est régulière, le pipeline de développement est sain.",
  },
  unit_growth_interp_avg: {
    en: "Moderate unit growth. The chain expands cautiously, possibly limited by white space saturation or franchisee development capacity.",
    fr: "Croissance modérée du parc. La sté s'étend prudemment, possiblement limitée par la saturation du white space ou la capacité de développement des franchisés.",
  },
  unit_growth_interp_low: {
    en: "Very low or negative unit growth. Concept saturated or under pressure: closures offset openings. To watch: refranchising programs, fleet rationalization.",
    fr: "Croissance du parc très faible ou négative. Concept saturé ou sous pression : les fermetures compensent les ouvertures. À surveiller : programmes de refranchising, rationalisation du parc.",
  },
  unit_growth_input_net: {
    en: "Net new restaurants",
    fr: "Nouveaux restaurants nets",
  },
  unit_growth_input_base: {
    en: "Existing fleet",
    fr: "Parc pré-existant",
  },

  // ── Generic na fallback ────────────────────────────────────────────
  na_data: {
    en: "Required data not available for this company.",
    fr: "Données nécessaires non disponibles pour cette sté.",
  },
} as const satisfies Record<string, LocalizedString>;

/* ═══════════════════════════════════════════════════════════════════════
 *  Helpers locaux (clonés de super-kpi.ts pour autonomie du module).
 *  ═══════════════════════════════════════════════════════════════════════ */

const TIER_COLOR: Record<SuperKpiTier, string> = {
  premium: "#10b981",
  solid: "#84cc16",
  average: "#f59e0b",
  below: "#f43f5e",
  na: "#71717a",
};

const TIER_LABEL: Record<SuperKpiTier, LocalizedString> = {
  premium: { en: "Premium", fr: "Premium" },
  solid: { en: "Solid", fr: "Solide" },
  average: { en: "Average", fr: "Moyen" },
  below: { en: "Below", fr: "Faible" },
  na: { en: "N/A", fr: "Non applicable" },
};

function pickLoc(s: LocalizedString, locale: Locale): string {
  const rec = s as Record<string, string | undefined>;
  if (rec[locale]) return rec[locale]!;
  const base = locale.split("-")[0];
  if (rec[base]) return rec[base]!;
  return s.en;
}

function tr(key: keyof typeof SECTOR_STRINGS, locale: Locale): string {
  return pickLoc(SECTOR_STRINGS[key], locale);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v
      .replace(/\s/g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.\-+eE]/g, "");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmt(n: number, decimals: number): string {
  return n.toFixed(decimals).replace(".", ",");
}

/** Cherche un KPI par liste de shorts candidats puis par match name_en/name_fr. */
function findRestaurantKpi(
  c: Company,
  shorts: string[],
  nameMatchers: (en: string, fr: string) => boolean,
): { value: number; unit?: string } | null {
  for (const s of shorts) {
    const k = c.kpis.find((x) => x.short === s);
    if (k) {
      const v = num(k.value);
      if (v !== null) return { value: v, unit: k.unit };
    }
  }
  const k = c.kpis.find((x) => {
    const en = (x.name_en || "").toLowerCase();
    const fr = (x.name_fr || "").toLowerCase();
    return nameMatchers(en, fr);
  });
  if (k) {
    const v = num(k.value);
    if (v !== null) return { value: v, unit: k.unit };
  }
  return null;
}

function naResult(
  base: {
    id: string;
    name: string;
    category: SuperKpi["category"];
    formula: string;
    benchmark: string;
    inputs: string[];
  },
  locale: Locale,
): SuperKpi {
  return {
    ...base,
    value: null,
    display: "N/A",
    tier: "na",
    color: TIER_COLOR.na,
    tierLabel: pickLoc(TIER_LABEL.na, locale),
    gaugePct: 0,
    interpretation: tr("na_data", locale),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 1 — RESTAURANT SAME-STORE SALES GROWTH (SSSG)
 *  ═══════════════════════════════════════════════════════════════════════ */
export function restaurantSssg(c: Company, locale: Locale = "en"): SuperKpi {
  const sssg = findRestaurantKpi(
    c,
    [
      "Same-Store Sales",
      "Comparable Sales",
      "SSSG",
      "US SSSG",
      "Comp Sales",
      "Taco Bell US SSSG",
      "Same Store Sales",
      "Same-Store Sales Growth",
      "Comparable Sales Growth",
      "Comp Store Sales",
      "SSS",
    ],
    (en, fr) =>
      en === "same-store sales" ||
      en === "same store sales" ||
      en === "same-store sales growth" ||
      en === "same store sales growth" ||
      en === "comparable sales" ||
      en === "comparable sales growth" ||
      en === "comp sales" ||
      en === "comp sales growth" ||
      en === "comp store sales" ||
      en === "sssg" ||
      en === "us sssg" ||
      en === "sss" ||
      en === "taco bell us sssg" ||
      fr === "ventes à magasins comparables" ||
      fr === "ventes a magasins comparables" ||
      fr === "ventes comparables" ||
      fr === "croissance des ventes comparables" ||
      fr === "croissance ventes comparables" ||
      fr === "croissance à magasins comparables",
  );

  if (!sssg) {
    return naResult(
      {
        id: "restaurant-sssg",
        name: tr("name_sssg_na", locale),
        category: "Croissance",
        formula: tr("sssg_formula_na", locale),
        benchmark: tr("sssg_benchmark_na", locale),
        inputs: ["Same-Store Sales / Comparable Sales growth"],
      },
      locale,
    );
  }

  const growthPct = sssg.value;
  const tier: SuperKpiTier =
    growthPct >= 6 ? "premium" : growthPct >= 3 ? "solid" : growthPct >= 0 ? "average" : "below";
  // Jauge centrée : map [-10 %, +15 %] → [0, 100].
  const gauge = Math.max(0, Math.min(100, ((growthPct + 10) / 25) * 100));

  const sign = growthPct >= 0 ? "+" : "";

  const interp =
    growthPct >= 6 ? tr("sssg_interp_top", locale)
    : growthPct >= 3 ? tr("sssg_interp_mid", locale)
    : growthPct >= 0 ? tr("sssg_interp_avg", locale)
    : tr("sssg_interp_low", locale);

  return {
    id: "restaurant-sssg",
    name: tr("name_sssg", locale),
    category: "Croissance",
    value: growthPct,
    display: `${sign}${fmt(growthPct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("sssg_input_value", locale)} ${sign}${fmt(growthPct, 1)} %`,
    ],
    formula: tr("sssg_formula", locale),
    benchmark: tr("sssg_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — UNIT GROWTH QUALITY (Net new restaurants / existing fleet)
 *  ═══════════════════════════════════════════════════════════════════════ */
export function unitGrowthQuality(c: Company, locale: Locale = "en"): SuperKpi {
  const netNew = findRestaurantKpi(
    c,
    [
      "Net New Restaurants",
      "Net New Units",
      "Net New Stores",
      "Net Unit Growth",
      "Net New Openings",
    ],
    (en, fr) =>
      en === "net new restaurants" ||
      en === "net new units" ||
      en === "net new stores" ||
      en === "net unit growth" ||
      en === "net new openings" ||
      en === "net new restaurant openings" ||
      fr === "nouveaux restaurants nets" ||
      fr === "ouvertures nettes" ||
      fr === "ouvertures nettes de restaurants" ||
      fr === "unités nettes ajoutées" ||
      fr === "croissance nette du parc",
  );

  const base = findRestaurantKpi(
    c,
    [
      "Number of Restaurants",
      "Restaurant Count",
      "System Locations",
      "Total Restaurants",
      "Total Locations",
      "Total Units",
      "System Restaurants",
      "Store Count",
    ],
    (en, fr) =>
      en === "number of restaurants" ||
      en === "restaurant count" ||
      en === "system locations" ||
      en === "total restaurants" ||
      en === "total locations" ||
      en === "total units" ||
      en === "system restaurants" ||
      en === "store count" ||
      fr === "nombre de restaurants" ||
      fr === "parc de restaurants" ||
      fr === "parc total" ||
      fr === "nombre de points de vente" ||
      fr === "nombre d'unités" ||
      fr === "nombre d'établissements",
  );

  if (!netNew || !base || base.value <= 0) {
    return naResult(
      {
        id: "unit-growth-quality",
        name: tr("name_unit_growth_na", locale),
        category: "Stratégie",
        formula: tr("unit_growth_formula_na", locale),
        benchmark: tr("unit_growth_benchmark_na", locale),
        inputs: ["Net New Restaurants", "Number of Restaurants"],
      },
      locale,
    );
  }

  // Convention : base = parc pré-existant, donc on retire les ouvertures nettes
  // de la valeur courante pour reconstituer le dénominateur "début de période".
  const preBase = base.value - netNew.value;
  const denom = preBase > 0 ? preBase : base.value;
  const growthPct = (netNew.value / denom) * 100;

  const tier: SuperKpiTier =
    growthPct >= 6 ? "premium" : growthPct >= 4 ? "solid" : growthPct >= 2 ? "average" : "below";
  // Jauge [0, 10 %] → [0, 100].
  const gauge = Math.max(0, Math.min(100, (growthPct / 10) * 100));

  const sign = growthPct >= 0 ? "+" : "";

  const interp =
    growthPct >= 6 ? tr("unit_growth_interp_top", locale)
    : growthPct >= 4 ? tr("unit_growth_interp_mid", locale)
    : growthPct >= 2 ? tr("unit_growth_interp_avg", locale)
    : tr("unit_growth_interp_low", locale);

  return {
    id: "unit-growth-quality",
    name: tr("name_unit_growth", locale),
    category: "Stratégie",
    value: growthPct,
    display: `${sign}${fmt(growthPct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("unit_growth_input_net", locale)} ${sign}${fmt(netNew.value, 0)}`,
      `${tr("unit_growth_input_base", locale)} ${fmt(denom, 0)}`,
    ],
    formula: tr("unit_growth_formula", locale),
    benchmark: tr("unit_growth_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 *  ═══════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [restaurantSssg, unitGrowthQuality];
