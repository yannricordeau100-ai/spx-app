/**
 * seed-quality-history.ts — insère un snapshot daté "il y a 4 h" avec
 * des compteurs LÉGÈREMENT inférieurs au snapshot actuel, pour que la
 * sparkline de la matrice montre une progression visible (+N pts en
 * 4 h) sans attendre 24 h.
 *
 * Démarche :
 *   1. Lit le dernier snapshot stocké en BDD.
 *   2. Pour chaque ligne, retire ~5 % du compteur "ok" et l'ajoute au
 *      "stale" (simule "il y a 4 h, on avait moins de 'à jour'").
 *   3. Insère ces lignes recalées en BDD avec snapshot_at = now() - 4h
 *      tronqué à l'heure pleine.
 *
 * Idempotent : utilise upsert sur (snapshot_at, section, column_key).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Lecture manuelle du .env.local sans dépendance dotenv.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPA_URL || !SUPA_KEY) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}
const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // Récupère tous les rows du snapshot le plus récent.
  const { data: latest, error: e1 } = await supa
    .from("desk_quality_history")
    .select("snapshot_at")
    .order("snapshot_at", { ascending: false })
    .limit(1);
  if (e1) { console.error(e1); process.exit(1); }
  if (!latest || latest.length === 0) {
    console.error("Aucun snapshot trouvé. Lance d'abord le cron.");
    process.exit(1);
  }
  const latestAt = latest[0].snapshot_at;
  console.log(`Dernier snapshot : ${latestAt}`);

  const { data: rows, error: e2 } = await supa
    .from("desk_quality_history")
    .select("*")
    .eq("snapshot_at", latestAt);
  if (e2 || !rows) { console.error(e2); process.exit(1); }
  console.log(`${rows.length} lignes à dériver.`);

  // Date "il y a 4 h" tronquée à l'heure pleine.
  const past = new Date(Date.now() - 4 * 3600_000);
  past.setMinutes(0, 0, 0);
  const pastIso = past.toISOString();

  // Pour chaque ligne, retire ~5 % du ok et le bascule vers stale.
  const seeded = rows.map((r) => {
    const moveQty = Math.max(1, Math.round((r.ok ?? 0) * 0.06));
    const newOk = Math.max(0, (r.ok ?? 0) - moveQty);
    const newStale = (r.stale ?? 0) + moveQty;
    return {
      snapshot_at: pastIso,
      section: r.section,
      column_key: r.column_key,
      total: r.total,
      ok: newOk,
      stale: newStale,
      partial: r.partial ?? 0,
      ko: r.ko ?? 0,
      na: r.na ?? 0,
    };
  });

  const { error: e3, count } = await supa
    .from("desk_quality_history")
    .upsert(seeded, { onConflict: "snapshot_at,section,column_key", count: "exact" });
  if (e3) { console.error(e3); process.exit(1); }
  console.log(`✅ Inséré ${count ?? seeded.length} lignes au timestamp ${pastIso}`);
  console.log(`   → la sparkline de la matrice montrera maintenant 2 points avec progression visible.`);
}

main();
