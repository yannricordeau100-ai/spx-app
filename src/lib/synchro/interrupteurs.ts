import { createClient } from "@supabase/supabase-js";
import type { CategorieSynchro } from "./etat";

/**
 * Interrupteurs des mises a jour quotidiennes (9 sept 2026). Ranges dans
 * Supabase (desk_page_content, page synchro / section interrupteurs) pour
 * etre lus a la fois par l app et par les scripts du Mac (scripts/synchro_flags.py).
 * Absent = allume.
 */
export type Interrupteurs = Record<CategorieSynchro, boolean>;

export const INTERRUPTEURS_DEFAUT: Interrupteurs = { transcripts: true, kpi_ic: true, kpi_stories: true };

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function lireInterrupteurs(): Promise<Interrupteurs> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", "synchro")
      .eq("section_key", "interrupteurs")
      .maybeSingle();
    const brut = data?.content_fr ? (JSON.parse(data.content_fr) as Partial<Interrupteurs>) : {};
    return {
      transcripts: brut.transcripts !== false,
      kpi_ic: brut.kpi_ic !== false,
      kpi_stories: brut.kpi_stories !== false,
    };
  } catch {
    return { ...INTERRUPTEURS_DEFAUT };
  }
}

export async function ecrireInterrupteurs(v: Interrupteurs): Promise<void> {
  await admin()
    .from("desk_page_content")
    .upsert(
      { page_key: "synchro", section_key: "interrupteurs", content_fr: JSON.stringify(v), updated_at: new Date().toISOString() },
      { onConflict: "page_key,section_key" },
    );
}
