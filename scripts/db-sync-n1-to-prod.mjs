#!/usr/bin/env node
// =============================================================================
// db-sync-n1-to-prod.mjs · PROMOTION données niveau 1 → prod
// =============================================================================
// Yann 18 mai 2026, bascule niveau 1.
//
// !!! COMMANDE À NE LANCER QUE SUR VALIDATION EXPLICITE YANN !!!
//
// Une fois Yann a validé un changement sur niveau 1 (ex : nouveaux prix
// pricing_plans, nouvelles features, nouvelles taglines), ce script copie
// les tables pricing_* + desk_page_content + autres "data publique" depuis
// Supabase niveau 1 vers Supabase prod.
//
// PROTECTION :
//   - Tables ciblées explicitement (liste TABLES_BY_DEFAULT) — pas de sync
//     de toutes les tables. Sinon = risque de pousser des comptes auth, des
//     contact_messages, des billing_history (sensibles).
//   - Argument --tables obligatoire à partir d'une certaine sensibilité
//   - Demande confirmation interactive (sauf --yes pour CI futur).
//
// Usage :
//   node scripts/db-sync-n1-to-prod.mjs --tables pricing_plans,pricing_prices,pricing_features,pricing_plan_features --yes
//
// SOURCE niveau 1 (hardcoded) : idpsbtgvuyfwtvzelogw.supabase.co
// TARGET prod : lue dans .env.local (NEXT_PUBLIC_SUPABASE_URL + SERVICE_ROLE_KEY)
// =============================================================================

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const tablesIdx = args.indexOf("--tables");
const tablesArg = tablesIdx >= 0 ? args[tablesIdx + 1].split(",") : null;
const skipPrompt = args.includes("--yes");

// Tables autorisées à la sync n1 → prod (explicit allowlist)
const ALLOWED_TABLES = new Set([
  "pricing_plans",
  "pricing_prices",
  "pricing_features",
  "pricing_plan_features",
  "pricing_promos",
  "desk_page_content", // copy / taglines pages publiques
  "desk_pricing_taglines",
]);

// Tables explicitement BLOQUÉES (jamais auto-sync vers prod)
const FORBIDDEN_TABLES = new Set([
  "auth.users",
  "desk_todos",
  "desk_notes",
  "desk_bookmarks",
  "desk_calendar",
  "desk_ideas",
  "desk_links",
  "desk_drafts",
  "desk_pitch_notes",
  "desk_inspiration",
  "desk_bugs",
  "desk_kpi_requests",
  "desk_image_findings",
  "desk_image_findings_requests",
  "desk_special_kpis",
  "desk_quality_history",
  "billing_history",
  "billing_events",
  "subscriptions",
  "contact_messages",
  "desk_email_sequences",
  "analytics_events",
]);

if (!tablesArg) {
  console.error("X --tables <comma-sep> requis. Tables autorisées :");
  console.error("  " + Array.from(ALLOWED_TABLES).join(", "));
  process.exit(1);
}

for (const t of tablesArg) {
  if (FORBIDDEN_TABLES.has(t)) {
    console.error(`X Table "${t}" interdite à la sync n1 → prod (sensible).`);
    process.exit(1);
  }
  if (!ALLOWED_TABLES.has(t)) {
    console.error(`X Table "${t}" pas dans l'allowlist. Allowed: ${Array.from(ALLOWED_TABLES).join(", ")}`);
    process.exit(1);
  }
}

// --- Charge .env.local (= prod) -----------------------------------------
const envPath = join(ROOT, ".env.local");
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

const N1_URL = "https://idpsbtgvuyfwtvzelogw.supabase.co";
const N1_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkcHNidGd2dXlmd3R2emVsb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTEwNTE0NywiZXhwIjoyMDk0NjgxMTQ3fQ.Dkb7QOdhx4IpIt6qTr9R-DCm3ZSPWav_pz9QGKh3ro0";

console.log(`\n!!! SYNC NIVEAU 1 → PROD !!!`);
console.log(`> SOURCE niveau1 : ${N1_URL}`);
console.log(`> TARGET prod    : ${PROD_URL}`);
console.log(`> Tables         : ${tablesArg.join(", ")}\n`);

if (!skipPrompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question("Confirmer la promotion ? (tape OUI majuscules pour confirmer) > ");
  rl.close();
  if (ans.trim() !== "OUI") {
    console.log("Annulé.");
    process.exit(0);
  }
}

async function pullAll(table) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const r = await fetch(`${N1_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: N1_KEY,
        Authorization: `Bearer ${N1_KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
      },
    });
    if (!r.ok) {
      if (r.status === 404) return null;
      throw new Error(`pull ${table} HTTP ${r.status}`);
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
    const r = await fetch(`${PROD_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: PROD_KEY,
        Authorization: `Bearer ${PROD_KEY}`,
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
for (const table of tablesArg) {
  try {
    const rows = await pullAll(table);
    if (rows === null) {
      console.log(`  ${table.padEnd(30)} (absente n1, skip)`);
      continue;
    }
    if (rows.length === 0) {
      console.log(`  ${table.padEnd(30)} (0 rows n1, skip)`);
      continue;
    }
    const n = await pushAll(table, rows);
    console.log(`  ${table.padEnd(30)} ${String(n).padStart(5)} rows promus en prod`);
    totalRows += n;
  } catch (err) {
    console.error(`  ${table.padEnd(30)} X ${err.message}`);
  }
}

console.log(`\nDone. ${totalRows} rows totaux promus n1 → prod.`);
