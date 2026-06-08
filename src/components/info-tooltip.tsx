"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Info } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * Generic "i" hover/tap tooltip with rich content.
 *
 * RÈGLE UNIVERSELLE : la popup est rendue via React Portal au niveau de
 * <body>, en `position: fixed`. Elle s'extrait ainsi de TOUS les
 * stacking contexts parents (cards, grid items, modals) et reste
 * TOUJOURS au premier plan, jamais clippée par un voisin.
 *
 * Position calculée à partir du rect du bouton "i" déclencheur.
 *
 * Utilisée partout dans l'app (home cards, page société hero, KPI table,
 * super-KPI cards, freshness pills, etc.) — un seul correctif règle tout.
 */
export function InfoTooltip({
  children,
  color = "#c4b5fd",
  align = "left",
  size = "sm",
}: {
  children: React.ReactNode;
  color?: string;
  /**
   * Direction d'ouverture par rapport au bouton :
   *  - "left"   : popup s'étend vers la droite (left edge de la popup
   *               alignée sur le bouton)
   *  - "right"  : popup s'étend vers la gauche (right edge alignée sur
   *               le bouton) — utile en bord-droit d'écran
   *  - "center" : popup centrée horizontalement sur le bouton
   */
  align?: "left" | "right" | "center";
  size?: "sm" | "md";
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    right: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isSm = size === "sm";

  // Calcule la position de la popup à partir du bouton déclencheur.
  // Recalculé à chaque ouverture + sur scroll/resize tant que ouverte.
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const btn = triggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setCoords({
        top: r.bottom + 6, // 6px sous le bouton
        left: r.left,
        right: window.innerWidth - r.right,
      });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  // Pour SSR : ne rendre le portal qu'une fois monté côté client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const popupStyle: React.CSSProperties = (() => {
    if (!coords) return { display: "none" };
    if (align === "right") return { top: coords.top, right: coords.right };
    if (align === "center")
      return {
        top: coords.top,
        left: coords.left,
        transform: "translateX(-50%)",
      };
    return { top: coords.top, left: coords.left };
  })();

  return (
    <span className="relative inline-flex shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-[#050505] transition-colors hover:bg-[#1a1a1a] ${
          isSm ? "size-[18px]" : "size-[22px]"
        }`}
        style={{ borderColor: color, color }}
        aria-label={t("ui.more_info")}
      >
        <Info
          className={isSm ? "size-[14px]" : "size-4"}
          strokeWidth={3}
          aria-hidden
        />
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                role="tooltip"
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                className="pointer-events-auto fixed z-[1000] w-72 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3.5 text-[12.5px] leading-relaxed text-zinc-200 shadow-2xl"
                style={popupStyle}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </span>
  );
}
