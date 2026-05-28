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
  | "gouvernance_top3"
  | "logo"
  | "repartition_geo_treemap"
  | "repartition_geo_radial"
  | "repartition_geo_iso3d"
  | "repartition_segment_treemap"
  | "repartition_segment_radial"
  | "repartition_segment_iso3d"
  | "gouvernance_top3_votes"
  | "gouvernance_top3_capital";

export const DISABLED_BLOCKS_KEYS: DisabledBlockKey[] = [
  "snapshot_boursier",
  "logo",
  "description_mettrik",
  "graphiques_schemas",
  "gouvernance",
  "gouvernance_top3_votes",
  "gouvernance_top3_capital",
  "ai_positioning",
  "transcript_bullets",
  "risks",
  "kpi_stories",
  "events",
  "repartition_geo_treemap",
  "repartition_geo_radial",
  "repartition_geo_iso3d",
  "repartition_segment_treemap",
  "repartition_segment_radial",
  "repartition_segment_iso3d",
];

export const DISABLED_BLOCKS_LABELS: Record<DisabledBlockKey, string> = {
  snapshot_boursier: "Snapshot boursier",
  logo: "Logo (header)",
  description_mettrik: "Description Mettrik",
  graphiques_schemas: "Graphiques et schémas",
  gouvernance: "Gouvernance & rémunération",
  gouvernance_top3: "Gouvernance : Top 3 (votes + capital) [legacy]",
  gouvernance_top3_votes: "Gouvernance · Top 3 Droits de vote",
  gouvernance_top3_capital: "Gouvernance · Top 3 Capital détenu",
  ai_positioning: "Positionnement IA",
  transcript_bullets: "Synthèse earning call",
  risks: "Facteurs de risque",
  kpi_stories: "Stories KPIs",
  events: "Événements (timeline)",
  repartition_geo_treemap: "Répartition CA · vue Géographique Treemap",
  repartition_geo_radial: "Répartition CA · vue Géographique Radiale",
  repartition_geo_iso3d: "Répartition CA · vue Géographique Iso 3D",
  repartition_segment_treemap: "Répartition CA · vue Segment Treemap",
  repartition_segment_radial: "Répartition CA · vue Segment Radiale",
  repartition_segment_iso3d: "Répartition CA · vue Segment Iso 3D",
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
  if (cfg.disabled.includes(key)) return true;
  // Rétro-compatibilité : ancienne clé `gouvernance_top3` (legacy) couvre
  // les 2 nouvelles clés séparées votes + capital.
  if (
    (key === "gouvernance_top3_votes" || key === "gouvernance_top3_capital") &&
    cfg.disabled.includes("gouvernance_top3")
  ) {
    return true;
  }
  return false;
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
  if (perSte.includes(blockKey)) return true;
  // Rétro-compatibilité per-sté : ancienne clé legacy `gouvernance_top3`
  // couvre les 2 nouvelles clés votes + capital.
  if (
    (blockKey === "gouvernance_top3_votes" || blockKey === "gouvernance_top3_capital") &&
    perSte.includes("gouvernance_top3")
  ) {
    return true;
  }
  return false;
}
