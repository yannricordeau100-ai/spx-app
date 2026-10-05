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
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(window.innerWidth < 640), []);
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
    // Mobile : visible seulement apres 2 ecrans de defilement.
    const onScroll = () => setShow(window.scrollY > (window.innerWidth < 640 ? 2 * window.innerHeight : 400));
    onScroll();
    // Marque la page en defilement (flottants a 0,6), retire 200 ms apres l arret.
    let minuteur: number | undefined;
    const surDefile = () => {
      onScroll();
      document.documentElement.setAttribute("data-defile", "1");
      window.clearTimeout(minuteur);
      minuteur = window.setTimeout(() => document.documentElement.removeAttribute("data-defile"), 200);
    };
    window.addEventListener("scroll", surDefile, { passive: true });
    return () => {
      window.clearTimeout(minuteur);
      window.removeEventListener("scroll", surDefile);
    };
  }, []);

  return (
    <button
      data-flottant
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-3 z-50 inline-flex size-11 max-sm:size-10 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#0a0a0a]/90 text-zinc-200 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-violet-500/50 hover:text-violet-200 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
      style={{
        right: "max(0.75rem, env(safe-area-inset-right))",
        bottom: mobile
          ? "calc(max(1rem, env(safe-area-inset-bottom)) + 3rem)"
          : decale
            ? "max(7rem, calc(env(safe-area-inset-bottom) + 6.5rem))"
            : "calc(max(1rem, env(safe-area-inset-bottom)) + 3.25rem)",
      }}
      aria-label="Remonter en haut de la page"
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
