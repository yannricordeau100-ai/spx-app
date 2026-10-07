"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Bouton "remonter la page" — fixed bottom-right, apparaît après 400px de scroll.
 * Drop-in : <BackToTop /> dans le layout ou la page racine.
 */
export function BackToTop() {
  const [show, setShow] = useState(false);
  // 7 oct 2026 : colonne commune des flottants (globals.css .flot-*).
  useEffect(() => {
    try {
      const niveau = process.env.NEXT_PUBLIC_NIVEAU;
      const h = window.location.hostname.toLowerCase();
      if (niveau === "0" ? false : niveau ? true : !(h === "mettrik.ai" || h === "www.mettrik.ai")) {
        document.documentElement.setAttribute("data-preversion", "1");
      }
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
    // 7 oct 2026 : sans gouttiere (ecran etroit), la colonne des deux boutons
    // survole du texte ou un graphique : on marque <html> et le CSS baisse
    // l opacite (survol et focus la remettent a 1). Mesure legere, une par image.
    let image = 0;
    const verifierContenu = () => {
      image = 0;
      try {
        const sur = [...document.querySelectorAll<HTMLElement>("[data-flot-colonne]")].some((b) => {
          const r = b.getBoundingClientRect();
          if (!r.width) return false;
          return [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]].some(([fx, fy]) =>
            {
              // seul l element le plus haut sous le point compte (pas les fonds de page)
              const e = document
                .elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy)
                .find((x) => !x.closest("[data-flottant]"));
              if (!e || e === document.documentElement || e === document.body) return false;
              if (/^(svg|canvas|img|path|image|picture|video)$/i.test(e.tagName)) return true;
              if ([...e.childNodes].some((n) => n.nodeType === 3 && !!n.textContent?.trim())) return true;
              // carte : fond ou bordure visibles
              const c = getComputedStyle(e);
              const fond = c.backgroundColor.match(/[\d.]+/g);
              const alpha = fond && fond.length > 3 ? parseFloat(fond[3]) : fond ? 1 : 0;
              return alpha > 0.05 || parseFloat(c.borderTopWidth) > 0 || parseFloat(c.borderRightWidth) > 0;
            },
          );
        });
        if (sur) document.documentElement.setAttribute("data-flot-sur-contenu", "1");
        else document.documentElement.removeAttribute("data-flot-sur-contenu");
      } catch {
        /* sans effet : opacite de repos */
      }
    };
    const planifier = () => {
      if (!image) image = window.requestAnimationFrame(verifierContenu);
    };
    planifier();
    window.addEventListener("scroll", surDefile, { passive: true });
    window.addEventListener("scroll", planifier, { passive: true });
    window.addEventListener("resize", planifier);
    return () => {
      window.clearTimeout(minuteur);
      window.cancelAnimationFrame(image);
      document.documentElement.removeAttribute("data-flot-sur-contenu");
      window.removeEventListener("scroll", surDefile);
      window.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
    };
  }, []);

  return (
    <button
      data-flottant
      data-flot-colonne
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`flot-haut flot-rond fixed z-50 inline-flex items-center justify-center rounded-full border border-[#2a2a2a] bg-[#0a0a0a]/90 text-zinc-200 shadow-xl backdrop-blur-md transition-[transform,opacity,color,border-color] duration-300 hover:scale-110 hover:border-violet-500/50 hover:text-violet-200 ${
        show ? "translate-y-0 flot-discret" : "pointer-events-none translate-y-4 opacity-0"
      }`}
      aria-label="Remonter en haut de la page"
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
