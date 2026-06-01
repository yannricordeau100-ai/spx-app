/**
 * apply-block-rules.ts — worker pour appliquer les règles stockées dans
 * `desk_block_rules` à TOUT l'univers V1.9.5 (911 datasets dans
 * `src/data/v1-9-complete/`).
 *
 * Catégorisation auto par règle :
 *   - Catégorie A (UI) : règle qui parle de composant React, de couleur,
 *     de taille de police, de marge, d'animation, etc. → reportée comme
 *     "déjà appliquée par le team" (pas de modif data).
 *   - Catégorie B (data) : règle qui parle d'em-dash, d'unité, de
 *     normalisation de chiffre, de vocabulaire FR strict, etc. → on
 *     applique sur les datasets V1.9.5.
 *
 * Anti-hallucination : si une règle est ambiguë (pas de pattern data clair),
 * on la flag `needs_human_review` et on NE l'applique PAS.
 *
 * Idempotent : appliquer 2 fois la même règle ne crée pas de modifs en
 * plus la 2e fois (les transformations sont déjà faites).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BLOCK_KEYS,
  BLOCK_LABELS,
  type BlockKey,
} from "@/lib/block-rules";

const V1_9_5_DIR = path.join(process.cwd(), "src", "data", "v1-9-complete");

/** Catégorie inférée pour une règle. */
type RuleCategory = "ui" | "data" | "ambiguous";

/** 1 transformation data détectée dans une règle. */
type DataTransform = {
  kind:
    | "remove_em_dash"
    | "normalize_b_to_mds"
    | "normalize_m_dollar"
    | "normalize_percent_spacing"
    | "ban_english_term";
  /** Terme à bannir, si kind = ban_english_term. */
  term?: string;
  /** Remplacement (par défaut, équivalent FR). */
  replacement?: string;
};

/** Résultat de l'analyse d'une ligne de règle. */
type AnalyzedRule = {
  raw_line: string;
  category: RuleCategory;
  /** Patterns data détectés (peut être vide). */
  transforms: DataTransform[];
  /** Raison si flag review humain. */
  needs_review_reason?: string;
};

/** Report par bloc. */
export type BlockApplyReport = {
  block_key: BlockKey;
  block_label: string;
  rules_count: number;
  ui_rules_count: number;
  data_rules_count: number;
  ambiguous_rules_count: number;
  /** Liste des règles flag review. */
  needs_review: { line: string; reason: string }[];
  /** Compte des modifs data par type. */
  data_modifications: Record<string, number>;
  /** Stés touchées par les modifs data. */
  modified_tickers: string[];
};

export type JobReport = {
  started_at: string;
  finished_at: string;
  total_companies_scanned: number;
  total_modifications: number;
  by_block: BlockApplyReport[];
};

/**
 * Analyse 1 ligne de règle et infère sa catégorie + transformations data.
 * V1 : détection par mots-clés FR (le LLM parser viendra en V2).
 */
function analyzeRuleLine(line: string): AnalyzedRule {
  const lower = line.toLowerCase();
  const transforms: DataTransform[] = [];

  // Patterns DATA détectables sans ambiguïté.
  if (/em[\s-]?dash|tiret[\s]?long|cadratin|—/.test(lower)) {
    transforms.push({ kind: "remove_em_dash" });
  }
  if (
    /\bb\$|\$b\b|\bmds\s?\$|milliards/.test(lower) &&
    /(remplace|normalise|toujours|jamais|écris)/.test(lower)
  ) {
    transforms.push({ kind: "normalize_b_to_mds" });
  }
  if (/\bm\$|\$m\b|millions/.test(lower) && /(espace|normalise|écris)/.test(lower)) {
    transforms.push({ kind: "normalize_m_dollar" });
  }
  if (/%\s|pourcent|pourcentage/.test(lower) && /(espace|nbsp|insécable)/.test(lower)) {
    transforms.push({ kind: "normalize_percent_spacing" });
  }

  // Détection bannissement terme EN (ex : "jamais say-on-pay" → ban_english_term).
  const banMatch = line.match(/jamais\s+["«]?([a-zA-Z][a-zA-Z\s-]+)["»]?/i);
  if (banMatch) {
    transforms.push({ kind: "ban_english_term", term: banMatch[1].trim() });
  }

  // Catégorisation.
  const uiKeywords =
    /composant|react|tailwind|css|couleur|police|font|marge|padding|animation|hover|focus|spinner|modal|tooltip|chart|graph|svg|axe|axis|toggle|scroll|sticky|responsive/;
  const dataKeywords =
    /em[\s-]?dash|tiret|unité|chiffre|nombre|format|vocabulaire|valeur|kpi|history|description|signal|narratif|texte|libellé|label/;

  if (transforms.length > 0) {
    return { raw_line: line, category: "data", transforms };
  }

  if (uiKeywords.test(lower) && !dataKeywords.test(lower)) {
    return { raw_line: line, category: "ui", transforms: [] };
  }

  if (dataKeywords.test(lower)) {
    return {
      raw_line: line,
      category: "ambiguous",
      transforms: [],
      needs_review_reason:
        "Règle data mais pas de pattern automatique détecté (transformations possibles à clarifier).",
    };
  }

  // Par défaut, considéré UI (le team a fait le job).
  return { raw_line: line, category: "ui", transforms: [] };
}

