/**
 * Per-company brand colors + quality/percentile rating logic.
 */
import type { KPI } from "./data";

export const BRAND: Record<
  string,
  { primary: string; secondary: string; glow: string }
> = {
  GOOGL: {
    primary: "#4285F4", // Google blue
    secondary: "#34A853", // Google green
    glow: "rgba(66, 133, 244, 0.25)",
  },
  META: {
    primary: "#0866FF", // Meta blue
    secondary: "#1877F2",
    glow: "rgba(8, 102, 255, 0.25)",
  },
  MSCI: {
    primary: "#3D7BFF", // MSCI blue (corporate accent on dark)
    secondary: "#7AAEFF",
    glow: "rgba(61, 123, 255, 0.25)",
  },
  SPGI: {
    primary: "#E31837", // S&P Global red
    secondary: "#FF5470",
    glow: "rgba(227, 24, 55, 0.22)",
  },
  CAT: {
    primary: "#FFCD11", // Caterpillar yellow
    secondary: "#FFD84D",
    glow: "rgba(255, 205, 17, 0.22)",
  },
};

export function brand(ticker: string) {
  return BRAND[ticker] ?? BRAND.META;
}

/* -------------------------------------------------------------------------- */
/*                              Quality rating                                */
/* -------------------------------------------------------------------------- */

export type QualityTier = "excellent" | "bon" | "moyen" | "faible";

export type Rating = {
  tier: QualityTier;
  label: string;
  percentile: string; // e.g. "Top 5 %", "Top 25 %", "Bottom 25 %"
  color: string;
};

const TIER_META: Record<QualityTier, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "#10b981" },
  bon: { label: "Bon", color: "#22c55e" },
  moyen: { label: "Moyen", color: "#f59e0b" },
  faible: { label: "Faible", color: "#f43f5e" },
};

function parsePct(s: string | null | undefined): number | null {
  // accepts "+12%", "-3.5 pts", "+9.2%", "+x.x pts"
  if (typeof s !== "string") return null;
  const m = s.match(/(-?\+?-?\d+\.?\d*)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/\+/g, ""));
}

/**
 * Heuristic quality + percentile for V1.
 * Different rules per type. All percentile thresholds rounded (1, 5, 10, 25, 50).
 */
export function rate(kpi: KPI): Rating {
  const yoy = parsePct(kpi.yoy) ?? 0;
  // Garde-fou : value peut être number, null, ou string. Convertir avec sécurité.
  const valueStr = typeof kpi.value === "string" ? kpi.value : (kpi.value != null ? String(kpi.value) : "");
  const value = parseFloat(valueStr.replace(/,/g, ""));
  const t = kpi.type;

  // Cost-type: growth is bad
  if (t === "Cost") {
    if (yoy <= 0) return makeRating("excellent", "Top 5 %");
    if (yoy < 5) return makeRating("bon", "Top 25 %");
    if (yoy < 15) return makeRating("moyen", "Top 50 %");
    return makeRating("faible", "Bottom 25 %");
  }

  // Margin: level matters more than YoY
  if (t === "Margin") {
    if (value >= 50) return makeRating("excellent", "Top 1 %");
    if (value >= 30) return makeRating("excellent", "Top 5 %");
    if (value >= 20) return makeRating("bon", "Top 25 %");
    if (value >= 10) return makeRating("moyen", "Top 50 %");
    return makeRating("faible", "Bottom 25 %");
  }

  // Investment (capex): high growth = strategic — neutral-leaning
  if (t === "Investment") {
    if (yoy >= 50) return makeRating("excellent", "Top 5 %");
    if (yoy >= 20) return makeRating("bon", "Top 25 %");
    if (yoy >= 0) return makeRating("moyen", "Top 50 %");
    return makeRating("faible", "Bottom 25 %");
  }

  // User retention/DAP — level + small growth
  if (t === "User") {
    // Retention >94% = excellent; user growth >5% = excellent
    if (kpi.unit === "%") {
      if (value >= 95) return makeRating("excellent", "Top 5 %");
      if (value >= 92) return makeRating("bon", "Top 25 %");
      if (value >= 88) return makeRating("moyen", "Top 50 %");
      return makeRating("faible", "Bottom 25 %");
    }
    if (yoy >= 5) return makeRating("excellent", "Top 5 %");
    if (yoy >= 2) return makeRating("bon", "Top 25 %");
    if (yoy >= 0) return makeRating("moyen", "Top 50 %");
    return makeRating("faible", "Bottom 25 %");
  }

  // Revenue / Demand / Cash / Volume / Pricing — YoY-driven
  if (yoy >= 30) return makeRating("excellent", "Top 1 %");
  if (yoy >= 15) return makeRating("excellent", "Top 5 %");
  if (yoy >= 8) return makeRating("bon", "Top 25 %");
  if (yoy >= 0) return makeRating("moyen", "Top 50 %");
  return makeRating("faible", "Bottom 25 %");
}

