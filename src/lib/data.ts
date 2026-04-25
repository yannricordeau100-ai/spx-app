import google from "@/data/google.json";
import meta from "@/data/meta.json";
import msci from "@/data/msci.json";
import spgi from "@/data/spgi.json";
import cat from "@/data/cat.json";

export type KPI = {
  /** Short acronym/badge displayed first (e.g. "DAP", "Cloud Rev"). */
  short: string;
  /**
   * ISO date string of the most recent data point (e.g. "2025-12-31").
   * Used to flag stale data with a freshness warning. Optional for backwards
   * compat; if missing we fall back to "unknown" indicator.
   */
  last_data_date?: string;
  /** French name (full). */
  name_fr: string;
  /** Original English name (kept under FR). Optional if FR == EN. */
  name_en?: string;
  /** Italic 1-line explanation: precise scope (which segment, which products, etc.). */
  explanation: string;
  value: string;
  unit: string;
  yoy: string;
  type: string;
  nature: string;
  comparable: string;
  /** Comparability key: KPIs sharing the same key across companies are auto-matched in Compare. */
  compare_key?: string;
  signal: string;
  description: string;
  history: number[];
};

export type Ranks = {
  global_world: string; // e.g. "#4"
  global_us: string;
  sector: string;
  subsector: string;
};

/** Market position: company segment revenue vs total addressable market. */
export type MarketPosition = {
  segment_name: string;
  /** Company revenue on that segment, in the same unit as `segment_unit`. */
  segment_revenue: number;
  segment_unit: string; // "$B", "$M"
  /** Total Addressable Market (point estimate). */
  tam: number;
  tam_unit: string;
  /** Optional TAM range for honest uncertainty display. */
  tam_range?: [number, number];
  /** Source short name + year, e.g. "Gartner, 2025". */
  source: string;
  /** Longer methodological note shown in the "i" tooltip. */
  source_note?: string;
  /** Optional expected market CAGR %, shown as comparison to company CAGR. */
  market_cagr?: number;
};

export type RiskCategory =
  | "regulatory"
  | "competitive"
  | "cyber"
  | "operational"
  | "financial"
  | "macro"
  | "technology";

export type RiskTrend = "new" | "up" | "stable" | "down" | "removed";

export type CompanyRisk = {
  /** Editorial short title (8-14 words). */
  title: string;
  category: RiskCategory;
  /** Literal 10-K quote (2-3 sentences). */
  quote: string;
  /** Trend vs the prior-year 10-K. */
  trend: RiskTrend;
  /** Severity score 1-5 where 5 = most severe. */
  score: 1 | 2 | 3 | 4 | 5;
  /**
   * Rationale for the score, shown in an "i" tooltip.
   * Should cite the 4 inputs: position in 10-K, language intensity,
   * trend vs prior year, category weight.
   */
  score_rationale: string;
};

export type HolderType = "institutionnel" | "particulier" | "insider" | "fondateur" | "fonds souverain";

export type Shareholder = {
  name: string;
  stake_pct: number;
  type: HolderType;
  /** If insider, the role (e.g. "CEO", "Fondateur", "Co-fondateur"). */
  role?: string;
};

/** Peer benchmark hint for a metric. */
export type PeerRank = "bas" | "moyen" | "haut" | "extrême";

/** Governance & executive compensation from the latest annual shareholders meeting. */
export type Governance = {
  /** Date of the last annual shareholders meeting, e.g. "2025-06-10". */
  agm_date: string;
  /** Fiscal year the numbers correspond to. */
  fiscal_year: number;
  /** CEO name. */
  ceo_name: string;
  /** CEO total compensation (cash + stock + perks), in $M. */
  ceo_total_comp_m: number;
  /** Peer rank for this metric (sector median). */
  ceo_comp_rank?: PeerRank;
  /** CEO compensation as a multiple of median employee pay. */
  ceo_pay_ratio: number;
  ceo_pay_ratio_rank?: PeerRank;
  /** Shareholder approval % on executive compensation vote (formerly "say-on-pay"). */
  exec_comp_approval_pct: number;
  exec_comp_approval_rank?: PeerRank;
  /** % of independent directors on the board. */
  board_independence_pct: number;
  board_independence_rank?: PeerRank;
  /** Number of directors. */
  board_size: number;
  /** Average tenure of directors, in years. */
  avg_tenure_years: number;
  /** % of women on the board. */
  board_women_pct?: number;
  /** Average age of directors. */
  avg_board_age?: number;
  /** Total insider ownership % (directors + officers combined). */
  insider_ownership_pct?: number;
  /** Dual-class / voting structure description. */
  voting_structure?: string;
  /** Board members (name + role). */
  directors?: Array<{ name: string; role: string }>;
  /** Top 3 voting rights holders. */
  top_voting?: Shareholder[];
  /** Top 3 capital holders (by economic ownership). */
  top_capital?: Shareholder[];
  /** Free-form notable governance items. */
  notes?: string[];
};

