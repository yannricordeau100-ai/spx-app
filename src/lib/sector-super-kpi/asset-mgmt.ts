/**
 * Super-KPIs sector-specific — ASSET-MGMT (V1.9.5)
 *
 * 2 super-KPIs calibrés sur le business model asset management / brokers :
 *   1. aumGrowthQuality : CAGR 5 ans des actifs sous gestion / custody
 *   2. feeRevenueMix   : % revenus commissions / management fees vs
 *                        revenus financiers volatils
 *
 * Univers cible : ~10 stés direct (BLK, GS, MS, SCHW, BX, KKR, ICE, CME,
 * NDAQ, CBOE) + fallback subsector.
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
  // ── aumGrowthQuality ───────────────────────────────────────────────
  name_aum_growth: {
    en: "AUM/AUC growth quality (5y CAGR)",
    fr: "Qualité de croissance AUM/AUC (CAGR 5 ans)",
  },
  name_aum_growth_na: {
    en: "AUM/AUC growth quality (N/A)",
    fr: "Qualité de croissance AUM/AUC (N/A)",
  },
  aum_growth_formula: {
    en: "CAGR 5y = (AUM_t / AUM_t-5)^(1/5) − 1",
    fr: "CAGR 5 ans = (AUM_t / AUM_t-5)^(1/5) − 1",
  },
  aum_growth_formula_na: {
    en: "5-year compound annual growth rate of Assets Under Management or Custody",
    fr: "Taux de croissance annuel composé 5 ans des actifs sous gestion ou custody",
  },
  aum_growth_benchmark: {
    en: "≥ 12 % premium · 8-12 % solid · 4-8 % average · < 4 % below",
    fr: "≥ 12 % premium · 8 à 12 % solide · 4 à 8 % moyen · < 4 % en deçà",
  },
  aum_growth_benchmark_na: {
    en: "Premium ≥ 12 % CAGR 5y",
    fr: "Premium si CAGR 5 ans ≥ 12 %",
  },
  aum_growth_interp_top: {
    en: "Outstanding AUM compounding. The franchise gains share and absorbs market drawdowns through net inflows. Translates directly into management fee growth.",
    fr: "Croissance AUM remarquable. La franchise gagne de la part et absorbe les drawdowns de marché via des flux nets entrants. Se traduit directement en croissance des management fees.",
  },
  aum_growth_interp_mid: {
    en: "Solid AUM growth in line with the asset manager peer set. Market beta plus modest net inflows. Fee base expands steadily.",
    fr: "Croissance AUM solide en ligne avec les pairs asset managers. Bêta de marché plus flux nets modestes. La base de fees s'étend de manière stable.",
  },
  aum_growth_interp_low: {
    en: "Weak AUM compounding. Either net outflows offset market returns, or product mix is rotating toward lower-fee passive. Fee revenue under pressure.",
    fr: "Croissance AUM faible. Soit les flux sortants compensent les rendements de marché, soit le mix produit tourne vers du passif à fees plus basses. Revenus de fees sous pression.",
  },
  aum_growth_input_current: {
    en: "AUM/AUC current",
    fr: "AUM/AUC actuel",
  },
  aum_growth_input_start: {
    en: "AUM/AUC 5y ago",
    fr: "AUM/AUC il y a 5 ans",
  },

  // ── feeRevenueMix ──────────────────────────────────────────────────
  name_fee_mix: {
    en: "Fee revenue mix",
    fr: "Mix revenus de commissions",
  },
  name_fee_mix_na: {
    en: "Fee revenue mix (N/A)",
    fr: "Mix revenus de commissions (N/A)",
  },
  fee_mix_formula: {
    en: "Fee revenue / Total revenue × 100",
    fr: "Revenus de commissions / Revenu total × 100",
  },
  fee_mix_formula_na: {
    en: "Share of management and service fees in total revenue (vs volatile financial income)",
    fr: "Part des management et service fees dans le revenu total (vs revenus financiers volatils)",
  },
  fee_mix_benchmark: {
    en: "≥ 75 % premium · 60-75 % solid · 45-60 % average · < 45 % below",
    fr: "≥ 75 % premium · 60 à 75 % solide · 45 à 60 % moyen · < 45 % en deçà",
  },
  fee_mix_benchmark_na: {
    en: "Premium ≥ 75 % fee revenue mix",
    fr: "Premium si mix revenus de commissions ≥ 75 %",
  },
  fee_mix_interp_top: {
    en: "Highly recurring revenue base dominated by management and service fees. Earnings are predictable across cycles, with limited sensitivity to trading or balance-sheet income.",
    fr: "Base de revenus très récurrente dominée par les management et service fees. Les résultats sont prévisibles à travers les cycles, avec une sensibilité limitée au trading ou aux revenus de bilan.",
  },
  fee_mix_interp_mid: {
    en: "Balanced mix between recurring fees and market-sensitive revenue. Earnings quality is decent but cyclical components can amplify drawdowns in stressed markets.",
    fr: "Mix équilibré entre fees récurrentes et revenus sensibles au marché. La qualité des résultats est correcte mais les composantes cycliques peuvent amplifier les drawdowns en marché stressé.",
  },
  fee_mix_interp_low: {
    en: "Revenue dominated by volatile financial income (trading, principal investments, market making). Earnings carry higher beta and lower multiples than fee-driven peers.",
    fr: "Revenus dominés par les revenus financiers volatils (trading, investissements pour compte propre, market making). Les résultats portent un bêta plus élevé et des multiples plus bas que les pairs orientés fees.",
  },
  fee_mix_input_fee: {
    en: "Fee revenue",
    fr: "Revenus de commissions",
  },
  fee_mix_input_total: {
    en: "Total revenue",
    fr: "Revenu total",
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

/** Cherche un KPI par liste de shorts candidats, ou par match name_en/name_fr. */
function findKpi(
  c: Company,
  shorts: string[],
  nameMatchers: (en: string, fr: string) => boolean,
): { value: number; history: number[]; unit: string } | null {
  for (const s of shorts) {
    const k = c.kpis.find((x) => x.short === s);
    if (k) {
      const v = num(k.value);
      const hist = Array.isArray(k.history)
        ? k.history.filter((h): h is number => typeof h === "number" && Number.isFinite(h))
        : [];
      if (v !== null) return { value: v, history: hist, unit: k.unit || "" };
    }
  }
  const k = c.kpis.find((x) => {
    const en = (x.name_en || "").toLowerCase();
    const fr = (x.name_fr || "").toLowerCase();
    return nameMatchers(en, fr);
  });
  if (k) {
    const v = num(k.value);
    const hist = Array.isArray(k.history)
      ? k.history.filter((h): h is number => typeof h === "number" && Number.isFinite(h))
      : [];
    if (v !== null) return { value: v, history: hist, unit: k.unit || "" };
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
 *  Super-KPI 1 — AUM GROWTH QUALITY (CAGR 5y)
 *  ═══════════════════════════════════════════════════════════════════════ */
export function aumGrowthQuality(c: Company, locale: Locale = "en"): SuperKpi {
  const aum = findKpi(
    c,
    [
      "AUM",
      "Assets Under Management",
      "AUC",
      "Assets Under Custody",
      "AUM/AUC",
      "AUMA",
      "Client Assets",
    ],
    (en, fr) =>
      en === "aum" ||
      en === "assets under management" ||
      en === "auc" ||
      en === "assets under custody" ||
      en === "assets under management and administration" ||
      en === "client assets" ||
      fr === "actifs sous gestion" ||
      fr === "actifs sous custody" ||
      fr === "encours sous gestion",
  );

  if (!aum || aum.history.length < 4) {
    return naResult(
      {
        id: "aum-growth-quality",
        name: tr("name_aum_growth_na", locale),
        category: "Croissance",
        formula: tr("aum_growth_formula_na", locale),
        benchmark: tr("aum_growth_benchmark_na", locale),
        inputs: ["AUM / AUC", "AUM/AUC history (≥4 pts)"],
      },
      locale,
    );
  }

  // CAGR sur la fenêtre history disponible (jusqu'à 5 ans). Si history n'a
  // pas exactement 5 pts, on prend le span effectif et on annualise.
  const series = [...aum.history];
  // S'assurer que la valeur courante est incluse en fin de série si la
  // donnée history ne la contient pas déjà.
  if (series[series.length - 1] !== aum.value) {
    series.push(aum.value);
  }
  const last = series[series.length - 1];
  const start = series.length > 5 ? series[series.length - 6] : series[0];
  const years = series.length > 5 ? 5 : series.length - 1;

  if (start <= 0 || last <= 0 || years <= 0) {
    return naResult(
      {
        id: "aum-growth-quality",
        name: tr("name_aum_growth_na", locale),
        category: "Croissance",
        formula: tr("aum_growth_formula_na", locale),
        benchmark: tr("aum_growth_benchmark_na", locale),
        inputs: ["AUM / AUC", "AUM/AUC history"],
      },
      locale,
    );
  }

  const cagrPct = (Math.pow(last / start, 1 / years) - 1) * 100;
  const tier: SuperKpiTier =
    cagrPct >= 12 ? "premium" : cagrPct >= 8 ? "solid" : cagrPct >= 4 ? "average" : "below";
  // Jauge : map [-5 %, +25 %] → [0, 100].
  const gauge = Math.max(0, Math.min(100, ((cagrPct + 5) / 30) * 100));

  const sign = cagrPct >= 0 ? "+" : "";
  const perYearLabel = locale.startsWith("fr") ? "%/an" : "%/yr";

  const interp =
    cagrPct >= 12 ? tr("aum_growth_interp_top", locale)
    : cagrPct >= 4 ? tr("aum_growth_interp_mid", locale)
    : tr("aum_growth_interp_low", locale);

  const unitSuffix = aum.unit ? ` ${aum.unit}` : "";

  return {
    id: "aum-growth-quality",
    name: tr("name_aum_growth", locale),
    category: "Croissance",
    value: cagrPct,
    display: `${sign}${fmt(cagrPct, 1)} ${perYearLabel}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("aum_growth_input_current", locale)} ${fmt(last, 1)}${unitSuffix}`,
      `${tr("aum_growth_input_start", locale)} ${fmt(start, 1)}${unitSuffix}`,
    ],
    formula: tr("aum_growth_formula", locale),
    benchmark: tr("aum_growth_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — FEE REVENUE MIX
 *  ═══════════════════════════════════════════════════════════════════════ */
export function feeRevenueMix(c: Company, locale: Locale = "en"): SuperKpi {
  // 1. Essai direct : un KPI déjà exprimé en % de revenu fees.
  const directPct = findKpi(
    c,
    [
      "Fee Revenue Mix",
      "Fee Revenue %",
      "Management Fee Mix",
      "Fee Income Share",
    ],
    (en, fr) =>
      en === "fee revenue mix" ||
      en === "fee revenue %" ||
      en === "management fee mix" ||
      en === "fee income share" ||
      fr === "mix revenus commissions" ||
      fr === "part revenus commissions",
  );

  if (directPct && directPct.unit === "%") {
    const mixPct = directPct.value;
    return buildFeeMixResult(mixPct, null, null, locale);
  }

  // 2. Sinon : Fee Revenue absolu / Total Revenue absolu.
  const fee = findKpi(
    c,
    [
      "Management Fee Revenue",
      "Fee Revenue",
      "Service Fee Revenue",
      "Management Fees",
      "Asset Management Fees",
      "Fees & Commissions",
      "Fee Income",
    ],
    (en, fr) =>
      en === "management fee revenue" ||
      en === "fee revenue" ||
      en === "service fee revenue" ||
      en === "management fees" ||
      en === "asset management fees" ||
      en === "fees & commissions" ||
      en === "fee and commission income" ||
      en === "fee income" ||
      en === "investment management fees" ||
      fr === "revenus de commissions" ||
      fr === "management fees" ||
      fr === "frais de gestion" ||
      fr === "commissions de gestion",
  );

  const total = findKpi(
    c,
    [
      "Revenue",
      "Total Revenue",
      "Total Revenues",
      "Net Revenues",
      "Revenues",
      "Net Revenue",
    ],
    (en, fr) =>
      en === "revenue" ||
      en === "total revenue" ||
      en === "total revenues" ||
      en === "net revenues" ||
      en === "net revenue" ||
      en === "revenues" ||
      fr === "revenu" ||
      fr === "revenu total" ||
      fr === "chiffre d'affaires" ||
      fr === "produit net" ||
      fr === "produit net bancaire",
  );

  // 3. Dernier fallback : si on a "Organic Revenue Growth" en % comme proxy
  // qualitatif de la composante fees récurrente, on peut au moins surfacer
  // une lecture qualitative. On ne le score pas en pourcentage de mix.
  if (!fee || !total) {
    return naResult(
      {
        id: "fee-revenue-mix",
        name: tr("name_fee_mix_na", locale),
        category: "Stratégie",
        formula: tr("fee_mix_formula_na", locale),
        benchmark: tr("fee_mix_benchmark_na", locale),
        inputs: ["Fee Revenue", "Total Revenue"],
      },
      locale,
    );
  }

  // Si l'un des deux est en %, on ne peut pas calculer un ratio absolu.
  if (fee.unit === "%" || total.unit === "%") {
    return naResult(
      {
        id: "fee-revenue-mix",
        name: tr("name_fee_mix_na", locale),
        category: "Stratégie",
        formula: tr("fee_mix_formula_na", locale),
        benchmark: tr("fee_mix_benchmark_na", locale),
        inputs: ["Fee Revenue (abs)", "Total Revenue (abs)"],
      },
      locale,
    );
  }

  if (total.value === 0) {
    return naResult(
      {
        id: "fee-revenue-mix",
        name: tr("name_fee_mix_na", locale),
        category: "Stratégie",
        formula: tr("fee_mix_formula_na", locale),
        benchmark: tr("fee_mix_benchmark_na", locale),
        inputs: ["Fee Revenue", "Total Revenue"],
      },
      locale,
    );
  }

  // Alignement d'unité : si différentes, on skip pour rester honnête.
  if (fee.unit !== total.unit) {
    return naResult(
      {
        id: "fee-revenue-mix",
        name: tr("name_fee_mix_na", locale),
        category: "Stratégie",
        formula: tr("fee_mix_formula_na", locale),
        benchmark: tr("fee_mix_benchmark_na", locale),
        inputs: ["Fee Revenue", "Total Revenue"],
      },
      locale,
    );
  }

  const mixPct = (fee.value / total.value) * 100;
  return buildFeeMixResult(mixPct, fee, total, locale);
}

function buildFeeMixResult(
  mixPct: number,
  fee: { value: number; unit: string } | null,
  total: { value: number; unit: string } | null,
  locale: Locale,
): SuperKpi {
  const tier: SuperKpiTier =
    mixPct >= 75 ? "premium" : mixPct >= 60 ? "solid" : mixPct >= 45 ? "average" : "below";
  // Jauge [0, 100].
  const gauge = Math.max(0, Math.min(100, mixPct));

  const interp =
    mixPct >= 75 ? tr("fee_mix_interp_top", locale)
    : mixPct >= 45 ? tr("fee_mix_interp_mid", locale)
    : tr("fee_mix_interp_low", locale);

  const inputs: string[] =
    fee && total
      ? [
          `${tr("fee_mix_input_fee", locale)} ${fmt(fee.value, 1)}${fee.unit ? ` ${fee.unit}` : ""}`,
          `${tr("fee_mix_input_total", locale)} ${fmt(total.value, 1)}${total.unit ? ` ${total.unit}` : ""}`,
        ]
      : [`${tr("fee_mix_input_fee", locale)} ${fmt(mixPct, 1)} %`];

  return {
    id: "fee-revenue-mix",
    name: tr("name_fee_mix", locale),
    category: "Stratégie",
    value: mixPct,
    display: `${fmt(mixPct, 0)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs,
    formula: tr("fee_mix_formula", locale),
    benchmark: tr("fee_mix_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 *  ═══════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [aumGrowthQuality, feeRevenueMix];
