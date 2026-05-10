"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Currency, setCurrencyCookie } from "@/lib/currency";
import { type Locale, COOKIE_NAME as LOCALE_COOKIE } from "@/lib/i18n/types";

/**
 * Persistance multi-device des préférences utilisateur connecté.
 *
 * Modèle :
 *  - Anonyme : cookies seulement (NEXT_LOCALE, mettrik:currency, mettrik:theme).
 *  - Connecté : Supabase `user_metadata` est source de vérité, les cookies
 *    locaux sont juste un cache. Au login, on hydrate depuis user_metadata.
 *    À chaque change manuel, on push best-effort vers user_metadata.
 *
 * Clés user_metadata : theme, currency, locale.
 *
 * Cohérent avec le pattern existant ThemeToggle (cf src/components/theme-toggle.tsx).
 */

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

/** Set le cookie locale côté client (1 an). */
export function setLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Synchronise une préférence utilisateur vers Supabase user_metadata.
 * Best-effort : si pas connecté ou erreur réseau, échoue silencieusement
 * (la pref reste dans le cookie).
 */
export async function pushUserPref(
  key: "currency" | "locale" | "theme",
  value: string,
): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return; // Anonyme : pas de sync
    await supabase.auth.updateUser({ data: { [key]: value } });
  } catch {
    // Silencieux : le cookie local est déjà à jour, pas critique.
  }
}

/**
 * Hydrate currency + locale depuis Supabase user_metadata si connecté.
 * Si une pref existe côté user_metadata et diffère du cookie local
 * → on applique le user_metadata (source de vérité multi-device).
 *
 * Si user_metadata est vide → on push le cookie local vers user_metadata
 * (1ère connexion après signup).
 *
 * Retourne true si quelque chose a été modifié côté local (cookies),
 * pour que le composant appelant puisse re-render.
 */
export async function syncUserPrefsFromSupabase(): Promise<{
  currency: Currency | null;
  locale: Locale | null;
  changed: boolean;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return { currency: null, locale: null, changed: false };

    const remoteCurrency = user.user_metadata?.currency as Currency | undefined;
    const remoteLocale = user.user_metadata?.locale as Locale | undefined;

    let changed = false;
    if (remoteCurrency) {
      setCurrencyCookie(remoteCurrency);
      changed = true;
    }
    if (remoteLocale) {
      setLocaleCookie(remoteLocale);
      changed = true;
    }

    return {
      currency: remoteCurrency ?? null,
      locale: remoteLocale ?? null,
      changed,
    };
  } catch {
    return { currency: null, locale: null, changed: false };
  }
}
