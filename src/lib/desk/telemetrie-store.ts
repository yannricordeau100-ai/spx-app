/**
 * Interrupteur global de la télémétrie (Yann 31 août 2026).
 * Stocké en base comme les autres réglages (desk_page_content), effet
 * immédiat en production. Par défaut : ACTIF.
 */
import { createClient } from "@supabase/supabase-js";

const PAGE_KEY = "telemetrie";
const SECTION_KEY = "reglages";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function chargeReglageTelemetrie(): Promise<boolean> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", PAGE_KEY)
      .eq("section_key", SECTION_KEY)
      .maybeSingle();
    if (!data?.content_fr) return true;
    return JSON.parse(data.content_fr)?.actif !== false;
  } catch {
    return true;
  }
}

export async function enregistreReglageTelemetrie(actif: boolean): Promise<void> {
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      { page_key: PAGE_KEY, section_key: SECTION_KEY, content_fr: JSON.stringify({ actif }) },
      { onConflict: "page_key,section_key" },
    );
  if (error) throw new Error(error.message);
}
