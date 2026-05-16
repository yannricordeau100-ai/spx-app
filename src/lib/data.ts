import google from "@/data/google.json";
import meta from "@/data/meta.json";
import msci from "@/data/msci.json";
import spgi from "@/data/spgi.json";
import cat from "@/data/cat.json";
import {
  type InterpLocale,
  numLocale,
  perYear,
  leadSentence,
  cagrTrendBit,
  peakTrendBit,
  joinAnd,
  trendSignalShortHistory,
  trendSignalUnknown,
  trendSignalByCategory,
  detailPrefix,
  bulletLabel,
  bulletBodyKpi,
  futureBulletBody,
} from "@/lib/interp-i18n";

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
  /**
   * KPI tags pour l'organisation Hero / Indicateurs clés / Stories.
   * DÉCIDÉS UNE FOIS pour toutes au moment de la publication de la société.
   * Ne changent PAS quand de nouvelles données trimestrielles arrivent.
   * Voir CLAUDE.md § "ORDRE D'AFFICHAGE DES KPI".
   */
  /** Distinctif, propre à la société ou à sa sous-industrie (DAP, Carnet, Ratings Cyclique). */
  is_wow?: boolean;
  /** Comptable banal (Total Revenue, Net Income, EPS, Operating Margin, Capex, FCF). */
  is_generic?: boolean;
  /**
   * Historique <5 ans → bouge dans le bloc Stories (pas Indicateurs clés).
   * Aussi true si KPI ponctuel (publié 1 fois lors d'un investor day).
   */
  is_short_history?: boolean;
  /** Catégorie de la story. Ex: "Innovation", "Marché", "Adoption", "Capacité". */
  story_category?: string;
  /**
   * TTM = Trailing Twelve Months. Somme des 4 derniers trimestres dispo
   * (Q2 N-1 + Q3 N-1 + Q4 N-1 + Q1 N). Affiché sur les charts comme une
   * barre / point supplémentaire APRÈS la dernière année calendaire,
   * avec un style visuel distinct (couleur plus claire / pointillé) pour
   * qu'on comprenne que c'est "12 derniers mois" et pas une année calendaire.
   * Optionnel : non rendu si absent ou null.
   */
  ttm?: number | null;
  /**
   * Périodicité de l'historique. Par défaut "year" (V1 historique : 5-6
   * années annuelles). "quarter" pour les KPI publiés trimestriellement
   * (NFLX subscribers : 20 trimestres Q1'21 → Q4'25). Détermine les
   * labels axe X générés par CompanyView : ["2020", ..., "2025"] en
   * mode année, ["T1 21", ..., "T4 25"] en mode trimestre.
   */
  period_type?: "year" | "quarter" | "semester";
};

export type Ranks = {
  global_world: string; // e.g. "#4"
  global_us: string;
  sector: string;
  subsector: string;
};

/** Market position: company segment revenue vs total addressable market. */
/** Tranche d'une répartition (géographique ou par segment opérationnel). */
export type RevenueSlice = {
  /** Libellé en FR. */
  label: string;
  /** Libellé en EN (optionnel, fallback sur label). */
  label_en?: string;
  /** Valeur dans l'unité de la breakdown (montant ou %). */
  value: number;
  /** Couleur custom (sinon palette auto). */
  color?: string;
};

