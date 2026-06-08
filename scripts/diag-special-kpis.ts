import { createClient } from "@supabase/supabase-js";
import fs from "fs";
(async () => {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const t = (process.argv[2] || "LLY").toUpperCase();
  for (const tbl of ["special_kpis", "hero_kpi_overrides", "kpi_requests"]) {
    try {
      const { data, error } = await sb.from(tbl).select("*").ilike("ticker", t);
      console.log(`[${tbl}]`, error ? "ERR " + error.message : data?.length ? JSON.stringify(data).slice(0, 800) : "(vide)");
    } catch (e) {
      console.log(`[${tbl}] EXC`, String(e).slice(0, 80));
    }
  }
  const ep = `src/data/v2-pipeline-enrich/${t.toLowerCase()}.json`;
  if (fs.existsSync(ep)) {
    const e = JSON.parse(fs.readFileSync(ep, "utf-8"));
    const ek = (e.kpis || []).filter((k: any) => /drug/i.test(String(k.short)));
    console.log("[enrich kpis 'drug']", JSON.stringify(ek).slice(0, 500) || "(aucun)");
    console.log("[enrich keys]", Object.keys(e).join(","));
  } else console.log("[enrich] pas de fichier");
})();