/** Company AI positioning — sourced from 10-K, 10-Q, and investor communications. */
export type AIPositioning = {
  /** Overall stance: "leader" | "integrator" | "cautious" | "absent". */
  stance: "leader" | "integrator" | "cautious" | "absent";
  /** 2-4 sentence summary of how the company positions itself on AI. */
  summary: string;
  /** 3-5 concrete examples of AI uses / products / investments. */
  evidence: string[];
  /** Source document cited (e.g. "10-K 2024", "Earnings Call Q4 2025"). */
  source: string;
};

export type Company = {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  hero_kpi: string; // matches KPI.short
  tagline: string;
  founded: number;
  ipo: number;
  ranks: Ranks;
  /** Logo treatment hint per company (used to choose visual signature in V1). */
  logo_treatment: "orbit" | "prism" | "ring" | "wave" | "spark";
  kpis: KPI[];
  /**
   * Optional market positions: one per segment where both company revenue
   * and a credible TAM are available. Not shown if missing (honesty rule).
   */
  market_positions?: MarketPosition[];
  /** Top 5-8 risks extracted from latest 10-K. */
  risks?: CompanyRisk[];
  /** AI positioning statement. Mandatory for V1 — if no mention, stance = "absent". */
  ai_positioning?: AIPositioning;
  /** Governance / executive compensation from DEF 14A. */
  governance?: Governance;
};

export const COMPANIES: Record<string, Company> = {
  GOOGL: google as Company,
  META: meta as Company,
  MSCI: msci as Company,
  SPGI: spgi as Company,
  CAT: cat as Company,
};

export const TICKERS = Object.keys(COMPANIES);

export function getCompany(ticker: string): Company | null {
  return COMPANIES[ticker.toUpperCase()] ?? null;
}

export function getHero(company: Company): KPI {
  return (
    company.kpis.find((k) => k.short === company.hero_kpi) ?? company.kpis[0]
  );
}

/* -------------------------------------------------------------------------- */
/*                              Format helpers                                */
/* -------------------------------------------------------------------------- */

/** Convert "$B" → "Mds $", "B" → "Mds", "$M" → "M $", "%" → "%", etc. */
export function formatUnit(unit: string): string {
  switch (unit) {
    case "$B":
      return "Mds $";
    case "B":
      return "Mds";
    case "$M":
      return "M $";
    case "M":
      return "M";
    case "% YoY":
      return "%";
    default:
      return unit;
  }
}

/** Whether the YoY string already starts with sign. */
export function ensureYoYSuffix(yoy: string): string {
  // strip parenthetical " (YoY)" if already present
  return yoy.trim();
}

/**
 * Freshness tier for a piece of data based on its last_data_date.
 *  - "fresh" : < 4 months (last quarter)
 *  - "recent" : 4–12 months (last fiscal year still relevant)
 *  - "stale" : > 12 months (warn user)
 *  - "unknown" : no date
 */
export type FreshnessTier = "fresh" | "recent" | "stale" | "unknown";

export function getFreshness(lastDate?: string, now: Date = new Date()): FreshnessTier {
  if (!lastDate) return "unknown";
  const d = new Date(lastDate);
  if (Number.isNaN(d.getTime())) return "unknown";
  const months = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.4);
  if (months < 4) return "fresh";
  if (months < 12) return "recent";
  return "stale";
}

/**
 * Compound annual growth rate over the full history window.
 * Returns null when not meaningful (any zero/negative endpoint, < 2 points,
 * or KPIs that already are themselves growth rates like "% YoY").
 */
