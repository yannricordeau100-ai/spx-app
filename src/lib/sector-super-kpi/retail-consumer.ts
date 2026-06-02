/**
 * Super-KPIs sector-specific — RETAIL-CONSUMER (V1.9.5)
 *
 * 2 super-KPIs calibrés sur le business model retail / consumer :
 *   1. sameStoreSalesGrowth : croissance des ventes à magasins comparables
 *      (SSS / Comp Sales), indicateur clé de la santé organique du retailer
 *      hors expansion réseau.
 *   2. inventoryTurns       : rotation des stocks (COGS / Inventory), mesure
 *      d'efficacité opérationnelle critique en distribution.
 *
 * Univers cible : 27 stés retail (WMT, TGT, COST, HD, LOW, AMZN, ULTA, TJX,
 * KR, DG, DLTR, ROST, BURL, BBY, ORLY, AZO, BJ, CHWY, CVNA, DKS, WSM, SBUX,
 * SPG, GDDY, AD.AS, LI.PA, 9988.HK).
 *
 * i18n : EN + FR obligatoires (règle Yann 17 mai 2026 : EN = canonical).
 * Anti-em-dash dans rationale FR. Vocabulaire FR strict (stés, pas
 * "sociétés cotées", etc.).
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
  // ── sameStoreSalesGrowth ──────────────────────────────────────────
  name_sss_growth: {
    en: "Same-store sales growth",
    fr: "Croissance des ventes à magasins comparables",
  },
  name_sss_growth_na: {
    en: "Same-store sales growth (N/A)",
    fr: "Croissance des ventes comparables (N/A)",
  },
  sss_growth_formula: {
    en: "Same-store / comparable sales growth (year-over-year)",
    fr: "Croissance des ventes à magasins comparables (variation annuelle)",
  },
  sss_growth_formula_na: {
    en: "Year-over-year growth of sales for stores open at least 12 months",
    fr: "Croissance annuelle des ventes pour les magasins ouverts depuis au moins 12 mois",
  },
  sss_growth_benchmark: {
    en: "≥ 6 % premium · 3-6 % solid · 0-3 % average · < 0 % below",
    fr: "≥ 6 % premium · 3 à 6 % solide · 0 à 3 % moyen · < 0 % en deçà",
  },
  sss_growth_benchmark_na: {
    en: "Premium ≥ 6 % year-over-year",
    fr: "Premium si croissance annuelle ≥ 6 %",
  },
  sss_growth_interp_top: {
    en: "Strong same-store sales growth. The retailer captures share organically without relying on new store openings, sign of brand momentum and pricing power.",
    fr: "Croissance forte des ventes comparables. La sté capte des parts organiquement sans s'appuyer sur l'expansion réseau, signe de momentum de marque et de pricing power.",
  },
  sss_growth_interp_mid: {
    en: "Solid same-store sales growth in line with retail sector standards. Stable underlying demand, traffic and ticket holding up.",
    fr: "Croissance solide des ventes comparables en ligne avec les standards du retail. Demande sous-jacente stable, trafic et panier qui tiennent.",
  },
  sss_growth_interp_avg: {
    en: "Flat to low same-store sales growth. The retailer struggles to grow organically. To watch: traffic erosion, share loss to online or value competitors.",
    fr: "Croissance des ventes comparables faible ou stable. La sté peine à croître organiquement. À surveiller : érosion du trafic, perte de parts au profit du online ou des enseignes value.",
  },
  sss_growth_interp_low: {
    en: "Same-store sales contracting. Structural concern: store productivity drops, the network needs reshaping or the format is losing relevance.",
    fr: "Ventes comparables en contraction. Préoccupation structurelle : productivité par magasin qui chute, le réseau doit être repensé ou le format perd en pertinence.",
  },
  sss_growth_input_value: {
    en: "SSS growth",
    fr: "Croissance SSS",
  },

  // ── inventoryTurns ────────────────────────────────────────────────
  name_inv_turns: {
    en: "Inventory turns",
    fr: "Rotation des stocks",
  },
  name_inv_turns_na: {
    en: "Inventory turns (N/A)",
    fr: "Rotation des stocks (N/A)",
  },
  inv_turns_formula: {
    en: "COGS / Inventory (times per year)",
    fr: "COGS / Stocks (fois par an)",
  },
  inv_turns_formula_na: {
    en: "Cost of Goods Sold divided by Inventory, measures how many times inventory is sold and replaced per year",
    fr: "Coût des marchandises vendues divisé par les stocks, mesure combien de fois les stocks sont vendus et reconstitués par an",
  },
  inv_turns_benchmark: {
    en: "≥ 10× premium · 6-10× solid · 4-6× average · < 4× below",
    fr: "≥ 10× premium · 6 à 10× solide · 4 à 6× moyen · < 4× en deçà",
  },
  inv_turns_benchmark_na: {
    en: "Premium ≥ 10 turns per year",
    fr: "Premium si ≥ 10 rotations par an",
  },
  inv_turns_interp_top: {
    en: "Very high inventory rotation. The retailer operates a tight supply chain, minimizing working capital tied up in stock and markdown risk. Hallmark of best-in-class operators (COST, WMT food).",
    fr: "Rotation des stocks très élevée. La sté opère une supply chain tendue, minimisant le BFR immobilisé en stock et le risque de démarque. Signature des meilleurs opérateurs (COST, WMT alimentaire).",
  },
  inv_turns_interp_mid: {
    en: "Solid inventory rotation in line with quality retail. Inventory management is under control, working capital intensity is reasonable.",
    fr: "Rotation des stocks solide en ligne avec le retail de qualité. La gestion des stocks est sous contrôle, l'intensité en BFR reste raisonnable.",
  },
  inv_turns_interp_avg: {
    en: "Average inventory rotation. Inventory management is acceptable but leaves room for improvement on working capital and obsolescence risk.",
    fr: "Rotation des stocks moyenne. La gestion des stocks est acceptable mais laisse de la marge sur le BFR et le risque d'obsolescence.",
  },
  inv_turns_interp_low: {
    en: "Slow inventory rotation. Risk of stale stock, markdown pressure and working capital weighing on cash flow. To watch: aging inventory, gross margin compression linked to clearance.",
    fr: "Rotation des stocks lente. Risque de stock dormant, pression de démarque et BFR qui pèse sur le cash flow. À surveiller : vieillissement des stocks, compression de la marge brute liée aux soldes.",
  },
  inv_turns_input_cogs: {
    en: "COGS",
    fr: "COGS",
  },
  inv_turns_input_inv: {
    en: "Inventory",
    fr: "Stocks",
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
function findRetailKpi(
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
 *  Super-KPI 1 — SAME-STORE SALES GROWTH
 *  ═══════════════════════════════════════════════════════════════════════ */
