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
/**
 * Yann 4 sept 2026 : le back-office se verrouillait lui-meme. En mode
 * pre-lancement, ses pages renvoient vers la connexion, qui vit sur l accueil,
 * lui-meme ferme par la maintenance : plus aucun acces, y compris pour
 * regler les codes promo ou rouvrir le site. On accepte donc, en secours, le
 * jeton d audit passe en parametre, exactement comme la page de lancement et
 * la carte de structure. Le jeton est secret et deja utilise pour ces pages.
 */
async function jetonAuditValide(): Promise<boolean> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const url = h.get("x-url") ?? h.get("referer") ?? "";
    const attendu = process.env.VISUAL_AUDIT_TOKEN;
    if (!attendu) return false;
    const t = new URL(url, "https://mettrik.ai").searchParams.get("audit_token");
    return !!t && t === attendu;
  } catch {
    return false;
  }
}

export async function requireDeskOwner(): Promise<{ email: string; userId: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if ((!user || user.email !== DESK_OWNER_EMAIL) && (await jetonAuditValide())) {
    return { email: DESK_OWNER_EMAIL ?? "", userId: "audit" };
  }
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
