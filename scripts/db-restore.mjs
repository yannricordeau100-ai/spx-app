#!/usr/bin/env node
// =============================================================================
// db-restore.mjs · Restore des tables desk_* + subscriptions depuis un backup
// =============================================================================
// Usage :
//   node scripts/db-restore.mjs backups/2026-05-01T02-27-13     # depuis un dump
//   node scripts/db-restore.mjs backups/<date> --table desk_todos   # 1 table
//
// Pré-requis :
//   1. Tables existantes (lance la migration SQL d'abord, voir RECOVERY-KIT.md)
//   2. .env.local avec SUPABASE_SERVICE_ROLE_KEY (bypass RLS)
//
// Comportement :
//   - INSERT en mode upsert (on conflict id, update). Ne supprime jamais de rows
//     existantes. Si row déjà présente avec même id → update.
//   - Ordre table par table, batches de 500 rows max (PostgREST limit).
// =============================================================================

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage : node scripts/db-restore.mjs <backup-dir> [--table <name>]");
  process.exit(1);
}

const backupDir = resolve(args[0]);
if (!existsSync(backupDir)) {
  console.error("X Dossier backup introuvable :", backupDir);
  process.exit(1);
}

const tableIdx = args.indexOf("--table");
const onlyTable = tableIdx >= 0 ? args[tableIdx + 1] : null;

// --- Charge .env.local ---------------------------------------------------
const ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const envPath = join(ROOT, ".env.local");
const env = readFileSync(envPath, "utf-8")
  .split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .reduce((acc, l) => {
    const [k, ...rest] = l.split("=");
    acc[k.trim()] = rest.join("=").trim();
    return acc;
  }, {});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("X SUPABASE_URL ou SERVICE_ROLE_KEY manquant.");
  process.exit(1);
}

// --- List backup files ---------------------------------------------------
let files = readdirSync(backupDir).filter((f) => f.endsWith(".json") && f !== "_manifest.json");
if (onlyTable) files = files.filter((f) => f === `${onlyTable}.json`);

if (files.length === 0) {
  console.error("X Aucun fichier .json à restaurer dans", backupDir);
  process.exit(1);
}

console.log(`> Restore depuis : ${backupDir}`);
console.log(`> Tables : ${files.length}\n`);

let totalInserted = 0;

for (const file of files) {
  const table = basename(file, ".json");
  const rows = JSON.parse(readFileSync(join(backupDir, file), "utf-8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  ${table.padEnd(22)} (vide, skip)`);
    continue;
  }

  process.stdout.write(`  ${table.padEnd(22)} `);
  let inserted = 0;
  // PostgREST batches : 500 rows max par requête recommandé.
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(slice),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.log(`X batch ${i} : ${r.status} ${txt.slice(0, 80)}`);
      break;
    }
    inserted += slice.length;
  }
  totalInserted += inserted;
  console.log(`OK ${inserted}/${rows.length} rows`);
}

console.log(`\n> Total : ${totalInserted} rows restaurées.`);
console.log(`> Vérifie via Supabase Dashboard -> Database -> Tables.`);