/** Répartition du chiffre d'affaires par dimension (géo, segment, etc.). */
export type RevenueBreakdown = {
  /** "$B", "$M", "%", etc. Si "%", values doivent sommer à ~100. */
  unit: string;
  /** Total explicite (sinon = somme des slices). */
  total?: number;
  slices: RevenueSlice[];
  /** Date de référence des chiffres (ex: "2024-12-31"). */
  source_date?: string;
  /** Source courte (ex: "10-K 2024"). */
  source?: string;
};

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
  /** Editorial short title in French (8-14 words). */
  title: string;
  /** Editorial title in English (V2 = auto-generated by Groq pipeline). */
  title_en?: string;
  category: RiskCategory;
  /** Original 10-K quote (verbatim from SEC filing, English). */
  quote: string;
  /** French translation of the 10-K quote. */
  quote_fr?: string;
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
  /**
   * Rationale (1-2 phrases) expliquant POURQUOI ce KPI a été choisi comme
   * Hero pour cette société. Lu lors de l'audit éditorial. Pas affiché à
   * l'utilisateur final (sauf en mode debug). Voir CLAUDE.md § ORDRE.
   */
  hero_kpi_rationale?: string;
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
  /** Répartition du chiffre d'affaires par zone géographique. */
  revenue_by_geography?: RevenueBreakdown;
  /** Répartition du chiffre d'affaires par segment opérationnel. */
  revenue_by_segment?: RevenueBreakdown;
  /** Top 5-8 risks extracted from latest 10-K. */
  risks?: CompanyRisk[];
  /** AI positioning statement. Mandatory for V1 — if no mention, stance = "absent". */
  ai_positioning?: AIPositioning;
  /** Governance / executive compensation from DEF 14A. */
  governance?: Governance;
  /**
   * Faits saillants récents (≤4) sur 12 mois. Format `CompanyEvent[]` cf
   * src/lib/events.ts. Source dynamique : `enrich-events-yfinance.py`
   * remplit `src/data/v2-pipeline-enrich/<ticker>.events.json` ; merge
   * automatique côté `loadV17Company`. Si absent → fallback sur events
   * hand-curated V1.0 via `getCompanyEvents`.
   */
  events?: Array<{ year: number; month?: number; title: string; body: string; source?: string; url?: string; date?: string }>;
  /**
   * Profit warning history + forward-looking risk score.
   * Score (1-5) calé sur :
   *   1) historique des PW + commentaires direction + dernier earnings call
   *   2) tendance court+moyen terme (<3 mois) de réduction de marges au-delà
   *      des déclarations publiques précédentes
   */
  profit_warning?: ProfitWarning;
  /**
   * Date approximative des prochains résultats (ISO ou texte). Affichée
   * dans la tooltip "à jour" sous la forme "~ [date]".
   */
  next_earnings_date?: string;
  /**
   * Description longue de la société (1-3 paragraphes). Source : 10-K
   * Item 1 Business via yfinance `longBusinessSummary`. Affichée dans
   * le bloc "Profil société" (legacy, va être remplacé par mettrik_description).
   */
  company_description?: string;
  /**
   * Yann 14 mai 2026 v2 : description "PV Mettrik" structurée par sections
   * (Gemini 2.5 Flash, 2 versions × 3 langues × 4 sections). Remplace
   * l'ancienne description yfinance générique. Stockée dans
   * `v2-pipeline-enrich/<ticker>.description.json`.
   *
   * Schéma `v2-sections` :
   *   - simple : pour débutant. 4 sections (activity, products, customers, edge).
   *   - advanced : pour investisseur informé. 4 sections (positioning,
   *     tech_products, moat, risks).
   */
  mettrik_description?: {
    simple: {
      fr: { activity: string; products: string; customers: string; edge: string };
      en: { activity: string; products: string; customers: string; edge: string };
      de: { activity: string; products: string; customers: string; edge: string };
    };
    advanced: {
      fr: { positioning: string; tech_products: string; moat: string; risks: string };
      en: { positioning: string; tech_products: string; moat: string; risks: string };
      de: { positioning: string; tech_products: string; moat: string; risks: string };
    };
  };
  /** Snapshot boursier live (rafraîchi toutes les 14 j via yfinance). */
  financial_snapshot?: {
    market_cap_usd?: number | null;
    pe_ratio?: number | null;
    forward_pe?: number | null;
    eps_ttm?: number | null;
    beta?: number | null;
    dividend_yield_pct?: number | null;
    high_52w?: number | null;
    low_52w?: number | null;
    day_change_pct?: number | null;
    currency?: string | null;
  };
  /** Faits clés sur la société (siège, employés, bourse de cotation, etc.). */
  key_facts?: {
    hq_city?: string | null;
    hq_country?: string | null;
    employees_count?: number | null;
    exchange?: string | null;
    isin?: string | null;
    industry?: string | null;
    industry_disp?: string | null;
    website?: string | null;
    fiscal_year_end?: number | null;
  };
  /**
   * Sociétés comparables (peers) pour suggestion dans le panneau Comparer.
   * Calculé offline depuis le sub-sector + market_cap proximity.
   */
  peers?: Array<{
    ticker: string;
    name: string;
    sector: string;
    subsector: string;
    market_cap_usd: number | null;
  }>;
  /**
   * Dernière actualité communiquée par la société (PR officiel, ER, 8-K, IR
   * page) résumée en 2-3 phrases FR via Gemini 2.5 Flash Lite (gratuit).
   * Remplace le bloc "À propos" sur la fiche société quand présente.
   * Mise à jour quotidienne via `scripts/enrich-latest-news-gemini.py`.
   */
  latest_news?: {
    date: string; // ISO YYYY-MM-DD
    headline: string;
    summary: string; // 2-3 phrases FR
    url?: string | null;
    source?: string | null; // ex : "Press release", "8-K", "Earnings call"
    fetched_at?: string;
  };
  /**
   * Dernier earning publié récupéré depuis SEC EDGAR `submissions/CIK<X>.json`.
   * Yann (10 mai 2026) : la pill "À jour" doit afficher la date de
   * PUBLICATION du dernier earning intégré sur la page (pas la fin de
   * période fiscale). Source : `scripts/fetch-filing-dates.py`.
   */
  latest_filing?: {
    date: string;        // ISO date de filing (publication) ex "2026-04-30"
    form: string;        // "10-Q" | "10-K" | "20-F" | "6-K" | etc.
    period_end: string;  // ISO date fin de période fiscale couverte
    fetched_at?: string;
  };
};

