/**
 * scripts/categorize-pricing-features.ts
 *
 * Yann (25 mai 2026) : analyse automatique des fonctionnalités pricing
 * en BDD et attribution d'une catégorie cohérente basée sur leur nom.
 *
 * Hypothèse Yann : les 17 premières (par `feature_order`) définissent le
 * CONTENU des pages société (hero, KPIs, risques, gouvernance, etc.) →
 * catégorie unique « Contenu page société ».
 *
 * Le script :
 *  1. Lit toutes les features triées par feature_order
 *  2. Affiche les 17 premières + catégorie actuelle
 *  3. UPDATE leur category vers "Contenu page société" (créée à la volée)
 *  4. Pour les features 18+, propose des catégories basées sur keyword
 *     matching mais n'applique RIEN sans validation manuelle (juste log).
 *
 * Lancement : npx tsx scripts/categorize-pricing-features.ts
 * Variable env : SUPABASE_SERVICE_ROLE_KEY (déjà dans .env.local)
 *
 * Idempotent : ré-exécutable sans risque (UPDATE par id).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Charge .env.local manuellement (sans dépendre de dotenv)
try {
  const envPath = resolve(__dirname, "..", ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
} catch {
  // Si .env.local absent, utiliser env existantes (Vercel runtime, etc.)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis dans .env.local");
  process.exit(1);
}

const CATEGORY_TARGET = "Contenu page société";
const TOP_N = 17;

type Feature = {
  id: string;
  code: string;
  label_fr: string;
  category: string | null;
  category_order: number | null;
  feature_order: number | null;
  is_active: boolean;
};

/** Heuristique keyword → catégorie suggérée (pour les features 18+). */
function suggestCategory(label: string, code: string): string {
  const t = `${label} ${code}`.toLowerCase();
  if (/abonn|favoris|alerte|notification|email/.test(t)) return "Suivi & alertes";
  if (/compar|side.?by.?side|matrix/.test(t)) return "Comparaison sés";
  if (/export|pdf|csv|api|téléchargement/.test(t)) return "Export & API";
  if (/support|prioritair|chat|aide/.test(t)) return "Support";
  if (/historique|10.?ans|20.?ans|profondeur/.test(t)) return "Profondeur historique";
  return "Autres";
}

async function main() {
  const supa = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("📥 Lecture features depuis Supabase…");
  const { data: features, error } = await supa
    .from("pricing_features")
    .select("id, code, label_fr, category, category_order, feature_order, is_active")
    .order("feature_order", { ascending: true });

  if (error) {
    console.error("❌ Erreur lecture :", error.message);
    process.exit(1);
  }
  if (!features || features.length === 0) {
    console.log("ℹ️  Aucune feature en BDD.");
    return;
  }

  console.log(`\n✅ ${features.length} features lues.\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`TOP ${TOP_N} → cible "${CATEGORY_TARGET}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const topN = (features as Feature[]).slice(0, TOP_N);
  for (let i = 0; i < topN.length; i++) {
    const f = topN[i];
    const flag = f.category === CATEGORY_TARGET ? "✓" : "→";
    console.log(`${String(i + 1).padStart(2, " ")}. [${flag}] ${f.label_fr.padEnd(50, " ")} (cat actuelle : ${f.category || "—"})`);
  }

  const toUpdate = topN.filter((f) => f.category !== CATEGORY_TARGET);
  if (toUpdate.length === 0) {
    console.log(`\nℹ️  Les ${TOP_N} premières features ont déjà la catégorie cible. Rien à faire.`);
  } else {
    console.log(`\n📤 UPDATE ${toUpdate.length} features → "${CATEGORY_TARGET}" (category_order=1)…`);
    for (const f of toUpdate) {
      const { error: upErr } = await supa
        .from("pricing_features")
        .update({ category: CATEGORY_TARGET, category_order: 1 })
        .eq("id", f.id);
      if (upErr) {
        console.error(`   ❌ ${f.label_fr} : ${upErr.message}`);
      } else {
        console.log(`   ✓ ${f.label_fr}`);
      }
    }
  }

  // Features 18+ : suggestions de catégorie, pas d'UPDATE auto
  const rest = (features as Feature[]).slice(TOP_N);
  if (rest.length > 0) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Features ${TOP_N + 1}+ → suggestions de catégorie (NON appliquées)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    for (let i = 0; i < rest.length; i++) {
      const f = rest[i];
      const suggested = suggestCategory(f.label_fr, f.code);
      console.log(`${String(TOP_N + i + 1).padStart(2, " ")}. ${f.label_fr.padEnd(50, " ")} | actuelle: ${(f.category || "—").padEnd(20, " ")} | suggérée: ${suggested}`);
    }
    console.log(`\nℹ️  Pour appliquer les suggestions, ré-exécute avec --apply-suggestions (à implémenter si besoin).`);
  }

  console.log(`\n✅ Fini.`);
}

main().catch((e) => {
  console.error("❌ Crash:", e);
  process.exit(1);
});
