"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { COOKIE_NAME, COOKIE_MAX_AGE, type Locale } from "./types";
import { translate } from "./dictionary";

type I18nCtx = {
  locale: Locale;
  /** Translate a key using the active locale. Falls back to the key. */
  t: (key: string) => string;
  /** Switch locale (sets cookie + reloads). */
  setLocale: (next: Locale) => void;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = useCallback((key: string) => translate(key, locale), [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    // Cookie pour persister le choix (gère les variantes type "en-GB", "de-CH").
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    // Path-based : seul "fr" a un préfixe URL pour l'instant. Les autres
    // locales (en, de, nl, sv, da, en-GB, de-CH) utilisent /<route> avec
    // distinction via cookie. Quand DE/NL/etc. seront pleinement traduits,
    // on ajoutera leurs préfixes URL.
    const path = window.location.pathname;
    const search = window.location.search;
    const FR_PREFIX = "/fr";
    const isCurrentlyFr = path === FR_PREFIX || path.startsWith(FR_PREFIX + "/");
    let basePath = path;
    if (isCurrentlyFr) {
      basePath = path === FR_PREFIX ? "/" : path.slice(FR_PREFIX.length);
    }
    const targetPath = next === "fr"
      ? (basePath === "/" ? "/fr" : `/fr${basePath}`)
      : basePath;
    window.location.href = targetPath + search;
  }, []);

  const value = useMemo<I18nCtx>(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook principal : `const { t, locale, setLocale } = useT();` */
export function useT(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Fallback safe si appelé hors Provider (en SSR initial)
    return {
      locale: "en",
      t: (key: string) => translate(key, "en"),
      setLocale: () => {},
    };
  }
  return v;
}
