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
  color = "#a78bfa",
  align = "left",
  size = "sm",
  icone,
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
  /** Yann 18 sept 2026 : icone de remplacement (ex. fleche vers le bas). */
  icone?: React.ReactNode;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    haut: number;
    left: number;
    right: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // 14 sept 2026 : largeur reelle de la popup, mesuree apres rendu. La
  // constante 288 px ne valait que pour une police racine de 16 px ; sur les
  // grands ecrans la popup etait plus large et partait loin du « i ».
  const popupRef = useRef<HTMLDivElement>(null);
  const [largeurPopup, setLargeurPopup] = useState(288);
  // Yann 18 sept 2026 : hauteur mesuree aussi, pour ouvrir vers le haut quand
  // le bouton est en bas de l ecran (la popup sortait de l ecran).
  const [hauteurPopup, setHauteurPopup] = useState(0);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const w = popupRef.current?.offsetWidth;
      if (w && Math.abs(w - largeurPopup) > 1) setLargeurPopup(w);
      const h = popupRef.current?.offsetHeight;
      if (h && Math.abs(h - hauteurPopup) > 1) setHauteurPopup(h);
    });
    return () => cancelAnimationFrame(id);
  }, [open, coords, largeurPopup, hauteurPopup]);
  const isSm = size === "sm";

  // Calcule la position de la popup à partir du bouton déclencheur.
  // Recalculé à chaque ouverture + sur scroll/resize tant que ouverte.
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const btn = triggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      // 25 sept 2026 : le site applique « body { zoom: 1.1 } ». La popup, en
      // position fixe DANS le corps zoome, voit ses coordonnees agrandies une
      // seconde fois : elle partait en bas a droite, loin du « i », et sortait
      // de l ecran. On ramene tout en pixels de mise en page (rapport entre la
      // largeur affichee du bouton et sa largeur de mise en page).
      const z = btn.offsetWidth > 0 ? r.width / btn.offsetWidth : 1;
      const f = z > 0.5 && z < 3 ? z : 1;
      setZoom(f);
      setCoords({
        top: r.bottom / f + 6, // 6px sous le bouton
        haut: r.top / f, // bord haut du bouton, pour ouvrir au-dessus si besoin
        left: r.left / f,
        right: (window.innerWidth - r.right) / f,
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
    // 14 sept 2026 : la popup reste toujours collee au « i » et entierement
    // visible : position calculee en pixels puis bornee aux bords de l ecran.
    const MARGE = 12;
    const vw = (typeof window !== "undefined" ? window.innerWidth : 1440) / zoom;
    const vh = (typeof window !== "undefined" ? window.innerHeight : 900) / zoom;
    const borne = (x: number) => Math.max(MARGE, Math.min(x, vw - largeurPopup - MARGE));
    // Vertical : sous le bouton si la place suffit, sinon au-dessus, toujours
    // dans l ecran et jamais loin du « i ».
    const h = hauteurPopup || 160;
    const dessous = coords.top;
    const dessus = coords.haut - 6 - h;
    const top = dessous + h + MARGE <= vh ? dessous : Math.max(MARGE, dessus >= MARGE ? dessus : vh - h - MARGE);
    const gaucheBouton = coords.left;
    const droiteBouton = vw - coords.right;
    if (align === "center") {
      return { top, left: borne((gaucheBouton + droiteBouton) / 2 - largeurPopup / 2) };
    }
    if (align === "right") return { top, left: borne(droiteBouton - largeurPopup) };
    // Yann 8 juin 2026 : auto-flip. La popup fait w-72 (288px). Si elle
    // depasserait le bord droit de l'ecran (cas du "i" en bout de titre KPI a
    // droite, ex "Revenus des frais de membership (i)"), on l'ouvre vers la
    // GAUCHE (right-align) pour ne plus tronquer le texte de definition.
    if (gaucheBouton + largeurPopup + MARGE > vw) {
      return { top, left: borne(droiteBouton - largeurPopup) };
    }
    return { top, left: borne(gaucheBouton) };
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
        className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-[#0a0a0a] transition-colors hover:bg-[#161616] ${
          isSm ? "size-[18px]" : "size-[22px]"
        }`}
        style={{ borderColor: `${color}99`, color }}
        aria-label={t("ui.more_info")}
      >
        {icone ?? (
          <Info
            className={isSm ? "size-[14px]" : "size-4"}
            strokeWidth={2.5}
            aria-hidden
          />
        )}
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
                ref={popupRef}
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
