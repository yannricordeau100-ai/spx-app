"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * ThemeToggle — bascule clair/sombre.
 *
 * Logique de persistance :
 *  1. Anonyme : `localStorage["mettrik:theme"]` source de vérité.
 *  2. Connecté : `user_metadata.theme` Supabase = source de vérité ;
 *     écrit en parallèle dans localStorage pour éviter le flash au reload.
 *  3. Premier visiteur (pas de localStorage) : défaut basé sur la viewport.
 *      - viewport ≥ 768px (desktop / laptop / tablette) → "light"
 *      - viewport < 768px (mobile)                       → "dark"
 *  4. Au login (event SIGNED_IN), si user_metadata.theme existe → applique-le.
 *     Sinon, migre la valeur localStorage actuelle vers user_metadata.
 *  5. Toggle : update localStorage + (si auth) update user_metadata. Le
 *     mode courant survit donc à un sign-out/sign-in.
 *  6. Email templates restent sombres par construction (HTML statique).
 */

const STORAGE_KEY = "mettrik:theme";
const FILTER_LIGHT = "invert(1) hue-rotate(180deg)";
type Mode = "light" | "dark";

function defaultByViewport(): Mode {
  if (typeof window === "undefined") return "dark";
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

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
    const initial: Mode = stored ?? defaultByViewport();
    setMode(initial);
    applyFilter(initial);
    if (!stored) window.localStorage.setItem(STORAGE_KEY, initial);

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
        const cur = (window.localStorage.getItem(STORAGE_KEY) as Mode | null) ?? defaultByViewport();
        await supabase.auth.updateUser({ data: { theme: cur } });
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const toggle = (next: Mode) => {
    setMode(next);
    applyFilter(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
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

  return (
    <div className="inline-flex gap-0.5 rounded-full border border-white/10 bg-[#0a0a0a]/85 p-0.5 backdrop-blur-md">
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
