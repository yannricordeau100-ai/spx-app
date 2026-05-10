/**
 * Debug : dump le contenu BDD pricing_plans + pricing_features +
 * pricing_plan_features pour vérifier que les codes de plans matchent
 * ce qu'attend loadPricingCatalog (decouverte / investisseur / pro_plus).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const { data: plans } = await supa.from("pricing_plans").select("id, code, name_fr, tier_order").order("tier_order");
  console.log("\n--- PLANS ---");
  console.log(plans);
  const { data: feats } = await supa.from("pricing_features").select("id, code, label_fr, category, category_order, feature_order, is_active").order("feature_order");
  console.log("\n--- FEATURES (count =", feats?.length, ") ---");
  console.log(feats);
  const { data: pf } = await supa.from("pricing_plan_features").select("*").limit(20);
  console.log("\n--- PLAN_FEATURES sample ---");
  console.log(pf);
})();
