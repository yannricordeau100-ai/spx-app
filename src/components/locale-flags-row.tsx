"use client";

import { motion } from "motion/react";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/types";
import { useT } from "@/lib/i18n/provider";

/**
 * Rangée discrète de drapeaux : montre les 8 langues disponibles.
 * À placer dans le footer ou en zone secondaire. Click = switch + reload.
 *
 * Design : très petit (size-4), opacity 50% par défaut, full opacity au hover.
 * Drapeau actif = ring violet pour signaler la langue courante.
 */
export function LocaleFlagsRow({ align = "center" }: { align?: "left" | "center" | "right" }) {
  const { locale, setLocale } = useT();
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${
        align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"
      }`}
      aria-label="Choisir la langue"
    >
      {LOCALES.map((loc) => {
        const meta = LOCALE_META[loc];
        const isActive = locale === loc;
        return (
          <motion.button
            key={loc}
            onClick={() => setLocale(loc as Locale)}
            title={meta.nativeName}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            className={`relative inline-flex size-5 items-center justify-center rounded-full text-[14px] leading-none transition-all ${
              isActive ? "opacity-100 ring-1 ring-violet-400/60" : "opacity-50 hover:opacity-100"
            }`}
            aria-label={meta.nativeName}
            aria-pressed={isActive}
          >
            <span aria-hidden>{meta.flag}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
