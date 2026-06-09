/**
 * Super-KPIs sector-specific — CHEMICALS (V1.9.5)
 *
 * 2 super-KPIs calibrés sur le business model chemicals :
 *   1. specialtyMixGrowth      : part des spécialités sur revenu total, vs
 *                                commodités cycliques. Plus le mix
 *                                spécialités est élevé, plus la marge est
 *                                résiliente sur le cycle.
 *   2. ebitdaResilienceCycle   : résilience EBITDA sur 5 ans mesurée par
 *                                le coefficient de variation (stddev/mean).
 *                                Plus le CoV est bas, plus l'EBITDA est
 *                                stable à travers le cycle commodité.
 *
 * Univers cible : 8 stés Chemicals (DOW, LIN, DD, APD, ECL, SHW, FMC, MOS),
 * 2 stés direct (CTVA, LIN) + fallback subsector.
 *
 * i18n : EN + FR obligatoires (règle Yann 17 mai 2026 : EN = canonical).
 * Anti-em-dash dans rationale FR. Vocabulaire FR strict (stés, etc.).
 *
 * IMPORTANT : pas de commit, pas d'edit sur src/lib/super-kpi.ts. Le
 * caller intégrera lui-même les exports `SECTOR_KPIS` et `SECTOR_STRINGS`.
 */

import type { Company } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import type { SuperKpi, SuperKpiTier } from "@/lib/super-kpi";