function makeRating(tier: QualityTier, percentile: string): Rating {
  const meta = TIER_META[tier];
  return { tier, label: meta.label, percentile, color: meta.color };
}

/* -------------------------------------------------------------------------- */
/*                             Anomaly detection                              */
/* -------------------------------------------------------------------------- */

export type AnomalyCause = "performance" | "perimeter" | "reporting" | "unknown";

export type Anomaly = {
  index: number;
  pct: number;
  /** Categorised cause (best-effort, KPI-aware). */
  cause: AnomalyCause;
  /** Title shown at the top of the tooltip. */
  title: string;
  /** Body explaining the variation. */
  message: string;
};

const CAUSE_LABEL: Record<AnomalyCause, string> = {
  performance: "Variation de performance",
  perimeter: "Changement de périmètre",
  reporting: "Changement comptable / reporting",
  unknown: "Cause à investiguer",
};

/**
 * Detect any data point that jumped >50% or fell >40% vs prior.
 * Cause heuristics use the KPI type + the magnitude.
 */
export function detectAnomalies(
  history: number[],
  kpiType?: string,
  kpiShort?: string
): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    if (prev === 0) continue;
    const denom = Math.abs(prev);
    const pct = ((curr - prev) / denom) * 100;
    if (Math.abs(pct) < 50) continue;

    let cause: AnomalyCause = "performance";
    let extra = "";

    // Heuristics by KPI signature
    if (kpiShort === "Revenue" && pct > 50) {
      cause = "perimeter";
      extra =
        " Probablement lié à une fusion ou acquisition (ex. SPGI fusion IHS Markit en 2022 ou intégration d'un nouveau segment).";
    } else if (kpiType === "Investment" && pct > 50) {
      cause = "performance";
      extra =
        " Décision stratégique de la direction (cycle d'investissement IA, capacité industrielle).";
    } else if (kpiType === "Cost" && pct > 50) {
      cause = "performance";
      extra =
        " Charge exceptionnelle ou détérioration opérationnelle. À vérifier vs guidance.";
    } else if (kpiType === "Demand" && pct > 50) {
      cause = "performance";
      extra =
        " Choc de demande exogène (ex. boom datacenters pour CAT, reprise pub pour Meta).";
    } else if (Math.abs(pct) >= 80) {
      cause = "performance";
      extra = " Magnitude exceptionnelle, à mettre en regard du contexte sectoriel.";
    }

    const dir = pct > 0 ? "Hausse" : "Recul";
    const sign = pct > 0 ? "+" : "";
    out.push({
      index: i,
      pct,
      cause,
      title: `${dir} de ${sign}${pct.toFixed(0)} % vs l'année précédente`,
      message: `${CAUSE_LABEL[cause]}.${extra}`,
    });
  }
  return out;
}

export { CAUSE_LABEL };
