#!/usr/bin/env node
/**
 * Sync down : fetch les demandes image-findings status='claude_pending'
 * depuis Supabase vers JSON local pour le worker GitHub Action.
 *
 * Yann 18 mai 2026.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

(async () => {
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supa
    .from("desk_image_findings_requests")
    .select("id, display_number, title, query, target_tickers, languages, status")
    .eq("status", "claude_pending")
    .order("display_number", { ascending: true });

  if (error) {
    console.error("Erreur fetch demandes:", error.message);
    process.exit(1);
  }

  const out = {
    updated_at: new Date().toISOString(),
    requests: data ?? [],
  };
  const outPath = path.join(__dirname, "..", "src", "data", "image-findings-pending.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Sync down: ${out.requests.length} demande(s) claude_pending → ${outPath}`);
})();
