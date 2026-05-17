#!/usr/bin/env node
/**
 * vip-worker-sync-up.js — Synchronise JSON local → Supabase BDD
 * APRÈS que vip-deep-inspection.py a fini.
 *
 * Lit src/data/vip-inspection-status.json et push chaque résultat vers
 * vip_inspection_status (upsert).
 *
 * Yann 17 mai 2026.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");
const STATUS_JSON = path.join(ROOT, "src/data/vip-inspection-status.json");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(1);
  }
  if (!fs.existsSync(STATUS_JSON)) {
    console.error(`ERR: ${STATUS_JSON} not found`);
    process.exit(1);
  }
  const local = JSON.parse(fs.readFileSync(STATUS_JSON, "utf-8"));
  const supa = createClient(url, key);

  let upserted = 0;
  for (const [ticker, st] of Object.entries(local.results || {})) {
    const { error } = await supa.from("vip_inspection_status").upsert(
      {
        ticker,
        state: st.state,
        last_run_at: st.last_run_at || null,
        defects: st.defects || [],
        mode_screenshots: st.mode_screenshots || {},
        error: st.error || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ticker" },
    );
    if (error) console.error(`  ❌ ${ticker}: ${error.message}`);
    else {
      const d = st.defects || [];
      console.log(`  ✅ ${ticker} · state=${st.state} · defects=${d.length} · corrected=${d.filter((x) => x.corrected).length} · reverified=${d.filter((x) => x.reverified).length}`);
      upserted++;
    }
  }
  console.log(`\nTotal upserted: ${upserted}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
