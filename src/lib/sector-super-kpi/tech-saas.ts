/**
 * Sector Super-KPIs — TECH-SAAS V1.9.5
 *
 * 3 super-KPIs sectoriels pour Tech SaaS / Software (CRM, ORCL, NOW, ADBE,
 * INTU, WDAY, SNOW, DDOG, 17 stés total) :
 *   1. netRevenueRetention : NRR (Croissance)
 *   2. arrGrowth           : croissance ARR YoY (Croissance)
 *   3. ruleOf50            : ARR Growth % + FCF Margin % (Composite)
 *
 * Convention identique à src/lib/super-kpi.ts :
 *   - Chaque fonction retourne un objet SuperKpi complet.
 *   - i18n via mini-dictionnaire SECTOR_STRINGS (EN + FR obligatoires).
 *   - Pas d'em-dash dans les narratives FR. Vocabulaire FR strict.
 *
 * Pas d'edit sur src/lib/super-kpi.ts. Le caller integrera lui-meme les
 * exports SECTOR_STRINGS et SECTOR_KPIS.
 */

import type { Company, KPI } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import type { SuperKpi, SuperKpiTier } from "@/lib/super-kpi";

/* ═════════════════════════════════════════════════════════════════════
 *  TIER label + color (cloné de super-kpi.ts pour autonomie module)
 * ═════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string };

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

/* ═════════════════════════════════════════════════════════════════════
 *  i18n strings sector-specific (EN + FR obligatoires)
 * ═════════════════════════════════════════════════════════════════════ */

