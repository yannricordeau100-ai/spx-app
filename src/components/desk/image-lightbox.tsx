"use client";

/**
 * Fenetre d agrandissement d une image (onglet « Indicateurs varies - Moyen terme »).
 * Uniquement l image, aucun formulaire. Fermeture par clic sur le fond,
 * par la touche Echap et par la croix en haut a droite.
 */
import { useEffect } from "react";
import { X } from "lucide-react";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", surTouche);
    // On bloque le defilement de la page tant que l agrandissement est ouvert.
    const ancienOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = ancienOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Graphique agrandi"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        title="Fermer"
        aria-label="Fermer"
        className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-zinc-200 hover:bg-white/10 hover:text-white"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        referrerPolicy="no-referrer"
        className="max-h-[90vh] max-w-[90vw] object-contain"
      />
    </div>
  );
}
