import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
