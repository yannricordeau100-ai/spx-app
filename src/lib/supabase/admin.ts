import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase ADMIN — utilise la Secret Key (service_role).
 * BYPASS Row Level Security. À n'utiliser QUE dans des contextes server-only
 * de confiance (route handlers protégés, server actions admin), JAMAIS
 * exposé au navigateur.
 *
 * Cas d'usage Mettrik :
 *   - Création de comptes par invitation
 *   - Migrations / seeds en script
 *   - Opérations cross-user (pas pour les flows utilisateur normaux)
 */
export function createSupabaseAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante — vérifier .env.local"
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