export const SECTOR_STRINGS = {
  na_data: {
    en: "Required data not available for this SaaS company.",
    fr: "Données nécessaires non disponibles pour cette sté SaaS.",
  },

  // ── Net Revenue Retention ──────────────────────────────────────────
  nrr_name: {
    en: "Net Revenue Retention",
    fr: "Net Revenue Retention",
  },
  nrr_name_na: {
    en: "Net Revenue Retention (N/A)",
    fr: "Net Revenue Retention (N/A)",
  },
  nrr_formula: {
    en: "NRR % disclosed by the company",
    fr: "NRR % publié par la sté",
  },
  nrr_benchmark: {
    en: ">= 130 % premium · 115-130 % solid · 105-115 % average · < 105 % below",
    fr: ">= 130 % premium, 115 à 130 % solide, 105 à 115 % moyen, < 105 % faible",
  },
  nrr_interp_premium: {
    en: "Best-in-class expansion within the installed base. Each existing customer cohort grows materially year over year, a strong signal of pricing power and product stickiness.",
    fr: "Expansion best-in-class sur la base installée. Chaque cohorte client existante croît fortement d'une année sur l'autre, signal puissant de pricing power et de stickiness produit.",
  },
  nrr_interp_solid: {
    en: "Solid net retention. The installed base keeps expanding through upsell and cross-sell, offsetting any churn comfortably.",
    fr: "Net retention solide. La base installée continue à s'étendre via upsell et cross-sell, compensant largement le churn.",
  },
  nrr_interp_average: {
    en: "Average net retention. The base expansion barely covers churn. Upsell engine and product stickiness need to strengthen to keep growth durable.",
    fr: "Net retention moyenne. L'expansion de la base couvre tout juste le churn. Moteur d'upsell et stickiness produit à renforcer pour maintenir la croissance.",
  },
  nrr_interp_below: {
    en: "Net retention below standard. Churn outpaces expansion within the installed base, growth depends entirely on new logos. Structural risk on the SaaS model.",
    fr: "Net retention en deçà du standard. Le churn dépasse l'expansion sur la base installée, la croissance repose entièrement sur les new logos. Risque structurel sur le modèle SaaS.",
  },
  nrr_input_value: {
    en: "Disclosed NRR",
    fr: "NRR publié",
  },

  // ── ARR Growth ─────────────────────────────────────────────────────
  arr_name: {
    en: "ARR Growth YoY",
    fr: "Croissance ARR YoY",
  },
  arr_name_na: {
    en: "ARR Growth YoY (N/A)",
    fr: "Croissance ARR YoY (N/A)",
  },
  arr_formula: {
    en: "(ARR current / ARR year-ago) - 1",
    fr: "(ARR actuel / ARR un an plus tôt) - 1",
  },
  arr_benchmark: {
    en: ">= 30 % premium · 20-30 % solid · 10-20 % average · < 10 % below",
    fr: ">= 30 % premium, 20 à 30 % solide, 10 à 20 % moyen, < 10 % faible",
  },
  arr_interp_premium: {
    en: "Hyper-growth ARR trajectory. The company adds recurring revenue at a rate reserved for category leaders, often paired with land-and-expand motion and strong NRR.",
    fr: "Trajectoire ARR en hyper-croissance. La sté ajoute du revenu récurrent à un rythme réservé aux category leaders, souvent couplé à un motion land-and-expand et à une NRR élevée.",
  },
  arr_interp_solid: {
    en: "Solid ARR growth. The recurring base scales fast enough to justify a premium multiple while leaving room for margin expansion.",
    fr: "Croissance ARR solide. La base récurrente s'étend assez vite pour justifier un multiple premium tout en laissant de la marge pour l'expansion de marge.",
  },
  arr_interp_average: {
    en: "Average ARR growth. The company is past hyper-growth and enters the maturity phase where margin discipline matters more than topline acceleration.",
    fr: "Croissance ARR moyenne. La sté sort de l'hyper-croissance et entre dans la phase de maturité où la discipline de marge prime sur l'accélération du topline.",
  },
  arr_interp_below: {
    en: "ARR growth below standard. The recurring engine is decelerating, valuation multiples are likely to compress unless margin or capital return offsets emerge.",
    fr: "Croissance ARR en deçà du standard. Le moteur récurrent décélère, les multiples vont probablement se contracter sauf si la marge ou la redistribution prennent le relais.",
  },
  arr_input_current: {
    en: "ARR current",
    fr: "ARR actuel",
  },
  arr_input_prior: {
    en: "ARR year-ago",
    fr: "ARR un an plus tôt",
  },

  // ── Rule of 50 ─────────────────────────────────────────────────────
  r50_name: {
    en: "Rule of 50",
    fr: "Rule of 50",
  },
  r50_name_na: {
    en: "Rule of 50 (N/A)",
    fr: "Rule of 50 (N/A)",
  },
  r50_formula: {
    en: "ARR Growth (%) + FCF Margin (%)",
    fr: "Croissance ARR (%) + Marge FCF (%)",
  },
  r50_benchmark: {
    en: ">= 60 premium · 50-60 solid · 40-50 average · < 40 below",
    fr: ">= 60 premium, 50 à 60 solide, 40 à 50 moyen, < 40 faible",
  },
  r50_interp_premium: {
    en: "Best-in-class combination of growth and free cash flow. The company hits the SaaS holy grail: hyper-growth without burning cash, the most valued profile by software investors.",
    fr: "Combinaison best-in-class de croissance et de cash flow disponible. La sté coche le graal SaaS : hyper-croissance sans brûler de cash, le profil le plus valorisé par les investisseurs software.",
  },
  r50_interp_solid: {
    en: "Solid Rule of 50. Growth and free cash flow are well balanced, the company sustains a high multiple while staying self-financed.",
    fr: "Rule of 50 solide. Croissance et cash flow disponible sont bien équilibrés, la sté tient un multiple élevé tout en restant autofinancée.",
  },
  r50_interp_average: {
    en: "Average score. Either growth or cash flow has to lift to keep a premium multiple, the current combination is standard for the SaaS universe.",
    fr: "Note moyenne. Soit la croissance soit le cash flow doit progresser pour maintenir un multiple premium, la combinaison actuelle est standard sur l'univers SaaS.",
  },
  r50_interp_below: {
    en: "Score below standard. Growth and cash flow do not jointly hit the threshold sought by software investors. Either deceleration or sustained burn, multiple at risk.",
    fr: "Note en deçà du standard. Croissance et cash flow n'atteignent pas conjointement le seuil recherché par les investisseurs software. Soit décélération soit burn persistant, multiple à risque.",
  },
  r50_input_arr: {
    en: "ARR Growth",
    fr: "Croissance ARR",
  },
  r50_input_fcf: {
    en: "FCF Margin",
    fr: "Marge FCF",
  },
} as const satisfies Record<string, LocalizedString>;

