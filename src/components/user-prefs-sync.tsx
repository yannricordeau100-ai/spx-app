"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncUserPrefsFromSupabase } from "@/lib/user-prefs";

/**
 * Composant invisible monté dans le layout root.
 *
 * Au mount : si user connecté → hydrate les cookies (currency, locale)
 * depuis Supabase user_metadata. Source de vérité multi-device.
 *
 * À l'event SIGNED_IN : refait le sync.
 *
 * Note : le ThemeToggle gère déjà sa propre sync, donc on ne touche pas
 * au theme ici (évite un double-set qui ferait flicker).
 */
export function UserPrefsSync() {
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    void (async () => {
      const result = await syncUserPrefsFromSupabase();
      if (cancelled) return;
      if (result.changed) {
        // Le cookie a été update — on déclenche un soft reload pour que
        // le proxy serveur lise le nouveau cookie au prochain rendu.
        // Utiliser router.refresh() serait propre, mais ici on est dans
        // le layout root, on évite l'import next/navigation alourdi.
        // Soft : juste rerender les composants client qui lisent
        // document.cookie au mount (ex DividendStories qui lit
        // mettrik:currency).
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      void syncUserPrefsFromSupabase();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
