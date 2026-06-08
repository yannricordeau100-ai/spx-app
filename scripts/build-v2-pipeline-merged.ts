/**
 * Build src/data/v2-pipeline/*.json → src/data/v2-pipeline/_merged.json
 *
 * Importable depuis v2-data.ts. Régénéré après chaque pipeline run.
 * Run : npx tsx scripts/build-v2-pipeline-merged.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const projectRoot = resolve(__dirname, "..");
const dir = join(projectRoot, "src/data/v2-pipeline");
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));

type AnyDataset = Record<string, unknown> & { ticker?: string };

const merged: Record<string, AnyDataset> = {};
for (const f of files) {
  try {
    const raw = readFileSync(join(dir, f), "utf-8");
    const data = JSON.parse(raw) as AnyDataset;
    if (!data.ticker) continue;
    // Normalisation : ajout des champs manquants pour compat type Company
    const t = String(data.ticker).toUpperCase();
    const normalized: AnyDataset = {
      logo_treatment: "orbit",
      // Default values for missing fields
      ranks: { global_world: "-", global_us: "-", sector: "-", subsector: "-" },
      tagline: data.tagline ?? "",
      ...data,
      ticker: t,
    };
    // Merge stories_kpis into kpis with is_short_history flag
    if (Array.isArray(normalized.stories_kpis)) {
      const stories = (normalized.stories_kpis as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        is_short_history: true,
      }));
      const kpis = [
        ...((normalized.kpis as Array<Record<string, unknown>>) || []),
        ...stories,
      ];
      normalized.kpis = kpis;
      delete normalized.stories_kpis;
    }
    // Truncate trailing nulls in history → évite les graphiques qui finissent à 0
    if (Array.isArray(normalized.kpis)) {
      normalized.kpis = (normalized.kpis as Array<Record<string, unknown>>).map((k) => {
        const h = k.history;
        if (Array.isArray(h)) {
          // Remove trailing null/undefined/non-numeric
          const cleaned = [...h];
          while (
            cleaned.length > 0 &&
            (cleaned[cleaned.length - 1] === null ||
              cleaned[cleaned.length - 1] === undefined ||
              typeof cleaned[cleaned.length - 1] !== "number" ||
              !Number.isFinite(cleaned[cleaned.length - 1] as number))
          ) {
            cleaned.pop();
          }
          // Also remove leading nulls (if any)
          while (
            cleaned.length > 0 &&
            (cleaned[0] === null ||
              cleaned[0] === undefined ||
              typeof cleaned[0] !== "number")
          ) {
            cleaned.shift();
          }
          k.history = cleaned;
        }
        return k;
      });
    }
    merged[t] = normalized;
  } catch (e) {
    console.warn(`[skip] ${f}: ${(e as Error).message}`);
  }
}

// Sanitize em-dashes (Yann rule : pas d'em-dash en user-facing).
// Pipeline LLM peut en produire dans les signals/descriptions.
function sanitizeEmDashes(s: string): string {
  return s
    .replace(/ — /g, " : ")
    .replace(/ —([^ ])/g, " : $1")
    .replace(/([^ ])— /g, "$1: ")
    .replace(/—/g, "-");
}

// Yann 8 juin 2026 : strip des cles internes (_validation, _fix_log, _sa*, etc)
// + minification. Sinon _merged.json gonfle a 46MB et la fonction serverless
// depasse 250MB (limite Vercel) car _merged est importe statiquement partout.
// Yann 8 juin 2026 : strip RECURSIF de TOUTE cle interne commencant par "_"
// (a n'importe quelle profondeur : company, kpis[], nested objects). Le schema
// public n'utilise aucune cle prefixee "_" : ce sont toutes des cles de
// provenance/QA/audit (_validation, _fix_log, _hero_reextracted_10k,
// _reextract_failed, _data_suspect, _sa*, _xbrl_tag, _contamination_cleared,
// etc). L'app ignore deja les cles inconnues, donc ce strip n'affecte que la
// taille + evite d'exposer des strings internes dans _merged.json.
function stripInternal(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) stripInternal(item);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key.startsWith("_")) delete obj[key];
      else stripInternal(obj[key]);
    }
  }
}
for (const t of Object.keys(merged)) {
  stripInternal(merged[t]);
}

const json = sanitizeEmDashes(JSON.stringify(merged));
const emDashCount = (JSON.stringify(merged).match(/—/g) || []).length;

writeFileSync(join(dir, "_merged.json"), json, "utf-8");
console.log(`✅ Merged ${Object.keys(merged).length} stés → ${join(dir, "_merged.json")}`);
console.log(`   Tickers: ${Object.keys(merged).sort().join(", ")}`);
if (emDashCount > 0) {
  console.log(`   Sanitized ${emDashCount} em-dashes from LLM output.`);
}