export type ProfitWarning = {
  /** ISO date du dernier profit warning, null si jamais. */
  last_date: string | null;
  /** 1 = très peu probable, 5 = imminent. */
  score: 1 | 2 | 3 | 4 | 5;
  /** Justification de la note : historique + commentaires direction + signaux. */
  rationale: string;
  /** Commentaire optionnel sur la trajectoire de marges <3 mois. */
  margin_trend?: string;
};

// META en 1er = société par défaut (fallback partout où une sté doit
// être chargée sans contexte). Ordre = ordre d'affichage des cards home.
export const COMPANIES: Record<string, Company> = {
  META: meta as Company,
  GOOGL: google as Company,
  MSCI: msci as Company,
  SPGI: spgi as Company,
  CAT: cat as Company,
};

export const TICKERS = Object.keys(COMPANIES);

/**
 * Alias multi-classes : certaines sociétés cotent plusieurs lignes (ex.
 * Alphabet : GOOGL Class A avec droit de vote, GOOG Class C sans). On
 * résout vers le ticker canonique du panel pour qu'une recherche ou une
 * URL avec l'alias retombe sur la bonne fiche, et que les pages dual-
 * class ne soient pas dupliquées.
 *
 * Étendre cette table à mesure que de nouvelles sociétés sont ajoutées
 * (BRK.A/BRK.B, FOX/FOXA, NWS/NWSA, DISCA/DISCK, etc.).
 */
/**
 * Alias multi-classes : la cible est le ticker RÉELLEMENT présent dans le
 * dataset au moment T. Quand CONV-DATA ajoute la classe préférée ailleurs,
 * inverser le mapping pour pointer dessus.
 *
 *  - Alphabet     : GOOGL Class A (vote) prioritaire. GOOG Class C alias.
 *  - Berkshire    : BRK.B accessible aux particuliers vs BRK.A à 700k$.
 *                   Slash bloqué dans les URL → on stocke BRK-B.
 *  - Fox Corp     : FOXA Class A (vote) prioritaire vs FOX Class B (sans).
 *  - News Corp    : NWS Class B présent dans le dataset → NWSA alias dessus.
 *                   À inverser quand CONV-DATA ajoute NWSA Class A (vote).
 *  - Under Armour : UA Class C présent → UAA alias dessus. Idem.
 */