/* ═══════════════════════════════════════════════════════════════════════
 *  i18n strings — EN canonical, FR traduction. Style anti-em-dash.
 *  ═══════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string };

export const SECTOR_STRINGS = {
  // ── specialtyMixGrowth ─────────────────────────────────────────────
  name_spec_mix: {
    en: "Specialty mix share",
    fr: "Part du mix spécialités",
  },
  name_spec_mix_na: {
    en: "Specialty mix share (N/A)",
    fr: "Part du mix spécialités (N/A)",
  },
  spec_mix_formula: {
    en: "Specialty revenue divided by total revenue",
    fr: "Revenu spécialités divisé par revenu total",
  },
  spec_mix_formula_na: {
    en: "Share of specialty revenue in total revenue, vs cyclical commodities",
    fr: "Part du revenu spécialités dans le revenu total, vs commodités cycliques",
  },
  spec_mix_benchmark: {
    en: "≥ 60 % premium · 40-60 % solid · 25-40 % average · < 25 % below",
    fr: "≥ 60 % premium · 40 à 60 % solide · 25 à 40 % moyen · < 25 % en deçà",
  },
  spec_mix_benchmark_na: {
    en: "Premium ≥ 60 % specialty share",
    fr: "Premium si part spécialités ≥ 60 %",
  },
  spec_mix_interp_top: {
    en: "Specialty-heavy mix. The company derives most of its revenue from value-added specialty chemicals, less exposed to commodity price cycles. Structurally higher and more stable margins through the cycle.",
    fr: "Mix orienté spécialités. La sté tire la majorité de son revenu de chimies de spécialité à valeur ajoutée, moins exposée aux cycles de prix commodité. Marges structurellement plus élevées et stables sur le cycle.",
  },
  spec_mix_interp_mid: {
    en: "Balanced mix between specialties and commodity chemicals. Margins benefit from the specialty share but remain partly exposed to commodity cycles. Standard portfolio profile.",
    fr: "Mix équilibré entre spécialités et chimies commodité. Les marges bénéficient de la part spécialités mais restent partiellement exposées aux cycles commodité. Profil de portefeuille standard.",
  },
  spec_mix_interp_low: {
    en: "Commodity-heavy mix. Revenue is dominated by cyclical commodity chemicals, exposed to spread volatility and trough pricing. To watch: margin compression on the next downcycle.",
    fr: "Mix orienté commodités. Le revenu est dominé par les chimies commodité cycliques, exposées à la volatilité des spreads et aux creux de prix. À surveiller : compression de marge sur le prochain bas de cycle.",
  },
  spec_mix_input_spec: {
    en: "Specialty revenue",
    fr: "Revenu spécialités",
  },
  spec_mix_input_total: {
    en: "Total revenue",
    fr: "Revenu total",
  },

  // ── ebitdaResilienceCycle ──────────────────────────────────────────
  name_ebitda_res: {
    en: "EBITDA resilience through cycle",
    fr: "Résilience EBITDA sur cycle",
  },
  name_ebitda_res_na: {
    en: "EBITDA resilience (N/A)",
    fr: "Résilience EBITDA (N/A)",
  },
  ebitda_res_formula: {
    en: "Coefficient of variation of EBITDA over 5 years (stddev / mean)",
    fr: "Coefficient de variation de l'EBITDA sur 5 ans (stddev / moyenne)",
  },
  ebitda_res_formula_na: {
    en: "Coefficient of variation of EBITDA over 5 years, lower is better",
    fr: "Coefficient de variation de l'EBITDA sur 5 ans, plus bas vaut mieux",
  },
  ebitda_res_benchmark: {
    en: "< 0.15 premium · 0.15-0.25 solid · 0.25-0.40 average · ≥ 0.40 below",
    fr: "< 0,15 premium · 0,15 à 0,25 solide · 0,25 à 0,40 moyen · ≥ 0,40 en deçà",
  },
  ebitda_res_benchmark_na: {
    en: "Premium if CoV < 0.15 over 5 years",
    fr: "Premium si CoV < 0,15 sur 5 ans",
  },
  ebitda_res_interp_top: {
    en: "Very resilient EBITDA. The company keeps an EBITDA stream remarkably stable across the chemicals cycle, sign of a defensive mix (specialties, contracted volumes, industrial gases). Strong through-cycle cash generation profile.",
    fr: "EBITDA très résilient. La sté maintient un flux d'EBITDA remarquablement stable à travers le cycle chimie, signe d'un mix défensif (spécialités, volumes contractés, gaz industriels). Profil de génération de cash through-cycle solide.",
  },
  ebitda_res_interp_mid: {
    en: "Standard EBITDA resilience for the chemicals sector. The cycle leaves a visible mark on profitability but the amplitude stays manageable. Typical portfolio profile.",
    fr: "Résilience EBITDA standard pour le secteur chimie. Le cycle laisse une empreinte visible sur la profitabilité mais l'amplitude reste gérable. Profil de portefeuille typique.",
  },
  ebitda_res_interp_low: {
    en: "Highly volatile EBITDA over the cycle. The asset base is exposed to commodity spreads with little structural buffer. Cash generation drops sharply at trough, leverage risks rising. To watch on the next downcycle.",
    fr: "EBITDA très volatil sur le cycle. La base d'actifs est exposée aux spreads commodité avec peu de coussin structurel. La génération de cash chute fortement en creux, levier à risque de monter. À surveiller sur le prochain bas de cycle.",
  },
  ebitda_res_input_cov: {
    en: "CoV",
    fr: "CoV",
  },
  ebitda_res_input_points: {
    en: "Points",
    fr: "Points",
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
    const n = parseFloat(v.replace(/,/g, ".").replace(/\s/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmt(n: number, decimals: number): string {
  return n.toFixed(decimals).replace(".", ",");
}

/**
 * Garde-fou part/mix en % (∈ [0, 100]). > 120 % = bug d'input → null (N/A).
 * 100-120 % = bruit d'arrondi → clamp à 100. Réservé aux PARTS d'un tout
 * (jamais aux croissances, CoV, ratios en ×).
 */
function clampSharePct(pct: number | null): number | null {
  if (pct === null || !Number.isFinite(pct) || pct < 0 || pct > 120) return null;
  return Math.min(100, pct);
}

/** Unité en valeur absolue (exclut les KPIs en %). */
const NON_PCT = (u: string) => (u || "").trim() !== "%";

type FoundKpi = { value: number; history: number[]; unit?: string; name_en?: string; name_fr?: string };

