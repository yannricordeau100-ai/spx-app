/**
 * Sector Super-KPIs — PHARMA V1.9.5
 *
 * Cible : 33 stés pharma (PFE, LLY, MRK, NVS, NVO, AZN, JNJ, ROG.SW, etc.)
 * Bucket source : /tmp/sector-buckets.json clé "pharma"
 *
 * Deux super-KPIs spécifiques au business model pharmaceutique :
 *   1. topDrugConcentrationRisk : part du top drug dans le revenu total
 *      (risque cliff de brevet).
 *   2. rdPipelineEfficiency : ratio R&D / Revenue × intensité pipeline
 *      (capacité d'innovation pondérée par le pipeline Phase 3).
 *
 * Convention identique à src/lib/super-kpi.ts :
 *   - i18n via SECTOR_STRINGS (EN + FR obligatoires)
 *   - Tier premium / solid / average / below / na
 *   - Format FR strict (pas d'em-dash, virgule décimale)
 */

import type { Company, KPI } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import type { SuperKpi, SuperKpiTier } from "@/lib/super-kpi";

/* ─────────────────────────────────────────────────────────────────────── */

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
  solid:   { en: "Solid",   fr: "Solide" },
  average: { en: "Average", fr: "Moyen" },
  below:   { en: "Below",   fr: "Faible" },
  na:      { en: "N/A",     fr: "Non applicable" },
};