/**
 * Applique 1 transformation à une string. Idempotent.
 */
function applyTransformToText(text: string, t: DataTransform): { out: string; n: number } {
  let out = text;
  let n = 0;
  switch (t.kind) {
    case "remove_em_dash": {
      const matches = out.match(/—/g);
      if (matches) {
        n = matches.length;
        out = out.replace(/—/g, " : ");
      }
      break;
    }
    case "normalize_b_to_mds": {
      const matches = out.match(/\b(\d+[,.]?\d*)\s?B\$|\$\s?(\d+[,.]?\d*)\s?B\b/g);
      if (matches) n = matches.length;
      out = out.replace(/(\d+[,.]?\d*)\s?B\$/g, "$1 Mds $");
      out = out.replace(/\$\s?(\d+[,.]?\d*)\s?B\b/g, "$1 Mds $");
      break;
    }
    case "normalize_m_dollar": {
      const matches = out.match(/(\d+[,.]?\d*)M\$/g);
      if (matches) n = matches.length;
      out = out.replace(/(\d+[,.]?\d*)M\$/g, "$1 M $");
      break;
    }
    case "normalize_percent_spacing": {
      // remplace "12%" par "12 %" (espace insécable U+00A0).
      const matches = out.match(/(\d+[,.]?\d*)%/g);
      if (matches) n = matches.length;
      out = out.replace(/(\d+[,.]?\d*)%/g, "$1 %");
      break;
    }
    case "ban_english_term": {
      if (t.term) {
        const re = new RegExp(`\\b${t.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        const matches = out.match(re);
        if (matches) n = matches.length;
        if (t.replacement) {
          out = out.replace(re, t.replacement);
        }
      }
      break;
    }
  }
  return { out, n };
}

/**
 * Champs textuels d'un dataset V1.9.5 où on applique les transformations data.
 * On évite les champs structurés (numériques, dates) pour ne pas casser.
 */
const TEXT_FIELDS_TOP = ["tagline", "hero_kpi_rationale"] as const;
const TEXT_FIELDS_KPI = ["signal", "description", "name_fr", "name_en"] as const;

type Dataset = {
  ticker: string;
  tagline?: string;
  hero_kpi_rationale?: string;
  kpis?: Array<Record<string, unknown>>;
  [k: string]: unknown;
};

function applyTransformsToDataset(
  dataset: Dataset,
  transforms: DataTransform[],
): { changed: boolean; modifications: number } {
  let totalMods = 0;

  for (const t of transforms) {
    for (const field of TEXT_FIELDS_TOP) {
      const v = dataset[field];
      if (typeof v === "string") {
        const { out, n } = applyTransformToText(v, t);
        if (n > 0) {
          dataset[field] = out;
          totalMods += n;
        }
      }
    }
    if (Array.isArray(dataset.kpis)) {
      for (const kpi of dataset.kpis) {
        for (const field of TEXT_FIELDS_KPI) {
          const v = kpi[field];
          if (typeof v === "string") {
            const { out, n } = applyTransformToText(v, t);
            if (n > 0) {
              kpi[field] = out;
              totalMods += n;
            }
          }
        }
      }
    }
  }

  return { changed: totalMods > 0, modifications: totalMods };
}

/**
 * Lance le run complet d'application des règles.
 * Met à jour Supabase au fur et à mesure (last_applied_at + last_apply_report).
 */
export async function runBlockRulesApply(jobId: string): Promise<JobReport> {
  const startedAt = new Date().toISOString();
  const supabase = createSupabaseAdminClient();

  // Marque job running.
  await supabase
    .from("desk_block_rules_jobs")
    .update({ status: "running" })
    .eq("id", jobId);

  // 1. Charge toutes les règles depuis Supabase.
  const { data: rulesRows, error: rulesErr } = await supabase
    .from("desk_block_rules")
    .select("block_key, rules_raw");
  if (rulesErr) throw new Error(`Lecture règles : ${rulesErr.message}`);

  const rulesMap = new Map<string, string>();
  for (const row of rulesRows ?? []) {
    rulesMap.set(row.block_key as string, (row.rules_raw as string) ?? "");
  }

  // 2. Analyse chaque règle par bloc.
  const analyzedByBlock: Record<BlockKey, AnalyzedRule[]> = {} as Record<
    BlockKey,
    AnalyzedRule[]
  >;
  const allDataTransforms: { blockKey: BlockKey; t: DataTransform }[] = [];

  for (const bk of BLOCK_KEYS) {
    const raw = rulesMap.get(bk) ?? "";
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    analyzedByBlock[bk] = lines.map(analyzeRuleLine);
    for (const a of analyzedByBlock[bk]) {
      if (a.category === "data") {
        for (const t of a.transforms) {
          allDataTransforms.push({ blockKey: bk, t });
        }
      }
    }
  }

  // 3. Si au moins 1 transform data : scanner les datasets V1.9.5.
  const reportByBlock = new Map<BlockKey, BlockApplyReport>();
  for (const bk of BLOCK_KEYS) {
    const rules = analyzedByBlock[bk];
    reportByBlock.set(bk, {
      block_key: bk,
      block_label: BLOCK_LABELS[bk],
      rules_count: rules.length,
      ui_rules_count: rules.filter((r) => r.category === "ui").length,
      data_rules_count: rules.filter((r) => r.category === "data").length,
      ambiguous_rules_count: rules.filter((r) => r.category === "ambiguous").length,
      needs_review: rules
        .filter((r) => r.needs_review_reason)
        .map((r) => ({ line: r.raw_line, reason: r.needs_review_reason! })),
      data_modifications: {},
      modified_tickers: [],
    });
  }

  let totalScanned = 0;
  let totalMods = 0;

  if (allDataTransforms.length > 0) {
    // Liste des fichiers V1.9.5.
    let files: string[] = [];
    try {
      files = (await fs.readdir(V1_9_5_DIR)).filter((f) => f.endsWith(".json"));
    } catch (e) {
      console.warn(`[block-rules-apply] readdir ${V1_9_5_DIR} : ${(e as Error).message}`);
    }

    totalScanned = files.length;

    for (const file of files) {
      const fullPath = path.join(V1_9_5_DIR, file);
      let dataset: Dataset;
      try {
        const raw = await fs.readFile(fullPath, "utf-8");
        dataset = JSON.parse(raw) as Dataset;
      } catch {
        continue;
      }

      // Applique CHAQUE transform et compte les modifs par bloc.
      let datasetChanged = false;
      for (const { blockKey, t } of allDataTransforms) {
        const { changed, modifications } = applyTransformsToDataset(dataset, [t]);
        if (changed) {
          datasetChanged = true;
          totalMods += modifications;
          const rep = reportByBlock.get(blockKey)!;
          rep.data_modifications[t.kind] =
            (rep.data_modifications[t.kind] ?? 0) + modifications;
          if (!rep.modified_tickers.includes(dataset.ticker)) {
            rep.modified_tickers.push(dataset.ticker);
          }
        }
      }

      if (datasetChanged) {
        try {
          await fs.writeFile(fullPath, JSON.stringify(dataset, null, 2) + "\n", "utf-8");
        } catch (e) {
          console.warn(`[block-rules-apply] write ${file} : ${(e as Error).message}`);
        }
      }
    }
  }

  // 4. Met à jour last_applied_at + last_apply_report par bloc dans Supabase.
  const nowIso = new Date().toISOString();
  for (const bk of BLOCK_KEYS) {
    const rep = reportByBlock.get(bk)!;
    const { error: upErr } = await supabase
      .from("desk_block_rules")
      .update({
        last_applied_at: nowIso,
        last_apply_report: rep,
      })
      .eq("block_key", bk);
    if (upErr) {
      console.warn(`[block-rules-apply] update ${bk} : ${upErr.message}`);
    }
  }

  // 5. Met à jour le job.
  const finishedAt = new Date().toISOString();
  const jobReport: JobReport = {
    started_at: startedAt,
    finished_at: finishedAt,
    total_companies_scanned: totalScanned,
    total_modifications: totalMods,
    by_block: Array.from(reportByBlock.values()),
  };

  await supabase
    .from("desk_block_rules_jobs")
    .update({
      status: "done",
      finished_at: finishedAt,
      report: jobReport,
    })
    .eq("id", jobId);

  return jobReport;
}
