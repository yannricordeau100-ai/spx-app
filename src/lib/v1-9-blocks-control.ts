import controlData from "@/data/v1-9-blocks-control.json";

export type BlockId =
  | "hero"
  | "interpretation"
  | "kpis"
  | "stories"
  | "repartition"
  | "governance"
  | "risks"
  | "events"
  | "ai_positioning"
  | "dividend"
  | "transcripts"
  | "image_findings"
  | "ranks";

export const BLOCK_LABELS: Record<BlockId, string> = {
  hero: "Hero KPI",
  interpretation: "Interprétation",
  kpis: "KPIs",
  stories: "Histoires KPI",
  repartition: "Répartition (segments / géo)",
  governance: "Gouvernance",
  risks: "Facteurs de risque",
  events: "Événements à venir",
  ai_positioning: "Position IA",
  dividend: "Dividende",
  transcripts: "Transcripts earnings",
  image_findings: "Image findings",
  ranks: "Classements & parts de marché",
};

export const BLOCK_PLACEHOLDER_HINTS: Record<BlockId, string> = {
  hero: "Le KPI principal de cette sté arrive bientôt.",
  interpretation: "L'analyse en quatre lectures (Lead, Moteur, Vigilance, Veille) est en préparation.",
  kpis: "Le panneau de KPIs détaillés se peaufine.",
  stories: "Les histoires derrière chaque indicateur prennent forme.",
  repartition: "La cartographie segments et géographies se prépare.",
  governance: "Le détail gouvernance (CEO, board, capital) est en cours de vérification.",
  risks: "Les facteurs de risque officiels sont en cours d'extraction.",
  events: "Le calendrier d'événements à venir se construit.",
  ai_positioning: "Notre lecture de la position IA arrive prochainement.",
  dividend: "L'analyse dividende (DPS, payout, growth) est en cours.",
  transcripts: "Les transcripts d'earnings calls arrivent.",
  image_findings: "Les findings visuels sont en cours d'extraction.",
  ranks: "Les classements et parts de marché se peaufinent.",
};

type ControlData = {
  global: Record<BlockId, boolean>;
  per_ticker_overrides: Record<string, Partial<Record<BlockId, boolean>>>;
};

const data = controlData as unknown as ControlData;

/**
 * Returns true if the block should be visible for this ticker.
 * Rules :
 * - If global=false → bloc masqué partout (force off)
 * - If global=true ET no per-ticker override → bloc affiché
 * - If global=true ET per-ticker override=false → bloc masqué (placeholder affiché)
 * - If global=true ET per-ticker override=true → bloc affiché
 */
export function isBlockEnabled(blockId: BlockId, ticker?: string): boolean {
  const globalEnabled = data.global?.[blockId] ?? true;
  if (!globalEnabled) return false;
  if (!ticker) return globalEnabled;
  const tk = ticker.toUpperCase();
  const overrides = data.per_ticker_overrides?.[tk];
  if (!overrides) return globalEnabled;
  if (typeof overrides[blockId] === "boolean") {
    return overrides[blockId] as boolean;
  }
  return globalEnabled;
}

/**
 * Returns global toggle state (admin UI).
 */
export function getGlobalToggles(): Record<BlockId, boolean> {
  return { ...data.global };
}

/**
 * Returns per-ticker override map (admin UI).
 */
export function getPerTickerOverrides(): Record<string, Partial<Record<BlockId, boolean>>> {
  return { ...data.per_ticker_overrides };
}
