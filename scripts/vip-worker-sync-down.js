#!/usr/bin/env node
/**
 * vip-worker-sync-down.js — Synchronise Supabase BDD → JSON local
 * AVANT que vip-deep-inspection.py s'exécute.
 *
 * Lit vip_inspection_list + vip_inspection_status depuis Supabase,
 * écrit src/data/vip-list.json + src/data/vip-inspection-status.json.
 *
 * Le script Python lit ces JSONs pour identifier les tickers state=running
 * et exécuter l'inspection.
 *
 * Yann 17 mai 2026.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");
const LIST_JSON = path.join(ROOT, "src/data/vip-list.json");
const STATUS_JSON = path.join(ROOT, "src/data/vip-inspection-status.json");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(1);
  }
  const supa = createClient(url, key);

  const { data: listRows, error: e1 } = await supa
    .from("vip_inspection_list")
    .select("ticker, note, added_at, scheduled_at")
    .order("added_at", { ascending: true });
  if (e1) { console.error("list err:", e1); process.exit(1); }

  const { data: statusRows, error: e2 } = await supa
    .from("vip_inspection_status")
    .select("*");
  if (e2) { console.error("status err:", e2); process.exit(1); }

  const list = {
    _doc: "Liste VIP synchronisée depuis Supabase par vip-worker-sync-down.js",
    updated_at: new Date().toISOString(),
    tickers: (listRows || []).map((r) => ({
      ticker: r.ticker,
      added_at: r.added_at,
      note: r.note || undefined,
      scheduled_at: r.scheduled_at || undefined,
    })),
  };

  const results = {};
  for (const s of statusRows || []) {
    results[s.ticker] = {
      ticker: s.ticker,
      state: s.state,
      last_run_at: s.last_run_at || undefined,
      defects: s.defects || [],
      mode_screenshots: s.mode_screenshots || {},
      error: s.error || undefined,
    };
  }
  const status = {
    _doc: "État VIP synchronisé depuis Supabase par vip-worker-sync-down.js",
    updated_at: new Date().toISOString(),
    results,
  };

  fs.writeFileSync(LIST_JSON, JSON.stringify(list, null, 2) + "\n");
  fs.writeFileSync(STATUS_JSON, JSON.stringify(status, null, 2) + "\n");

  const runningTickers = Object.values(results).filter((s) => s.state === "running").map((s) => s.ticker);
  console.log(`✅ Sync down : ${list.tickers.length} tickers · ${Object.keys(results).length} status`);
  console.log(`   running: ${runningTickers.length} → [${runningTickers.join(", ")}]`);
}

main().catch((err) => { console.error(err); process.exit(1); });
