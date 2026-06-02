/**
 * Sector Super-KPIs — MEDIA-STREAMING V1.9.5
 *
 * 2 super-KPIs sectoriels pour media-streaming (DIS, NFLX, SPOT, WBD, PARA,
 * FOX, NWSA, etc., 12 sociétés) :
 *   1. subscriberArpuMomentum : momentum composite ARPU growth + Subscriber growth (Croissance)
 *   2. contentSpendEfficiency : Revenue / Content Spend (Profitabilité)
 *
 * Convention identique à src/lib/super-kpi.ts :
 *   - Chaque fonction retourne un objet SuperKpi complet.
 *   - i18n via mini-dictionnaire SECTOR_STRINGS (EN + FR obligatoires).
 *   - Pas d'em-dash dans les narratives FR.
 */

import type { Company, KPI } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";

export type SuperKpiTier = "premium" | "solid" | "average" | "below" | "na";

export type SuperKpiCategory =
  | "Croissance"
  | "Profitabilité"
  | "Risque"
  | "Stratégie"
  | "Composite";

export type SuperKpi = {
  id: string;
  name: string;
  category: SuperKpiCategory;
  value: number | null;
  display: string;
  tier: SuperKpiTier;
  color: string;
  tierLabel: string;
  gaugePct: number;
  inputs: string[];
  formula: string;
  interpretation: string;
  benchmark: string;
};

const TIER_COLOR: Record<SuperKpiTier, string> = {
  premium: "#10b981",
  solid: "#84cc16",
  average: "#f59e0b",
  below: "#f43f5e",
  na: "#71717a",
};

/* ═════════════════════════════════════════════════════════════════════
 *  i18n strings sector-specific
 * ═════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string; de?: string };

function pickLoc(s: LocalizedString, locale: Locale): string {
  const rec = s as Record<string, string | undefined>;
  if (rec[locale]) return rec[locale]!;
  const base = locale.split("-")[0];
  if (rec[base]) return rec[base]!;
  return s.en;
}

const TIER_LABEL: Record<SuperKpiTier, LocalizedString> = {
  premium: { en: "Premium", fr: "Premium", de: "Premium" },
  solid:   { en: "Solid",   fr: "Solide",  de: "Solide" },
  average: { en: "Average", fr: "Moyen",   de: "Mittel" },
  below:   { en: "Below",   fr: "Faible",  de: "Schwach" },
  na:      { en: "N/A",     fr: "Non applicable", de: "Nicht anwendbar" },
};

export const SECTOR_STRINGS = {
  na_data: {
    en: "Required data not available for this media-streaming company.",
    fr: "Données nécessaires non disponibles pour cette société media-streaming.",
  },

  // Subscriber ARPU Momentum (composite ARPU + Subs growth)
  sam_name: {
    en: "Subscriber ARPU Momentum",
    fr: "Momentum Abonnés-ARPU",
  },
  sam_formula: {
    en: "(ARPU YoY growth + Subscribers YoY growth) / 2 (composite momentum)",
    fr: "(Croissance YoY ARPU + Croissance YoY abonnes) / 2 (momentum composite)",
  },
  sam_benchmark: {
    en: ">= 15 % premium · >= 8 % solid · >= 4 % average · < 4 % below",
    fr: ">= 15 % premium, >= 8 % solide, >= 4 % moyen, < 4 % faible",
  },
  sam_interp_premium: {
    en: "Exceptional growth momentum. The platform combines aggressive subscriber acquisition with strong pricing power on ARPU, a rare configuration signalling a structural leader on its streaming segment.",
    fr: "Momentum de croissance exceptionnel. La plateforme combine une acquisition agressive d'abonnes et un fort pricing power sur l'ARPU, configuration rare qui signale un leader structurel sur son segment streaming.",
  },
  sam_interp_solid: {
    en: "Solid momentum. The subscriber base keeps growing and ARPU is rising in parallel, a healthy mix that supports the multi-year revenue trajectory.",
    fr: "Momentum solide. La base d'abonnes continue de croitre et l'ARPU progresse en parallele, mix sain qui soutient la trajectoire de revenus pluriannuelle.",
  },
  sam_interp_average: {
    en: "Average momentum. Growth is real but moderate, typically driven by one of the two levers (subscribers or ARPU) while the other stagnates or compensates.",
    fr: "Momentum moyen. La croissance existe mais reste moderee, typiquement portee par un des deux leviers (abonnes ou ARPU) tandis que l'autre stagne ou compense.",
  },
  sam_interp_below: {
    en: "Weak momentum. The combination of subscriber and ARPU growth is below the streaming sector average, signalling potential maturity, churn pressure, or pricing constraint.",
    fr: "Momentum faible. La combinaison croissance abonnes plus ARPU est inferieure a la moyenne du secteur streaming, signal potentiel de maturite, de pression sur le churn ou de contrainte sur les prix.",
  },

  // Content Spend Efficiency (Revenue / Content Spend)
  cse_name: {
    en: "Content Spend Efficiency",
    fr: "Efficacité du Content Spend",
  },
  cse_formula: {
    en: "Revenue / Content Spend (revenue generated per dollar invested in content)",
    fr: "Revenu / Content Spend (revenu genere par dollar investi en contenu)",
  },
  cse_benchmark: {
    en: ">= 2.5x premium · >= 1.8x solid · >= 1.3x average · < 1.3x below",
    fr: ">= 2,5x premium, >= 1,8x solide, >= 1,3x moyen, < 1,3x faible",
  },
  cse_interp_premium: {
    en: "Exceptional content monetization. Each dollar invested in programming generates a high revenue multiple, the sign of a strong catalogue, a loyal audience, and pricing power that lift content into a true profit lever.",
    fr: "Monetisation du contenu exceptionnelle. Chaque dollar investi en programmation genere un multiple de revenus eleve, signe d'un catalogue fort, d'une audience fidele et d'un pricing power qui transforment le contenu en veritable levier de profit.",
  },
  cse_interp_solid: {
    en: "Solid content efficiency. The content P&L is well calibrated relative to monetization, supporting margin expansion as the subscriber base scales.",
    fr: "Efficacite du contenu solide. Le P&L contenu est bien calibre par rapport a la monetisation, soutenant l'expansion des marges au fur et a mesure que la base d'abonnes scale.",
  },
  cse_interp_average: {
    en: "Average content efficiency. Revenue covers the content envelope without generating a clear multiple, typical of platforms still investing heavily to build their library or in transition to streaming.",
    fr: "Efficacite du contenu moyenne. Les revenus couvrent l'enveloppe contenu sans generer de multiple clair, typique de plateformes encore en investissement lourd pour batir leur catalogue ou en transition vers le streaming.",
  },
  cse_interp_below: {
    en: "Weak content efficiency. Content spend weighs heavily on the P&L versus generated revenue, a warning signal on streaming unit economics and a potential sign of an inflated programming envelope or insufficient monetization.",
    fr: "Efficacite du contenu faible. Le content spend pese fortement sur le P&L au regard des revenus generes, signal d'alerte sur les unit economics streaming et signe potentiel d'une enveloppe programmation surdimensionnee ou d'une monetisation insuffisante.",
  },
};

/* ═════════════════════════════════════════════════════════════════════
 *  Helpers
 * ═════════════════════════════════════════════════════════════════════ */

