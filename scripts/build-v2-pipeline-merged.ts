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

const json = sanitizeEmDashes(JSON.stringify(merged, null, 2));
const emDashCount = (JSON.stringify(merged).match(/—/g) || []).length;

writeFileSync(join(dir, "_merged.json"), json, "utf-8");
console.log(`✅ Merged ${Object.keys(merged).length} stés → ${join(dir, "_merged.json")}`);
console.log(`   Tickers: ${Object.keys(merged).sort().join(", ")}`);
if (emDashCount > 0) {
  console.log(`   Sanitized ${emDashCount} em-dashes from LLM output.`);
}
