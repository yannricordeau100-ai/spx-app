/**
 * Super-KPIs sectoriels AERO-DEFENSE V1.9.5
 *
 * Bucket aero-defense (8 stés cibles) :
 *   BA, LMT, RTX, NOC, GD, LHX, TDG, HII
 *
 * 2 super-KPIs propres au secteur :
 *   1. backlogYearsCoverage   — Backlog / Revenue annuel = années visibilité (Stratégie)
 *   2. defenseProgramsMix     — % revenu défense gouv + international (Risque)
 *
 * Heuristique fallback : si le bucket ne reconnaît pas la sté, on tente un
 * match subsector ("aerospace", "defense", "defence") avant de bailer en N/A.
 *
 * Règles communes :
 *   - EN canonical, FR traduction
 *   - Pas d'em-dash dans les strings FR
 *   - Vocabulaire FR strict (Mettrik) : stés, pas "sociétés cotées"
 *   - Pas de commit, pas d'edit sur src/lib/super-kpi.ts
 */

import type { Company, KPI } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import type { SuperKpi, SuperKpiTier } from "@/lib/super-kpi";

/* ═════════════════════════════════════════════════════════════════════
 *  i18n
 * ═════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string };

function pickLoc(s: LocalizedString, locale: Locale): string {
  const rec = s as Record<string, string | undefined>;
  if (rec[locale]) return rec[locale]!;
  const base = locale.split("-")[0];
  if (rec[base]) return rec[base]!;
  return s.en;
}

const TIER_COLOR: Record<SuperKpiTier, string> = {
  premium: "#10b981",
  solid: "#84cc16",
  average: "#f59e0b",
  below: "#f43f5e",
  na: "#71717a",
};

const TIER_LABEL: Record<SuperKpiTier, LocalizedString> = {
  premium: { en: "Premium", fr: "Premium" },
  solid:   { en: "Solid",   fr: "Solide" },
  average: { en: "Average", fr: "Moyen" },
  below:   { en: "Below",   fr: "Faible" },
  na:      { en: "N/A",     fr: "Non applicable" },
};

export const SECTOR_STRINGS = {
  // Generic
  na_data: {
    en: "Required data not available for this company.",
    fr: "Données nécessaires non disponibles pour cette sté.",
  },
  na_missing_prefix: {
    en: "Cannot compute. Missing inputs: ",
    fr: "Calcul impossible. KPIs manquants : ",
  },

  // ── backlogYearsCoverage ──────────────────────────────────────────
  backlog_name: {
    en: "Backlog Years Coverage",
    fr: "Couverture backlog en années",
  },
  backlog_formula: {
    en: "Backlog / Annual Revenue (years of visibility)",
    fr: "Backlog / Revenu annuel (années de visibilité)",
  },
  backlog_benchmark: {
    en: "≥ 4y premium · 2.5-4 solid · 1.5-2.5 average · < 1.5 below",
    fr: "≥ 4 ans premium · 2,5 à 4 solide · 1,5 à 2,5 moyen · < 1,5 faible",
  },
  backlog_display: {
    en: "{n} yrs",
    fr: "{n} ans",
  },
  backlog_input_backlog: {
    en: "Backlog",
    fr: "Backlog",
  },
  backlog_input_revenue: {
    en: "Annual Revenue",
    fr: "Revenu annuel",
  },
  backlog_interp_premium: {
    en: "Backlog covers more than 4 years of revenue. Exceptional visibility on long-cycle programs, the company can absorb a defense budget slowdown without immediate revenue impact.",
    fr: "Le backlog couvre plus de 4 ans de revenu. Visibilité exceptionnelle sur les programmes longs, la sté peut absorber un ralentissement des budgets défense sans impact immédiat sur le revenu.",
  },
  backlog_interp_solid: {
    en: "Backlog covers 2.5 to 4 years of revenue. Solid visibility on long-cycle production and services contracts, in line with sector standards.",
    fr: "Le backlog couvre 2,5 à 4 ans de revenu. Visibilité solide sur les contrats de production et services longs, en ligne avec les standards du secteur.",
  },
  backlog_interp_average: {
    en: "Backlog covers 1.5 to 2.5 years of revenue. Average visibility, the company depends more on new contract wins to sustain growth.",
    fr: "Le backlog couvre 1,5 à 2,5 ans de revenu. Visibilité moyenne, la sté dépend davantage des nouvelles prises de contrats pour soutenir la croissance.",
  },
  backlog_interp_below: {
    en: "Backlog covers less than 1.5 years of revenue. Low visibility for an aero-defense player, structural exposure to short-cycle commercial or services activity.",
    fr: "Le backlog couvre moins de 1,5 an de revenu. Visibilité faible pour un acteur aéro-défense, exposition structurelle à l'activité commerciale ou services à cycle court.",
  },

  // ── defenseProgramsMix ────────────────────────────────────────────
  defense_name: {
    en: "Defense Programs Mix",
    fr: "Part programmes défense",
  },
  defense_formula: {
    en: "Defense Revenue / Total Revenue x 100",
    fr: "Revenu défense / Revenu total x 100",
  },
  defense_benchmark: {
    en: "≥ 80% premium · 60-80 solid · 40-60 average · < 40 below",
    fr: "≥ 80 % premium · 60 à 80 solide · 40 à 60 moyen · < 40 faible",
  },
  defense_display: {
    en: "{n} %",
    fr: "{n} %",
  },
  defense_input_defense: {
    en: "Defense Revenue",
    fr: "Revenu défense",
  },
  defense_input_revenue: {
    en: "Total Revenue",
    fr: "Revenu total",
  },
  defense_interp_premium: {
    en: "More than 80% of revenue comes from defense programs (government and international). Full defense profile, structural protection against commercial aerospace cyclicality.",
    fr: "Plus de 80 % du revenu provient des programmes défense (gouv et international). Profil full défense, protection structurelle contre la cyclicité de l'aéronautique commerciale.",
  },
  defense_interp_solid: {
    en: "Defense mix between 60 and 80% of revenue. Dominant defense exposure with a residual commercial leg, healthy balance for the sector.",
    fr: "Mix défense entre 60 et 80 % du revenu. Exposition défense dominante avec une jambe commerciale résiduelle, équilibre sain pour le secteur.",
  },
  defense_interp_average: {
    en: "Defense mix between 40 and 60% of revenue. Balanced profile, exposure to commercial aero cycle remains material.",
    fr: "Mix défense entre 40 et 60 % du revenu. Profil équilibré, l'exposition au cycle aéronautique commercial reste significative.",
  },
  defense_interp_below: {
    en: "Defense represents less than 40% of revenue. Profile dominated by commercial aerospace, full exposure to airline capex and travel demand cycles.",
    fr: "La défense représente moins de 40 % du revenu. Profil dominé par l'aéronautique commerciale, exposition pleine aux cycles de capex des compagnies aériennes et de la demande de voyage.",
  },
} as const satisfies Record<string, LocalizedString>;

/* ═════════════════════════════════════════════════════════════════════
 *  Helpers
 * ═════════════════════════════════════════════════════════════════════ */