function pickLoc(s: LocalizedString, locale: Locale): string {
  const rec = s as Record<string, string | undefined>;
  if (rec[locale]) return rec[locale]!;
  const base = locale.split("-")[0];
  if (rec[base]) return rec[base]!;
  return s.en;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  SECTOR_STRINGS — i18n EN + FR
 *  ═══════════════════════════════════════════════════════════════════════ */

export const SECTOR_STRINGS = {
  na_data: {
    en: "Required data not available for this company.",
    fr: "Données nécessaires non disponibles pour cette société.",
  },

  // 1. Top Drug Concentration Risk
  name_topdrug: {
    en: "Top Drug Concentration Risk",
    fr: "Concentration du top drug",
  },
  topdrug_formula: {
    en: "Top Drug Revenue / Total Revenue (%)",
    fr: "Revenu top drug / Revenue total (%)",
  },
  topdrug_benchmark: {
    en: "< 20 % diversified · 20-30 % solid · 30-45 % concentrated · >= 45 % cliff risk",
    fr: "< 20 % diversifié · 20-30 % solide · 30-45 % concentré · >= 45 % risque cliff",
  },
  topdrug_interp_premium: {
    en: "Diversified portfolio. No single drug exceeds 20 % of revenue: a patent cliff on the lead product would not threaten the overall trajectory.",
    fr: "Portefeuille diversifié. Aucun médicament ne dépasse 20 % du revenu : un cliff de brevet sur le produit phare ne menacerait pas la trajectoire globale.",
  },
  topdrug_interp_solid: {
    en: "Solid concentration. The top drug weighs 20-30 % of revenue: identified but manageable risk if the pipeline takes over.",
    fr: "Concentration solide. Le top drug pese 20-30 % du revenu : risque identifie mais gerable si le pipeline prend le relais.",
  },
  topdrug_interp_average: {
    en: "Marked concentration on the lead drug (30-45 % of revenue). Patent cliff risk in coming years: monitor Phase 3 pipeline closely.",
    fr: "Concentration marquee sur le medicament phare (30-45 % du revenu). Risque de patent cliff dans les annees a venir : surveiller le pipeline Phase 3 de pres.",
  },
  topdrug_interp_below: {
    en: "Critical dependency on the lead drug (>= 45 %). Patent cliff = existential risk. The trajectory depends on the ability to launch successors before expiry.",
    fr: "Dependance critique au medicament phare (>= 45 %). Patent cliff = risque existentiel. La trajectoire depend de la capacite a lancer des successeurs avant l'expiration.",
  },
  topdrug_input_top: { en: "Top drug revenue", fr: "Revenu top drug" },
  topdrug_input_rev: { en: "Total revenue",   fr: "Revenue total" },

  // 2. R&D Pipeline Efficiency
  name_rdpip: {
    en: "R&D Pipeline Efficiency",
    fr: "Efficacite R&D x pipeline",
  },
  rdpip_formula: {
    en: "(R&D / Revenue %) x (Pipeline count / 10)",
    fr: "(R&D / Revenue %) x (nb pipeline / 10)",
  },
  rdpip_benchmark: {
    en: ">= 4.0 premium · >= 2.5 solid · >= 1.5 average · < 1.5 below",
    fr: ">= 4,0 premium · >= 2,5 solide · >= 1,5 moyen · < 1,5 faible",
  },
  rdpip_interp_premium: {
    en: "Premium R&D engine. The company combines high R&D intensity and a dense Phase 3 pipeline: structural innovation pump driving future revenue.",
    fr: "Moteur R&D premium. La societe combine une forte intensite R&D et un pipeline Phase 3 dense : pompe d'innovation structurelle qui alimente les revenus futurs.",
  },
  rdpip_interp_solid: {
    en: "Solid R&D / pipeline combination. The company invests significantly and has visible pipeline depth: capacity to renew the portfolio confirmed.",
    fr: "Combinaison R&D / pipeline solide. La societe investit significativement et dispose d'une profondeur pipeline visible : capacite a renouveler le portefeuille confirmee.",
  },
  rdpip_interp_average: {
    en: "Average R&D efficiency. Either R&D intensity is moderate, or the pipeline is light: classic Big Pharma profile to compare to peers.",
    fr: "Efficacite R&D moyenne. Soit l'intensite R&D est moderee, soit le pipeline est leger : profil classique Big Pharma a comparer aux pairs.",
  },
  rdpip_interp_below: {
    en: "Low R&D / pipeline efficiency. Combination of low R&D intensity and thin pipeline: trajectory exposed to patent cliffs without identified successors.",
    fr: "Efficacite R&D / pipeline faible. Combinaison d'une faible intensite R&D et d'un pipeline mince : trajectoire exposee aux patent cliffs sans relais identifies.",
  },
  rdpip_input_rd:    { en: "R&D",            fr: "R&D" },
  rdpip_input_rev:   { en: "Revenue",        fr: "Revenue" },
  rdpip_input_pipe:  { en: "Pipeline count", fr: "Nb pipeline" },
} as const;

function tr(key: keyof typeof SECTOR_STRINGS, locale: Locale): string {
  return pickLoc(SECTOR_STRINGS[key], locale);
}

/* ─────────────────────────────────────────────────────────────────────── */

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

function findKpi(c: Company, short: string): KPI | undefined {
  return c.kpis.find((k) => k.short === short);
}

/** Recherche du KPI top drug parmi plusieurs noms candidats. */
function findTopDrugKpi(c: Company): KPI | undefined {
  const candidates = [
    "Top Drug Sales",
    "Top Drug Revenue",
    "Lead Product Revenue",
    "Lead Product Sales",
    "Top Selling Drug",
    "Top Drug",
    "Lead Drug Revenue",
    "Top Product Revenue",
  ];
  for (const s of candidates) {
    const k = findKpi(c, s);
    if (k && k.unit !== "%") return k;
  }
  // Fallback : recherche heuristique sur name_en / name_fr
  return c.kpis.find((k) => {
    if (k.unit === "%") return false;
    const en = (k.name_en || "").toLowerCase();
    const fr = (k.name_fr || "").toLowerCase();
    return (
      en.includes("top drug") ||
      en.includes("lead product") ||
      en.includes("top selling drug") ||
      en.includes("top product") ||
      fr.includes("medicament phare") ||
      fr.includes("produit phare") ||
      fr.includes("top drug") ||
      fr.includes("revenu top")
    );
  });
}

/** Recherche du KPI Revenue total. */
function findRevenueKpi(c: Company): KPI | undefined {
  const standardShorts = [
    "Revenue",
    "Total Revenue",
    "Total Revenues",
    "Net Sales",
    "Total Net Sales",
    "Sales",
    "Net Revenue",
    "Net Revenues",
    "Group Revenue",
    "Group Sales",
  ];
  for (const s of standardShorts) {
    const k = findKpi(c, s);
    if (k && k.unit !== "%") return k;
  }
  return c.kpis.find((k) => {
    if (k.unit === "%") return false;
    const en = (k.name_en || "").toLowerCase();
    return en === "revenue" || en === "total revenue" || en === "net sales";
  });
}

/** Recherche du KPI R&D (en valeur absolue, pas en %). */
function findRdKpi(c: Company): KPI | undefined {
  const candidates = ["R&D", "R&D Expense", "R&D Spend", "Research and Development"];
  for (const s of candidates) {
    const k = findKpi(c, s);
    if (k && k.unit !== "%") return k;
  }
  return c.kpis.find((k) => {
    if (k.unit === "%") return false;
    const en = (k.name_en || "").toLowerCase();
    const fr = (k.name_fr || "").toLowerCase();
    return (
      (en.includes("r&d") || en.includes("research and development")) &&
      !en.includes("%") &&
      !fr.includes("ratio")
    );
  });
}

/** Recherche du compteur pipeline (Phase 3 ou pipeline total). */
function findPipelineCount(c: Company): number | null {
  const candidates = [
    "Pipeline Phase 3",
    "Phase 3 Pipeline",
    "R&D Pipeline",
    "Pipeline",
    "Phase 3 Programs",
  ];
  for (const s of candidates) {
    const k = findKpi(c, s);
    if (k) {
      const v = num(k.value);
      if (v !== null) return v;
    }
  }
  // Recherche heuristique
  const k = c.kpis.find((kp) => {
    const en = (kp.name_en || "").toLowerCase();
    const fr = (kp.name_fr || "").toLowerCase();
    return (
      en.includes("pipeline") ||
      en.includes("phase 3") ||
      fr.includes("pipeline") ||
      fr.includes("phase 3")
    );
  });
  return k ? num(k.value) : null;
}

function naResult(
  base: { id: string; name: string; category: SuperKpi["category"]; formula: string; benchmark: string; inputs: string[] },
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
 *  Super-KPI 1 — TOP DRUG CONCENTRATION RISK
 *  Categorie : Risque
 *  ═══════════════════════════════════════════════════════════════════════ */

export function topDrugConcentrationRisk(c: Company, locale: Locale = "en"): SuperKpi {
  const topDrug = findTopDrugKpi(c);
  const revenue = findRevenueKpi(c);

  const td = topDrug ? num(topDrug.value) : null;
  const rv = revenue ? num(revenue.value) : null;

  if (td === null || rv === null || rv === 0) {
    return naResult(
      {
        id: "pharma_topdrug",
        name: tr("name_topdrug", locale),
        category: "Risque",
        formula: tr("topdrug_formula", locale),
        benchmark: tr("topdrug_benchmark", locale),
        inputs: [tr("topdrug_input_top", locale), tr("topdrug_input_rev", locale)],
      },
      locale,
    );
  }

  const pct = (td / rv) * 100;
  const tier: SuperKpiTier =
    pct < 20 ? "premium" : pct < 30 ? "solid" : pct < 45 ? "average" : "below";

  const interpretation =
    tier === "premium" ? tr("topdrug_interp_premium", locale)
    : tier === "solid"   ? tr("topdrug_interp_solid", locale)
    : tier === "average" ? tr("topdrug_interp_average", locale)
    : tr("topdrug_interp_below", locale);

  // Jauge : 0 % = premium (gauche), 60 %+ = below (droite plein)
  const gauge = Math.max(0, Math.min(100, (pct / 60) * 100));

  return {
    id: "pharma_topdrug",
    name: tr("name_topdrug", locale),
    category: "Risque",
    value: pct,
    display: `${fmt(pct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [
      `${tr("topdrug_input_top", locale)} ${fmt(td, 1)}`,
      `${tr("topdrug_input_rev", locale)} ${fmt(rv, 1)}`,
    ],
    formula: tr("topdrug_formula", locale),
    benchmark: tr("topdrug_benchmark", locale),
    interpretation,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — R&D PIPELINE EFFICIENCY
 *  Categorie : Strategie
 *  ═══════════════════════════════════════════════════════════════════════ */

export function rdPipelineEfficiency(c: Company, locale: Locale = "en"): SuperKpi {
  const rd = findRdKpi(c);
  const revenue = findRevenueKpi(c);
  const pipelineCount = findPipelineCount(c);

  const rdV = rd ? num(rd.value) : null;
  const rvV = revenue ? num(revenue.value) : null;

  if (rdV === null || rvV === null || rvV === 0) {
    return naResult(
      {
        id: "pharma_rdpip",
        name: tr("name_rdpip", locale),
        category: "Stratégie",
        formula: tr("rdpip_formula", locale),
        benchmark: tr("rdpip_benchmark", locale),
        inputs: [
          tr("rdpip_input_rd", locale),
          tr("rdpip_input_rev", locale),
          tr("rdpip_input_pipe", locale),
        ],
      },
      locale,
    );
  }

  const rdPct = (rdV / rvV) * 100;
  // Si pas de pipeline count : neutre (factor = 1)
  const pipeFactor = pipelineCount !== null && pipelineCount > 0 ? pipelineCount / 10 : 1;
  const score = rdPct * pipeFactor;

  const tier: SuperKpiTier =
    score >= 4 ? "premium" : score >= 2.5 ? "solid" : score >= 1.5 ? "average" : "below";

  const interpretation =
    tier === "premium" ? tr("rdpip_interp_premium", locale)
    : tier === "solid"   ? tr("rdpip_interp_solid", locale)
    : tier === "average" ? tr("rdpip_interp_average", locale)
    : tr("rdpip_interp_below", locale);

  const gauge = Math.max(0, Math.min(100, (score / 6) * 100));

  const inputs: string[] = [
    `${tr("rdpip_input_rd", locale)} ${fmt(rdV, 1)}`,
    `${tr("rdpip_input_rev", locale)} ${fmt(rvV, 1)}`,
  ];
  if (pipelineCount !== null) {
    inputs.push(`${tr("rdpip_input_pipe", locale)} ${fmt(pipelineCount, 0)}`);
  }

  // Display : "X.X (R&D % x pipeline)"
  const display =
    pipelineCount !== null && pipelineCount > 0
      ? `${fmt(score, 1)} (${fmt(rdPct, 1)} % x ${fmt(pipelineCount, 0)})`
      : `${fmt(score, 1)} (${fmt(rdPct, 1)} %)`;

  return {
    id: "pharma_rdpip",
    name: tr("name_rdpip", locale),
    category: "Stratégie",
    value: score,
    display,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs,
    formula: tr("rdpip_formula", locale),
    benchmark: tr("rdpip_benchmark", locale),
    interpretation,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  SECTOR_KPIS — array exporte pour orchestration
 *  ═══════════════════════════════════════════════════════════════════════ */

export const SECTOR_KPIS = [
  {
    id: "pharma_topdrug",
    compute: topDrugConcentrationRisk,
  },
  {
    id: "pharma_rdpip",
    compute: rdPipelineEfficiency,
  },
] as const;
