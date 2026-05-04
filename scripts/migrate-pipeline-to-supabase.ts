/**
 * migrate-pipeline-to-supabase.ts
 *
 * Migre les fichiers JSON de `src/data/v2-pipeline/` vers la table Supabase
 * `companies_v2`. À lancer manuellement quand on bascule la 2.0 (fichiers →
 * DB). Idempotent : peut être relancé, fait un UPSERT.
 *
 * Pré-requis :
 *   - Migration `20260504_companies_v2_table.sql` appliquée en Supabase.
 *   - Variables d'env : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage :
 *   npx tsx scripts/migrate-pipeline-to-supabase.ts [--dry-run]
 *
 * Stratégie :
 *   1. Lit `_merged.json` (1606 stés actuellement, cible 6000 en 2.0).
 *   2. Pour chaque sté : derive validation_pass + display_ready + hero_kpi
 *      + kpis_count à partir des champs présents.
 *   3. UPSERT en batch de 100 lignes (Supabase recommande pas plus de 1000
 *      lignes par batch pour pas timeout).
 *   4. Les stés sans `name` ou sans `kpis` sont skipped.
 *
 * Ordre d'exécution recommandé :
 *   1. Backup Supabase (`npx tsx scripts/db-export.mjs`)
 *   2. Apply migration SQL (Supabase Dashboard → SQL Editor)
 *   3. npx tsx scripts/migrate-pipeline-to-supabase.ts --dry-run
 *   4. npx tsx scripts/migrate-pipeline-to-supabase.ts (pour de vrai)
 *   5. Vérifier count en DB : SELECT COUNT(*) FROM companies_v2;
 *   6. Bascule des routes app : remplacer fs.readFile / import JSON par fetch
 *      Supabase via createServerClient() dans /sandbox/v1-6 et /sandbox/v1-7.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const MERGED_PATH = path.join(ROOT, "src/data/v2-pipeline/_merged.json");
const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes("--dry-run");

type AnyRecord = Record<string, unknown>;

function inferValidationPass(entry: AnyRecord): 1 | 2 | 3 {
  if (entry._validation || entry._validation_global) return 3;
  const hasRisks = Array.isArray(entry.risks) && (entry.risks as unknown[]).length > 0;
  const hasGov = !!entry.governance;
  const hasAI = !!entry.ai_positioning;
  if (hasRisks || hasGov || hasAI) return 2;
  return 1;
}

function isDisplayReady(entry: AnyRecord, pass: number): boolean {
  if (pass < 3) return false;
  if (typeof entry.name !== "string" || !entry.name.trim()) return false;
  if (!Array.isArray(entry.kpis) || (entry.kpis as unknown[]).length === 0) return false;
  return true;
}

function inferCountry(entry: AnyRecord): string | null {
  // Pas de champ explicite dans les datasets actuels. Heuristique sur le ticker :
  // tickers avec point (ex : AI.PA) = FR, ".AS" = NL, ".DE" = DE, etc.
  // Sinon US par défaut. À raffiner par CONV-DATA en 2.0.
  const ticker = (entry.ticker as string) ?? "";
  if (ticker.endsWith(".PA")) return "FR";
  if (ticker.endsWith(".AS")) return "NL";
  if (ticker.endsWith(".DE")) return "DE";
  if (ticker.endsWith(".CO")) return "DK";
  if (ticker.endsWith(".ST")) return "SE";
  if (ticker.endsWith(".MI")) return "IT";
  return "US";
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[migrate] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const raw = readFileSync(MERGED_PATH, "utf-8");
  const merged = JSON.parse(raw) as Record<string, AnyRecord>;

  const rows: Array<Record<string, unknown>> = [];
  let skipped = 0;
  for (const [ticker, entry] of Object.entries(merged)) {
    if (!entry || typeof entry !== "object") {
      skipped++;
      continue;
    }
    if (typeof entry.name !== "string" || !entry.name.trim()) {
      skipped++;
      continue;
    }
    const pass = inferValidationPass(entry);
    rows.push({
      ticker,
      name: entry.name,
      sector: (entry.sector as string) ?? null,
      subsector: (entry.subsector as string) ?? null,
      country: inferCountry(entry),
      currency: (entry.currency as string) ?? null,
      validation_pass: pass,
      display_ready: isDisplayReady(entry, pass),
      kpis_count: Array.isArray(entry.kpis) ? (entry.kpis as unknown[]).length : 0,
      hero_kpi: (entry.hero_kpi as string) ?? null,
      last_pipeline_update: new Date().toISOString(),
      last_filing_date: null,
      data: entry,
    });
  }

  console.log(`[migrate] ready : ${rows.length} stés à upsert · skipped : ${skipped}`);
  if (DRY_RUN) {
    console.log("[migrate] DRY RUN, exiting before upsert");
    process.exit(0);
  }

  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("companies_v2")
      .upsert(batch, { onConflict: "ticker" });
    if (error) {
      console.error(`[migrate] batch ${i}-${i + batch.length} failed:`, error.message);
      process.exit(1);
    }
    total += batch.length;
    process.stdout.write(`\r[migrate] upserted ${total}/${rows.length}`);
  }
  process.stdout.write("\n");
  console.log("[migrate] ✅ done");
}

main().catch((e) => {
  console.error("[migrate] fatal:", e);
  process.exit(1);
});
