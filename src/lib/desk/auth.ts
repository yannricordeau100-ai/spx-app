import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Email autorisé à accéder au desk (single-tenant Yann uniquement). */
export const DESK_OWNER_EMAIL = process.env.DESK_OWNER_EMAIL ?? "yannricordeau100@gmail.com";

/** Slug de l'URL secrète. Doit matcher /desk-<slug>. */
export const DESK_SLUG = process.env.DESK_SLUG ?? "mtk9x4kp";

/**
 * Vérifie côté serveur que l'utilisateur courant est bien le propriétaire du
 * desk. Si non : 404 (notFound) pour ne pas révéler que la page existe.
 *
 * Utilise dans tous les Server Components du desk.
 */
export async function requireDeskOwner(): Promise<{ email: string; userId: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== DESK_OWNER_EMAIL) {
    // Le proxy.ts catch déjà ce cas, mais double sécurité au niveau page.
    redirect("/404");
  }

  return { email: user.email!, userId: user.id };
}

/**
 * Yann (25 mai 2026) : version non-throwing pour les pages publiques qui
 * veulent afficher conditionnellement un élément admin (ex CurrencyPicker
 * sur /pricing). Retourne true uniquement si l'utilisateur connecté est
 * `DESK_OWNER_EMAIL`. Aucune redirection : si false, on cache juste l'UI.
 */
export async function isDeskOwner(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user && user.email === DESK_OWNER_EMAIL;
  } catch {
    return false;
  }
}
