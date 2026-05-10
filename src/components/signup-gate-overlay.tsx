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
}: {
  children: React.ReactNode;
  /** Chemin de la page qui rend `<AuthModal />` (ex "/sandbox/v1-8"). */
  gatePath: string;
  /** Permet de désactiver le gate (ex : on debug). Default true. */
  enabled?: boolean;
}) {
  const [state, setState] = useState<AuthState>("checking");

  useEffect(() => {
    if (!enabled) {
      setState("authed");
      return;
    }
    let cancelled = false;
    const supa = createSupabaseBrowserClient();
    supa.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setState(data.user ? "authed" : "anon");
    });
    const { data: sub } = supa.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) setState("authed");
      if (event === "SIGNED_OUT") setState("anon");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [enabled]);

  // Pendant le check initial (~100ms), on rend les children sans overlay
  // pour éviter un flash bloquant si l'user EST connecté. Le faux positif
  // si l'user est anonyme et clique très vite reste tolérable (il navigue
  // alors normalement, atterrit sur la page suivante qui re-check elle-même).
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
