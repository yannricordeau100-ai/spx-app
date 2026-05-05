"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/types";
import { useT } from "@/lib/i18n/provider";

/**
 * LanguageDropdown : drapeau + nom de la langue active, click ouvre la
 * liste des 8 langues dispos avec drapeau + nom dans la langue native.
 *
 * Toutes les langues sont TOUJOURS visibles (Yann le 6 mai 2026).
 * Les langues non couvertes par la page courante sont grisées + pastille
 * "partiel". Cliquer sur une langue grisée fonctionne quand même (= switch
 * + fallback EN sur les clés manquantes), pour que l'user puisse explorer.
 *
 * Position type : top-right de la nav, inline avec ThemeToggle / AuthNav.
 */
export function LanguageDropdown({
  availableLocales,
}: {
  /** Locales pleinement traduites pour la page courante. Si non passé,
   *  toutes les locales sont considérées dispos (= aucune grisée). */
  availableLocales?: readonly Locale[];
}) {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside pour fermer
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const activeMeta = LOCALE_META[locale];
  const availableSet = availableLocales ? new Set(availableLocales) : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[12px] text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={activeMeta.nativeName}
      >
        <span className="text-[14px] leading-none" aria-hidden>{activeMeta.flag}</span>
        <span className="hidden sm:inline">{activeMeta.nativeName}</span>
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            className="absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-lg border border-white/15 bg-[#0c0c10] shadow-2xl"
          >
            {LOCALES.map((loc) => {
              const meta = LOCALE_META[loc];
              const isActive = locale === loc;
              const isAvailable = availableSet ? availableSet.has(loc) : true;
              return (
                <li key={loc}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setLocale(loc as Locale);
                    }}
                    role="option"
                    aria-selected={isActive}
                    title={
                      isAvailable
                        ? meta.nativeName
                        : `${meta.nativeName} : traduction partielle (fallback EN sur les zones non traduites)`
                    }
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors ${
                      isActive
                        ? "bg-violet-500/15 text-violet-100"
                        : isAvailable
                          ? "text-zinc-300 hover:bg-white/[0.04]"
                          : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-400"
                    }`}
                  >
                    <span
                      className={`text-[16px] leading-none ${isAvailable ? "" : "opacity-50"}`}
                      aria-hidden
                    >
                      {meta.flag}
                    </span>
                    <span className={`flex-1 ${isAvailable ? "" : "italic"}`}>{meta.nativeName}</span>
                    {!isAvailable && !isActive && (
                      <span className="rounded-sm border border-white/10 bg-white/[0.03] px-1 py-px font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                        partiel
                      </span>
                    )}
                    {isActive && <Check className="size-3.5 text-violet-300" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