export function cagr(history: number[], unit?: string): number | null {
  if (unit === "% YoY") return null; // already a growth-of-growth → meaningless
  if (!history || history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  if (first <= 0 || last <= 0) return null;
  const periods = history.length - 1;
  return (Math.pow(last / first, 1 / periods) - 1) * 100;
}

/** Format CAGR for display, e.g. "+22.4 % / an" or null when N/A. */
export function formatCAGR(history: number[], unit?: string): string | null {
  const c = cagr(history, unit);
  if (c === null) return null;
  const sign = c > 0 ? "+" : "";
  return `${sign}${c.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} % / an`;
}

/* -------------------------------------------------------------------------- */
/*                              Interpretation                                */
/* -------------------------------------------------------------------------- */

export type InterpretTone = "pos" | "neg" | "neutral" | "future";

export type InterpretBullet = {
  label: string;
  body: string;
  tone: InterpretTone;
};

export type InterpretBlock = {
  /** Headline sentence (HTML allowed). */
  lead: string;
  /** Structured bullets, including the future-watch one as its own bullet. */
  bullets: InterpretBullet[];
};

export function interpretStructured(company: Company): InterpretBlock {
  const hero = getHero(company);
  const drivers = company.kpis.filter((k) =>
    ["Revenue", "Demand", "User"].includes(k.type)
  );
  const driver = drivers.find((d) => d.short !== hero.short) ?? drivers[0];
  const risk = company.kpis.find(
    (k) =>
      (k.type === "Cost" && !k.yoy.startsWith("-")) ||
      (k.type === "Margin" && k.yoy.startsWith("-"))
  );
  const cash = company.kpis.find((k) => k.type === "Cash");

  const lead = `Le KPI principal de <strong>${company.name}</strong> est <strong>${hero.name_fr}</strong>, à <strong>${hero.value} ${formatUnit(hero.unit)}</strong> (${hero.yoy} <em>YoY</em>). À retenir : <em>${hero.signal.toLowerCase()}</em>.`;

  const bullets: InterpretBullet[] = [];
  if (driver && driver.short !== hero.short) {
    bullets.push({
      label: "Moteur de croissance",
      body: `<strong>${driver.name_fr}</strong> à ${driver.value} ${formatUnit(driver.unit)} (${driver.yoy}). ${driver.signal}.`,
      tone: "pos",
    });
  }
  if (risk) {
    bullets.push({
      label: "Point de vigilance",
      body: `<strong>${risk.name_fr}</strong> à ${risk.value} ${formatUnit(risk.unit)} (${risk.yoy}). ${risk.signal}.`,
      tone: "neg",
    });
  }
  if (cash && cash.short !== hero.short) {
    bullets.push({
      label: "Génération de cash",
      body: `<strong>${cash.name_fr}</strong> à ${cash.value} ${formatUnit(cash.unit)} (${cash.yoy}). ${cash.signal}.`,
      tone: "neutral",
    });
  }

  // FUTURE bullet — promoted to first-class citizen.
  bullets.push({
    label: "À surveiller au prochain trimestre",
    body: `Trois scénarios possibles pour <strong>${hero.name_fr}</strong> : (1) <strong>accélération</strong> qui validerait le momentum, (2) <strong>stabilisation</strong> autour du niveau actuel, (3) <strong>retournement</strong> qui casserait la tendance. Le marché ajustera la valorisation en fonction du scénario observé.`,
    tone: "future",
  });

  return { lead, bullets };
}

/* -------------------------------------------------------------------------- */
/*                            Compare matching                                */
/* -------------------------------------------------------------------------- */

/**
 * Find companies that share at least one comparable KPI with the source company.
 * Returns map: ticker → { company, matchedKpi, sourceKpi } sorted by relevance.
 */
export function findComparable(sourceTicker: string, sourceKpiShort?: string) {
  const src = COMPANIES[sourceTicker];
  if (!src) return [];
  const srcKpi = src.kpis.find((k) => k.short === sourceKpiShort);

  const matches: Array<{
    ticker: string;
    company: Company;
    matchedKpi: KPI;
    matchedSourceKpi: KPI;
    score: number; // higher = more relevant
  }> = [];

  for (const t of TICKERS) {
    if (t === sourceTicker) continue;
    const c = COMPANIES[t];
    // Try to match source KPI first
    if (srcKpi?.compare_key) {
      const m = c.kpis.find((k) => k.compare_key === srcKpi.compare_key);
      if (m) {
        matches.push({
          ticker: t,
          company: c,
          matchedKpi: m,
          matchedSourceKpi: srcKpi,
          score: 100,
        });
        continue;
      }
    }
    // Fallback: any shared compare_key
    const sharedKeys = src.kpis
      .map((k) => k.compare_key)
      .filter((x): x is string => Boolean(x));
    let bestPair: { src: KPI; m: KPI } | null = null;
    for (const k of sharedKeys) {
      const a = src.kpis.find((x) => x.compare_key === k);
      const b = c.kpis.find((x) => x.compare_key === k);
      if (a && b) {
        bestPair = { src: a, m: b };
        break;
      }
    }
    if (bestPair) {
      matches.push({
        ticker: t,
        company: c,
        matchedKpi: bestPair.m,
        matchedSourceKpi: bestPair.src,
        score: 50,
      });
    }
    // If no shared key at all, don't include this company
  }

  return matches.sort((a, b) => b.score - a.score);
}
