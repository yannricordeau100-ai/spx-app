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
  /**
   * Incertitude par slice en points de pourcentage (ex 5 → ±5%).
   * Utilisé pour le bloc IA Pro/Particulier (ai_customer) où le split
   * vient de sources externes (analystes, IR slides) plutôt que d'un
   * filing officiel. Seulement affiché si > 0 et si l'onglet est
   * `ai_customer`.
   */
  uncertainty_pct?: number;
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
  /** CEO actuel si différent de celui du dernier proxy (succession en cours
   *  d'exercice, ex DIS D'Amaro mars 2026). La rémunération affichée reste
   *  celle de `ceo_name` (le CEO couvert par le DEF14A). */
  ceo_current?: string;
  /** Depuis quand le CEO actuel est en poste, ex "mars 2026". */
  ceo_current_since?: string;
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
  /** Détail de rémunération CEO issu du dernier DEF14A (Summary Compensation Table). */
  comp_detail?: {
    source_fiscal_year?: number;
    ceo_salary_m?: number;
    ceo_bonus_m?: number;
    ceo_stock_awards_m?: number;
    ceo_option_awards_m?: number;
    ceo_non_equity_incentive_m?: number;
    ceo_other_m?: number;
    ceo_total_comp_m?: number;
    ceo_pay_ratio?: number;
    /** Salaire médian employé, en $ (pas en millions). */
    median_employee_pay?: number;
    neo2_name?: string;
    neo2_total_comp_m?: number;
    comp_vs_prior_year_pct?: string;
    perf_metrics_bonus?: string;
    note_structure?: string;
  };
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
  /** Traduction tagline par locale, affichée dans tooltip "i" sur les pages non-EN.
   *  Tagline EN original reste affichée principal (CLAUDE.md §6). Mappé par
   *  load-company.ts depuis les fichiers .{locale}.json. Yann 18 mai 2026. */
  tagline_i18n?: Record<string, string>;
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
  /**
   * Yann 21 mai 2026 : pour les stés qui vendent de l'IA (NVDA, MSFT,
   * GOOGL, etc.), split du CA IA entre clients PROFESSIONNELS (B2B) et
   * PARTICULIERS (B2C). Données non présentes dans les filings — donc
   * sourcées externes (analyst reports, articles tier 1). Visible
   * uniquement si présent. Source écrite dans v2-pipeline-enrich/<ticker>.json.
   */
  revenue_by_ai_customer_type?: RevenueBreakdown & {
    fiscal_year?: string;
    ai_segment_revenue?: number;
    ai_segment_unit?: string;
    confidence?: "low" | "mid" | "high";
    sources?: { url: string; title: string; date: string; publisher: string; kind: string }[];
  };
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
  // Yann 4 juin 2026 : Alibaba listing HK (9988.HK) renomme en BABA (ADR US).
  "9988.HK": "BABA",
  "9988-HK": "BABA",
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

/** YoY d'une série trimestrielle en matchant le MÊME trimestre de l'année
 *  précédente par LABEL (history_periods), pas par position -4.
 *  Yann 18 juil 2026 (screen MA Rebates) : les séries à trous (T4 absents des
 *  10-Q) faisaient comparer T3 2025 à T2 2024 avec le recul positionnel :
 *  +27,6 % affiché au lieu de +17,7 % réel. Formats acceptés : "Q3-2025",
 *  "Q3 2025", "Q3-FY2025". Retourne null si labels absents ou période N-1
 *  introuvable (l'appelant garde alors son fallback positionnel). */
export function yoySamePeriod(
  history: unknown,
  historyPeriods: unknown,
): number | null {
  if (!Array.isArray(history) || !Array.isArray(historyPeriods)) return null;
  if (history.length < 2 || historyPeriods.length !== history.length) return null;
  const parse = (q: unknown) => {
    const m = String(q ?? "").match(/^Q([1-4])[\s-](?:FY)?(\d{4})$/i);
    return m ? { q: Number(m[1]), y: Number(m[2]) } : null;
  };
  const lastIdx = history.length - 1;
  const last = history[lastIdx];
  const lastP = parse(historyPeriods[lastIdx]);
  if (typeof last !== "number" || !lastP) return null;
  for (let i = lastIdx - 1; i >= 0; i--) {
    const p = parse(historyPeriods[i]);
    if (p && p.q === lastP.q && p.y === lastP.y - 1) {
      const prev = history[i];
      if (typeof prev === "number" && prev !== 0)
        return ((last - prev) / Math.abs(prev)) * 100;
      return null;
    }
  }
  return null;
}

