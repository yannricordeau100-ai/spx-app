/**
 * Super-KPIs sector-specific — MINING-METALS (V1.9.5)
 *
 * 2 super-KPIs calibrés sur le business model mining + metals :
 *   1. aisCostPosition    : All-In Sustaining Cost, positionnement dans
 *                           la courbe de coûts du métal extrait (or, cuivre,
 *                           autres). Plus le coût est bas, mieux la sté
 *                           résiste aux cycles de prix.
 *   2. productionGrowth   : croissance annuelle de la production du volume
 *                           principal (or, cuivre, fer, autres) sur 5 ans.
 *
 * Univers cible : 26 stés Mining + Metals (BHP, RIO, GLEN.L, NEM, FCX,
 * NHY.OL, FRES.L, NUE, STLD, MLM, VMC, et autres chemicals/materials liés).
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
  // ── aisCostPosition ────────────────────────────────────────────────
  name_aisc: {
    en: "All-In Sustaining Cost position",
    fr: "Positionnement All-In Sustaining Cost",
  },
  name_aisc_na: {
    en: "AISC cost position (N/A)",
    fr: "Positionnement AISC (N/A)",
  },
  aisc_formula: {
    en: "All-In Sustaining Cost per unit produced (oz / lb / tonne)",
    fr: "All-In Sustaining Cost par unité produite (oz / lb / tonne)",
  },
  aisc_formula_na: {
    en: "All-In Sustaining Cost is the cash cost of extraction plus sustaining capex, per unit",
    fr: "All-In Sustaining Cost est le cash cost d'extraction plus le capex de maintenance, par unité",
  },
  aisc_benchmark_gold: {
    en: "< $1100/oz premium · 1100-1300 solid · 1300-1500 average · ≥ 1500 below",
    fr: "< $1100/oz premium · 1100 à 1300 solide · 1300 à 1500 moyen · ≥ 1500 en deçà",
  },
  aisc_benchmark_copper: {
    en: "< $2/lb premium · 2-2.5 solid · 2.5-3 average · ≥ 3 below",
    fr: "< $2/lb premium · 2 à 2,5 solide · 2,5 à 3 moyen · ≥ 3 en deçà",
  },
  aisc_benchmark_other: {
    en: "Lower quartile of industry cost curve = premium",
    fr: "Quartile bas de la courbe de coûts sectorielle = premium",
  },
  aisc_benchmark_na: {
    en: "Premium = bottom quartile of the metal cost curve",
    fr: "Premium si quartile bas de la courbe de coûts du métal",
  },
  aisc_interp_top: {
    en: "Best-in-class cost position. The company sits in the bottom quartile of the industry cost curve, capable of generating cash even at depressed commodity prices. Structural moat in a cyclical business.",
    fr: "Positionnement de coût best-in-class. La sté est dans le quartile bas de la courbe de coûts sectorielle, capable de générer du cash même à prix de matière déprimés. Avantage structurel dans un business cyclique.",
  },
  aisc_interp_mid: {
    en: "Solid cost position, around the industry average. Generates cash through the cycle but margin compression hits faster when commodity prices fall.",
    fr: "Positionnement de coût solide, autour de la moyenne sectorielle. Génère du cash sur le cycle mais la compression de marge arrive plus vite quand les prix de matière baissent.",
  },
  aisc_interp_low: {
    en: "Cost position above the industry average. Vulnerable to price downturns: at trough prices, this asset base risks turning cash-negative. To watch on the next cycle.",
    fr: "Positionnement de coût au-dessus de la moyenne sectorielle. Vulnérable aux baisses de prix : sur creux de cycle, ce parc d'actifs risque de passer cash-negative. À surveiller sur le prochain cycle.",
  },
  aisc_input_aisc: {
    en: "AISC",
    fr: "AISC",
  },
  aisc_input_metal: {
    en: "Metal",
    fr: "Métal",
  },

  // ── productionGrowth ───────────────────────────────────────────────
  name_prod_growth: {
    en: "Production growth (5y CAGR)",
    fr: "Croissance production (CAGR 5 ans)",
  },
  name_prod_growth_na: {
    en: "Production growth (N/A)",
    fr: "Croissance production (N/A)",
  },
  prod_growth_formula: {
    en: "5-year CAGR of main volume production (gold oz / copper lb / iron ore Mt / other)",
    fr: "CAGR 5 ans du volume de production principal (or oz / cuivre lb / fer Mt / autre)",
  },
  prod_growth_formula_na: {
    en: "5-year compound annual growth rate of the main extracted volume",
    fr: "Taux de croissance annuel composé sur 5 ans du volume principal extrait",
  },
  prod_growth_benchmark: {
    en: "≥ 8 %/y premium · 4-8 %/y solid · 0-4 %/y average · < 0 %/y below",
    fr: "≥ 8 %/an premium · 4 à 8 %/an solide · 0 à 4 %/an moyen · < 0 %/an en deçà",
  },
  prod_growth_benchmark_na: {
    en: "Premium ≥ 8 %/y volume CAGR",
    fr: "Premium si CAGR volume ≥ 8 %/an",
  },
  prod_growth_interp_top: {
    en: "Strong production growth. The company grows its main volume well above the industry average, sign of successful project pipeline execution and reserve replacement. Embedded operating leverage if commodity prices stay supportive.",
    fr: "Forte croissance de production. La sté fait croître son volume principal nettement au-dessus de la moyenne sectorielle, signe d'une bonne exécution du pipeline de projets et du remplacement des réserves. Levier opérationnel embarqué si les prix de matière restent porteurs.",
  },
  prod_growth_interp_mid: {
    en: "Solid production growth, broadly in line with the industry. The reserve base is maintained without aggressive expansion. Standard organic profile.",
    fr: "Croissance de production solide, globalement en ligne avec le secteur. La base de réserves est maintenue sans expansion agressive. Profil organique standard.",
  },
  prod_growth_interp_low: {
    en: "Production flat or declining over 5 years. Either the asset base is depleting faster than reserve replacement, or growth capex has been cut. To watch: future volumes depend on the project pipeline and new permitting.",
    fr: "Production stable ou en baisse sur 5 ans. Soit la base d'actifs s'épuise plus vite que le remplacement des réserves, soit le capex de croissance a été coupé. À surveiller : les volumes futurs dépendent du pipeline de projets et des nouveaux permis.",
  },
  prod_growth_input_recent: {
    en: "Recent volume",
    fr: "Volume récent",
  },
  prod_growth_input_5y: {
    en: "Volume 5y ago",
    fr: "Volume il y a 5 ans",
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

/** Format integer with thousands separator (FR style). */
function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");
}

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
 *  Super-KPI 1 — ALL-IN SUSTAINING COST POSITION
 *  ═══════════════════════════════════════════════════════════════════════ */
