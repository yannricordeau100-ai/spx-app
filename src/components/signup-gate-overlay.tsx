"use client";

/**
 * SignupGateOverlay — intercepte TOUS les clics dans son sous-arbre si le
 * visiteur n'est pas connecté. Au clic anonyme, on l'envoie sur
 * `<gatePath>?auth=signup&next=<url courante>` ce qui déclenche AuthModal.
 *
 * Approche : overlay absolu invisible par-dessus les children. Évite de
 * patcher individuellement chaque Link / input. Tout click (peu importe
 * où il tape dans la zone) est capturé.
 *
 * Si user authentifié → on rend juste les children, l'overlay est absent
 * et les interactions natives passent normalement.
 *
 * Yann 10 mai 2026 : "tout clic sur la barre de recherche + tout clic
 * sur l'aperçu d'une société ouvre une popup signup (sauf si connecté).
 * Peu importe le type de clic."
 */
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthState = "checking" | "authed" | "anon";

export function SignupGateOverlay({
  children,
  gatePath,
  enabled = true,
  initialAuthed,
}: {
  children: React.ReactNode;
  /** Chemin de la page qui rend `<AuthModal />` (ex "/sandbox/v1-8"). */
  gatePath: string;
  /** Permet de désactiver le gate (ex : on debug). Default true. */
  enabled?: boolean;
  /**
   * État d'auth connu côté serveur (passé en prop pour éviter le délai
   * de check Supabase côté client ~100ms pendant lequel l'overlay est
   * absent et un clic rapide passe à travers (Yann 11 mai 2026 : "j'ai
   * cliqué sur la barre de recherche et il n'y a pas de pop up").
   * - `false` → on initialise direct en "anon" (overlay actif au 1er render)
   * - `true`  → on initialise en "authed" (pas d'overlay)
   * - undefined (legacy) → "checking" puis re-check côté client
   */
  initialAuthed?: boolean;
}) {
  const [state, setState] = useState<AuthState>(() => {
    if (!enabled) return "authed";
    if (initialAuthed === false) return "anon";
    if (initialAuthed === true) return "authed";
    return "checking";
  });

  useEffect(() => {
    if (!enabled) {
      setState("authed");
      return;
    }
    let cancelled = false;
    const supa = createSupabaseBrowserClient();
    // Si on n'a pas reçu d'état initial du serveur, on check côté client.
    if (initialAuthed === undefined) {
      supa.auth.getUser().then(({ data }) => {
        if (cancelled) return;
        setState(data.user ? "authed" : "anon");
      });
    }
    const { data: sub } = supa.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) setState("authed");
      if (event === "SIGNED_OUT") setState("anon");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [enabled, initialAuthed]);

  // Pendant le check initial (~100ms), on rend les children sans overlay
  // pour éviter un flash bloquant si l'user EST connecté. Mais si on a
  // initialAuthed=false côté serveur, on est direct en "anon" → pas de
  // race condition possible.
  if (state === "authed" || state === "checking" || !enabled) {
    return <>{children}</>;
  }

  // Anonyme : overlay clickable qui capture tout
  const target = `${gatePath}?auth=signup&next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : gatePath)}`;
  return (
    <div className="relative">
      {children}
      <a
        href={target}
        aria-label="S'inscrire pour accéder"
        className="absolute inset-0 z-30 cursor-pointer"
      />
    </div>
  );
}
