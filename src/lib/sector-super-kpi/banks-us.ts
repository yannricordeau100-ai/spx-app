/**
 * Super-KPIs sector-specific — BANKS-US (V1.9.5)
 *
 * 2 super-KPIs calibrés sur le business model bancaire US :
 *   1. netInterestMarginQuality : qualité de la NIM vs sa moyenne 5y
 *   2. tier1RegulatoryBuffer    : marge CET1 / Tier 1 au-dessus du minimum
 *                                 réglementaire (10 %)
 *
 * Univers cible : ~86 stés US banks (JPM/BAC/C/WFC/USB/MTB/TFC/PNC/KEY/...).
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
  // ── netInterestMarginQuality ───────────────────────────────────────
  name_nim_quality: {
    en: "NIM expansion vs 5y average",
    fr: "Expansion NIM vs moyenne 5 ans",
  },
  name_nim_quality_na: {
    en: "NIM vs 5y average (N/A)",
    fr: "NIM vs moyenne 5 ans (N/A)",
  },
  nim_quality_formula: {
    en: "(NIM current − NIM 5y avg) / NIM 5y avg × 100",
    fr: "(NIM actuelle − NIM moyenne 5 ans) / NIM moyenne 5 ans × 100",
  },
  nim_quality_formula_na: {
    en: "Net Interest Margin expansion vs its 5-year historical average",
    fr: "Expansion de la marge nette d'intérêt vs sa moyenne historique 5 ans",
  },
  nim_quality_benchmark: {
    en: "≥ 10 % premium · 5-10 % solid · 0-5 % average · < 0 % below",
    fr: "≥ 10 % premium · 5 à 10 % solide · 0 à 5 % moyen · < 0 % en deçà",
  },
  nim_quality_benchmark_na: {
    en: "Premium ≥ 10 % expansion vs 5y avg",
    fr: "Premium si expansion ≥ 10 % vs moyenne 5 ans",
  },
  nim_quality_interp_top: {
    en: "NIM well above its historical average. The bank captures the rate cycle better than its own track record, a sign of strong asset repricing or deposit-cost discipline.",
    fr: "NIM nettement au-dessus de sa moyenne historique. La banque capte le cycle de taux mieux que son propre historique, signe d'un fort repricing de l'actif ou d'une discipline sur le coût des dépôts.",
  },
  nim_quality_interp_mid: {
    en: "NIM in line with or slightly above its 5-year average. Standard rate environment captured, no structural alpha yet.",
    fr: "NIM en ligne ou légèrement au-dessus de sa moyenne 5 ans. Environnement de taux capté de manière standard, pas encore d'alpha structurel.",
  },
  nim_quality_interp_low: {
    en: "NIM below its 5-year average. The bank under-captures the rate cycle. To watch: deposit beta rising, asset mix dilutive or loan repricing lagging.",
    fr: "NIM en deçà de sa moyenne 5 ans. La banque sous-capte le cycle de taux. À surveiller : bêta des dépôts qui monte, mix d'actifs dilutif ou repricing des prêts en retard.",
  },
  nim_quality_input_current: {
    en: "Current NIM",
    fr: "NIM actuelle",
  },
  nim_quality_input_avg: {
    en: "5y avg NIM",
    fr: "Moyenne 5 ans NIM",
  },

  // ── tier1RegulatoryBuffer ──────────────────────────────────────────
  name_t1_buffer: {
    en: "CET1 buffer above regulatory minimum",
    fr: "Marge CET1 au-dessus du minimum réglementaire",
  },
  name_t1_buffer_na: {
    en: "CET1 regulatory buffer (N/A)",
    fr: "Marge CET1 réglementaire (N/A)",
  },
  t1_buffer_formula: {
    en: "CET1 ratio − 10 % (Basel III well-capitalized threshold)",
    fr: "Ratio CET1 − 10 % (seuil Basel III bien capitalisée)",
  },
  t1_buffer_formula_na: {
    en: "Common Equity Tier 1 ratio minus the 10 % minimum regulatory threshold",
    fr: "Ratio Common Equity Tier 1 moins le seuil réglementaire minimum de 10 %",
  },
  t1_buffer_benchmark: {
    en: "≥ 6 pts premium · 4-6 pts solid · 2-4 pts average · < 2 pts below",
    fr: "≥ 6 pts premium · 4 à 6 pts solide · 2 à 4 pts moyen · < 2 pts en deçà",
  },
  t1_buffer_benchmark_na: {
    en: "Premium ≥ 6 pts above regulatory minimum",
    fr: "Premium si ≥ 6 pts au-dessus du minimum réglementaire",
  },
  t1_buffer_interp_top: {
    en: "Very comfortable capital buffer above the regulatory minimum. Significant capital return capacity (buybacks, dividend hikes) without putting the bank at risk during a stress scenario.",
    fr: "Marge de capital très confortable au-dessus du minimum réglementaire. Capacité significative de redistribution (rachats, hausses de dividende) sans mettre la banque en risque sur un scénario stressé.",
  },
  t1_buffer_interp_mid: {
    en: "Solid capital buffer. The bank can absorb a normal stress test and still return capital, but room for buyback acceleration remains limited.",
    fr: "Marge de capital solide. La sté peut absorber un stress test normal et continuer à redistribuer du capital, mais la marge d'accélération des rachats reste limitée.",
  },
  t1_buffer_interp_low: {
    en: "Thin capital buffer above the minimum. Any stress event or rising RWA could force capital actions to be cut. To watch closely.",
    fr: "Marge de capital faible au-dessus du minimum. Tout choc ou hausse des RWA pourrait forcer une coupe des actions sur capital. À surveiller de près.",
  },
  t1_buffer_input_cet1: {
    en: "CET1 ratio",
    fr: "Ratio CET1",
  },
  t1_buffer_input_min: {
    en: "Reg. minimum",
    fr: "Minimum réglementaire",
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
function findBankKpi(
  c: Company,
  shorts: string[],
  nameMatchers: (en: string, fr: string) => boolean,
): { value: number; history: number[] } | null {
  for (const s of shorts) {
    const k = c.kpis.find((x) => x.short === s);
    if (k && k.unit === "%") {
      const v = num(k.value);
      const hist = Array.isArray(k.history)
        ? k.history.filter((h): h is number => typeof h === "number" && Number.isFinite(h))
        : [];
      if (v !== null) return { value: v, history: hist };
    }
  }
  const k = c.kpis.find((x) => {
    if (x.unit !== "%") return false;
    const en = (x.name_en || "").toLowerCase();
    const fr = (x.name_fr || "").toLowerCase();
    return nameMatchers(en, fr);
  });
  if (k) {
    const v = num(k.value);
    const hist = Array.isArray(k.history)
      ? k.history.filter((h): h is number => typeof h === "number" && Number.isFinite(h))
      : [];
    if (v !== null) return { value: v, history: hist };
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
 *  Super-KPI 1 — NET INTEREST MARGIN QUALITY
 *  ═══════════════════════════════════════════════════════════════════════ */