export const TICKER_ALIASES: Record<string, string> = {
  GOOG: "GOOGL",
  "BRK.A": "BRK-B",
  "BRK-A": "BRK-B",
  "BRK.B": "BRK-B",
  FOX: "FOXA",
  NWSA: "NWS",
  UAA: "UA",
};

/** Renvoie le ticker canonique (majuscules), résout les alias. */
export function canonicalTicker(input: string): string {
  const u = input.toUpperCase();
  return TICKER_ALIASES[u] ?? u;
}

export function getCompany(ticker: string): Company | null {
  return COMPANIES[canonicalTicker(ticker)] ?? null;
}

export function getHero(company: Company): KPI {
  return (
    company.kpis.find((k) => k.short === company.hero_kpi) ?? company.kpis[0]
  );
}

/* -------------------------------------------------------------------------- */
/*                              Format helpers                                */
/* -------------------------------------------------------------------------- */

/** Convert "$B" → "Mds $", "B" → "Mds", "$M" → "M $", "%" → "%", etc.
 *  Yann 16 mai 2026 : aussi "B €" → "Mds €", "B £" → "Mds £" (ASMLF
 *  bookings 26.2 B € affichait "B €" au lieu de "Mds €"). */
export function formatUnit(unit: string): string {
  if (unit == null) return "";
  const u = String(unit).trim();
  switch (u) {
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
  }
  // Variantes "B X" / "M X" sans normalisation : "B €" / "B £" / "B $" / "M €" etc.
  const bMatch = u.match(/^B\s+([€£¥$])$/);
  if (bMatch) return `Mds ${bMatch[1]}`;
  const mMatch = u.match(/^M\s+([€£¥$])$/);
  if (mMatch) return `M ${mMatch[1]}`;
  return u;
}

/**
 * Format compact pour le hero number :
 *   - 2 décimales max
 *   - Auto-conversion M → Mds quand |valeur| >= 1000
 *   - locale FR (espace comme séparateur milliers)
 *
 * Évite que le chiffre + unité passe sur 2 lignes quand la colonne hero
 * est étroite (cas "3,302 M $" → "3,3 Mds $" plus court).
 */
/**
 * Décide du nombre de décimales selon la règle Yann (15 mai 2026,
 * applicable PARTOUT dans l'app) :
 *   - Si valeur entre 1 et 10 (exclu)        → 2 décimales
 *   - Sinon (≥ 10 ou < 1)                    → 1 décimale
 *   - Si l'unité contient une magnitude (Mds, M, K) et valeur ≥ 100
 *     → max 1 décimale (jamais "193,998 Mds")
 *   - Si valeur exacte (.0)                  → pas de décimale superflue (rendu via locale)
 *
 * Centralisé ici pour que toute la stack (hero, KPI row, story, home,
 * snapshot, comparaisons, exports PNG) applique la même règle.
 */
export function decimalsForValue(num: number, unit?: string): number {
  if (!Number.isFinite(num)) return 1;
  const abs = Math.abs(num);
  const hasMagnitude = !!unit && /\b(Mds|M|K|B)\b/i.test(unit);
  // Règle Yann : magnitude OU >= 10 → 1 décimale max. Entre 1 et 10 → 2.
  if (abs >= 1 && abs < 10) return 2;
  if (abs >= 10 || hasMagnitude) return 1;
  return 1;
}

/**
 * Format un kpi.value (string ou number) en respectant la règle Yann
 * (1 décimale par défaut, 2 décimales si valeur entre 1 et 10).
 * Utilisé partout : KPI row, story card, compare panel, home preview.
 */
