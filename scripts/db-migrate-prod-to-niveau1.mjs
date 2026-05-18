#!/usr/bin/env node
// =============================================================================
// db-migrate-prod-to-niveau1.mjs · Transfert données prod → niveau 1
// =============================================================================
// Yann 18 mai 2026, bascule niveau 1.
//
// Lit toutes les tables `desk_*` + pricing_* + referrals_settings depuis le
// projet Supabase prod (lu dans .env.local) et les insère (upsert) dans le
// projet Supabase niveau 1 (idpsbtgvuyfwtvzelogw).
//
// Skip volontairement :
//   - contact_messages (privé)
//   - billing_history, billing_events, subscriptions (sensible + FK user_id)
//   - desk_email_sequences (éviter re-envoi)
//   - analytics_events (volume + pas utile)
//
// Lecture : owner_email étant TEXT, le mapping est immédiat tant que Yann a
// créé yannricordeau100@gmail.com sur niveau 1 (fait via signup).
//
// Usage :
//   node scripts/db-migrate-prod-to-niveau1.mjs
//   node scripts/db-migrate-prod-to-niveau1.mjs --tables desk_todos,desk_notes
//
// Idempotent : Prefer resolution=merge-duplicates (upsert).
// =============================================================================

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- Args ----------------------------------------------------------------
const args = process.argv.slice(2);
const tablesIdx = args.indexOf("--tables");
const onlyTables = tablesIdx >= 0 ? args[tablesIdx + 1].split(",") : null;

// --- Charge .env.local (= prod) -----------------------------------------
const envPath = join(ROOT, ".env.local");
if (!existsSync(envPath)) {
  console.error("X .env.local introuvable :", envPath);
  process.exit(1);
}
const env = readFileSync(envPath, "utf-8")
  .split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .reduce((acc, l) => {
    const [k, ...rest] = l.split("=");
    acc[k.trim()] = rest.join("=").trim();
    return acc;
  }, {});

const PROD_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PROD_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// Niveau 1 (hardcoded — c'est unique)
const N1_URL = "https://idpsbtgvuyfwtvzelogw.supabase.co";
const N1_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkcHNidGd2dXlmd3R2emVsb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTEwNTE0NywiZXhwIjoyMDk0NjgxMTQ3fQ.Dkb7QOdhx4IpIt6qTr9R-DCm3ZSPWav_pz9QGKh3ro0";

if (!PROD_URL || !PROD_KEY) {
  console.error("X PROD SUPABASE_URL/SERVICE_KEY manquant dans .env.local");
  process.exit(1);
}

console.log(`> SOURCE prod    : ${PROD_URL}`);
console.log(`> TARGET niveau1 : ${N1_URL}\n`);

const TABLES = [
  // Desk core (owner_email TEXT, pas de FK user_id → mapping direct)
  "desk_todos",
  "desk_notes",
  "desk_bookmarks",
  "desk_calendar",
  "desk_ideas",
  "desk_links",
  "desk_drafts",
  "desk_pitch_notes",
  "desk_inspiration",
  "desk_pipeline", // partagée, pas owner_email
  // Desk feature tables
  "desk_bugs",
  "desk_kpi_requests",
  "desk_image_findings_requests",
  "desk_image_findings",
  "desk_page_content",
  "desk_ir_sources",
  "desk_data_quality_matrix",
  "desk_quality_history",
  "desk_special_kpis",
  // Pricing (référentiel)
  "pricing_plans",
  "pricing_prices",
  "pricing_features",
  "pricing_plan_features",
  "pricing_promos",
  // Referrals settings (config, pas les claims qui sont user-spécifiques)
  "referrals_settings",
  // Companies legacy
  "companies_v2",
];

const tablesToProcess = onlyTables ?? TABLES;

async function pullAll(table) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const r = await fetch(`${PROD_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: PROD_KEY,
        Authorization: `Bearer ${PROD_KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
        "Accept-Profile": "public",
      },
    });
    if (!r.ok) {
      const txt = await r.text();
      // 404 = table doesn't exist on prod → silently skip
      if (r.status === 404 || txt.includes("does not exist")) return null;
      throw new Error(`pull ${table} HTTP ${r.status} : ${txt.slice(0, 200)}`);
    }
    const rows = await r.json();
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function pushAll(table, rows) {
  if (rows.length === 0) return 0;
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const r = await fetch(`${N1_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: N1_KEY,
        Authorization: `Bearer ${N1_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(slice),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`push ${table} batch ${i} HTTP ${r.status} : ${txt.slice(0, 200)}`);
    }
    inserted += slice.length;
  }
  return inserted;
}

let totalRows = 0;
let skippedTables = [];

for (const table of tablesToProcess) {
  try {
    const rows = await pullAll(table);
    if (rows === null) {
      console.log(`  ${table.padEnd(30)} (table absente prod, skip)`);
      skippedTables.push(table);
      continue;
    }
    if (rows.length === 0) {
      console.log(`  ${table.padEnd(30)} (0 rows, skip)`);
      continue;
    }
    const n = await pushAll(table, rows);
    console.log(`  ${table.padEnd(30)} ${String(n).padStart(5)} rows transférés`);
    totalRows += n;
  } catch (err) {
    console.log(`  ${table.padEnd(30)} X ${err.message}`);
  }
}

console.log(`\nDone. ${totalRows} rows totaux transférés.`);
if (skippedTables.length > 0) {
  console.log(`Tables absentes prod : ${skippedTables.join(", ")}`);
}
