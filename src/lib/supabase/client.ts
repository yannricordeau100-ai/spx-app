"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase pour les composants CLIENT (Client Components).
 * Utilise la Publishable Key (anon) — RLS protège les données côté DB.
 * Lit/écrit la session dans les cookies (gérés par @supabase/ssr).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
