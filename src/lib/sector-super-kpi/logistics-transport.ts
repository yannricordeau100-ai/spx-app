/**
 * Super-KPIs sector-specific — LOGISTICS-TRANSPORT (V1.9.5)
 *
 * 2 super-KPIs calibrés sur le transport / logistique US (rail, trucking,
 * parcel, ocean, air) :
 *   1. operatingRatioCompetitive : Operating Ratio = OpEx / Revenue (rail/trucking KPI clé)
 *   2. volumeYieldComposite      : composite (Volume YoY + Yield YoY) / 2
 *
 * Univers cible : 11 stés (CHRW, CSX, EXPD, FDX, JBHT, LUV, NSC, UAL, UNP, UPS, WAB).
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
  // ── operatingRatioCompetitive ──────────────────────────────────────
  name_op_ratio: {
    en: "Operating ratio (competitive)",
    fr: "Operating ratio (compétitivité)",
  },
  name_op_ratio_na: {
    en: "Operating ratio (N/A)",
    fr: "Operating ratio (N/A)",
  },
  op_ratio_formula: {
    en: "Operating Expenses / Revenue (lower is better)",
    fr: "Operating Expenses / Revenue (plus bas = mieux)",
  },
  op_ratio_formula_na: {
    en: "Operating expenses divided by revenue. Industry standard rail and trucking efficiency metric, lower is better",
    fr: "Operating expenses divisé par le revenue. Métrique d'efficacité standard rail et trucking, plus bas = mieux",
  },
  op_ratio_benchmark: {
    en: "<= 58 % premium · 58-62 % solid · 62-68 % average · > 68 % below",
    fr: "<= 58 % premium · 58 à 62 % solide · 62 à 68 % moyen · > 68 % en deçà",
  },
  op_ratio_benchmark_na: {
    en: "Premium <= 58 % operating ratio",
    fr: "Premium si operating ratio <= 58 %",
  },
  op_ratio_interp_top: {
    en: "Best-in-class operating ratio. Operating expenses consume less than 58 % of revenue, signaling premium efficiency, strong network density, and material pricing power versus peers.",
    fr: "Operating ratio best-in-class. Les operating expenses consomment moins de 58 % du revenue, signalant une efficacité premium, une densité de réseau forte et un pricing power matériel face aux pairs.",
  },
  op_ratio_interp_mid: {
    en: "Operating ratio in standard sector band. Between 58 % and 68 % of revenue eaten by OpEx, in line with average rail and trucking profitability. No structural alpha but no margin pressure either.",
    fr: "Operating ratio dans la bande sectorielle standard. Entre 58 % et 68 % du revenue absorbés par les OpEx, en ligne avec la profitabilité moyenne rail et trucking. Pas d'alpha structurel mais pas de pression marge non plus.",
  },
  op_ratio_interp_low: {
    en: "Operating ratio above 68 %. Cost base eats too much of revenue, signaling efficiency lag versus best-in-class peers. To watch: fuel pass-through, labor costs, and network utilization.",
    fr: "Operating ratio au-dessus de 68 %. La base de coûts absorbe trop de revenue, signalant un retard d'efficacité face aux pairs best-in-class. À surveiller : fuel pass-through, coûts main d'oeuvre et utilisation du réseau.",
  },
  op_ratio_input: {
    en: "Operating ratio",
    fr: "Operating ratio",
  },

  // ── volumeYieldComposite ───────────────────────────────────────────
  name_vol_yield: {
    en: "Volume + yield composite",
    fr: "Composite volume + yield",
  },
  name_vol_yield_na: {
    en: "Volume + yield composite (N/A)",
    fr: "Composite volume + yield (N/A)",
  },
  vol_yield_formula: {
    en: "(Volume YoY % + Yield YoY %) / 2",
    fr: "(Volume YoY % + Yield YoY %) / 2",
  },
  vol_yield_formula_na: {
    en: "Average of volume YoY growth and yield (revenue per unit) YoY growth. Captures both demand and pricing legs",
    fr: "Moyenne de la croissance YoY des volumes et du yield (revenue par unité). Capture la jambe demande et la jambe pricing",
  },
  vol_yield_benchmark: {
    en: ">= 8 % premium · 4-8 % solid · 0-4 % average · < 0 % below",
    fr: ">= 8 % premium · 4 à 8 % solide · 0 à 4 % moyen · < 0 % en deçà",
  },
  vol_yield_benchmark_na: {
    en: "Premium >= 8 % composite growth",
    fr: "Premium si composite >= 8 %",
  },
  vol_yield_interp_top: {
    en: "Composite growth above 8 %. Volume and yield both push higher, signaling robust end-market demand combined with pricing power. Best regime of the freight cycle.",
    fr: "Composite croissance au-dessus de 8 %. Volumes et yield progressent ensemble, signalant une demande end-market robuste couplée à un pricing power. Meilleur régime du cycle fret.",
  },
  vol_yield_interp_mid: {
    en: "Composite growth between 0 % and 8 %. Volume and yield together deliver standard cycle growth, in line with GDP-plus trajectory. No deceleration signal but no acceleration either.",
    fr: "Composite croissance entre 0 % et 8 %. Volumes et yield délivrent ensemble une croissance de cycle standard, en ligne avec une trajectoire GDP-plus. Pas de signal de décélération ni d'accélération.",
  },
  vol_yield_interp_low: {
    en: "Composite growth negative. Volume and yield combined contract, signaling demand softness or pricing erosion. To watch: industrial production indicators and freight rate indices.",
    fr: "Composite croissance négative. Volumes et yield se contractent ensemble, signalant un fléchissement de la demande ou une érosion du pricing. À surveiller : indicateurs production industrielle et indices fret.",
  },
  vol_yield_input_volume: {
    en: "Volume YoY",
    fr: "Volume YoY",
  },
  vol_yield_input_yield: {
    en: "Yield YoY",
    fr: "Yield YoY",
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

function fmtSigned(n: number, decimals: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${fmt(n, decimals)}`;
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

function getHistory(kpi: KPI | undefined): number[] {
  if (!kpi) return [];
  const h = (kpi as KPI & { history?: unknown }).history;
  if (!Array.isArray(h)) return [];
  return h.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

/** Compute YoY % from current value + history. Returns null if not computable. */
function computeYoY(kpi: KPI | undefined): number | null {
  if (!kpi) return null;
  const current = num(kpi.value);
  if (current === null) return null;
  const hist = getHistory(kpi);
  if (hist.length < 1) return null;
  const prev = hist[hist.length - 1];
  if (prev == null || prev <= 0) return null;
  return ((current - prev) / prev) * 100;
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

const OP_RATIO_NAMES = [
  "Operating Ratio",
  "OR",
  "Op Ratio",
  "Ratio opérationnel",
];

const VOLUME_NAMES = [
  "Volume",
  "Carloads",
  "Average Daily Volume",
  "ADV",
  "Total Volume",
  "Shipments",
  "Volumes",
];

const YIELD_NAMES = [
  "Yield",
  "Revenue per Unit",
  "ARPP",
  "Revenue per Carload",
  "Revenue per Shipment",
  "RPU",
  "Average Revenue per Unit",
];

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 1 — OPERATING RATIO (competitive)
 *  ═══════════════════════════════════════════════════════════════════════ */
export function operatingRatioCompetitive(
  c: Company,
  locale: Locale = "en",
): SuperKpi {
  const orKpi = findKpiByNames(c.kpis, OP_RATIO_NAMES);
  const orRaw = orKpi ? num(orKpi.value) : null;

  if (orRaw === null) {
    return naResult(
      {
        id: "operating-ratio-competitive",
        name: tr("name_op_ratio_na", locale),
        category: "Profitabilité",
        formula: tr("op_ratio_formula_na", locale),
        benchmark: tr("op_ratio_benchmark_na", locale),
        inputs: ["Operating Ratio"],
      },
      locale,
    );
  }

  // Normalise : si la valeur est < 1 (ex: 0.62) → convertir en %.
  const orPct = orRaw <= 1 ? orRaw * 100 : orRaw;

  const tier: SuperKpiTier =
    orPct <= 58
      ? "premium"
      : orPct <= 62
        ? "solid"
        : orPct <= 68
          ? "average"
          : "below";
  // Jauge inversée [50 %, 80 %] → [100, 0] (plus bas = mieux).
  const gauge = Math.max(0, Math.min(100, ((80 - orPct) / 30) * 100));

  const interp =
    orPct <= 58
      ? tr("op_ratio_interp_top", locale)
      : orPct <= 68
        ? tr("op_ratio_interp_mid", locale)
        : tr("op_ratio_interp_low", locale);

  return {
    id: "operating-ratio-competitive",
    name: tr("name_op_ratio", locale),
    category: "Profitabilité",
    value: orPct,
    display: `${fmt(orPct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [`${tr("op_ratio_input", locale)} ${fmt(orPct, 1)} %`],
    formula: tr("op_ratio_formula", locale),
    benchmark: tr("op_ratio_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — VOLUME + YIELD COMPOSITE
 *  ═══════════════════════════════════════════════════════════════════════ */
export function volumeYieldComposite(
  c: Company,
  locale: Locale = "en",
): SuperKpi {
  const volumeKpi = findKpiByNames(c.kpis, VOLUME_NAMES);
  const yieldKpi = findKpiByNames(c.kpis, YIELD_NAMES);

  const volYoy = computeYoY(volumeKpi);
  const yieldYoy = computeYoY(yieldKpi);

  if (volYoy === null || yieldYoy === null) {
    return naResult(
      {
        id: "volume-yield-composite",
        name: tr("name_vol_yield_na", locale),
        category: "Croissance",
        formula: tr("vol_yield_formula_na", locale),
        benchmark: tr("vol_yield_benchmark_na", locale),
        inputs: ["Volume YoY", "Yield YoY"],
      },
      locale,
    );
  }

  const composite = (volYoy + yieldYoy) / 2;

  const tier: SuperKpiTier =
    composite >= 8
      ? "premium"
      : composite >= 4
        ? "solid"
        : composite >= 0
          ? "average"
          : "below";
  // Jauge centrée : map [-10 %, +15 %] → [0, 100].
  const gauge = Math.max(0, Math.min(100, ((composite + 10) / 25) * 100));

  const interp =
    composite >= 8
      ? tr("vol_yield_interp_top", locale)
      : composite >= 0
        ? tr("vol_yield_interp_mid", locale)
        : tr("vol_yield_interp_low", locale);

  const compositeWord = locale.startsWith("fr") ? "composite" : "composite";

  return {
    id: "volume-yield-composite",
    name: tr("name_vol_yield", locale),
    category: "Croissance",
    value: composite,
    display: `${fmtSigned(composite, 1)} % ${compositeWord}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("vol_yield_input_volume", locale)} ${fmtSigned(volYoy, 1)} %`,
      `${tr("vol_yield_input_yield", locale)} ${fmtSigned(yieldYoy, 1)} %`,
    ],
    formula: tr("vol_yield_formula", locale),
    benchmark: tr("vol_yield_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 *  ═══════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [operatingRatioCompetitive, volumeYieldComposite];
