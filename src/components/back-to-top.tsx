"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Bouton "remonter la page" — fixed bottom-right, apparaît après 400px de scroll.
 * Drop-in : <BackToTop /> dans le layout ou la page racine.
 */
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 right-6 z-50 inline-flex size-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#0a0a0a]/90 text-zinc-200 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-violet-500/50 hover:text-violet-200 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
      aria-label="Remonter en haut de la page"
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
