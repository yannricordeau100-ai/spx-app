/**
 * Helper centralisé pour la liste des blocs page société désactivés.
 *
 * Pourquoi : Yann veut pouvoir masquer un bloc page société (ex: snapshot
 * boursier, description Mettrik, graphiques et schémas, etc.) sans
 * supprimer le code. Réactivation par toggle dans /sandbox/v1-8/blocks-toggle.
 *
 * Indépendant du système existant `v1-9-blocks-control.json` qui gère les
 * blocs V1.9 avec overrides per-ticker. Ici on a un simple flag global
 * on/off par clé de bloc, lu côté SSR par `company-view.tsx`.
 *
 * Source de vérité : `src/data/disabled-blocks.json`.
 *
 * Clés de bloc supportées :
 *  - snapshot_boursier   : StockPriceBlock dans CompanyHeader
 *  - description_mettrik : Bloc description Mettrik dans CompanyProfileCard
 *  - graphiques_schemas  : ImageFindingsBlock (graphiques + schémas)
 *  - gouvernance         : GovernanceCard
 *  - ai_positioning      : AIPositioningCard
 *  - transcript_bullets  : TranscriptBulletsBlock (synthèse earning call)
 *  - risks               : RiskStack (facteurs de risque)
 *  - kpi_stories         : KpiStories (carrousel stories KPIs)
 *  - events              : EventTimeline (événements à venir / sur chart)
 */
import config from "@/data/disabled-blocks.json";
import perSteConfig from "@/data/disabled-blocks-per-ste.json";

export type DisabledBlockKey =
  | "snapshot_boursier"
  | "description_mettrik"
  | "graphiques_schemas"
  | "gouvernance"
  | "ai_positioning"
  | "transcript_bullets"
  | "risks"
  | "kpi_stories"
  | "events"
  | "gouvernance_top3";

export const DISABLED_BLOCKS_KEYS: DisabledBlockKey[] = [
  "snapshot_boursier",
  "description_mettrik",
  "graphiques_schemas",
  "gouvernance",
  "gouvernance_top3",
  "ai_positioning",
  "transcript_bullets",
  "risks",
  "kpi_stories",
  "events",
];

export const DISABLED_BLOCKS_LABELS: Record<DisabledBlockKey, string> = {
  snapshot_boursier: "Snapshot boursier",
  description_mettrik: "Description Mettrik",
  graphiques_schemas: "Graphiques et schémas",
  gouvernance: "Gouvernance & rémunération",
  gouvernance_top3: "Gouvernance : Top 3 (votes + capital)",
  ai_positioning: "Positionnement IA",
  transcript_bullets: "Synthèse earning call",
  risks: "Facteurs de risque",
  kpi_stories: "Stories KPIs",
  events: "Événements (timeline)",
};

export type DisabledBlocksConfig = {
  disabled: string[];
  updated_at?: string;
};

export function loadDisabledBlocks(): DisabledBlocksConfig {
  const c = config as { disabled?: unknown; updated_at?: unknown };
  const disabled = Array.isArray(c.disabled)
    ? c.disabled.filter((x): x is string => typeof x === "string")
    : [];
  const updated_at = typeof c.updated_at === "string" ? c.updated_at : undefined;
  return { disabled, updated_at };
}

export function isBlockDisabled(key: DisabledBlockKey | string): boolean {
  const cfg = loadDisabledBlocks();
  return cfg.disabled.includes(key);
}

/* ------------------------------------------------------------------ */
/* Per-sté overrides                                                  */
/* ------------------------------------------------------------------ */

export type DisabledBlocksPerSteConfig = {
  overrides: Record<string, string[]>;
  updated_at?: string;
};

export function loadDisabledBlocksPerSte(): DisabledBlocksPerSteConfig {
  const c = perSteConfig as { overrides?: unknown; updated_at?: unknown };
  const rawOverrides = (c.overrides ?? {}) as Record<string, unknown>;
  const overrides: Record<string, string[]> = {};
  for (const [ticker, blocks] of Object.entries(rawOverrides)) {
    if (Array.isArray(blocks)) {
      overrides[ticker.toUpperCase()] = blocks.filter(
        (x): x is string => typeof x === "string",
      );
    }
  }
  const updated_at = typeof c.updated_at === "string" ? c.updated_at : undefined;
  return { overrides, updated_at };
}

/**
 * Renvoie la liste des blocs désactivés pour un ticker donné (per-sté UNIQUEMENT,
 * pas le global). Utilisé par l'UI admin pour pré-cocher les cases.
 */
export function getDisabledBlocksForTicker(ticker: string): string[] {
  const cfg = loadDisabledBlocksPerSte();
  return cfg.overrides[ticker.toUpperCase()] ?? [];
}

/**
 * Renvoie true si le bloc est masqué pour ce ticker, soit parce qu'il est
 * désactivé globalement, soit parce qu'il est désactivé spécifiquement pour
 * cette sté. Utilisé côté `company-view.tsx`.
 */
export function isBlockDisabledForTicker(
  ticker: string,
  blockKey: DisabledBlockKey | string,
): boolean {
  if (isBlockDisabled(blockKey)) return true;
  const perSte = getDisabledBlocksForTicker(ticker);
  return perSte.includes(blockKey);
}
