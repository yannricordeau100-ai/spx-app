/**
 * Super-KPIs sector-specific — INDUSTRIAL-HEAVY (V1.9.5)
 *
 * 2 super-KPIs calibrés sur les industriels lourds US/EU :
 *   1. backlogCoverage : Backlog / Revenue annuel × 12 = mois de visibilité
 *   2. bookToBill      : Orders / Sales = ratio croissance future
 *
 * Univers cible : 12 stés (CAT, DE, HON, EMR, ETN, ITW, ROK, ...).
 *
 * i18n : EN + FR obligatoires (EN = canonical). Pas d'em-dash dans FR.
 * Vocabulaire FR strict (stés, pas "sociétés cotées").
 *
 * IMPORTANT : pas de commit, pas d'edit sur src/lib/super-kpi.ts. Le
 * caller intégrera lui-même les exports `SECTOR_KPIS` et `SECTOR_STRINGS`.
 */

import type { Company, KPI } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import type { SuperKpi, SuperKpiTier } from "@/lib/super-kpi";

/* ═══════════════════════════════════════════════════════════════════════
 *  i18n strings — EN canonical, FR traduction. Style anti-em-dash.
 *  ═══════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string };

export const SECTOR_STRINGS = {
  // ── backlogCoverage ────────────────────────────────────────────────
  name_backlog_cov: {
    en: "Backlog coverage (months of visibility)",
    fr: "Couverture du backlog (mois de visibilité)",
  },
  name_backlog_cov_na: {
    en: "Backlog coverage (N/A)",
    fr: "Couverture du backlog (N/A)",
  },
  backlog_cov_formula: {
    en: "Backlog / Annual Revenue × 12 (months)",
    fr: "Backlog / Revenue annuel × 12 (mois)",
  },
  backlog_cov_formula_na: {
    en: "Order backlog divided by annual revenue, expressed in months of visibility",
    fr: "Carnet de commandes divisé par le revenue annuel, exprimé en mois de visibilité",
  },
  backlog_cov_benchmark: {
    en: ">= 9 months premium · 6-9 solid · 3-6 average · < 3 below",
    fr: ">= 9 mois premium · 6 à 9 solide · 3 à 6 moyen · < 3 en deçà",
  },
  backlog_cov_benchmark_na: {
    en: "Premium >= 9 months of revenue visibility",
    fr: "Premium si >= 9 mois de visibilité revenue",
  },
  backlog_cov_interp_top: {
    en: "Exceptional revenue visibility. The backlog locks in more than 9 months of activity, giving strong cycle protection and pricing power on incremental orders.",
    fr: "Visibilité revenue exceptionnelle. Le backlog verrouille plus de 9 mois d'activité, donnant une forte protection au cycle et un pricing power sur les commandes additionnelles.",
  },
  backlog_cov_interp_mid: {
    en: "Solid backlog visibility. Between 3 and 9 months of revenue secured, in line with standard heavy-industrial cycle. No structural alpha but no near-term air pocket either.",
    fr: "Visibilité backlog solide. Entre 3 et 9 mois de revenue sécurisés, en ligne avec le cycle industriel lourd standard. Pas d'alpha structurel mais pas de trou d'air à court terme non plus.",
  },
  backlog_cov_interp_low: {
    en: "Thin backlog coverage. Less than 3 months of visibility leaves the business exposed to order slowdowns. To watch: incoming orders trend and cancellation rates.",
    fr: "Couverture backlog faible. Moins de 3 mois de visibilité laisse la sté exposée à un ralentissement des commandes. À surveiller : tendance des commandes entrantes et taux d'annulation.",
  },
  backlog_cov_input_backlog: {
    en: "Backlog",
    fr: "Backlog",
  },
  backlog_cov_input_revenue: {
    en: "Annual revenue",
    fr: "Revenue annuel",
  },

  // ── bookToBill ─────────────────────────────────────────────────────
  name_btb: {
    en: "Book-to-bill ratio",
    fr: "Ratio book-to-bill",
  },
  name_btb_na: {
    en: "Book-to-bill ratio (N/A)",
    fr: "Ratio book-to-bill (N/A)",
  },
  btb_formula: {
    en: "Orders (Order Intake) / Sales (Revenue)",
    fr: "Orders (Order Intake) / Sales (Revenue)",
  },
  btb_formula_na: {
    en: "Order intake divided by revenue. Above 1.0 signals future growth, below 1.0 signals deceleration",
    fr: "Order intake divisé par le revenue. Au-dessus de 1,0 signale une croissance future, en deçà signale une décélération",
  },
  btb_benchmark: {
    en: ">= 1.15 premium · 1.05-1.15 solid · 0.95-1.05 average · < 0.95 below",
    fr: ">= 1,15 premium · 1,05 à 1,15 solide · 0,95 à 1,05 moyen · < 0,95 en deçà",
  },
  btb_benchmark_na: {
    en: "Premium >= 1.15 orders-to-sales ratio",
    fr: "Premium si ratio orders-to-sales >= 1,15",
  },
  btb_interp_top: {
    en: "Order intake significantly above current sales. Backlog is building, future revenue acceleration is highly probable. Strong demand signal on the sector cycle.",
    fr: "Order intake nettement au-dessus des ventes courantes. Le backlog se construit, une accélération future du revenue est très probable. Signal de demande fort sur le cycle sectoriel.",
  },
  btb_interp_mid: {
    en: "Book-to-bill close to 1.0. Orders match sales, revenue trajectory should remain stable. Standard mid-cycle regime, no acceleration nor deceleration signal yet.",
    fr: "Book-to-bill proche de 1,0. Les commandes égalent les ventes, la trajectoire revenue devrait rester stable. Régime de mi-cycle standard, pas encore de signal d'accélération ni de décélération.",
  },
  btb_interp_low: {
    en: "Order intake below sales. The backlog is shrinking and revenue deceleration is mechanical over the next quarters. To watch: end-market demand and customer destocking signals.",
    fr: "Order intake en deçà des ventes. Le backlog se contracte et la décélération du revenue est mécanique sur les prochains trimestres. À surveiller : demande end-market et signaux de déstockage clients.",
  },
  btb_input_orders: {
    en: "Orders",
    fr: "Orders",
  },
  btb_input_sales: {
    en: "Sales",
    fr: "Sales",
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
      .replace(/\s+/g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.\-+]/g, "");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmt(n: number, decimals: number): string {
  return n.toFixed(decimals).replace(".", ",");
}

/** Cherche un KPI par liste de candidats short / name_en / name_fr (case insensitive, substring). */
function findKpiByNames(
  kpis: KPI[] | undefined,
  candidates: string[],
): KPI | undefined {
  if (!kpis || kpis.length === 0) return undefined;
  const targets = candidates.map((c) => c.toLowerCase());
  return kpis.find((k) => {
    const fields = [
      k.short,
      k.name_fr,
      (k as KPI & { name_en?: string }).name_en,
    ]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => v.toLowerCase());
    return fields.some((f) => targets.some((t) => f === t || f.includes(t)));
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

/* ═══════════════════════════════════════════════════════════════════════
 *  Listes de noms candidats (EN + FR, ordre de priorité).
 *  ═══════════════════════════════════════════════════════════════════════ */

const BACKLOG_NAMES = [
  "Backlog",
  "Order Backlog",
  "Order Book",
  "Carnet de commandes",
  "Carnet",
];

const REVENUE_NAMES = [
  "Revenue",
  "Total Revenue",
  "Net Revenue",
  "Net Sales",
  "Sales",
  "Revenu",
  "Chiffre d'affaires",
];

const ORDERS_NAMES = [
  "Orders",
  "Order Intake",
  "Bookings",
  "New Orders",
  "Order Inflow",
  "Commandes",
  "Prises de commandes",
];

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 1 — BACKLOG COVERAGE (months of visibility)
 *  ═══════════════════════════════════════════════════════════════════════ */
export function backlogCoverage(c: Company, locale: Locale = "en"): SuperKpi {
  const backlogKpi = findKpiByNames(c.kpis, BACKLOG_NAMES);
  const revenueKpi = findKpiByNames(c.kpis, REVENUE_NAMES);

  const backlog = backlogKpi ? num(backlogKpi.value) : null;
  const revenue = revenueKpi ? num(revenueKpi.value) : null;

  if (backlog === null || revenue === null || revenue <= 0) {
    return naResult(
      {
        id: "backlog-coverage",
        name: tr("name_backlog_cov_na", locale),
        category: "Stratégie",
        formula: tr("backlog_cov_formula_na", locale),
        benchmark: tr("backlog_cov_benchmark_na", locale),
        inputs: ["Backlog", "Annual Revenue"],
      },
      locale,
    );
  }

  const months = (backlog / revenue) * 12;
  const tier: SuperKpiTier =
    months >= 9 ? "premium" : months >= 6 ? "solid" : months >= 3 ? "average" : "below";
  // Jauge [0, 18 mois] → [0, 100].
  const gauge = Math.max(0, Math.min(100, (months / 18) * 100));

  const monthsLabel = locale.startsWith("fr") ? "mois visibilite" : "months visibility";

  const interp =
    months >= 9
      ? tr("backlog_cov_interp_top", locale)
      : months >= 3
        ? tr("backlog_cov_interp_mid", locale)
        : tr("backlog_cov_interp_low", locale);

  return {
    id: "backlog-coverage",
    name: tr("name_backlog_cov", locale),
    category: "Stratégie",
    value: months,
    display: `${fmt(months, 1)} ${monthsLabel}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("backlog_cov_input_backlog", locale)} ${fmt(backlog, 0)}`,
      `${tr("backlog_cov_input_revenue", locale)} ${fmt(revenue, 0)}`,
    ],
    formula: tr("backlog_cov_formula", locale),
    benchmark: tr("backlog_cov_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — BOOK-TO-BILL RATIO
 *  ═══════════════════════════════════════════════════════════════════════ */
export function bookToBill(c: Company, locale: Locale = "en"): SuperKpi {
  const ordersKpi = findKpiByNames(c.kpis, ORDERS_NAMES);
  const salesKpi = findKpiByNames(c.kpis, REVENUE_NAMES);

  const orders = ordersKpi ? num(ordersKpi.value) : null;
  const sales = salesKpi ? num(salesKpi.value) : null;

  if (orders === null || sales === null || sales <= 0) {
    return naResult(
      {
        id: "book-to-bill",
        name: tr("name_btb_na", locale),
        category: "Croissance",
        formula: tr("btb_formula_na", locale),
        benchmark: tr("btb_benchmark_na", locale),
        inputs: ["Orders / Order Intake", "Revenue / Sales"],
      },
      locale,
    );
  }

  const ratio = orders / sales;
  const tier: SuperKpiTier =
    ratio >= 1.15 ? "premium" : ratio >= 1.05 ? "solid" : ratio >= 0.95 ? "average" : "below";
  // Jauge centrée sur 1.0 : map [0.7, 1.3] → [0, 100].
  const gauge = Math.max(0, Math.min(100, ((ratio - 0.7) / 0.6) * 100));

  const interp =
    ratio >= 1.15
      ? tr("btb_interp_top", locale)
      : ratio >= 0.95
        ? tr("btb_interp_mid", locale)
        : tr("btb_interp_low", locale);

  return {
    id: "book-to-bill",
    name: tr("name_btb", locale),
    category: "Croissance",
    value: ratio,
    display: `${fmt(ratio, 2)} ×`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("btb_input_orders", locale)} ${fmt(orders, 0)}`,
      `${tr("btb_input_sales", locale)} ${fmt(sales, 0)}`,
    ],
    formula: tr("btb_formula", locale),
    benchmark: tr("btb_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 *  ═══════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [backlogCoverage, bookToBill];
