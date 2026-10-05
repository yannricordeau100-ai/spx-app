import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Client Supabase pour les composants SERVER (Server Components, route
 * handlers, server actions). Utilise la Publishable Key + cookies de
 * la requête courante pour porter la session de l'utilisateur connecté.
 *
 * Note Next 16 : `cookies()` est async, d'où l'`await`.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appels depuis un Server Component — ignore (le middleware
            // refresh la session côté request → response cycle).
          }
        },
      },
    }
  );
}

/**
 * Utilisateur de la requete courante, memoise PAR REQUETE (React cache).
 * Yann 5 oct 2026 (lenteur des fiches) : la page, AuthNav, le palier simule et
 * le controle admin appelaient chacun auth.getUser(), soit jusqu a 4 allers-
 * retours reseau vers Supabase par ouverture. Un seul desormais ; les appels
 * simultanes partagent la meme promesse. Rien n est partage entre visiteurs :
 * le cache React vit le temps d une requete.
 */
export const getUserCourant = cache(async () => {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
});