export function netInterestMarginQuality(c: Company, locale: Locale = "en"): SuperKpi {
  const nim = findBankKpi(
    c,
    [
      "NIM",
      "Net Interest Margin",
      "Net Interest Income / Avg Assets",
      "Net Interest Margin (FTE)",
      "NIM (FTE)",
    ],
    (en, fr) =>
      en === "net interest margin" ||
      en === "nim" ||
      en === "net interest income / avg assets" ||
      en === "net interest margin (fte)" ||
      fr === "marge nette d'intérêt" ||
      fr === "marge nette d'intérêts",
  );

  if (!nim || nim.history.length < 3) {
    return naResult(
      {
        id: "nim-quality",
        name: tr("name_nim_quality_na", locale),
        category: "Profitabilité",
        formula: tr("nim_quality_formula_na", locale),
        benchmark: tr("nim_quality_benchmark_na", locale),
        inputs: ["NIM", "NIM history (≥3 pts)"],
      },
      locale,
    );
  }

  // 5y avg = moyenne de l'history (jusqu'à 5 derniers points).
  const last5 = nim.history.slice(-5);
  const avg = last5.reduce((acc, v) => acc + v, 0) / last5.length;
  if (avg === 0) {
    return naResult(
      {
        id: "nim-quality",
        name: tr("name_nim_quality_na", locale),
        category: "Profitabilité",
        formula: tr("nim_quality_formula_na", locale),
        benchmark: tr("nim_quality_benchmark_na", locale),
        inputs: ["NIM", "NIM 5y avg"],
      },
      locale,
    );
  }

  const expansionPct = ((nim.value - avg) / avg) * 100;
  const tier: SuperKpiTier =
    expansionPct >= 10 ? "premium" : expansionPct >= 5 ? "solid" : expansionPct >= 0 ? "average" : "below";
  // Jauge centrée sur 0 : map [-20%, +20%] → [0, 100].
  const gauge = Math.max(0, Math.min(100, ((expansionPct + 20) / 40) * 100));

  const sign = expansionPct >= 0 ? "+" : "";
  const moyLabel = locale.startsWith("fr") ? "vs 5y moy" : "vs 5y avg";

  const interp =
    expansionPct >= 10 ? tr("nim_quality_interp_top", locale)
    : expansionPct >= 0 ? tr("nim_quality_interp_mid", locale)
    : tr("nim_quality_interp_low", locale);

  return {
    id: "nim-quality",
    name: tr("name_nim_quality", locale),
    category: "Profitabilité",
    value: expansionPct,
    display: `${sign}${fmt(expansionPct, 1)} % ${moyLabel}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("nim_quality_input_current", locale)} ${fmt(nim.value, 2)} %`,
      `${tr("nim_quality_input_avg", locale)} ${fmt(avg, 2)} %`,
    ],
    formula: tr("nim_quality_formula", locale),
    benchmark: tr("nim_quality_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — TIER 1 REGULATORY BUFFER
 *  ═══════════════════════════════════════════════════════════════════════ */
export function tier1RegulatoryBuffer(c: Company, locale: Locale = "en"): SuperKpi {
  const cet1 = findBankKpi(
    c,
    [
      "CET1",
      "CET1 Capital Ratio",
      "CET1 Ratio",
      "Tier 1 Ratio",
      "Common Equity Tier 1",
      "Common Equity Tier 1 Ratio",
    ],
    (en, fr) =>
      en === "cet1" ||
      en === "cet1 ratio" ||
      en === "cet1 capital ratio" ||
      en === "tier 1 ratio" ||
      en === "common equity tier 1" ||
      en === "common equity tier 1 ratio" ||
      fr === "ratio cet1" ||
      fr === "ratio tier 1" ||
      fr === "ratio common equity tier 1",
  );

  if (!cet1) {
    return naResult(
      {
        id: "t1-buffer",
        name: tr("name_t1_buffer_na", locale),
        category: "Risque",
        formula: tr("t1_buffer_formula_na", locale),
        benchmark: tr("t1_buffer_benchmark_na", locale),
        inputs: ["CET1 / Tier 1 Ratio"],
      },
      locale,
    );
  }

  // Seuil Basel III well-capitalized = 10 % (4,5 % minimum + buffer
  // conservation + G-SIB surcharge médian sur big US banks).
  const REG_MIN = 10;
  const buffer = cet1.value - REG_MIN;
  const tier: SuperKpiTier =
    buffer >= 6 ? "premium" : buffer >= 4 ? "solid" : buffer >= 2 ? "average" : "below";
  // Jauge [0, 10 pts] → [0, 100].
  const gauge = Math.max(0, Math.min(100, (buffer / 10) * 100));

  const sign = buffer >= 0 ? "+" : "";
  const aboveLabel = locale.startsWith("fr") ? "pts au-dessus minimum" : "pts above minimum";

  const interp =
    buffer >= 6 ? tr("t1_buffer_interp_top", locale)
    : buffer >= 2 ? tr("t1_buffer_interp_mid", locale)
    : tr("t1_buffer_interp_low", locale);

  return {
    id: "t1-buffer",
    name: tr("name_t1_buffer", locale),
    category: "Risque",
    value: buffer,
    display: `${sign}${fmt(buffer, 1)} ${aboveLabel}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("t1_buffer_input_cet1", locale)} ${fmt(cet1.value, 1)} %`,
      `${tr("t1_buffer_input_min", locale)} ${REG_MIN} %`,
    ],
    formula: tr("t1_buffer_formula", locale),
    benchmark: tr("t1_buffer_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 *  ═══════════════════════════════════════════════════════════════════════ */
export const SECTOR_KPIS = [netInterestMarginQuality, tier1RegulatoryBuffer];
