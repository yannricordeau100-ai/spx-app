#!/usr/bin/env node
// =============================================================================
// db-export.mjs · Backup local des tables desk_* + subscriptions
// =============================================================================
// Aligne avec la règle 7 (PERSISTANCE ABSOLUE) de SHARED-STATUS.md / CLAUDE.md.
// But : si demain Supabase tombe, on restore tout depuis ces JSON.
//
// Usage :
//   node scripts/db-export.mjs                   # dump dans backups/<date>/
//   node scripts/db-export.mjs --out /chemin     # dump custom
//
// Lit SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY depuis .env.local.
// Service role bypass RLS donc dump TOUTES les rows (pas que owner_email actuel).
//
// Restore : voir RECOVERY-KIT.md, section "Restore Supabase depuis backup".
// =============================================================================

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- Charge .env.local ---------------------------------------------------
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("X NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.");
  process.exit(1);
}

// --- Tables à dump (sync avec supabase/migrations/20251127_desk_and_billing.sql)
const TABLES = [
  "desk_notes",
  "desk_todos",
  "desk_bookmarks",
  "desk_calendar",
  "desk_ideas",
  "desk_links",
  "desk_drafts",
  "desk_pitch_notes",
  "desk_inspiration",
  "desk_pipeline",
  "subscriptions",
  "billing_events",
];

// --- Output dir ----------------------------------------------------------
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const dateStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = outIdx >= 0
  ? resolve(args[outIdx + 1])
  : join(ROOT, "backups", dateStamp);

mkdirSync(outDir, { recursive: true });
console.log(`> Dump destination : ${outDir}\n`);

// --- Fetch each table via PostgREST -------------------------------------
let totalRows = 0;
const summary = [];

for (const table of TABLES) {
  process.stdout.write(`  ${table.padEnd(22)} `);
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    const r = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Accept": "application/json",
        "Prefer": "count=exact",
      },
    });
    if (!r.ok) {
      const txt = await r.text();
      console.log(`X ${r.status} ${txt.slice(0, 60)}`);
      summary.push({ table, ok: false, error: `${r.status} ${txt.slice(0, 80)}` });
      continue;
    }
    const rows = await r.json();
    const file = join(outDir, `${table}.json`);
    writeFileSync(file, JSON.stringify(rows, null, 2));
    totalRows += rows.length;
    console.log(`OK ${String(rows.length).padStart(5)} rows -> ${table}.json`);
    summary.push({ table, ok: true, rows: rows.length });
  } catch (e) {
    console.log(`X ${e.message}`);
    summary.push({ table, ok: false, error: e.message });
  }
}

// --- Manifest ------------------------------------------------------------
const manifest = {
  exported_at: new Date().toISOString(),
  supabase_url: SUPABASE_URL,
  total_rows: totalRows,
  tables: summary,
};
writeFileSync(join(outDir, "_manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`\n> Total : ${totalRows} rows dans ${TABLES.length} tables.`);
console.log(`> Manifest : ${join(outDir, "_manifest.json")}`);
console.log(`> Pour restore : voir RECOVERY-KIT.md`);
