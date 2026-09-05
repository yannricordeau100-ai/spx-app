/**
 * Lecture des arbitrages de sous-industrie GICS faits par le proprietaire
 * (desk_page_content, page_key "gics", section_key "arbitrages") :
 * { "<TICKER>": "<code8>" }. Cote serveur uniquement.
 */
import { createClient } from "@supabase/supabase-js";

export async function lireArbitragesGics(): Promise<Record<string, string>> {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await sb
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", "gics")
      .eq("section_key", "arbitrages")
      .maybeSingle();
    const brut = data?.content_fr ? (JSON.parse(data.content_fr) as Record<string, string>) : {};
    return brut && typeof brut === "object" ? brut : {};
  } catch {
    return {};
  }
}