export function aisCostPosition(c: Company, locale: Locale = "en"): SuperKpi {
  const aisc = findKpi(
    c,
    [
      "AISC",
      "All-In Sustaining Cost",
      "All In Sustaining Cost",
      "AISC Gold",
      "AISC Copper",
      "AISC per oz",
      "AISC per lb",
      "AISC per tonne",
      "Cash Cost",
    ],
    (en, fr) =>
      en === "all-in sustaining cost" ||
      en === "all in sustaining cost" ||
      en === "aisc" ||
      en.includes("all-in sustaining") ||
      en.includes("all in sustaining") ||
      fr === "all-in sustaining cost" ||
      fr.includes("coût all-in sustaining") ||
      fr.includes("coût tout compris"),
  );

  if (!aisc) {
    return naResult(
      {
        id: "aisc-cost-position",
        name: tr("name_aisc_na", locale),
        category: "Profitabilité",
        formula: tr("aisc_formula_na", locale),
        benchmark: tr("aisc_benchmark_na", locale),
        inputs: ["AISC", "Production volume"],
      },
      locale,
    );
  }

  // Détermination du métal via l'unité (et fallback nom KPI).
  const unit = (aisc.unit || "").toLowerCase();
  const en = (aisc.name_en || "").toLowerCase();
  const fr = (aisc.name_fr || "").toLowerCase();

  let metal: "gold" | "copper" | "other" = "other";
  let unitDisplay = "/tonne";
  let benchmarkKey: "aisc_benchmark_gold" | "aisc_benchmark_copper" | "aisc_benchmark_other" = "aisc_benchmark_other";
  let metalLabel = locale.startsWith("fr") ? "autre" : "other";

  if (unit.includes("/oz") || unit.includes("oz") || en.includes("gold") || fr.includes("or")) {
    metal = "gold";
    unitDisplay = "/oz";
    benchmarkKey = "aisc_benchmark_gold";
    metalLabel = locale.startsWith("fr") ? "or" : "gold";
  } else if (unit.includes("/lb") || unit.includes("lb") || en.includes("copper") || fr.includes("cuivre")) {
    metal = "copper";
    unitDisplay = "/lb";
    benchmarkKey = "aisc_benchmark_copper";
    metalLabel = locale.startsWith("fr") ? "cuivre" : "copper";
  } else if (unit.includes("/t") || unit.includes("/tonne") || unit.includes("/ton") || unit.includes("tonne")) {
    metal = "other";
    unitDisplay = "/tonne";
  }

  // Calcul tier selon métal.
  let tier: SuperKpiTier;
  if (metal === "gold") {
    tier =
      aisc.value < 1100 ? "premium"
      : aisc.value < 1300 ? "solid"
      : aisc.value < 1500 ? "average"
      : "below";
  } else if (metal === "copper") {
    tier =
      aisc.value < 2 ? "premium"
      : aisc.value < 2.5 ? "solid"
      : aisc.value < 3 ? "average"
      : "below";
  } else {
    // Other: pas de seuil universel chiffrable. Tier average par défaut
    // (pas premium pour ne pas tromper, pas below pour ne pas pénaliser).
    tier = "average";
  }

  // Jauge : plus le coût est bas, plus la jauge est haute.
  // Mapping selon métal :
  //   gold   : [800, 1700]  → [100, 0]
  //   copper : [1.5, 3.5]   → [100, 0]
  //   other  : neutre 50
  let gauge: number;
  if (metal === "gold") {
    gauge = Math.max(0, Math.min(100, ((1700 - aisc.value) / 900) * 100));
  } else if (metal === "copper") {
    gauge = Math.max(0, Math.min(100, ((3.5 - aisc.value) / 2) * 100));
  } else {
    gauge = 50;
  }

  const interp =
    tier === "premium" ? tr("aisc_interp_top", locale)
    : tier === "solid" || tier === "average" ? tr("aisc_interp_mid", locale)
    : tr("aisc_interp_low", locale);

  // Display : $X/oz, $X/lb, $X/tonne. Décimales adaptées au métal.
  const decimals = metal === "copper" ? 2 : 0;
  const valueStr = metal === "copper" ? fmt(aisc.value, decimals) : fmtInt(aisc.value);
  const display = `$${valueStr} ${unitDisplay}`;

  return {
    id: "aisc-cost-position",
    name: tr("name_aisc", locale),
    category: "Profitabilité",
    value: aisc.value,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("aisc_input_aisc", locale)} $${valueStr} ${unitDisplay}`,
      `${tr("aisc_input_metal", locale)} ${metalLabel}`,
    ],
    formula: tr("aisc_formula", locale),
    benchmark: tr(benchmarkKey, locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — PRODUCTION GROWTH (5y CAGR)
 *  ═══════════════════════════════════════════════════════════════════════ */
export function productionGrowth(c: Company, locale: Locale = "en"): SuperKpi {
  const prod = findKpi(
    c,
    [
      "Iron Ore Production",
      "Gold Production",
      "Copper Production",
      "Aluminium Production",
      "Aluminum Production",
      "Steel Production",
      "Steel Shipments",
      "Nickel Production",
      "Zinc Production",
      "Silver Production",
      "Production",
      "Total Production",
      "Volume",
      "Volumes",
    ],
    (en, fr) =>
      en.includes("production") ||
      en.includes("shipments") ||
      en.includes("volume") ||
      fr.includes("production") ||
      fr.includes("volume") ||
      fr.includes("livraisons"),
  );

  if (!prod || prod.history.length < 5) {
    return naResult(
      {
        id: "production-growth",
        name: tr("name_prod_growth_na", locale),
        category: "Croissance",
        formula: tr("prod_growth_formula_na", locale),
        benchmark: tr("prod_growth_benchmark_na", locale),
        inputs: ["Production volume", "5y history"],
      },
      locale,
    );
  }

  // CAGR 5 ans : history[-1] vs history[-5]. Si plus de 5 points,
  // on prend les 5 derniers.
  const last5 = prod.history.slice(-5);
  const start = last5[0];
  const end = last5[last5.length - 1];

  if (start === null || end === null || start <= 0 || end <= 0) {
    return naResult(
      {
        id: "production-growth",
        name: tr("name_prod_growth_na", locale),
        category: "Croissance",
        formula: tr("prod_growth_formula_na", locale),
        benchmark: tr("prod_growth_benchmark_na", locale),
        inputs: ["Production volume", "5y history"],
      },
      locale,
    );
  }

  const years = last5.length - 1; // 4 années écoulées entre les 5 points
  const cagrPct = (Math.pow(end / start, 1 / years) - 1) * 100;

  const tier: SuperKpiTier =
    cagrPct >= 8 ? "premium"
    : cagrPct >= 4 ? "solid"
    : cagrPct >= 0 ? "average"
    : "below";

  // Jauge centrée [-5%, +15%] → [0, 100].
  const gauge = Math.max(0, Math.min(100, ((cagrPct + 5) / 20) * 100));

  const sign = cagrPct >= 0 ? "+" : "";
  const perYearLabel = locale.startsWith("fr") ? "%/an" : "%/y";

  const interp =
    cagrPct >= 8 ? tr("prod_growth_interp_top", locale)
    : cagrPct >= 0 ? tr("prod_growth_interp_mid", locale)
    : tr("prod_growth_interp_low", locale);

  return {
    id: "production-growth",
    name: tr("name_prod_growth", locale),
    category: "Croissance",
    value: cagrPct,
    display: `${sign}${fmt(cagrPct, 1)} ${perYearLabel}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("prod_growth_input_recent", locale)} ${fmt(end, 2)}`,
      `${tr("prod_growth_input_5y", locale)} ${fmt(start, 2)}`,
    ],
    formula: tr("prod_growth_formula", locale),
    benchmark: tr("prod_growth_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 *  ═══════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [aisCostPosition, productionGrowth];
