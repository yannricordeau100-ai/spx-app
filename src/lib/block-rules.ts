/**
 * block-rules.ts — règles d'écriture par bloc page sté.
 *
 * Source de vérité = table Supabase `desk_block_rules` (1 ligne par bloc).
 * Yann écrit librement les règles dans /sandbox/admin/block-rules.
 *
 * Les sub-agents (extracteurs, ré-écritures) DOIVENT appeler getBlockRules(blockKey)
 * AVANT toute écriture sur le bloc concerné pour respecter le fond + la forme
 * voulus par Yann.
 *
 * V1 (maintenant) : `rules_structured = { lines: rules_raw.split("\n").filter(...) }`
 * V2 (futur) : LLM parser Cerebras → { do: [], dont: [], hors_top1: [] }
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** 12 blocs canoniques de la page société Mettrik. */
export type BlockKey =
  | "hero_kpi"
  | "chart_hero"
  | "indicateurs_cles"
  | "stories_kpi"
  | "comprendre_societe"
  | "facteurs_risque"
  | "gouvernance"
  | "ai_positioning"
  | "repartition_ca"
  | "events_timeline"
  | "freshness_pill"
  | "footer_disclaimer";

export const BLOCK_KEYS: BlockKey[] = [
  "hero_kpi",
  "chart_hero",
  "indicateurs_cles",
  "stories_kpi",
  "comprendre_societe",
  "facteurs_risque",
  "gouvernance",
  "ai_positioning",
  "repartition_ca",
  "events_timeline",
  "freshness_pill",
  "footer_disclaimer",
];

/** Libellé FR human-readable pour chaque bloc (UI admin). */
export const BLOCK_LABELS: Record<BlockKey, string> = {
  hero_kpi: "Hero KPI",
  chart_hero: "Chart hero (animation, axe Y, fiscal label)",
  indicateurs_cles: "Indicateurs clés (table KPIs)",
  stories_kpi: "Stories KPI (carrousel)",
  comprendre_societe: "Comprendre la société (description, répartition)",
  facteurs_risque: "Facteurs de risque (risks[])",
  gouvernance: "Gouvernance & rémunération",
  ai_positioning: "Positionnement IA",
  repartition_ca: "Répartition CA (segments + géographie)",
  events_timeline: "Events timeline",
  freshness_pill: "Freshness pill (À jour / Stale)",
  footer_disclaimer: "Footer disclaimer",
};

export type BlockRulesStructured = {
  /** V1 : lignes brutes non vides extraites de `rules_raw`. */
  lines?: string[];
  /** V2 (futur) : règles structurées par LLM. */
  do?: string[];
  dont?: string[];
  hors_top1?: string[];
};

export type BlockRulesRow = {
  block_key: BlockKey;
  rules_raw: string;
  rules_structured: BlockRulesStructured;
  rules_hors_top1_raw: string;
  rules_hors_top1_structured: BlockRulesStructured;
  updated_at: string;
};

/** Sortie standard renvoyée aux sub-agents. */
export type BlockRulesPayload = {
  raw: string;
  structured: BlockRulesStructured;
  hors_top1_raw: string;
  hors_top1_structured: BlockRulesStructured;
  updated_at: string | null;
};

const EMPTY_PAYLOAD: BlockRulesPayload = {
  raw: "",
  structured: { lines: [] },
  hors_top1_raw: "",
  hors_top1_structured: { lines: [] },
  updated_at: null,
};

/**
 * V1 structuration : split sur newlines, filtre lignes vides, trim.
 * Idempotent : recalculable depuis `rules_raw` à tout moment.
 */
export function structureRulesV1(raw: string): BlockRulesStructured {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return { lines };
}

/**
 * Charge les règles d'un bloc précis. Retourne payload vide si bloc absent
 * (la table peut ne pas exister tant que la migration n'est pas appliquée).
 *
 * À appeler par les sub-agents AVANT chaque écriture sur le bloc concerné.
 */
export async function getBlockRules(
  blockKey: BlockKey,
): Promise<BlockRulesPayload> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("desk_block_rules")
      .select("*")
      .eq("block_key", blockKey)
      .maybeSingle();
    if (error || !data) return EMPTY_PAYLOAD;
    const row = data as BlockRulesRow;
    return {
      raw: row.rules_raw ?? "",
      structured: (row.rules_structured ?? { lines: [] }) as BlockRulesStructured,
      hors_top1_raw: row.rules_hors_top1_raw ?? "",
      hors_top1_structured: (row.rules_hors_top1_structured ?? { lines: [] }) as BlockRulesStructured,
      updated_at: row.updated_at,
    };
  } catch {
    return EMPTY_PAYLOAD;
  }
}

/**
 * Charge toutes les règles (utilisé par l'UI admin pour pré-remplir
 * les 12 textareas).
 */
export async function getAllBlockRules(): Promise<
  Record<BlockKey, BlockRulesPayload>
> {
  const out: Record<string, BlockRulesPayload> = {};
  for (const k of BLOCK_KEYS) out[k] = EMPTY_PAYLOAD;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("desk_block_rules")
      .select("*");
    if (error || !data) return out as Record<BlockKey, BlockRulesPayload>;
    for (const r of data as BlockRulesRow[]) {
      out[r.block_key] = {
        raw: r.rules_raw ?? "",
        structured: (r.rules_structured ?? { lines: [] }) as BlockRulesStructured,
        hors_top1_raw: r.rules_hors_top1_raw ?? "",
        hors_top1_structured: (r.rules_hors_top1_structured ?? { lines: [] }) as BlockRulesStructured,
        updated_at: r.updated_at,
      };
    }
  } catch {
    // fall-through : payload vide pour tous
  }
  return out as Record<BlockKey, BlockRulesPayload>;
}

/**
 * Upsert des règles d'un bloc. Recalcule `rules_structured` en V1 (split lignes).
 */
export async function upsertBlockRules(
  blockKey: BlockKey,
  raw: string,
  horsTop1Raw: string = "",
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const structured = structureRulesV1(raw);
  const horsTop1Structured = structureRulesV1(horsTop1Raw);
  const { error } = await supabase
    .from("desk_block_rules")
    .upsert(
      {
        block_key: blockKey,
        rules_raw: raw,
        rules_structured: structured,
        rules_hors_top1_raw: horsTop1Raw,
        rules_hors_top1_structured: horsTop1Structured,
      },
      { onConflict: "block_key" },
    );
  if (error) throw new Error(error.message);
}
