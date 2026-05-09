/**
 * page-content.ts — lecture / écriture du contenu des pages éditables
 * via le back-office (table `desk_page_content`).
 *
 * Yann 8 mai 2026 : "système d'édition contenu page (admin via desk)".
 *
 * Pages couvertes pour le moment :
 *   - "contact" : page V1.8 contact (5 sections seedées)
 *
 * Extensible : à mesure qu'on identifie des pages éditables (about,
 * privacy, etc.), on ajoute des entries dans la table. Le code ici
 * sert toutes les pages indifféremment.
 */
import { createClient } from "@supabase/supabase-js";
import type { Locale } from "@/lib/i18n/types";

export type PageContent = {
  id: string;
  page_key: string;
  section_key: string;
  content_fr: string;
  content_en: string | null;
  content_de: string | null;
  is_active: boolean;
  updated_at: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role keys missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Pick le contenu pour une locale donnée, fallback FR si autre absente. */
export function pickLocale(c: PageContent, locale: Locale): string {
  if (locale === "en" && c.content_en) return c.content_en;
  if (locale === "de" && c.content_de) return c.content_de;
  return c.content_fr;
}

/** Lit toutes les sections d'une page. Renvoie un map section_key→contenu. */
export async function loadPageContent(pageKey: string, locale: Locale = "fr"): Promise<Record<string, string>> {
  try {
    const { data, error } = await adminClient()
      .from("desk_page_content")
      .select("*")
      .eq("page_key", pageKey)
      .eq("is_active", true);
    if (error || !data) return {};
    const out: Record<string, string> = {};
    for (const row of data as PageContent[]) {
      out[row.section_key] = pickLocale(row, locale);
    }
    return out;
  } catch {
    return {};
  }
}

/** Lit toutes les sections en raw (toutes langues), pour le back-office. */
export async function loadPageContentRaw(): Promise<PageContent[]> {
  try {
    const { data, error } = await adminClient()
      .from("desk_page_content")
      .select("*")
      .order("page_key")
      .order("section_key");
    if (error) throw error;
    return (data ?? []) as PageContent[];
  } catch {
    return [];
  }
}

export async function upsertPageContent(input: Partial<PageContent>): Promise<PageContent> {
  const { data, error } = await adminClient()
    .from("desk_page_content")
    .upsert(input, { onConflict: "page_key,section_key" })
    .select()
    .single();
  if (error) throw error;
  return data as PageContent;
}

export async function deletePageContent(id: string): Promise<void> {
  const { error } = await adminClient().from("desk_page_content").delete().eq("id", id);
  if (error) throw error;
}