function findKpi(company: Company, candidates: string[]): KPI | null {
  if (!company?.kpis) return null;
  const wanted = candidates.map((c) => c.toLowerCase().trim());
  for (const k of company.kpis) {
    const short = (k.short || "").toLowerCase().trim();
    const nameFr = (k.name_fr || "").toLowerCase().trim();
    const nameEn = (k.name_en || "").toLowerCase().trim();
    if (wanted.includes(short) || wanted.includes(nameFr) || wanted.includes(nameEn)) {
      return k;
    }
  }
  return null;
}

/** Fallback subsector heuristique : repère "aerospace", "defense", "defence". */
function looksAeroDefense(company: Company): boolean {
  const fields = [
    (company as unknown as { subsector?: string }).subsector,
    (company as unknown as { sector?: string }).sector,
    (company as unknown as { industry?: string }).industry,
  ];
  for (const f of fields) {
    if (typeof f !== "string") continue;
    const v = f.toLowerCase();
    if (v.includes("aerospace") || v.includes("defense") || v.includes("defence")) {
      return true;
    }
  }
  return false;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.\-]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmtFr(n: number, decimals = 1): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtEn(n: number, decimals = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtNumber(n: number, locale: Locale, decimals = 1): string {
  const base = locale.split("-")[0];
  return base === "fr" ? fmtFr(n, decimals) : fmtEn(n, decimals);
}

function naResult(
  id: string,
  name: string,
  category: SuperKpi["category"],
  locale: Locale,
  missing: string[],
): SuperKpi {
  const msg =
    missing.length > 0
      ? pickLoc(SECTOR_STRINGS.na_missing_prefix, locale) + missing.join(", ")
      : pickLoc(SECTOR_STRINGS.na_data, locale);
  return {
    id,
    name,
    category,
    value: null,
    display: "n.d.",
    tier: "na",
    color: TIER_COLOR.na,
    tierLabel: pickLoc(TIER_LABEL.na, locale),
    gaugePct: 0,
    inputs: [],
    formula: "",
    interpretation: msg,
    benchmark: "",
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. Backlog Years Coverage (years)
 * ═════════════════════════════════════════════════════════════════════ */

export function backlogYearsCoverage(company: Company, locale: Locale = "en"): SuperKpi {
  const id = "aero-defense.backlog_years_coverage";
  const name = pickLoc(SECTOR_STRINGS.backlog_name, locale);
  const category: SuperKpi["category"] = "Stratégie";

  const backlogKpi = findKpi(company, [
    "Backlog",
    "Funded Backlog",
    "Total Backlog",
    "Order Backlog",
    "Carnet de commandes",
    "Backlog total",
  ]);
  const revenueKpi = findKpi(company, [
    "Revenue",
    "Total Revenue",
    "Net Revenue",
    "Net Sales",
    "Sales",
    "Revenu",
    "Revenu total",
    "Chiffre d'affaires",
  ]);

  const missing: string[] = [];
  if (!backlogKpi) missing.push("Backlog");
  if (!revenueKpi) missing.push("Revenue");
  if (missing.length > 0) {
    // Heuristique fallback : si on est aéro-défense, on garde le label sectoriel ;
    // sinon on bail en N/A standard avec inputs manquants listés.
    void looksAeroDefense(company);
    return naResult(id, name, category, locale, missing);
  }

  const backlog = toNumber(backlogKpi!.value);
  const revenue = toNumber(revenueKpi!.value);

  if (backlog === null || revenue === null || revenue <= 0) {
    return naResult(id, name, category, locale, missing);
  }

  const value = backlog / revenue;

  let tier: SuperKpiTier;
  let interp: LocalizedString;
  if (value >= 4) {
    tier = "premium";
    interp = SECTOR_STRINGS.backlog_interp_premium;
  } else if (value >= 2.5) {
    tier = "solid";
    interp = SECTOR_STRINGS.backlog_interp_solid;
  } else if (value >= 1.5) {
    tier = "average";
    interp = SECTOR_STRINGS.backlog_interp_average;
  } else {
    tier = "below";
    interp = SECTOR_STRINGS.backlog_interp_below;
  }

  // Jauge [0, 6 ans] → [0, 100].
  const gaugePct = Math.max(0, Math.min(100, (value / 6) * 100));
  const displayTpl = pickLoc(SECTOR_STRINGS.backlog_display, locale);
  const display = displayTpl.replace("{n}", fmtNumber(value, locale, 1));

  return {
    id,
    name,
    category,
    value,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [
      `${pickLoc(SECTOR_STRINGS.backlog_input_backlog, locale)} ${backlogKpi!.short}`,
      `${pickLoc(SECTOR_STRINGS.backlog_input_revenue, locale)} ${revenueKpi!.short}`,
    ],
    formula: pickLoc(SECTOR_STRINGS.backlog_formula, locale),
    benchmark: pickLoc(SECTOR_STRINGS.backlog_benchmark, locale),
    interpretation: pickLoc(interp, locale),
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  2. Defense Programs Mix (%)
 * ═════════════════════════════════════════════════════════════════════ */

export function defenseProgramsMix(company: Company, locale: Locale = "en"): SuperKpi {
  const id = "aero-defense.defense_programs_mix";
  const name = pickLoc(SECTOR_STRINGS.defense_name, locale);
  const category: SuperKpi["category"] = "Risque";

  const defenseKpi = findKpi(company, [
    "Defense Revenue",
    "Defense Programs",
    "Defense Sales",
    "Defense",
    "Government Revenue",
    "Defense & Government",
    "Revenu défense",
    "Programmes défense",
  ]);
  const revenueKpi = findKpi(company, [
    "Revenue",
    "Total Revenue",
    "Net Revenue",
    "Net Sales",
    "Sales",
    "Revenu",
    "Revenu total",
    "Chiffre d'affaires",
  ]);

  const missing: string[] = [];
  if (!defenseKpi) missing.push("Defense Revenue");
  if (!revenueKpi) missing.push("Total Revenue");
  if (missing.length > 0) {
    void looksAeroDefense(company);
    return naResult(id, name, category, locale, missing);
  }

  const defenseRaw = toNumber(defenseKpi!.value);
  const revenue = toNumber(revenueKpi!.value);

  if (defenseRaw === null || revenue === null || revenue <= 0) {
    return naResult(id, name, category, locale, missing);
  }

  // Si le KPI Defense est déjà exprimé en %, on prend tel quel.
  // Sinon on calcule defense / revenue x 100.
  const defenseUnit = (defenseKpi!.unit || "").trim();
  const value = defenseUnit === "%" ? defenseRaw : (defenseRaw / revenue) * 100;

  let tier: SuperKpiTier;
  let interp: LocalizedString;
  if (value >= 80) {
    tier = "premium";
    interp = SECTOR_STRINGS.defense_interp_premium;
  } else if (value >= 60) {
    tier = "solid";
    interp = SECTOR_STRINGS.defense_interp_solid;
  } else if (value >= 40) {
    tier = "average";
    interp = SECTOR_STRINGS.defense_interp_average;
  } else {
    tier = "below";
    interp = SECTOR_STRINGS.defense_interp_below;
  }

  // Jauge [0, 100 %] → [0, 100].
  const gaugePct = Math.max(0, Math.min(100, value));
  const displayTpl = pickLoc(SECTOR_STRINGS.defense_display, locale);
  const display = displayTpl.replace("{n}", fmtNumber(value, locale, 1));

  return {
    id,
    name,
    category,
    value,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [
      `${pickLoc(SECTOR_STRINGS.defense_input_defense, locale)} ${defenseKpi!.short}`,
      `${pickLoc(SECTOR_STRINGS.defense_input_revenue, locale)} ${revenueKpi!.short}`,
    ],
    formula: pickLoc(SECTOR_STRINGS.defense_formula, locale),
    benchmark: pickLoc(SECTOR_STRINGS.defense_benchmark, locale),
    interpretation: pickLoc(interp, locale),
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  Export liste pour intégration côté super-kpi.ts.
 * ═════════════════════════════════════════════════════════════════════ */

export const SECTOR_KPIS = [backlogYearsCoverage, defenseProgramsMix];