export function formatKpiValue(value: string | number | null | undefined, unit?: string): string {
  if (value == null) return "—";
  const s = typeof value === "string" ? value.replace(/,/g, "").trim() : String(value);
  const num = parseFloat(s);
  if (!Number.isFinite(num)) return typeof value === "string" ? value : "—";
  const dec = decimalsForValue(num, unit);
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export function formatHeroValue(value: string | number | null | undefined, unit: string): { value: string; unit: string } {
  const valueStr = typeof value === "string" ? value : (value != null ? String(value) : "");
  const cleaned = valueStr.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) {
    return { value: valueStr || "—", unit: formatUnit(unit) };
  }

  let displayNum = num;
  let displayUnit = formatUnit(unit);

  if ((unit === "M" || unit === "$M") && Math.abs(num) >= 1000) {
    displayNum = num / 1000;
    displayUnit = unit === "$M" ? "Mds $" : "Mds";
  }

  // Règle Yann 15 mai 2026 : nb de décimales déterminé par decimalsForValue.
  const dec = decimalsForValue(displayNum, displayUnit);
  const formatted = displayNum.toLocaleString("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  return { value: formatted, unit: displayUnit };
}

/** Whether the YoY string already starts with sign. */
export function ensureYoYSuffix(yoy: string): string {
  // strip parenthetical " (YoY)" if already present
  return yoy.trim();
}

/**
 * Freshness tier for a piece of data based on its last_data_date.
 *
 * Seuils ajustés le 4 mai 2026 (Yann) :
 *  - "fresh"  : < 4 mois  (dernier trimestre)
 *  - "recent" : 4–18 mois (le dernier exercice fiscal complet reste pertinent
 *               jusqu'à ce que le suivant soit largement publié; le pipeline
 *               CONV-DATA peut être en cours de refresh donc on tolère une
 *               fenêtre plus large que la stricte année)
 *  - "stale"  : > 18 mois (alerte utilisateur : data probablement périmée)
 *  - "unknown": pas de date
 */
export type FreshnessTier = "fresh" | "recent" | "stale" | "unknown";

export function getFreshness(lastDate?: string, now: Date = new Date()): FreshnessTier {
  if (!lastDate) return "unknown";
  const d = new Date(lastDate);
  if (Number.isNaN(d.getTime())) return "unknown";
  const months = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.4);
  if (months < 4) return "fresh";
  if (months < 18) return "recent";
  return "stale";
}

/**
 * Compound annual growth rate over the full history window.
 * Returns null when not meaningful (any zero/negative endpoint, < 2 points,
 * or KPIs that already are themselves growth rates like "% YoY").
 *
 * BUG FIX 6 mai 2026 (Yann) : pour les KPIs trimestriels (period_type
 * "quarter"), la formule retournait le taux PAR TRIMESTRE au lieu du taux
 * annuel. Ex : NFLX abonnés 207,64 → 325,27 sur 20 trimestres = 9,3 %/an
 * mais on affichait 2,4 %/an (= 9,3 % / 4 = taux trimestriel). Fix : on
 * divise le nombre de périodes par 4 quand period_type === "quarter", ou
 * par 2 quand "semester".
 */