export function sameStoreSalesGrowth(c: Company, locale: Locale = "en"): SuperKpi {
  const sss = findRetailKpi(
    c,
    [
      "Same-Store Sales",
      "Comp Sales",
      "Comparable Sales",
      "SSSG",
      "Comp Store Sales",
      "SSS",
      "Same Store Sales",
      "Same-Store Sales Growth",
      "Comparable Store Sales",
      "Comp Sales Growth",
    ],
    (en, fr) =>
      en === "same-store sales" ||
      en === "same store sales" ||
      en === "same-store sales growth" ||
      en === "same store sales growth" ||
      en === "comp sales" ||
      en === "comp sales growth" ||
      en === "comparable sales" ||
      en === "comparable sales growth" ||
      en === "comparable store sales" ||
      en === "comp store sales" ||
      en === "sssg" ||
      en === "sss" ||
      fr === "ventes à magasins comparables" ||
      fr === "ventes a magasins comparables" ||
      fr === "ventes comparables" ||
      fr === "croissance des ventes comparables" ||
      fr === "croissance ventes comparables" ||
      fr === "croissance à magasins comparables",
  );

  if (!sss) {
    return naResult(
      {
        id: "sss-growth",
        name: tr("name_sss_growth_na", locale),
        category: "Croissance",
        formula: tr("sss_growth_formula_na", locale),
        benchmark: tr("sss_growth_benchmark_na", locale),
        inputs: ["Same-Store Sales / Comp Sales growth"],
      },
      locale,
    );
  }

  const growthPct = sss.value;
  const tier: SuperKpiTier =
    growthPct >= 6 ? "premium" : growthPct >= 3 ? "solid" : growthPct >= 0 ? "average" : "below";
  // Jauge centrée : map [-10 %, +15 %] → [0, 100].
  const gauge = Math.max(0, Math.min(100, ((growthPct + 10) / 25) * 100));

  const sign = growthPct >= 0 ? "+" : "";

  const interp =
    growthPct >= 6 ? tr("sss_growth_interp_top", locale)
    : growthPct >= 3 ? tr("sss_growth_interp_mid", locale)
    : growthPct >= 0 ? tr("sss_growth_interp_avg", locale)
    : tr("sss_growth_interp_low", locale);

  return {
    id: "sss-growth",
    name: tr("name_sss_growth", locale),
    category: "Croissance",
    value: growthPct,
    display: `${sign}${fmt(growthPct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("sss_growth_input_value", locale)} ${sign}${fmt(growthPct, 1)} %`,
    ],
    formula: tr("sss_growth_formula", locale),
    benchmark: tr("sss_growth_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — INVENTORY TURNS
 *  ═══════════════════════════════════════════════════════════════════════ */
export function inventoryTurns(c: Company, locale: Locale = "en"): SuperKpi {
  const cogs = findRetailKpi(
    c,
    [
      "COGS",
      "Cost of Goods Sold",
      "Cost of Sales",
      "Cost of Revenue",
    ],
    (en, fr) =>
      en === "cogs" ||
      en === "cost of goods sold" ||
      en === "cost of sales" ||
      en === "cost of revenue" ||
      fr === "cogs" ||
      fr === "coût des marchandises vendues" ||
      fr === "cout des marchandises vendues" ||
      fr === "coût des ventes" ||
      fr === "cout des ventes",
  );

  const inv = findRetailKpi(
    c,
    [
      "Inventory",
      "Inventories",
      "Total Inventory",
      "Net Inventory",
    ],
    (en, fr) =>
      en === "inventory" ||
      en === "inventories" ||
      en === "total inventory" ||
      en === "net inventory" ||
      fr === "stocks" ||
      fr === "stock" ||
      fr === "stocks totaux" ||
      fr === "inventaire",
  );

  if (!cogs || !inv || inv.value <= 0) {
    return naResult(
      {
        id: "inv-turns",
        name: tr("name_inv_turns_na", locale),
        category: "Profitabilité",
        formula: tr("inv_turns_formula_na", locale),
        benchmark: tr("inv_turns_benchmark_na", locale),
        inputs: ["COGS", "Inventory"],
      },
      locale,
    );
  }

  const turns = cogs.value / inv.value;
  const tier: SuperKpiTier =
    turns >= 10 ? "premium" : turns >= 6 ? "solid" : turns >= 4 ? "average" : "below";
  // Jauge [0, 15×] → [0, 100].
  const gauge = Math.max(0, Math.min(100, (turns / 15) * 100));

  const turnsLabel = locale.startsWith("fr") ? "×/an" : "×/yr";

  const interp =
    turns >= 10 ? tr("inv_turns_interp_top", locale)
    : turns >= 6 ? tr("inv_turns_interp_mid", locale)
    : turns >= 4 ? tr("inv_turns_interp_avg", locale)
    : tr("inv_turns_interp_low", locale);

  const cogsUnit = cogs.unit ? ` ${cogs.unit}` : "";
  const invUnit = inv.unit ? ` ${inv.unit}` : "";

  return {
    id: "inv-turns",
    name: tr("name_inv_turns", locale),
    category: "Profitabilité",
    value: turns,
    display: `${fmt(turns, 1)} ${turnsLabel}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("inv_turns_input_cogs", locale)} ${fmt(cogs.value, 1)}${cogsUnit}`,
      `${tr("inv_turns_input_inv", locale)} ${fmt(inv.value, 1)}${invUnit}`,
    ],
    formula: tr("inv_turns_formula", locale),
    benchmark: tr("inv_turns_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 *  ═══════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [sameStoreSalesGrowth, inventoryTurns];
