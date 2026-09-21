"use client";

/**
 * Bulle de support flottante (Yann 21 sept 2026).
 *
 * Visible sur tout le site, y compris pour un visiteur non connecté.
 * Ancrée en bas à droite, au dessus des zones sûres du téléphone, et
 * volontairement petite pour ne rien masquer d'utile.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MessageCircleQuestion, X } from "lucide-react";
import { SupportPanel } from "./support-panel";
import { TEXTES, langueDepuisLocale, type LangueSupport } from "./support-strings";

/**
 * Le panneau admin occupe déjà le coin bas droite hors production
 * (niveaux 1, 2 et 3). On remonte la bulle pour ne pas le recouvrir.
 */
function panneauAdminPresent(): boolean {
  try {
    const niveau = process.env.NEXT_PUBLIC_NIVEAU;
    if (niveau === "0") return false;
    if (niveau === "1" || niveau === "2" || niveau === "3") return true;
    const hote = window.location.hostname.toLowerCase();
    if (hote === "mettrik.ai" || hote === "www.mettrik.ai") return false;
    return true;
  } catch {
    return false;
  }
}

export function SupportBubble() {
  const [ouvert, setOuvert] = useState(false);
  const [visible, setVisible] = useState(false);
  const [locale, setLocale] = useState("fr");
  const [decale, setDecale] = useState(false);
  const boutonRef = useRef<HTMLButtonElement | null>(null);
  const idPanneau = useId();

  useEffect(() => {
    try {
      const lang = document.documentElement.getAttribute("lang");
      if (lang) setLocale(lang);
    } catch {
      /* repli sur le français */
    }
    setDecale(panneauAdminPresent());
  }, []);

  const langue: LangueSupport = langueDepuisLocale(locale);
  const T = TEXTES[langue];

  // Apparition fluide : on monte le panneau puis on lance la transition.
  useEffect(() => {
    if (!ouvert) return;
    const image = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(image);
  }, [ouvert]);

  const fermer = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => {
      setOuvert(false);
      boutonRef.current?.focus({ preventScroll: true });
    }, 150);
  }, []);

  return (
    <div
      className="pointer-events-none fixed bottom-0 right-0 z-[1100] flex max-w-full flex-col items-end gap-2.5"
      style={{
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingBottom: decale ? "max(3.75rem, calc(env(safe-area-inset-bottom) + 3.25rem))" : "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {ouvert && (
        <div
          id={idPanneau}
          className={`pointer-events-auto origin-bottom-right transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
            visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.97] opacity-0"
          }`}
        >
          <SupportPanel langue={langue} locale={locale} onFermer={fermer} />
        </div>
      )}

      <button
        ref={boutonRef}
        type="button"
        onClick={() => (ouvert ? fermer() : setOuvert(true))}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        aria-controls={ouvert ? idPanneau : undefined}
        aria-label={ouvert ? T.bulle_fermer : T.bulle_ouvrir}
        title={ouvert ? T.bulle_fermer : T.bulle_ouvrir}
        className="pointer-events-auto relative grid size-12 place-items-center rounded-full border border-white/12 bg-[#0b0b11]/90 text-zinc-200 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.85)] ring-1 ring-violet-500/20 backdrop-blur-md transition-[transform,color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-violet-400/45 hover:text-white hover:shadow-[0_16px_38px_-10px_rgba(139,92,246,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {ouvert ? (
          <X aria-hidden className="size-5" />
        ) : (
          <MessageCircleQuestion aria-hidden className="size-5 text-violet-200" />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_70%_25%,rgba(6,182,212,0.22),transparent_60%)]"
        />
      </button>
    </div>
  );
}

export default SupportBubble;