/** Cherche un KPI par liste de shorts candidats, ou par match name_en/name_fr. */
function findKpi(
  c: Company,
  shorts: string[],
  nameMatchers: (en: string, fr: string) => boolean,
  unitFilter?: (u: string) => boolean,
): FoundKpi | null {
  for (const s of shorts) {
    const k = c.kpis.find((x) => x.short === s);
    if (k) {
      if (unitFilter && !unitFilter(k.unit || "")) continue;
      const v = num(k.value);
      const hist = Array.isArray(k.history)
        ? k.history.filter((h): h is number => typeof h === "number" && Number.isFinite(h))
        : [];
      if (v !== null) return { value: v, history: hist, unit: k.unit, name_en: k.name_en, name_fr: k.name_fr };
    }
  }
  const k = c.kpis.find((x) => {
    if (unitFilter && !unitFilter(x.unit || "")) return false;
    const en = (x.name_en || "").toLowerCase();
    const fr = (x.name_fr || "").toLowerCase();
    return nameMatchers(en, fr);
  });
  if (k) {
    const v = num(k.value);
    const hist = Array.isArray(k.history)
      ? k.history.filter((h): h is number => typeof h === "number" && Number.isFinite(h))
      : [];
    if (v !== null) return { value: v, history: hist, unit: k.unit, name_en: k.name_en, name_fr: k.name_fr };
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
 *  Super-KPI 1 — SPECIALTY MIX SHARE
 *  ═══════════════════════════════════════════════════════════════════════ */
export function specialtyMixGrowth(c: Company, locale: Locale = "en"): SuperKpi {
  const spec = findKpi(
    c,
    [
      "Specialty Revenue",
      "Specialties",
      "Specialty Sales",
      "Specialty Chemicals Revenue",
      "Specialty Products Revenue",
    ],
    (en, fr) =>
      en.includes("specialty revenue") ||
      en.includes("specialties revenue") ||
      en === "specialties" ||
      en === "specialty sales" ||
      en.includes("specialty chemicals") ||
      en.includes("specialty products") ||
      fr.includes("revenu spécialités") ||
      fr.includes("revenu specialites") ||
      fr === "spécialités" ||
      fr === "specialites" ||
      fr.includes("ventes spécialités") ||
      fr.includes("chimies de spécialité"),
    NON_PCT, // un revenu spécialités est en valeur absolue, jamais en %
  );

  const total = findKpi(
    c,
    ["Revenue", "Total Revenue", "Net Sales", "Sales", "Net Revenue", "Total Sales"],
    (en, fr) =>
      en === "revenue" ||
      en === "total revenue" ||
      en === "net sales" ||
      en === "sales" ||
      en === "net revenue" ||
      en === "total sales" ||
      fr === "revenu" ||
      fr === "revenu total" ||
      fr === "ventes" ||
      fr === "ventes nettes" ||
      fr === "chiffre d'affaires",
    NON_PCT, // revenu total en valeur absolue (exclut "... as % Revenue")
  );

  if (!spec || !total || total.value <= 0) {
    return naResult(
      {
        id: "specialty-mix-growth",
        name: tr("name_spec_mix_na", locale),
        category: "Stratégie",
        formula: tr("spec_mix_formula_na", locale),
        benchmark: tr("spec_mix_benchmark_na", locale),
        inputs: ["Specialty Revenue", "Total Revenue"],
      },
      locale,
    );
  }

  // Garde-fou : la part spécialités / revenu total est ∈ [0, 100]. Specialty
  // et total doivent être sur la même période. > 120 % = bug d'input (mauvais
  // appariement numérateur/dénominateur, unités mélangées) → N/A honnête.
  const sharePctRaw = (spec.value / total.value) * 100;
  const sharePct = clampSharePct(sharePctRaw);

  if (sharePct === null) {
    return naResult(
      {
        id: "specialty-mix-growth",
        name: tr("name_spec_mix_na", locale),
        category: "Stratégie",
        formula: tr("spec_mix_formula_na", locale),
        benchmark: tr("spec_mix_benchmark_na", locale),
        inputs: ["Specialty Revenue", "Total Revenue"],
      },
      locale,
    );
  }

  const tier: SuperKpiTier =
    sharePct >= 60 ? "premium"
    : sharePct >= 40 ? "solid"
    : sharePct >= 25 ? "average"
    : "below";

  // Jauge : [0, 80] → [0, 100], capée à 100.
  const gauge = Math.max(0, Math.min(100, (sharePct / 80) * 100));

  const interp =
    tier === "premium" ? tr("spec_mix_interp_top", locale)
    : tier === "solid" || tier === "average" ? tr("spec_mix_interp_mid", locale)
    : tr("spec_mix_interp_low", locale);

  return {
    id: "specialty-mix-growth",
    name: tr("name_spec_mix", locale),
    category: "Stratégie",
    value: sharePct,
    display: `${fmt(sharePct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("spec_mix_input_spec", locale)} ${fmt(spec.value, 2)}`,
      `${tr("spec_mix_input_total", locale)} ${fmt(total.value, 2)}`,
    ],
    formula: tr("spec_mix_formula", locale),
    benchmark: tr("spec_mix_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — EBITDA RESILIENCE THROUGH CYCLE (5y CoV)
 *  ═══════════════════════════════════════════════════════════════════════ */
export function ebitdaResilienceCycle(c: Company, locale: Locale = "en"): SuperKpi {
  const ebitda = findKpi(
    c,
    ["EBITDA", "Adjusted EBITDA", "Adj EBITDA", "EBITDA Reported", "Operating EBITDA"],
    (en, fr) =>
      en === "ebitda" ||
      en === "adjusted ebitda" ||
      en === "adj ebitda" ||
      en === "operating ebitda" ||
      en.includes("ebitda") ||
      fr === "ebitda" ||
      fr === "ebitda ajusté" ||
      fr.includes("ebitda"),
  );

  if (!ebitda || ebitda.history.length < 5) {
    return naResult(
      {
        id: "ebitda-resilience-cycle",
        name: tr("name_ebitda_res_na", locale),
        category: "Risque",
        formula: tr("ebitda_res_formula_na", locale),
        benchmark: tr("ebitda_res_benchmark_na", locale),
        inputs: ["EBITDA", "5y history"],
      },
      locale,
    );
  }

  // CoV = stddev / |mean| sur 5 derniers points.
  const last5 = ebitda.history.slice(-5);
  const mean = last5.reduce((a, b) => a + b, 0) / last5.length;

  if (mean === 0 || !Number.isFinite(mean)) {
    return naResult(
      {
        id: "ebitda-resilience-cycle",
        name: tr("name_ebitda_res_na", locale),
        category: "Risque",
        formula: tr("ebitda_res_formula_na", locale),
        benchmark: tr("ebitda_res_benchmark_na", locale),
        inputs: ["EBITDA", "5y history"],
      },
      locale,
    );
  }

  const variance = last5.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / last5.length;
  const stddev = Math.sqrt(variance);
  const cov = stddev / Math.abs(mean);

  if (!Number.isFinite(cov)) {
    return naResult(
      {
        id: "ebitda-resilience-cycle",
        name: tr("name_ebitda_res_na", locale),
        category: "Risque",
        formula: tr("ebitda_res_formula_na", locale),
        benchmark: tr("ebitda_res_benchmark_na", locale),
        inputs: ["EBITDA", "5y history"],
      },
      locale,
    );
  }

  const tier: SuperKpiTier =
    cov < 0.15 ? "premium"
    : cov < 0.25 ? "solid"
    : cov < 0.40 ? "average"
    : "below";

  // Jauge : plus le CoV est bas, plus la jauge est haute.
  // Mapping [0, 0.60] → [100, 0].
  const gauge = Math.max(0, Math.min(100, ((0.60 - cov) / 0.60) * 100));

  const interp =
    tier === "premium" ? tr("ebitda_res_interp_top", locale)
    : tier === "solid" || tier === "average" ? tr("ebitda_res_interp_mid", locale)
    : tr("ebitda_res_interp_low", locale);

  return {
    id: "ebitda-resilience-cycle",
    name: tr("name_ebitda_res", locale),
    category: "Risque",
    value: cov,
    display: `CoV ${fmt(cov, 2)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("ebitda_res_input_cov", locale)} ${fmt(cov, 2)}`,
      `${tr("ebitda_res_input_points", locale)} ${last5.length}`,
    ],
    formula: tr("ebitda_res_formula", locale),
    benchmark: tr("ebitda_res_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 *  ═══════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [specialtyMixGrowth, ebitdaResilienceCycle];
