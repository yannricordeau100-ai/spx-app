"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";

/**
 * ThemeToggle — bascule clair/sombre.
 *
 * Yann (8 juin 2026) : le thème CLAIR est réservé aux 2 offres PAYANTES
 * (premium + max). Pour les non-payants (anonyme + free), prop `paid={false}` :
 *  - l'option claire est grisée + cadenas + tooltip "réservé aux offres payantes",
 *  - le thème est FORCÉ en sombre au montage (même si localStorage ou
 *    user_metadata.theme avait mémorisé "light" du temps où l'user était
 *    payant, ou via préférence OS claire),
 *  - le clic sur l'option claire est inerte.
 * Anti-flash : le HTML est toujours rendu en sombre côté SSR
 * (cf src/app/layout.tsx data-theme="dark"), et le mode clair n'est appliqué
 * que dans ce useEffect client. Un non-payant ne voit donc jamais de flash
 * clair, le gating tombant au tout premier effet d'hydratation.
 *
 * Logique de persistance (Yann 10 mai 2026 : reglage auto OS) :
 *  1. Anonyme : `localStorage["mettrik:theme"]` source de vérité si l'user
 *     a déjà choisi explicitement (= cliqué sur le toggle).
 *  2. Sinon, défaut basé sur la PRÉFÉRENCE SYSTÈME de l'OS via
 *     `matchMedia('(prefers-color-scheme: dark)')`. Marche sur macOS,
 *     Windows 10+, iOS 13+, Android, etc. (~99,5 % de fiabilité).
 *     Mise à jour live si l'user change le mode OS pendant la session.
 *  3. Connecté : `user_metadata.theme` Supabase = source de vérité ;
 *     écrit en parallèle dans localStorage pour éviter le flash au reload.
 *  4. Au login (event SIGNED_IN), si user_metadata.theme existe → applique-le.
 *     Sinon, migre la valeur courante vers user_metadata.
 *  5. Toggle : update localStorage + (si auth) update user_metadata. Le
 *     mode courant survit à un sign-out/sign-in.
 *  6. Fallback ultime (pas de matchMedia, navigateur très vieux) : viewport
 *     >= 768px → light, sinon dark.
 *  7. Email templates restent sombres par construction (HTML statique).
 */

const STORAGE_KEY = "mettrik:theme";
const FILTER_LIGHT = "invert(1) hue-rotate(180deg)";
type Mode = "light" | "dark";

/** Préférence système OS (prefers-color-scheme). Fallback viewport si pas de matchMedia. */
function defaultBySystemPreference(): Mode {
  if (typeof window === "undefined") return "dark";
  if (typeof window.matchMedia === "function") {
    const mqDark = window.matchMedia("(prefers-color-scheme: dark)");
    if (mqDark.matches) return "dark";
    const mqLight = window.matchMedia("(prefers-color-scheme: light)");
    if (mqLight.matches) return "light";
  }
  // Pas de pref OS détectable → fallback viewport (laptop/desktop = light, mobile = dark)
  return window.innerWidth >= 768 ? "light" : "dark";
}

function applyFilter(m: Mode) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (m === "light") {
    html.style.filter = FILTER_LIGHT;
    html.style.background = "#fff";
    html.setAttribute("data-theme", "light");
  } else {
    html.style.filter = "";
    html.style.background = "";
    html.setAttribute("data-theme", "dark");
  }
}

/**
 * @param paid  true pour les offres payantes (premium + max) → toggle complet.
 *              false (défaut) pour anonyme + free → clair verrouillé, sombre forcé.
 *              Résolu côté serveur via getServerFreemiumTier() ou la prop
 *              freemiumTier (CompanyView), puis `tier === "premium" || tier === "max"`.
 */
