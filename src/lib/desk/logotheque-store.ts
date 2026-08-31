/**
 * Stockage des réglages de la logothèque (Yann 31 août 2026).
 *
 * Même mécanique que les zones de floutage : table générique
 * desk_page_content, effet immédiat en production sans redéploiement.
 * En prod le système de fichiers Vercel est en lecture seule, donc écrire
 * un JSON du dépôt ne marcherait pas : la base est le seul support viable.
 */
import { createClient } from "@supabase/supabase-js";
import { nettoieReglages, type ReglagesLogotheque } from "@/lib/logotheque";

const PAGE_KEY = "logotheque";
const SECTION_KEY = "emplacements";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function chargeReglagesLogotheque(): Promise<ReglagesLogotheque> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", PAGE_KEY)
      .eq("section_key", SECTION_KEY)
      .maybeSingle();
    if (!data?.content_fr) return {};
    return nettoieReglages(JSON.parse(data.content_fr));
  } catch {
    // Base injoignable : on retombe sur la variante globale, jamais d'erreur
    // visible côté visiteur.
    return {};
  }
}

export async function enregistreReglagesLogotheque(
  reglages: ReglagesLogotheque,
): Promise<void> {
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      {
        page_key: PAGE_KEY,
        section_key: SECTION_KEY,
        content_fr: JSON.stringify(nettoieReglages(reglages)),
      },
      { onConflict: "page_key,section_key" },
    );
  if (error) throw new Error(error.message);
}
