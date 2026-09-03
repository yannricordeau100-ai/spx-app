import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const pairs = process.argv.slice(2).map((a) => { const i = a.indexOf("="); return { ticker: a.slice(0, i), hero_kpi_short: a.slice(i + 1) }; });
const { error } = await sb.from("desk_hero_kpi_overrides").upsert(pairs, { onConflict: "ticker" });
console.log(error ? "ERR " + error.message : "OK " + pairs.map((p) => p.ticker + "=" + p.hero_kpi_short).join(", "));