export function cagr(
  history: number[],
  unit?: string,
  period_type: "year" | "quarter" | "semester" = "year"
): number | null {
  if (unit === "% YoY") return null; // already a growth-of-growth → meaningless
  if (!history || history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  if (first <= 0 || last <= 0) return null;
  const stepsPerYear =
    period_type === "quarter" ? 4 : period_type === "semester" ? 2 : 1;
  const years = (history.length - 1) / stepsPerYear;
  if (years <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

/** Format CAGR for display, e.g. "+22.4 % / an" or null when N/A. */
export function formatCAGR(
  history: number[],
  unit?: string,
  period_type: "year" | "quarter" | "semester" = "year",
  locale: "fr" | "en" | "en-GB" | "de" | "de-CH" | "nl" | "sv" | "da" = "fr"
): string | null {
  const c = cagr(history, unit, period_type);
  if (c === null) return null;
  const sign = c > 0 ? "+" : "";
  // Yann 15 mai 2026 : suffix "/ an" traduit selon la langue. Default = FR
  // pour rétro-compat avec les callsites non encore migrés.
  const PER_YEAR: Record<typeof locale, string> = {
    "fr":    "% / an",
    "en":    "% / year",
    "en-GB": "% / year",
    "de":    "% / Jahr",
    "de-CH": "% / Jahr",
    "nl":    "% / jaar",
    "sv":    "% / år",
    "da":    "% / år",
  };
  const numLocale = locale === "fr" ? "fr-FR" : locale === "de" || locale === "de-CH" ? "de-DE" : "en-US";
  return `${sign}${c.toLocaleString(numLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} ${PER_YEAR[locale]}`;
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

/**
 * Yann 14 mai 2026 : helpers pour générer une interprétation dynamique
 * quand le KPI n'a pas de signal/yoy renseigné dans le dataset.
 */
/**
 * Yann 15 mai 2026 : auto-rescale unit pour interpretStructured (server side).
 * Évite "0,41 M unités" dans le texte d'interprétation → "410 K unités".
 */
function autoRescaleForInterp(unit: string, allBelowOne: boolean): { unit: string; factor: number } {
  if (!allBelowOne) return { unit, factor: 1 };
  const u = unit.trim();
  let m = u.match(/^Mds(\s+.+)$/i);
  if (m) return { unit: `M${m[1]}`, factor: 1000 };
  m = u.match(/^M(\s+.+)$/i);
  if (m) return { unit: m[1].trim(), factor: 1_000_000 };
  if (u === "M $") return { unit: "$", factor: 1_000_000 };
  if (u === "M €") return { unit: "€", factor: 1_000_000 };
  if (u === "M £") return { unit: "£", factor: 1_000_000 };
  return { unit, factor: 1 };
}

function computeYoyFromHistory(
  history: number[] | null | undefined,
  locale: InterpLocale = "fr"
): string {
  if (!history || history.length < 2) return "n/a";
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (typeof last !== "number" || typeof prev !== "number" || prev === 0) return "n/a";
  const pct = ((last - prev) / Math.abs(prev)) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString(numLocale(locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

function computeTrendSignal(
  history: number[] | null | undefined,
  kpiName: string,
  locale: InterpLocale = "fr"
): { signal: string } {
  if (!history || history.length < 2) {
    return { signal: trendSignalShortHistory(locale, kpiName) };
  }
  const last = history[history.length - 1];
  const first = history[0];
  const prev = history[history.length - 2];
  if (typeof last !== "number" || typeof first !== "number" || typeof prev !== "number") {
    return { signal: trendSignalUnknown(locale) };
  }
  const totalChange = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const lastChange = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : 0;
  if (totalChange > 30 && lastChange > 0) return { signal: trendSignalByCategory(locale, "strong_up") };
  if (totalChange > 10 && lastChange > 0) return { signal: trendSignalByCategory(locale, "moderate_up") };
  if (totalChange > 0 && lastChange < -5) return { signal: trendSignalByCategory(locale, "slowdown") };
  if (totalChange < -10 && lastChange < 0) return { signal: trendSignalByCategory(locale, "downtrend") };
  if (Math.abs(totalChange) < 10) return { signal: trendSignalByCategory(locale, "stable") };
  return { signal: trendSignalByCategory(locale, "mixed") };
}

/**
 * Yann 14 mai 2026 v2 : interprétation RÉACTIVE au KPI active.
 * Si `activeShort` fourni, le lead+future bullet parlent de ce KPI-là.
 * Sinon (default), parle du hero KPI. Les bullets driver/risk/cash
 * restent contextuels au reste du dataset.
 */
export function interpretStructured(
  company: Company,
  activeShort?: string,
  locale: InterpLocale = "fr"
): InterpretBlock {
  const heroDefault = getHero(company);
  // Si KPI active fourni et différent du hero, on parle de lui.
  const active = activeShort
    ? company.kpis.find((k) => k.short === activeShort) ?? heroDefault
    : heroDefault;
  const hero = active;
  // Préférer un KPI sectoriel (Demand/User/Adoption) plutôt que le total revenu
  // pour le bloc "Moteur de croissance" — le revenu n'est pas un moteur,
  // c'est un résultat. Fallback sur Revenue uniquement si aucun segment dispo.
  const segmentDrivers = company.kpis.filter((k) =>
    ["Demand", "User", "Adoption"].includes(k.type)
  );
  const revenueDrivers = company.kpis.filter((k) => k.type === "Revenue");
  // Yann 16 mai 2026 : élargir les types acceptés pour driver — si une sté
  // n'a pas de KPI Demand/User/Adoption/Revenue, fallback sur Volume,
  // Pricing, Growth, Engagement, Capacity, Productivity, puis sur le
  // premier KPI non-hero. Évite l'absence du bullet "Moteur de croissance"
  // sur 39+ stés (sectorielles non-revenue, financières, etc.).
  const extendedDrivers = company.kpis.filter((k) =>
    [
      "Volume",
      "Pricing",
      "Growth",
      "Engagement",
      "Capacity",
      "Productivity",
      "Operations",
      "Production",
      "Quality",
      "Innovation",
    ].includes(k.type)
  );
  const firstNonHero = company.kpis.find(
    (k) => k.short !== hero.short && !["Cost", "Margin", "Cash"].includes(k.type)
  );
  const driver =
    segmentDrivers.find((d) => d.short !== hero.short) ??
    revenueDrivers.find((d) => d.short !== hero.short) ??
    extendedDrivers.find((d) => d.short !== hero.short) ??
    segmentDrivers[0] ??
    firstNonHero;
  const risk = company.kpis.find(
    (k) =>
      (k.type === "Cost" && typeof k.yoy === "string" && !k.yoy.startsWith("-")) ||
      (k.type === "Margin" && typeof k.yoy === "string" && k.yoy.startsWith("-"))
  );
  const cash = company.kpis.find((k) => k.type === "Cash");

  // Yann 14-15 mai 2026 : interprétation IA SUBSTANTIVE.
  // Pas un copier-coller du nom KPI, mais : valeur rescalée (jamais "0,..."),
  // YoY chiffré, CAGR sur la période, point haut/bas historique, ralenti
  // ou pas. La signal pré-écrite reste un complément si non-trivial.
  const rawValue = typeof hero.value === "number" ? hero.value : Number(hero.value);
  const rawUnit = String(hero.unit ?? "").replace(/\s+deployed$/i, "").replace(/\s+units$/i, " unités");
  const histNums = (Array.isArray(hero.history) ? hero.history : []).filter((x): x is number => typeof x === "number");
  const allBelowOne = histNums.length > 0 && histNums.every((v) => Math.abs(v) < 1) && (!Number.isFinite(rawValue) || Math.abs(rawValue) < 1);
  const { unit: scaledUnit, factor: scaleFactor } = autoRescaleForInterp(rawUnit, allBelowOne);
  const heroValue = Number.isFinite(rawValue)
    ? (rawValue * scaleFactor).toLocaleString(numLocale(locale), { maximumFractionDigits: 1 })
    : (hero.value ?? "—");
  const computedYoy = computeYoyFromHistory(hero.history, locale);
  const heroYoy = (typeof hero.yoy === "string" && hero.yoy.trim()) ? hero.yoy : computedYoy;
  // Trend : valeurs rescalées pour les comparaisons.
  const scaledHist = histNums.map((v) => v * scaleFactor);
  const cagrPct = scaledHist.length >= 2 ? cagr(scaledHist, scaledUnit, hero.period_type ?? "year") : null;
  const peak = scaledHist.length ? Math.max(...scaledHist) : null;
  const last = scaledHist.length ? scaledHist[scaledHist.length - 1] : null;
  const trendBits: string[] = [];
  if (cagrPct !== null) {
    const s = cagrPct > 0 ? "+" : "";
    const cagrFormatted = `${s}${cagrPct.toLocaleString(numLocale(locale), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} ${perYear(locale)}`;
    trendBits.push(cagrTrendBit(locale, cagrFormatted));
  }
  if (peak !== null && last !== null && Math.abs(peak - last) / Math.abs(peak || 1) > 0.1 && peak > last) {
    const pctBelow = `${(((peak - last) / peak) * 100).toFixed(0)} %`;
    trendBits.push(peakTrendBit(locale, pctBelow));
  }
  const richTrend = trendBits.length > 0
    ? trendBits.join(joinAnd(locale))
    : computeTrendSignal(hero.history, hero.name_fr, locale).signal;
  // Signal pré-écrite ignorée si elle ne fait que paraphraser le nom KPI
  // (ex "Croissance des livraisons de véhicules électriques" pour KPI
  // "Ventes de véhicules"). On garde la signal seulement si elle apporte
  // une info chiffrée ou un angle distinctif.
  // Yann 15 mai 2026 : la `signal` est en FR côté data (chantier CONV-DATA
  // pour traduction batch). On ne l'inclut que si elle apporte une info
  // chiffrée distinctive, indépendamment de la locale UI.
  const heroSignalLow = typeof hero.signal === "string" ? hero.signal.toLowerCase() : "";
  const nameNorm = (hero.name_fr ?? "").toLowerCase();
  const signalAddsValue = heroSignalLow.trim().length > 0
    && !nameNorm.split(/\s+/).every((w) => heroSignalLow.includes(w))
    && /\d/.test(heroSignalLow);
  const tailSignal = signalAddsValue ? detailPrefix(locale, heroSignalLow) : "";
  const lead = leadSentence(
    locale,
    company.name,
    hero.name_fr,
    heroValue,
    formatUnit(scaledUnit),
    heroYoy,
    richTrend,
    tailSignal
  );

  // Yann 15 mai 2026 : format locale-aware des valeurs bullets (fix "30.976" → "30,976" FR).
  const fmtVal = (v: unknown): string => {
    if (v == null) return "—";
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
    if (!Number.isFinite(n)) return String(v);
    return n.toLocaleString(numLocale(locale), { maximumFractionDigits: 3 });
  };
  const bullets: InterpretBullet[] = [];
  if (driver && driver.short !== hero.short) {
    bullets.push({
      label: bulletLabel(locale, "driver"),
      body: bulletBodyKpi(locale, driver.name_fr, fmtVal(driver.value), formatUnit(driver.unit), String(driver.yoy ?? ""), driver.signal ?? ""),
      tone: "pos",
    });
  }
  if (risk) {
    bullets.push({
      label: bulletLabel(locale, "risk"),
      body: bulletBodyKpi(locale, risk.name_fr, fmtVal(risk.value), formatUnit(risk.unit), String(risk.yoy ?? ""), risk.signal ?? ""),
      tone: "neg",
    });
  }
  if (cash && cash.short !== hero.short) {
    bullets.push({
      label: bulletLabel(locale, "cash"),
      body: bulletBodyKpi(locale, cash.name_fr, fmtVal(cash.value), formatUnit(cash.unit), String(cash.yoy ?? ""), cash.signal ?? ""),
      tone: "neutral",
    });
  }

  // FUTURE bullet — promoted to first-class citizen.
  bullets.push({
    label: bulletLabel(locale, "future"),
    body: futureBulletBody(locale, hero.name_fr),
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

/**
 * True si la source indiquée provient d'un document officiel de la sté
 * (10-K, 10-Q, 8-K, DEF 14A, Earnings Release/Call, Investor Day, Investor
 * Deck, etc.). Dans ce cas l'app n'affiche PAS la source à l'utilisateur :
 * c'est implicite que la donnée vient des filings officiels Mettrik.
 */
export function isOfficialSource(s?: string | null): boolean {
  if (!s) return false;
  const u = s.toUpperCase();
  const keywords = [
    "10-K", "10-Q", "8-K", "DEF 14A", "EARNINGS",
    "INVESTOR DAY", "INVESTOR DECK", "PROXY", "ANNUAL REPORT",
  ];
  return keywords.some((k) => u.includes(k));
}