function findKpi(kpis: KPI[] | undefined, names: string[]): KPI | undefined {
  if (!kpis || kpis.length === 0) return undefined;
  const lower = names.map((n) => n.toLowerCase());
  return kpis.find((k) => {
    const candidates = [
      k.short,
      k.name_fr,
      (k as KPI & { name_en?: string }).name_en,
    ]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => v.toLowerCase());
    return candidates.some((c) => lower.some((target) => c.includes(target)));
  });
}

function parseNumber(value: KPI["value"] | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value
      .replace(/ /g, " ")
      .replace(/\s+/g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.\-+]/g, "");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractHistory(kpi: KPI | undefined): number[] {
  if (!kpi) return [];
  const k = kpi as KPI & {
    history?: Array<{ value?: number | string | null }> | Record<string, number | string | null>;
    values?: Array<{ value?: number | string | null }> | Record<string, number | string | null>;
  };
  const raw = k.history ?? k.values;
  if (!raw) return [];
  const items: Array<number | string | null | undefined> = (Array.isArray(raw)
    ? (raw as unknown[]).map((r) => (typeof r === "object" && r !== null && "value" in r ? (r as { value: unknown }).value : r)) as Array<number | string | null | undefined>
    : (Object.values(raw) as Array<number | string | null | undefined>));
  const out: number[] = [];
  for (const it of items) {
    const n = parseNumber(it as KPI["value"]);
    if (n !== null) out.push(n);
  }
  return out;
}

function naSuperKpi(
  id: string,
  name: string,
  category: SuperKpiCategory,
  locale: Locale,
  formula: string,
  benchmark: string,
): SuperKpi {
  return {
    id,
    name,
    category,
    value: null,
    display: "N/A",
    tier: "na",
    color: TIER_COLOR.na,
    tierLabel: pickLoc(TIER_LABEL.na, locale),
    gaugePct: 0,
    inputs: [],
    formula,
    interpretation: pickLoc(SECTOR_STRINGS.na_data, locale),
    benchmark,
  };
}

function formatComposite(value: number, locale: Locale): string {
  const sign = value > 0 ? "+" : "";
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${sign}${num} % ${locale === "fr" ? "composite" : "composite"}`;
}

function formatMultiple(value: number, locale: Locale): string {
  const num = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${num} ×`;
}

function yoyPct(history: number[]): number | null {
  if (history.length < 2) return null;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null;
  return ((last - prev) / Math.abs(prev)) * 100;
}

/* ═════════════════════════════════════════════════════════════════════
 *  1. Subscriber ARPU Momentum (composite ARPU YoY + Subs YoY)
 * ═════════════════════════════════════════════════════════════════════ */

const ARPU_NAMES = [
  "ARPU",
  "Average Revenue Per User",
  "Average Revenue per Member",
  "ARPU mensuel",
];