export function ThemeToggle({ paid = false }: { paid?: boolean }) {
  const [mode, setMode] = useState<Mode>("dark");
  const { t } = useT();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // GATING NON-PAYANT (anonyme + free) : thème clair indisponible. On force
    // sombre, on ignore toute valeur "light" persistée (localStorage,
    // user_metadata) et on n'installe AUCUN listener OS (sinon une pref OS
    // claire rebasculerait en clair). Le HTML est déjà sombre côté SSR donc
    // zéro flash.
    if (!paid) {
      setMode("dark");
      applyFilter("dark");
      window.localStorage.setItem(STORAGE_KEY, "dark");
      return;
    }

    // Flag : l'user a-t-il choisi explicitement via le toggle ? Si oui on
    // ne suit plus la pref OS (= localStorage prevaut).
    const explicit = window.localStorage.getItem(`${STORAGE_KEY}:explicit`) === "1";
    const stored = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
    const sysPref = defaultBySystemPreference();
    const initial: Mode = explicit && stored ? stored : sysPref;
    setMode(initial);
    applyFilter(initial);
    window.localStorage.setItem(STORAGE_KEY, initial);

    // Listener OS : si l'user n'a PAS encore cliqué sur le toggle, on
    // suit la pref système en temps réel (ex : macOS bascule auto à 20h).
    let mqHandler: ((e: MediaQueryListEvent) => void) | null = null;
    let mq: MediaQueryList | null = null;
    if (typeof window.matchMedia === "function") {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      mqHandler = (e: MediaQueryListEvent) => {
        const userExplicit = window.localStorage.getItem(`${STORAGE_KEY}:explicit`) === "1";
        if (userExplicit) return;
        const next: Mode = e.matches ? "dark" : "light";
        setMode(next);
        applyFilter(next);
        window.localStorage.setItem(STORAGE_KEY, next);
      };
      if (mq.addEventListener) mq.addEventListener("change", mqHandler);
      else if (mq.addListener) mq.addListener(mqHandler); // legacy Safari
    }

    // Sync avec Supabase si user connecté.
    const supabase = createSupabaseBrowserClient();

    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (cancelled || !user) return;
      const remote = (user.user_metadata?.theme as Mode | undefined) ?? null;
      if (remote && remote !== initial) {
        // Le serveur a la dernière préférence : prévaut sur le local.
        setMode(remote);
        applyFilter(remote);
        window.localStorage.setItem(STORAGE_KEY, remote);
      } else if (!remote) {
        // L'user vient de s'inscrire (ou pas de pref encore) : on remonte
        // le local vers le serveur, silencieusement.
        await supabase.auth.updateUser({ data: { theme: initial } });
      }
    })();

    // Bascule sur SIGNED_IN (login après sign-out) : refetch et sync.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event !== "SIGNED_IN") return;
      const { data: d2 } = await supabase.auth.getUser();
      const remote = (d2.user?.user_metadata?.theme as Mode | undefined) ?? null;
      if (remote) {
        setMode(remote);
        applyFilter(remote);
        window.localStorage.setItem(STORAGE_KEY, remote);
      } else {
        // Pas de pref serveur (1ère co après signup) : push le local actuel.
        const cur = (window.localStorage.getItem(STORAGE_KEY) as Mode | null) ?? defaultBySystemPreference();
        await supabase.auth.updateUser({ data: { theme: cur } });
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (mq && mqHandler) {
        if (mq.removeEventListener) mq.removeEventListener("change", mqHandler);
        else if ((mq as MediaQueryList & { removeListener?: (h: (e: MediaQueryListEvent) => void) => void }).removeListener) {
          (mq as MediaQueryList & { removeListener: (h: (e: MediaQueryListEvent) => void) => void }).removeListener(mqHandler);
        }
      }
    };
  }, [paid]);

  const toggle = (next: Mode) => {
    // Non-payant : le clic sur l'option claire est inerte (clair verrouillé).
    if (!paid && next === "light") return;
    setMode(next);
    applyFilter(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      // Marqueur "choix explicite" : à partir d'ici, on arrête de suivre
      // la pref OS automatiquement. L'user reprend la main.
      window.localStorage.setItem(`${STORAGE_KEY}:explicit`, "1");
    }
    // Best-effort : sync vers le compte si connecté.
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          await supabase.auth.updateUser({ data: { theme: next } });
        }
      } catch {
        // Silent : la pref locale est déjà à jour.
      }
    })();
  };

  const lockLabel = t("theme.light_paid_only");

  return (
    <div className="inline-flex gap-0.5 rounded-full border border-white/10 bg-[#0a0a0a]/85 p-0.5 backdrop-blur-md">
      {paid ? (
        <button
          type="button"
          onClick={() => toggle("light")}
          aria-label="Mode clair"
          className={`inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${
            mode === "light"
              ? "bg-violet-500 text-white shadow-[0_0_12px_rgba(167,139,250,0.5)]"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Sun className="size-3.5" />
        </button>
      ) : (
        // Non-payant : option claire grisee + cadenas + invitation a s abonner.
        // Yann 4 sept 2026 : un simple `title` ne se voyait pas et n invitait a
        // rien. Au survol, on explique ce qui est verrouille et on propose de
        // passer a l offre payante, en un clic.
        <span className="group/clair relative inline-flex">
          <span
            aria-label={lockLabel}
            aria-disabled="true"
            className="relative inline-flex cursor-not-allowed items-center justify-center rounded-full p-1.5 text-zinc-600"
          >
            <Sun className="size-3.5 opacity-50" />
            <Lock className="absolute -bottom-0.5 -right-0.5 size-2 text-zinc-500" />
          </span>
          <a
            href="/pricing"
            className="pointer-events-none absolute right-0 top-full z-[120] mt-2 w-[210px] rounded-xl border border-violet-400/30 bg-[#0b0b0e] p-3 text-left opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.6)] transition-opacity duration-150 group-hover/clair:pointer-events-auto group-hover/clair:opacity-100"
          >
            <span className="block text-[12px] font-semibold text-zinc-100">
              Le mode clair est reserve aux abonnes
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-zinc-400">
              Debloquez aussi toutes les fiches, sans floutage.
            </span>
            <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white">
              Voir les offres
            </span>
          </a>
        </span>
      )}
      <button
        type="button"
        onClick={() => toggle("dark")}
        aria-label="Mode sombre"
        className={`inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${
          mode === "dark"
            ? "bg-violet-500 text-white shadow-[0_0_12px_rgba(167,139,250,0.5)]"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <Moon className="size-3.5" />
      </button>
    </div>
  );
}
