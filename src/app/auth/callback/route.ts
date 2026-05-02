import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Auth callback — terminus du flow OAuth (Google) et magic link.
 * Échange le `code` query param contre une session, puis redirige.
 *
 * URL : /auth/callback?code=XYZ&next=/somewhere
 *   - `code` : code d'autorisation OAuth ou OTP
 *   - `next` : URL de redirection après login (défaut : /account)
 */
/**
 * Sanitize : n'accepte qu'une URL relative interne au domaine.
 * Bloque les open-redirect du genre ?next=https://attacker.com.
 */
function safeNext(raw: string | null): string {
  // Idem actions.ts : par défaut on renvoie sur la home, qui est
  // désormais 100 % accessible une fois connecté. Si `next` cible une
  // page précise (page société pré-cliquée, /auth/update-password après
  // un reset, etc.), on respecte.
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Traduit les messages Supabase techniques en messages FR clairs et rassurants.
 * Évite les "invalid flow state, flow state has expired" qui paniquent l'user.
 */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already") && m.includes("used"))
    return "Ce lien a déjà été utilisé. Connecte-toi avec ton email + mot de passe.";
  if (m.includes("flow state") || m.includes("code verifier"))
    return "Le lien doit être ouvert dans le même navigateur que celui où tu t'es inscrit. Connecte-toi avec ton email + mot de passe.";
  if (m.includes("expired") || m.includes("token has expired"))
    return "Le lien a expiré. Connecte-toi simplement avec ton email + mot de passe, ton compte est créé.";
  if (m.includes("rate")) return "Trop de tentatives. Patiente une minute puis réessaie.";
  if (m.includes("invalid"))
    return "Le lien n'est plus valide. Ton compte existe déjà : connecte-toi avec email + mot de passe.";
  return "Lien invalide. Connecte-toi avec ton email + mot de passe pour continuer.";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Supabase utilise `token_hash` pour les confirmations d'email signup,
  // recovery, magic link, email change. `code` est utilisé pour OAuth (PKCE).
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type"); // signup | magiclink | recovery | email_change | invite
  const next = safeNext(searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  // Cas 1a : token_hash présent (signup confirmation, magic link, recovery, etc.)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "magiclink" | "recovery" | "email_change" | "invite",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Vérifie si déjà connecté (cas du double-click)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/?auth=signin&error=${encodeURIComponent(friendlyError(error.message))}`
    );
  }

  // Cas 1b : un code est présent (OAuth PKCE) → tente l'échange.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    // L'échange a échoué. Vérifie si l'user est DÉJÀ connecté (cookies valides
    // d'une session précédente) : dans ce cas, on ignore silencieusement
    // l'erreur et on l'envoie sur sa page cible. C'est ce qui se passe quand
    // un user clique deux fois sur le même lien email ou rafraîchit la page.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/?auth=signin&error=${encodeURIComponent(friendlyError(error.message))}`
    );
  }

  // Cas 2 : pas de code ni de token_hash. Si déjà connecté, on accepte quand même.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/?auth=signin&error=${encodeURIComponent("Le lien est incomplet. Connecte-toi avec ton email pour continuer.")}`
  );
}