function tr(key: keyof typeof SECTOR_STRINGS, locale: Locale): string {
  return pickLoc(SECTOR_STRINGS[key], locale);
}

/* ═════════════════════════════════════════════════════════════════════
 *  Helpers locaux
 * ═════════════════════════════════════════════════════════════════════ */

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, ".").replace(/[%\s+]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmt(n: number, decimals: number): string {
  return n.toFixed(decimals).replace(".", ",");
}

/** Cherche un KPI par liste de shorts ou name_en/name_fr (case-insensitive substring). */
function findKpiByNames(c: Company, candidates: string[]): KPI | undefined {
  if (!c.kpis || c.kpis.length === 0) return undefined;
  const lower = candidates.map((n) => n.toLowerCase());
  return c.kpis.find((k) => {
    const fields: string[] = [];
    if (typeof k.short === "string") fields.push(k.short.toLowerCase());
    if (typeof k.name_fr === "string") fields.push(k.name_fr.toLowerCase());
    const en = (k as KPI & { name_en?: string }).name_en;
    if (typeof en === "string") fields.push(en.toLowerCase());
    return fields.some((f) => lower.some((t) => f === t || f.includes(t)));
  });
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

/* ═════════════════════════════════════════════════════════════════════
 *  Super-KPI 1 — NET REVENUE RETENTION
 * ═════════════════════════════════════════════════════════════════════ */
export function netRevenueRetention(c: Company, locale: Locale = "en"): SuperKpi {
  const kpi = findKpiByNames(c, [
    "NRR",
    "NRR%",
    "Net Revenue Retention",
    "Net Revenue Retention Rate",
    "Dollar-Based Net Retention",
    "Dollar-Based Net Retention Rate",
    "DBNR",
    "Net Dollar Retention",
  ]);

  if (!kpi) {
    return naResult(
      {
        id: "nrr",
        name: tr("nrr_name_na", locale),
        category: "Croissance",
        formula: tr("nrr_formula", locale),
        benchmark: tr("nrr_benchmark", locale),
        inputs: ["NRR / Net Revenue Retention / DBNR"],
      },
      locale,
    );
  }

  const v = num(kpi.value);
  if (v === null) {
    return naResult(
      {
        id: "nrr",
        name: tr("nrr_name_na", locale),
        category: "Croissance",
        formula: tr("nrr_formula", locale),
        benchmark: tr("nrr_benchmark", locale),
        inputs: ["NRR / Net Revenue Retention / DBNR"],
      },
      locale,
    );
  }

  const tier: SuperKpiTier =
    v >= 130 ? "premium" : v >= 115 ? "solid" : v >= 105 ? "average" : "below";
  // Jauge : map [80, 150] → [0, 100]
  const gauge = Math.max(0, Math.min(100, ((v - 80) / 70) * 100));

  const interp =
    v >= 130 ? tr("nrr_interp_premium", locale)
    : v >= 115 ? tr("nrr_interp_solid", locale)
    : v >= 105 ? tr("nrr_interp_average", locale)
    : tr("nrr_interp_below", locale);

  return {
    id: "nrr",
    name: tr("nrr_name", locale),
    category: "Croissance",
    value: v,
    display: `${fmt(v, 0)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [`${tr("nrr_input_value", locale)} ${fmt(v, 0)} %`],
    formula: tr("nrr_formula", locale),
    benchmark: tr("nrr_benchmark", locale),
    interpretation: interp,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — ARR GROWTH (YoY %)
 * ═════════════════════════════════════════════════════════════════════ */

/**
 * Extrait croissance YoY de l'ARR.
 *
 * Stratégie :
 *   1. Si yoy parseable, on l'utilise tel quel.
 *   2. Sinon, on calcule depuis history (dernier / précédent - 1).
 */
function computeArrYoY(kpi: KPI): number | null {
  // Tentative parse yoy
  if (typeof kpi.yoy === "string" && kpi.yoy.length > 0) {
    const parsed = num(kpi.yoy);
    if (parsed !== null) return parsed;
  }
  if (typeof kpi.yoy === "number" && Number.isFinite(kpi.yoy)) {
    return kpi.yoy;
  }
  // Fallback history
  const hist = Array.isArray(kpi.history)
    ? kpi.history.filter((h): h is number => typeof h === "number" && Number.isFinite(h))
    : [];
  if (hist.length < 2) return null;
  const current = hist[hist.length - 1];
  const prior = hist[hist.length - 2];
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function arrGrowth(c: Company, locale: Locale = "en"): SuperKpi {
  const kpi = findKpiByNames(c, [
    "ARR",
    "Annual Recurring Revenue",
    "Annualized Recurring Revenue",
    "Annualized ARR",
    "Subscription ARR",
    "Cloud ARR",
  ]);

  if (!kpi) {
    return naResult(
      {
        id: "arr-growth",
        name: tr("arr_name_na", locale),
        category: "Croissance",
        formula: tr("arr_formula", locale),
        benchmark: tr("arr_benchmark", locale),
        inputs: ["ARR / Annual Recurring Revenue"],
      },
      locale,
    );
  }

  const yoy = computeArrYoY(kpi);
  if (yoy === null) {
    return naResult(
      {
        id: "arr-growth",
        name: tr("arr_name_na", locale),
        category: "Croissance",
        formula: tr("arr_formula", locale),
        benchmark: tr("arr_benchmark", locale),
        inputs: ["ARR (history >= 2 pts ou yoy disclosed)"],
      },
      locale,
    );
  }

  const tier: SuperKpiTier =
    yoy >= 30 ? "premium" : yoy >= 20 ? "solid" : yoy >= 10 ? "average" : "below";
  // Jauge : map [-10, 50] → [0, 100]
  const gauge = Math.max(0, Math.min(100, ((yoy + 10) / 60) * 100));

  const sign = yoy >= 0 ? "+" : "";
  const interp =
    yoy >= 30 ? tr("arr_interp_premium", locale)
    : yoy >= 20 ? tr("arr_interp_solid", locale)
    : yoy >= 10 ? tr("arr_interp_average", locale)
    : tr("arr_interp_below", locale);

  // Inputs : current value + prior (si history dispo)
  const hist = Array.isArray(kpi.history)
    ? kpi.history.filter((h): h is number => typeof h === "number" && Number.isFinite(h))
    : [];
  const inputs: string[] = [];
  if (hist.length >= 2) {
    const cur = hist[hist.length - 1];
    const prior = hist[hist.length - 2];
    const unit = typeof kpi.unit === "string" && kpi.unit.length > 0 ? ` ${kpi.unit}` : "";
    inputs.push(`${tr("arr_input_current", locale)} ${fmt(cur, 1)}${unit}`);
    inputs.push(`${tr("arr_input_prior", locale)} ${fmt(prior, 1)}${unit}`);
  } else {
    const v = num(kpi.value);
    if (v !== null) {
      const unit = typeof kpi.unit === "string" && kpi.unit.length > 0 ? ` ${kpi.unit}` : "";
      inputs.push(`${tr("arr_input_current", locale)} ${fmt(v, 1)}${unit}`);
    }
  }

  return {
    id: "arr-growth",
    name: tr("arr_name", locale),
    category: "Croissance",
    value: yoy,
    display: `${sign}${fmt(yoy, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs,
    formula: tr("arr_formula", locale),
    benchmark: tr("arr_benchmark", locale),
    interpretation: interp,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  Super-KPI 3 — RULE OF 50 (ARR Growth % + FCF Margin %)
 *  Variante stricte de Rule of 40.
 * ═════════════════════════════════════════════════════════════════════ */

/** Cherche un KPI FCF Margin %. */
function findFcfMarginKpi(c: Company): { value: number } | null {
  const direct = findKpiByNames(c, [
    "FCF Margin",
    "Free Cash Flow Margin",
    "FCF Mgn",
    "Marge FCF",
    "Marge Free Cash Flow",
  ]);
  if (direct && direct.unit === "%") {
    const v = num(direct.value);
    if (v !== null) return { value: v };
  }
  // Fallback : compute from FCF + Revenue if both absolute
  const fcfKpi = findKpiByNames(c, [
    "FCF",
    "Free Cash Flow",
    "Free cash flow",
  ]);
  const revKpi = findKpiByNames(c, [
    "Revenue",
    "Total Revenue",
    "Net Sales",
    "Total Revenues",
    "Net Revenues",
    "Revenues",
  ]);
  if (!fcfKpi || !revKpi) return null;
  if (fcfKpi.unit === "%" || revKpi.unit === "%") return null;
  const fcfV = num(fcfKpi.value);
  const revV = num(revKpi.value);
  if (fcfV === null || revV === null || revV === 0) return null;
  // Unit alignment : on suppose même unité (Mds $ vs Mds $). Si différentes,
  // skip pour rester honnête.
  if (fcfKpi.unit !== revKpi.unit) return null;
  const margin = (fcfV / revV) * 100;
  // Garde-fou : une marge FCF (FCF / Revenue) ne peut pas dépasser 100 % en
  // valeur absolue. |marge| > 120 % = bug d'input (périodes/unités) → skip.
  if (!Number.isFinite(margin) || Math.abs(margin) > 120) return null;
  return { value: margin };
}

export function ruleOf50(c: Company, locale: Locale = "en"): SuperKpi {
  // 1. ARR Growth %
  const arrKpi = findKpiByNames(c, [
    "ARR",
    "Annual Recurring Revenue",
    "Annualized Recurring Revenue",
    "Annualized ARR",
    "Subscription ARR",
    "Cloud ARR",
  ]);
  const arrYoY = arrKpi ? computeArrYoY(arrKpi) : null;

  // 2. FCF Margin %
  const fcfMargin = findFcfMarginKpi(c);

  if (arrYoY === null || fcfMargin === null) {
    return naResult(
      {
        id: "rule-of-50",
        name: tr("r50_name_na", locale),
        category: "Composite",
        formula: tr("r50_formula", locale),
        benchmark: tr("r50_benchmark", locale),
        inputs: ["ARR Growth %", "FCF Margin %"],
      },
      locale,
    );
  }

  const score = arrYoY + fcfMargin.value;
  const tier: SuperKpiTier =
    score >= 60 ? "premium" : score >= 50 ? "solid" : score >= 40 ? "average" : "below";
  // Jauge : map [0, 100] → [0, 100]
  const gauge = Math.max(0, Math.min(100, score));

  const interp =
    score >= 60 ? tr("r50_interp_premium", locale)
    : score >= 50 ? tr("r50_interp_solid", locale)
    : score >= 40 ? tr("r50_interp_average", locale)
    : tr("r50_interp_below", locale);

  return {
    id: "rule-of-50",
    name: tr("r50_name", locale),
    category: "Composite",
    value: score,
    display: `${fmt(score, 1)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("r50_input_arr", locale)} ${arrYoY >= 0 ? "+" : ""}${fmt(arrYoY, 1)} %`,
      `${tr("r50_input_fcf", locale)} ${fcfMargin.value >= 0 ? "+" : ""}${fmt(fcfMargin.value, 1)} %`,
    ],
    formula: tr("r50_formula", locale),
    benchmark: tr("r50_benchmark", locale),
    interpretation: interp,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts
 * ═════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [netRevenueRetention, arrGrowth, ruleOf50];
