/**
 * publish-online.ts — publie / retire des stés de la liste "online".
 *
 * Source de vérité = table Supabase `desk_curated_companies` (réutilise
 * l'existant : min_plan='free' = online/visible, 'hidden' = retiré).
 * La search lit cette liste via /api/online-tickers (runtime, pas de redeploy).
 *
 * Usage :
 *   publier : source .env.local && npx tsx scripts/publish-online.ts AAPL MSFT
 *   retirer : ... npx tsx scripts/publish-online.ts --hide AAPL
 *   lister  : ... npx tsx scripts/publish-online.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const hide = args.includes("--hide");
const tickers = args.filter((a) => !a.startsWith("--")).map((t) => t.toUpperCase());

(async () => {
  if (!url || !key) {
    console.error("ERREUR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes (source .env.local)");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (tickers.length) {
    const min_plan = hide ? "hidden" : "free";
    const rows = tickers.map((t) => ({ ticker: t, min_plan }));
    const { error } = await sb.from("desk_curated_companies").upsert(rows, { onConflict: "ticker" });
    if (error) {
      console.error("ERREUR upsert:", error.message);
      process.exit(1);
    }
    console.log((hide ? "RETIRÉ" : "PUBLIÉ") + " : " + tickers.join(","));
  }

  const { data, error } = await sb.from("desk_curated_companies").select("ticker, min_plan");
  if (error) {
    console.error("ERREUR read:", error.message);
    process.exit(1);
  }
  const online = (data ?? [])
    .filter((r: { min_plan?: string | null }) => r.min_plan && r.min_plan !== "hidden")
    .map((r: { ticker: string }) => r.ticker)
    .sort();
  console.log("ONLINE TOTAL (" + online.length + "): " + online.join(","));
})();
