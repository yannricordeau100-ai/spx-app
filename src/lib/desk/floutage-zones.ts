/**
 * Zones de floutage nommees (Yann 29 aout 2026).
 *
 * Stockage : table generique desk_page_content, ligne (floutage, zones),
 * contenu = JSON des zones. Aucune nouvelle table, effet immediat en
 * production sans redeploiement : company-view lit /api/floutage-zones au
 * chargement d une page en acces gratuit.
 */
import { createClient } from "@supabase/supabase-js";
import type { Zone } from "@/lib/floutage";

const PAGE_KEY = "floutage";
const SECTION_KEY = "zones";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function chargeZonesFloutage(): Promise<Zone[]> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", PAGE_KEY)
      .eq("section_key", SECTION_KEY)
      .maybeSingle();
    const parsed = JSON.parse(data?.content_fr ?? "[]");
    return Array.isArray(parsed) ? (parsed as Zone[]) : [];
  } catch {
    return [];
  }
}

export async function enregistreZonesFloutage(zones: Zone[]): Promise<void> {
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      {
        page_key: PAGE_KEY,
        section_key: SECTION_KEY,
        content_fr: JSON.stringify(zones),
      },
      { onConflict: "page_key,section_key" },
    );
  if (error) throw new Error(error.message);
}
