"use client";

import { motion } from "motion/react";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/types";
import { useT } from "@/lib/i18n/provider";
import { usePickerVisible } from "@/lib/i18n/lang-picker-visibility";

/**
 * Rangée discrète de drapeaux : montre les 6 langues disponibles.
 * À placer dans le footer ou en zone secondaire. Click = switch + reload.
 *
 * Design : très petit (size-4), opacity 50% par défaut, full opacity au hover.
 * Drapeau actif = ring violet pour signaler la langue courante.
 */
export function LocaleFlagsRow({ align = "center" }: { align?: "left" | "center" | "right" }) {
  const visible = usePickerVisible();
  const { locale, setLocale } = useT();
  if (!visible) return null;
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
            whileHover={{ scale: 1.18 }}
            whileTap={{ scale: 0.95 }}
            className={`relative inline-flex size-7 items-center justify-center rounded-full border text-[15px] leading-none transition-all ${
              isActive
                ? "border-violet-400/70 bg-white shadow-[0_0_8px_rgba(167,139,250,0.4)] dark:bg-zinc-900"
                : "border-zinc-300/60 bg-white/80 hover:scale-110 hover:bg-white dark:border-zinc-700/60 dark:bg-zinc-900/80 dark:hover:bg-zinc-900"
            }`}
            aria-label={meta.nativeName}
            aria-pressed={isActive}
          >
            <span aria-hidden style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}>{meta.flag}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
