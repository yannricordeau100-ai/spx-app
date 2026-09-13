import { SandboxClient } from "./sandbox-client";

export const metadata = {
  title: "Sandbox · Mettrik",
  robots: { index: false, follow: false },
};

/** 9 sept 2026 : la page reste un composant serveur (metadata) ; toute la
 *  logique (usage local, zones, recherche) vit dans sandbox-client.tsx. */
export const dynamic = "force-dynamic";

/** Yann 13 sept 2026 : l alerte rouge des mises a jour est visible des l accueil de la sandbox. */
async function lireAlerte(): Promise<{ rougesTotal: number; stesRouges: string[]; calculeLe: string; resume: string[] } | null> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await sb.from("desk_page_content").select("content_fr").eq("page_key", "alertes_maj").eq("section_key", "etat").maybeSingle();
    return data?.content_fr ? JSON.parse(data.content_fr) : null;
  } catch {
    return null;
  }
}

export default async function SandboxPage() {
  const alerte = await lireAlerte();
  return <SandboxClient alerte={alerte} />;
}
