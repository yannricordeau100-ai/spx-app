"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Bouton "remonter la page" — fixed bottom-right, apparaît après 400px de scroll.
 * Drop-in : <BackToTop /> dans le layout ou la page racine.
 */
export function BackToTop() {
  const [show, setShow] = useState(false);
  // 5 oct 2026 : empile au-dessus de la bulle d aide (meme colonne, bas droite)
  // sans chevauchement. La bulle monte quand le panneau admin est present.
  const [decale, setDecale] = useState(false);
  useEffect(() => {
    try {
      const niveau = process.env.NEXT_PUBLIC_NIVEAU;
      const h = window.location.hostname.toLowerCase();
      setDecale(niveau === "0" ? false : niveau ? true : !(h === "mettrik.ai" || h === "www.mettrik.ai"));
    } catch {
      /* repli : position de production */
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      data-flottant
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-3 z-50 inline-flex size-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#0a0a0a]/90 text-zinc-200 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-violet-500/50 hover:text-violet-200 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
      style={{
        right: "max(0.75rem, env(safe-area-inset-right))",
        bottom: decale
          ? "max(7.5rem, calc(env(safe-area-inset-bottom) + 7rem))"
          : "calc(max(1rem, env(safe-area-inset-bottom)) + 3.75rem)",
      }}
      aria-label="Remonter en haut de la page"
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
