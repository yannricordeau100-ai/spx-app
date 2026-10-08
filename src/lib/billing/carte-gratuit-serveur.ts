/**
 * Lecture / écriture serveur du réglage de la carte Gratuit (voir carte-gratuit.ts).
 * Stockage : desk_page_content (page_key « pricing », section_key « carte_gratuit »).
 */
import { createClient } from "@supabase/supabase-js";
import { CARTE_GRATUIT_PAGE_KEY, CARTE_GRATUIT_SECTION_KEY, lireCarteGratuit, type CarteGratuit } from "./carte-gratuit";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role keys missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Réglage enregistré, ou null (affichage par défaut). Jamais d exception. */
export async function chargeCarteGratuit(): Promise<CarteGratuit | null> {
  try {
    const { data } = await adminClient()
      .from("desk_page_content")
      .select("content_fr, is_active")
      .eq("page_key", CARTE_GRATUIT_PAGE_KEY)
      .eq("section_key", CARTE_GRATUIT_SECTION_KEY)
      .maybeSingle();
    if (!data || data.is_active === false) return null;
    return lireCarteGratuit(data.content_fr as string | null);
  } catch {
    return null;
  }
}

/** Enregistre le réglage ; null = retour à l affichage par défaut. */
export async function enregistreCarteGratuit(reglage: CarteGratuit | null): Promise<void> {
  const { error } = await adminClient()
    .from("desk_page_content")
    .upsert(
      {
        page_key: CARTE_GRATUIT_PAGE_KEY,
        section_key: CARTE_GRATUIT_SECTION_KEY,
        content_fr: reglage ? JSON.stringify(reglage) : "",
        is_active: !!reglage,
      },
      { onConflict: "page_key,section_key" },
    );
  if (error) throw error;
}