/** Convert "$B" → "Mds $", "B" → "Mds", "$M" → "M $", "%" → "%", etc.
 *  Yann 16 mai 2026 : aussi "B €" → "Mds €", "B £" → "Mds £" (ASMLF
 *  bookings 26.2 B € affichait "B €" au lieu de "Mds €"). */
export function formatUnit(unit: string): string {
  if (unit == null) return "";
  const u = String(unit).trim();
  switch (u) {
    // Bruts USD
    case "$T":
      return "B $";
    case "$B":
      return "Mds $";
    case "$M":
      return "M $";
    case "$K":
      return "K $";
    case "$":
      return "$";
    // Bruts magnitudes
    case "T":
      return "B";
    case "B":
      return "Mds";
    case "M":
      return "M";
    case "K":
      return "K";
    // % variants
    case "% YoY":
      return "%";
    // Pass-through variantes plain FR
    case "Milliards":
    case "Mds":
      return "Mds";
    case "Millions":
      return "M";
    // Pass-through variantes déjà formatées : on les laisse intactes
    case "Mds $":
    case "Mds €":
    case "Mds £":
    case "M $":
    case "M €":
    case "M £":
    case "K $":
    case "K €":
    case "K £":
      return u;
  }
  // Variantes "B X" sans normalisation : "B €" / "B £" / "B $" mais aussi
  // "B km" / "B units" etc. (Yann 11 juin 2026 : "B km" affichait l'acronyme
  // US au lieu du FR). Tout "B <suffixe>" → "Mds <suffixe>".
  const bMatch = u.match(/^B\s+(.+)$/);
  if (bMatch) return `Mds ${bMatch[1]}`;
  const mMatch = u.match(/^M\s+([€£¥$])$/);
  if (mMatch) return `M ${mMatch[1]}`;
  // Pass-through "Mds CHF" / "Mds JPY" / etc — déjà formatées correctement
  const mdsDevise = u.match(/^Mds\s+[A-Z]{3}$/);
  if (mdsDevise) return u;
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
  const u = (unit ?? "").trim();
  const hasMagnitude = !!u && /\b(Mds|M|K|B)\b/i.test(u);
  // Yann 18 mai 2026 : unités de comptage entières (unités, units,
  // employés, employees, stores, magasins, véhicules, vehicles, abonnés,
  // subscribers, contrats, contracts, etc.) sans préfixe de magnitude
  // (Mds/M/K) ne doivent JAMAIS afficher de décimale, sinon on a
  // "410 000,0 unités" pour TSLA (absurde, observé 18 mai). Test : unit
  // ne contient ni symbole monétaire, ni %, ni magnitude, ET la valeur
  // est >= 100 (rare d'avoir un count fractionnaire en-dessous).
  const isCountUnit =
    !!u &&
    !hasMagnitude &&
    !/[$€£¥%]/.test(u) &&
    /^[A-Za-zÀ-ÿ\s.\-/()]+$/.test(u);
  if (isCountUnit && abs >= 100) return 0;
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
    minimumFractionDigits: 0,
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
  // Yann 12 juil 2026 : normalisation unité brute AVANT rescale (règle [1,999]).
  // Cause n°1 des violations : "M$" (sans espace), "K $", "B$", "millions"...
  // échappaient au ladder -> "4 483 M$" au lieu de "4,48 Mds $".
  const RAW_UNIT_NORMALIZE: Record<string, string> = {
    "M$": "M $", "M USD": "M $", "MUSD": "M $", "millions": "M $", "Millions": "M $",
    "millions $": "M $", "M dollars": "M $",
    "K$": "K $", "$K": "K $", "K USD": "K $", "KUSD": "K $", "milliers $": "K $",
    "B$": "Mds $", "$B": "Mds $", "B USD": "Mds $", "BUSD": "Mds $",
    "milliards": "Mds $", "Milliards": "Mds $", "milliards $": "Mds $", "Md$": "Mds $",
    "Md $": "Mds $", "Mds$": "Mds $", "bn $": "Mds $", "bn": "Mds",
    "M€": "M €", "K€": "K €", "B€": "Mds €",
  };
  const normalizedUnit = RAW_UNIT_NORMALIZE[String(unit ?? "").trim()] ?? unit;
  let displayUnit = formatUnit(normalizedUnit);

  // Yann 17 mai 2026 : rescale M → Mds quand |valeur| >= 1000.
  // Yann 19 mai 2026 : étendu aux formats "M XXX" (code devise texte,
  // ex "M EUR" pour NESTE.HE Revenue 20635 → 20.6 Mds EUR au lieu de
  // l'affichage brut "20 635 M EUR" qui sortait du scope de RESCALE).
  const RESCALE_M_TO_MDS: Record<string, string> = {
    "M": "Mds",
    "$M": "Mds $",
    "M USD": "Mds $",
    "M$": "Mds $",
    "M €": "Mds €",
    "M EUR": "Mds €",
    "M $": "Mds $",
    "M £": "Mds £",
    "M GBP": "Mds GBP",
    "M CHF": "Mds CHF",
    "M JPY": "Mds JPY",
    "M CAD": "Mds CAD",
    "M AUD": "Mds AUD",
    "M DKK": "Mds DKK",
    "M SEK": "Mds SEK",
    "M NOK": "Mds NOK",
    "M HKD": "Mds HKD",
    "M CNY": "Mds CNY",
    "M INR": "Mds INR",
    "M BRL": "Mds BRL",
    "M MXN": "Mds MXN",
    "M ZAR": "Mds ZAR",
    "M KRW": "Mds KRW",
    "M PLN": "Mds PLN",
  };
  const unitForRescale = String(normalizedUnit ?? "").trim();
  if (RESCALE_M_TO_MDS[unitForRescale] && Math.abs(num) >= 1000) {
    displayNum = num / 1000;
    displayUnit = RESCALE_M_TO_MDS[unitForRescale];
  }
  // Yann 12 juil 2026 : ladder K -> M -> Mds (les unités "K $" n'avaient
  // aucun rescale : "33 173 381 K $" restait brut). Applique [1,999].
  const K_LADDER: Record<string, string[]> = {
    "K $": ["K $", "M $", "Mds $"],
    "K €": ["K €", "M €", "Mds €"],
    "K £": ["K £", "M £", "Mds £"],
    "K USD": ["K $", "M $", "Mds $"],
  };
  const kl = K_LADDER[unitForRescale];
  if (kl && Math.abs(displayNum) >= 1000) {
    let ti = 0;
    while (Math.abs(displayNum) >= 1000 && ti < kl.length - 1) {
      displayNum = displayNum / 1000;
      ti += 1;
    }
    displayUnit = kl[ti];
  }
  // "M $" déjà rescalé une fois peut encore dépasser 999 (ex 13 894 600 M$
  // -> 13 894,6 Mds) : pas de tier au-dessus de Mds (décision Yann), on laisse.
  // Yann 12 juil 2026 : DOWNSCALE quand |v| < 1 avec magnitude (règle [1,999]
  // côté bas) : "0,9 Mds $" -> "900 M $" ; "0,37 B USD" -> "370 M $".
  const DOWNSCALE: Record<string, string> = {
    "Mds $": "M $", "Mds €": "M €", "Mds £": "M £", "Mds": "M",
    "Mds USD": "M $", "Mds EUR": "M €",
    "M $": "K $", "M €": "K €",
  };
  while (Math.abs(displayNum) > 0 && Math.abs(displayNum) < 1 && DOWNSCALE[displayUnit]) {
    displayNum = displayNum * 1000;
    displayUnit = DOWNSCALE[displayUnit];
  }

  // Yann 20 mai 2026 : règle "toujours 1 à 999 avec 1 décimale".
  // Cas observé UPS / TSLA : value brute en devise pure ($, €, £…) sans
  // préfixe de magnitude, ex 65 872 000 000 $ pour Average Revenue Per
  // Piece. Affichage actuel = "65 872 000000,0 $", catastrophe.
  // Solution : si la valeur sort de [1, 999] et que l'unit est une
  // devise pure (pas déjà préfixée M / Mds), on monte de magnitude
  // automatiquement jusqu'à rentrer dans [1, 999].
  const RAW_CURRENCY_MAGNITUDE_LADDER: Record<string, string[]> = {
    "$": ["$", "K $", "M $", "Mds $", "B $"],
    "€": ["€", "K €", "M €", "Mds €", "B €"],
    "£": ["£", "K £", "M £", "Mds £", "B £"],
    "¥": ["¥", "K ¥", "M ¥", "Mds ¥", "B ¥"],
    "CHF": ["CHF", "K CHF", "M CHF", "Mds CHF", "B CHF"],
    "EUR": ["EUR", "K EUR", "M EUR", "Mds EUR", "B EUR"],
    "USD": ["USD", "K USD", "M USD", "Mds USD", "B USD"],
    "GBP": ["GBP", "K GBP", "M GBP", "Mds GBP", "B GBP"],
    "JPY": ["JPY", "K JPY", "M JPY", "Mds JPY", "B JPY"],
    "CAD": ["CAD", "K CAD", "M CAD", "Mds CAD", "B CAD"],
    "AUD": ["AUD", "K AUD", "M AUD", "Mds AUD", "B AUD"],
    "SEK": ["SEK", "K SEK", "M SEK", "Mds SEK", "B SEK"],
    "DKK": ["DKK", "K DKK", "M DKK", "Mds DKK", "B DKK"],
    "NOK": ["NOK", "K NOK", "M NOK", "Mds NOK", "B NOK"],
    "HKD": ["HKD", "K HKD", "M HKD", "Mds HKD", "B HKD"],
    "CNY": ["CNY", "K CNY", "M CNY", "Mds CNY", "B CNY"],
    "INR": ["INR", "K INR", "M INR", "Mds INR", "B INR"],
    "BRL": ["BRL", "K BRL", "M BRL", "Mds BRL", "B BRL"],
    "MXN": ["MXN", "K MXN", "M MXN", "Mds MXN", "B MXN"],
    "ZAR": ["ZAR", "K ZAR", "M ZAR", "Mds ZAR", "B ZAR"],
    "KRW": ["KRW", "K KRW", "M KRW", "Mds KRW", "B KRW"],
    "PLN": ["PLN", "K PLN", "M PLN", "Mds PLN", "B PLN"],
  };
  const ladder = RAW_CURRENCY_MAGNITUDE_LADDER[unit];
  if (ladder && Math.abs(displayNum) >= 1000) {
    let tier = 0;
    while (Math.abs(displayNum) >= 1000 && tier < ladder.length - 1) {
      displayNum = displayNum / 1000;
      tier += 1;
    }
    displayUnit = ladder[tier];
  }

  // Règle Yann 15 mai 2026 : nb de décimales déterminé par decimalsForValue.
  const dec = decimalsForValue(displayNum, displayUnit);
  const formatted = displayNum.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
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
  // Yann 15 juin 2026 : un CAGR sur un KPI de TAUX (croissance %, marge %,
  // points de base) n'a aucun sens (taux début≈fin → 0 %/an trompeur).
  // On masque le CAGR pour toutes les unités de pourcentage / points.
  const u = (unit || "").trim().toLowerCase();
  if (u.includes("%") || ["pts", "pb", "pp", "bps", "bp"].includes(u)) return null;
  if (!history || history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  if (first <= 0 || last <= 0) return null;
  const stepsPerYear =
    period_type === "quarter" ? 4 : period_type === "semester" ? 2 : 1;
  const years = (history.length - 1) / stepsPerYear;
  if (years <= 0) return null;
  const result = (Math.pow(last / first, 1 / years) - 1) * 100;
  // Garde-fou (audit 15 juil 2026, GOOGL RPO "+746 %/an") : un CAGR annualisé
  // au-delà de ±200 %/an vient d'une série trop courte ou d'un point de départ
  // quasi nul : trompeur pour l'investisseur → on masque plutôt qu'afficher.
  if (!Number.isFinite(result) || Math.abs(result) > 200) return null;
  return result;
}

/** Format CAGR for display, e.g. "+22.4 % / an" or null when N/A. */
export function formatCAGR(
  history: number[],
  unit?: string,
  period_type: "year" | "quarter" | "semester" = "year",
  locale: "fr" | "en" | "en-GB" | "de" | "de-CH" | "nl" = "fr"
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
  };
  const numLocale = locale === "fr" ? "fr-FR" : locale === "de" || locale === "de-CH" ? "de-DE" : "en-US";
  return `${sign}${c.toLocaleString(numLocale, {
    minimumFractionDigits: 0,
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
  locale: InterpLocale = "fr",
  periodType?: string,
  unit?: string
): string {
  if (!history || history.length < 2) return "n/a";
  const last = history[history.length - 1];
  // Série trimestrielle : YoY = vs même trimestre N-1 (4 pas en arrière),
  // pas vs trimestre précédent (audit 15 juil : "+0,3 %" QoQ affiché "vs N-1").
  const back = periodType === "quarter" && history.length >= 5 ? 5
    : periodType === "semester" && history.length >= 3 ? 3
    : 2;
  const prev = history[history.length - back];
  if (typeof last !== "number" || typeof prev !== "number" || prev === 0) return "n/a";
  // Yann 28 juillet 2026 : un KPI déjà exprimé en % (marge, taux, croissance)
  // se compare en POINTS, jamais en variation relative. Avant, la croissance
  // des impressions publicitaires de META (5 % au T1 2025 -> 19 % au T1 2026)
  // s'affichait "+280,0 %", ce qu'un investisseur lit comme une hausse de 280 %
  // des impressions. La bonne lecture est "+14,0 pts".
  const isPercentUnit = String(unit ?? "").trim() === "%";
  if (isPercentUnit) {
    const diff = last - prev;
    const sgn = diff > 0 ? "+" : "";
    const abs = Math.abs(diff);
    const ptLabel = locale === "fr" ? (abs < 2 ? " pt" : " pts") : abs < 2 ? " pt" : " pts";
    return `${sgn}${diff.toLocaleString(numLocale(locale), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}${ptLabel}`;
  }
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
  // Yann 14 juil 2026 (audit T7) : un KPI en recul ne peut pas être présenté
  // comme "Moteur de croissance" (ex Paxlovid -59 % chez PFE). On préfère un
  // candidat en croissance à chaque niveau de priorité ; si tous les candidats
  // reculent, on garde le meilleur mais le bullet portera le label
  // "Croissance sous pression" (cf plus bas).
  const growsYoy = (k: { yoy?: string | null }) =>
    typeof k.yoy === "string" ? !k.yoy.trim().startsWith("-") : true;
  const driver =
    segmentDrivers.find((d) => d.short !== hero.short && growsYoy(d)) ??
    revenueDrivers.find((d) => d.short !== hero.short && growsYoy(d)) ??
    extendedDrivers.find((d) => d.short !== hero.short && growsYoy(d)) ??
    segmentDrivers.find((d) => d.short !== hero.short) ??
    revenueDrivers.find((d) => d.short !== hero.short) ??
    extendedDrivers.find((d) => d.short !== hero.short) ??
    segmentDrivers[0] ??
    firstNonHero;
  // Yann 21 mai 2026 : élargir détection risk pour garantir 4 sous-blocs
  // d'interprétation. Avant : Cost↑ ou Margin↓ uniquement (manque sur 196 stés).
  // Maintenant : on accepte aussi Margin/Profitability sans condition (signal
  // structurel sectoriel) en fallback, ou Cost/Investment quel que soit yoy.
  // Yann 19 juil 2026 : le label du sous-bloc suit la vraie nature du KPI
  // choisi. "Point de vigilance" ne colle qu'à une tension avérée (Cost↑ ou
  // Margin↓). Sinon on remplace par un label honnête : "Rentabilité" pour
  // les marges stables/en hausse, "Structure de coûts" pour un capex neutre.
  const riskTension = company.kpis.find(
    (k) =>
      (k.type === "Cost" && typeof k.yoy === "string" && !k.yoy.startsWith("-")) ||
      (k.type === "Margin" && typeof k.yoy === "string" && k.yoy.startsWith("-"))
  );
  const riskMarginFallback = company.kpis.find(
    (k) => (k.type === "Margin" || k.type === "Profitability") && k.short !== hero.short
  );
  const riskCostFallback = company.kpis.find(
    (k) => (k.type === "Cost" || k.type === "Investment") && k.short !== hero.short
  );
  const risk = riskTension ?? riskMarginFallback ?? riskCostFallback;
  const riskLabelKey: "risk" | "risk_margin" | "risk_cost" =
    riskTension ? "risk" : (riskMarginFallback ? "risk_margin" : "risk_cost");

  // Yann 27 mai 2026 : refonte priorité cash. Avant : Cash/CashFlow/Capital
  // /Dividende par TYPE. Problème : GOOGL n'a aucun KPI typed Cash → fallback
  // Dividende ($0.21/share) qui n'a aucun sens pour Google. Maintenant :
  // priorité par NOM (Free Cash Flow > Operating Cash Flow > Cash from Ops)
  // → ces noms matchent les tech/SaaS qui ne taguent pas leurs KPIs en Cash.
  // Fallback par type, et Dividende EN DERNIER seulement si vraiment rien.
  const nameMatchesFCF = (k: { short: string; name_fr: string; name_en?: string }) => {
    const blob = `${k.short} ${k.name_fr} ${k.name_en ?? ""}`.toLowerCase();
    return /\b(free\s+cash\s+flow|fcf|operating\s+cash\s+flow|cash\s+from\s+op|flux\s+de\s+tr[ée]sorerie|tr[ée]sorerie\s+op[ée]r)/.test(blob);
  };
  // Yann 27 mai 2026 v2 : exclure les KPIs masqués par _kpis_hidden_by_history_rule.
  // Si un KPI est explicitement masqué (ex GOOGL : DPS/Cap Return/Payout Ratio),
  // il ne doit PAS non plus apparaître dans le bullet cash de l'interprétation.
  // Et : suppression du fallback Dividende (aberrant pour Google : 0,21 $/share).
  const hiddenShorts = new Set(
    (company as unknown as { _kpis_hidden_by_history_rule?: string[] })
      ._kpis_hidden_by_history_rule ?? []
  );
  const eligibleCash = (k: { short: string }) =>
    k.short !== hero.short && !hiddenShorts.has(k.short);
  const cash =
    company.kpis.find((k) => nameMatchesFCF(k) && eligibleCash(k)) ??
    company.kpis.find((k) => k.type === "Cash" && eligibleCash(k)) ??
    company.kpis.find((k) => k.type === "Cash Flow" && eligibleCash(k)) ??
    company.kpis.find((k) => k.type === "Capital" && eligibleCash(k));

  // Yann 14-15 mai 2026 : interprétation IA SUBSTANTIVE.
  // Pas un copier-coller du nom KPI, mais : valeur rescalée (jamais "0,..."),
  // YoY chiffré, CAGR sur la période, point haut/bas historique, ralenti
  // ou pas. La signal pré-écrite reste un complément si non-trivial.
  const histNumsAll = (Array.isArray(hero.history) ? hero.history : []).filter((x): x is number => typeof x === "number");
  // Yann 18 juil 2026 (MA : hero affiché 5 389 trimestriel vs lead "20 522 M
  // USD" annuel) : pour un hero TRIMESTRIEL, le lead parle du même chiffre que
  // le gros nombre affiché = dernier point trimestriel, pas la value annuelle.
  const heroIsQuarterlyLead = hero.period_type === "quarter" && histNumsAll.length >= 5;
  const rawValue = heroIsQuarterlyLead
    ? histNumsAll[histNumsAll.length - 1]
    : (typeof hero.value === "number" ? hero.value : Number(hero.value));
  const rawUnit = String(hero.unit ?? "").replace(/\s+deployed$/i, "").replace(/\s+units$/i, " unités");
  const histNums = histNumsAll;
  const allBelowOne = histNums.length > 0 && histNums.every((v) => Math.abs(v) < 1) && (!Number.isFinite(rawValue) || Math.abs(rawValue) < 1);
  const { unit: scaledUnit, factor: scaleFactor } = autoRescaleForInterp(rawUnit, allBelowOne);
  const heroValue = Number.isFinite(rawValue)
    ? (rawValue * scaleFactor).toLocaleString(numLocale(locale), { maximumFractionDigits: 1 })
    : (hero.value ?? "—");
  const computedYoy = computeYoyFromHistory(hero.history, locale, hero.period_type, rawUnit);
  // Yann 18 juil 2026 : hero trimestriel → YoY recalculé (par label de période
  // en priorité, cf yoySamePeriod), jamais le yoy stocké souvent annuel/périmé.
  let quarterlyLeadYoy: string | null = null;
  if (heroIsQuarterlyLead) {
    const byLabel = yoySamePeriod(
      hero.history,
      (hero as unknown as { history_periods?: string[] }).history_periods,
    );
    const pct = byLabel !== null
      ? byLabel
      : (histNumsAll.length >= 5 && histNumsAll[histNumsAll.length - 5] !== 0
        ? ((histNumsAll[histNumsAll.length - 1] - histNumsAll[histNumsAll.length - 5]) / Math.abs(histNumsAll[histNumsAll.length - 5])) * 100
        : null);
    if (pct !== null) {
      // Yann 28 juillet 2026 : même règle que computeYoyFromHistory. Un KPI
      // déjà en % se compare en points, sinon on affiche une variation
      // relative d'un taux, illisible pour un investisseur.
      const dec = numLocale(locale).startsWith("fr") ? "," : ".";
      if (String(rawUnit ?? "").trim() === "%") {
        const li = histNumsAll.length - 1;
        const pi = li - 4;
        const diff = pi >= 0 ? histNumsAll[li] - histNumsAll[pi] : null;
        if (diff !== null) {
          const abs = Math.abs(diff);
          quarterlyLeadYoy = `${diff > 0 ? "+" : ""}${diff.toFixed(1).replace(".", dec)}${abs < 2 ? " pt" : " pts"}`;
        }
      } else {
        quarterlyLeadYoy = `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", dec)} %`;
      }
    }
  }
  const heroYoy = quarterlyLeadYoy ?? ((typeof hero.yoy === "string" && hero.yoy.trim()) ? hero.yoy : computedYoy);
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
  // Yann 27 mai 2026 : nom KPI selon locale (avant : hardcoded name_fr → texte FR mixed sur page EN).
  const kpiName = (k: { name_fr: string; name_en?: string; name_de?: string }): string => {
    if (locale === "en" || locale === "en-GB") return k.name_en || k.name_fr;
    if (locale === "de" || locale === "de-CH") return k.name_de || k.name_en || k.name_fr;
    return k.name_fr;
  };

  const lead = leadSentence(
    locale,
    company.name,
    kpiName(hero),
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
    const driverDeclines = typeof driver.yoy === "string" && driver.yoy.trim().startsWith("-");
    bullets.push({
      label: bulletLabel(locale, driverDeclines ? "driver_declining" : "driver"),
      body: bulletBodyKpi(locale, kpiName(driver), fmtVal(driver.value), formatUnit(driver.unit), String(driver.yoy ?? ""), driver.signal ?? ""),
      tone: driverDeclines ? "neg" : "pos",
    });
  }
  if (risk) {
    bullets.push({
      label: bulletLabel(locale, riskLabelKey),
      body: bulletBodyKpi(locale, kpiName(risk), fmtVal(risk.value), formatUnit(risk.unit), String(risk.yoy ?? ""), risk.signal ?? ""),
      tone: "neg",
    });
  }
  if (cash && cash.short !== hero.short) {
    bullets.push({
      label: bulletLabel(locale, "cash"),
      body: bulletBodyKpi(locale, kpiName(cash), fmtVal(cash.value), formatUnit(cash.unit), String(cash.yoy ?? ""), cash.signal ?? ""),
      tone: "neutral",
    });
  }

  // Yann 21 mai 2026 : safety-net 4-sous-blocs. Si on n'a pas atteint 3 bullets
  // (= driver + risk + cash, soit 4 sous-blocs total avec lead+future), on
  // pioche dans les KPIs restants pour combler. Garantit qu'aucune fiche
  // V1.9 publishable n'affiche moins de 4 sous-blocs d'interprétation.
  if (bullets.length < 3) {
    const used = new Set<string>([hero.short]);
    if (driver) used.add(driver.short);
    if (risk) used.add(risk.short);
    if (cash) used.add(cash.short);
    const fallbacks = company.kpis.filter((k) => !used.has(k.short));
    const needed = 3 - bullets.length;
    for (let i = 0; i < needed && i < fallbacks.length; i++) {
      const k = fallbacks[i];
      const isNeg = typeof k.yoy === "string" && k.yoy.startsWith("-");
      const tone: InterpretTone = isNeg ? "neg" : "neutral";
      const isCash =
        k.type === "Cash" || k.type === "Cash Flow" || k.type === "Capital" || k.type === "Dividende";
      const isRisk =
        k.type === "Cost" ||
        k.type === "Margin" ||
        k.type === "Profit" ||
        k.type === "Profitability" ||
        k.type === "Risk";
      const labelKey: "cash" | "risk" | "driver" | "driver_declining" =
        isCash ? "cash" : isRisk ? "risk" : isNeg ? "driver_declining" : "driver";
      bullets.push({
        label: bulletLabel(locale, labelKey),
        body: bulletBodyKpi(locale, kpiName(k), fmtVal(k.value), formatUnit(k.unit), String(k.yoy ?? ""), k.signal ?? ""),
        tone,
      });
    }
  }

  // FUTURE bullet — promoted to first-class citizen.
  bullets.push({
    label: bulletLabel(locale, "future"),
    body: futureBulletBody(locale, kpiName(hero)),
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
