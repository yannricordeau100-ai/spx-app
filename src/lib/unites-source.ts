import { createClient } from "@supabase/supabase-js";

/** Page temporaire « unités mal annotées à la source » (Yann 11 sept 2026). Décisions dans desk_page_content. */
export type Decision = {
  statut: "corriger" | "bloque" | "non_resolvable";
  facteur?: string;
  unite?: string;
  explication?: string;
  at?: string;
};

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function lireDecisions(): Promise<Record<string, Decision>> {
  try {
    const { data } = await admin().from("desk_page_content").select("content_fr").eq("page_key", "unites_source").eq("section_key", "decisions").maybeSingle();
    const j = data?.content_fr ? JSON.parse(data.content_fr) : {};
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

export async function ecrireDecision(id: string, d: Decision | null): Promise<void> {
  const tous = await lireDecisions();
  if (d) tous[id] = { ...d, at: new Date().toISOString() };
  else delete tous[id];
  const { error } = await admin()
    .from("desk_page_content")
    .upsert({ page_key: "unites_source", section_key: "decisions", content_fr: JSON.stringify(tous) }, { onConflict: "page_key,section_key" });
  if (error) throw new Error(error.message);
}
