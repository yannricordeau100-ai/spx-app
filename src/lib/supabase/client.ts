"use client";

import { createBrowserClient } from "@supabase/ssr";
import { domaineCookies } from "@/lib/domaine-app";

/**
 * Client Supabase pour les composants CLIENT (Client Components).
 * Utilise la Publishable Key (anon) — RLS protège les données côté DB.
 * Lit/écrit la session dans les cookies (gérés par @supabase/ssr).
 */
export function createSupabaseBrowserClient() {
  // 15 oct 2026 : session partagee mettrik.ai / app.mettrik.ai.
  const domaine = typeof window !== "undefined" ? domaineCookies(window.location.hostname) : undefined;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    domaine ? { cookieOptions: { domain: domaine } } : undefined
  );
}