const SUBSCRIBERS_NAMES = [
  "Subscribers",
  "DTC Subscribers",
  "Paid Members",
  "Paid Memberships",
  "Paying Subscribers",
  "Premium Subscribers",
  "Abonnes",
  "Abonnés",
];

export function subscriberArpuMomentum(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.sam_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.sam_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.sam_name, locale);

  const arpuKpi = findKpi(c.kpis, ARPU_NAMES);
  const subKpi = findKpi(c.kpis, SUBSCRIBERS_NAMES);
  const arpuHist = extractHistory(arpuKpi);
  const subHist = extractHistory(subKpi);

  const arpuYoy = yoyPct(arpuHist);
  const subYoy = yoyPct(subHist);

  if (arpuKpi == null || subKpi == null || arpuYoy == null || subYoy == null) {
    return naSuperKpi(
      "subscriberArpuMomentum",
      name,
      "Croissance",
      locale,
      formula,
      benchmark,
    );
  }

  const composite = (arpuYoy + subYoy) / 2;

  let tier: SuperKpiTier;
  let interpretation: string;
  if (composite >= 15) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.sam_interp_premium, locale);
  } else if (composite >= 8) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.sam_interp_solid, locale);
  } else if (composite >= 4) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.sam_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.sam_interp_below, locale);
  }

  // Gauge : <= 0 % = 0, >= 20 % = 100
  const gaugePct = composite <= 0 ? 0 : composite >= 20 ? 100 : Math.max(0, Math.min(100, (composite / 20) * 100));

  return {
    id: "subscriberArpuMomentum",
    name,
    category: "Croissance",
    value: composite,
    display: formatComposite(composite, locale),
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [arpuKpi.short, subKpi.short],
    formula,
    interpretation,
    benchmark,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  2. Content Spend Efficiency (Revenue / Content Spend)
 * ═════════════════════════════════════════════════════════════════════ */

const REVENUE_NAMES = [
  "Revenue",
  "Total Revenue",
  "Net Revenue",
  "Revenues",
  "Chiffre d'affaires",
  "CA",
];

const CONTENT_SPEND_NAMES = [
  "Content Spend",
  "Content Spending",
  "Content Investment",
  "Programming Costs",
  "Programming Expenses",
  "Cost of Content",
  "Depenses de contenu",
  "Dépenses de contenu",
];

export function contentSpendEfficiency(c: Company, locale: Locale = "en"): SuperKpi {
  const formula = pickLoc(SECTOR_STRINGS.cse_formula, locale);
  const benchmark = pickLoc(SECTOR_STRINGS.cse_benchmark, locale);
  const name = pickLoc(SECTOR_STRINGS.cse_name, locale);

  const revKpi = findKpi(c.kpis, REVENUE_NAMES);
  const spendKpi = findKpi(c.kpis, CONTENT_SPEND_NAMES);
  const revenue = parseNumber(revKpi?.value);
  const spend = parseNumber(spendKpi?.value);

  if (revKpi == null || spendKpi == null || revenue == null || spend == null || spend <= 0) {
    return naSuperKpi(
      "contentSpendEfficiency",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  const ratio = revenue / spend;

  if (!Number.isFinite(ratio) || ratio < 0) {
    return naSuperKpi(
      "contentSpendEfficiency",
      name,
      "Profitabilité",
      locale,
      formula,
      benchmark,
    );
  }

  let tier: SuperKpiTier;
  let interpretation: string;
  if (ratio >= 2.5) {
    tier = "premium";
    interpretation = pickLoc(SECTOR_STRINGS.cse_interp_premium, locale);
  } else if (ratio >= 1.8) {
    tier = "solid";
    interpretation = pickLoc(SECTOR_STRINGS.cse_interp_solid, locale);
  } else if (ratio >= 1.3) {
    tier = "average";
    interpretation = pickLoc(SECTOR_STRINGS.cse_interp_average, locale);
  } else {
    tier = "below";
    interpretation = pickLoc(SECTOR_STRINGS.cse_interp_below, locale);
  }

  // Gauge : 0x = 0, >= 3.5x = 100
  const gaugePct = ratio <= 0 ? 0 : ratio >= 3.5 ? 100 : Math.max(0, Math.min(100, (ratio / 3.5) * 100));

  return {
    id: "contentSpendEfficiency",
    name,
    category: "Profitabilité",
    value: ratio,
    display: formatMultiple(ratio, locale),
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct,
    inputs: [revKpi.short, spendKpi.short],
    formula,
    interpretation,
    benchmark,
  };
}

/* ═════════════════════════════════════════════════════════════════════
 *  Registry
 * ═════════════════════════════════════════════════════════════════════ */

export const SECTOR_KPIS = [
  {
    id: "subscriberArpuMomentum",
    category: "Croissance" as SuperKpiCategory,
    compute: subscriberArpuMomentum,
  },
  {
    id: "contentSpendEfficiency",
    category: "Profitabilité" as SuperKpiCategory,
    compute: contentSpendEfficiency,
  },
];
