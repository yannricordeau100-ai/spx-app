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

export type ConfigTelemetrie = {
  actif: boolean;
  /** ip_hash a ignorer a l ingestion (ordinateurs de Yann). */
  hashesExclus: string[];
  /** user_id Supabase a ignorer (compte Yann + compte de test audit.claude). */
  usersExclus: string[];
};

/** Lecture unique : interrupteur + listes d exclusion (Yann 2 sept 2026 :
 *  ses propres visites ne doivent jamais compter dans la telemetrie). */
export async function chargeConfigTelemetrie(): Promise<ConfigTelemetrie> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", PAGE_KEY)
      .eq("section_key", SECTION_KEY)
      .maybeSingle();
    if (!data?.content_fr) return { actif: true, hashesExclus: [], usersExclus: [] };
    const cfg = JSON.parse(data.content_fr) ?? {};
    return {
      actif: cfg.actif !== false,
      hashesExclus: Array.isArray(cfg.hashes_exclus) ? cfg.hashes_exclus : [],
      usersExclus: Array.isArray(cfg.users_exclus) ? cfg.users_exclus : [],
    };
  } catch {
    return { actif: true, hashesExclus: [], usersExclus: [] };
  }
}

export async function chargeReglageTelemetrie(): Promise<boolean> {
  return (await chargeConfigTelemetrie()).actif;
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
