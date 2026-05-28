"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  LOCALE_META,
  LOCALE_FAMILIES_ORDER,
  LOCALE_FAMILY_LABEL,
  LOCALES_BY_FAMILY,
  type Locale,
  type LocaleFamily,
} from "@/lib/i18n/types";
import { useT } from "@/lib/i18n/provider";
import { getDisabledLocaleSet } from "@/lib/disabled-locales";

/**
 * LanguageDropdown : drapeau + nom de la langue active, click ouvre la
 * liste des 6 langues dispos avec drapeau + nom dans la langue native.
 *
 * Regroupement par famille linguistique (Yann 17 mai 2026 nuit) :
 *   - English   : EN-US + EN-GB
 *   - Romance   : FR
 *   - Germanique: DE + DE-CH + NL (NL cousine germanique occidentale)
 *   - Scandinave: SV + DA
 *
 * Toutes les langues sont TOUJOURS visibles (Yann le 6 mai 2026).
 * Les langues non couvertes par la page courante sont grisées + pastille
 * "partiel". Cliquer sur une langue grisée fonctionne quand même.
 *
 * Position type : top-right de la nav, inline avec ThemeToggle / AuthNav.
 */
/**
 * Yann 29 mai 2026 — Phase 1 V1 FR-only : on masque entièrement le picker
 * de langue. Le composant `LanguageDropdown` retourne `null`. Le composant
 * d'origine est renommé `LanguageDropdownLegacy` (jamais monté) afin de
 * conserver l'arbre + les hooks pour une réactivation V2 multi-locale.
 */
export function LanguageDropdown(_props: { availableLocales?: readonly Locale[] }) {
  return null;
}

function LanguageDropdownLegacy({
  availableLocales,
}: {
  /** Locales pleinement traduites pour la page courante. Si non passé,
   *  toutes les locales sont considérées dispos (= aucune grisée). */
  availableLocales?: readonly Locale[];
}) {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
  // Yann 26 mai 2026 : locales masquées via /sandbox/v1-8/languages-toggle.
  // Les dictionnaires i18n restent intacts ; seule l'option disparaît du picker.
  const disabledLocales = getDisabledLocaleSet();

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
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 min-w-[244px] overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#0d0d12] to-[#0a0a0e] shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent"
            />
            <ul role="listbox" className="py-1.5">
              {LOCALE_FAMILIES_ORDER.map((family, familyIdx) => {
                const raw = LOCALES_BY_FAMILY[family];
                if (!raw || raw.length === 0) return null;
                // Filtre les locales explicitement désactivées (ex NL).
                // L'active reste toujours visible même si désactivée
                // (sécurité : éviter un dropdown vide ou un état illisible).
                const locales = raw.filter((loc) => loc === locale || !disabledLocales.has(loc));
                if (locales.length === 0) return null;
                return (
                  <FamilyGroup
                    key={family}
                    family={family}
                    locales={locales}
                    activeLocale={locale}
                    availableSet={availableSet}
                    onPick={(loc) => {
                      setOpen(false);
                      setLocale(loc);
                    }}
                    showDivider={familyIdx > 0}
                    delay={familyIdx * 0.04}
                  />
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FamilyGroup({
  family,
  locales,
  activeLocale,
  availableSet,
  onPick,
  showDivider,
  delay,
}: {
  family: LocaleFamily;
  locales: Locale[];
  activeLocale: Locale;
  availableSet: Set<Locale> | null;
  onPick: (loc: Locale) => void;
  showDivider: boolean;
  delay: number;
}) {
  const label = LOCALE_FAMILY_LABEL[family];
  const accent = FAMILY_ACCENT[family];

  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay }}
      className="list-none"
    >
      {showDivider && (
        <div aria-hidden className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      )}
      <div className="flex items-center gap-2 px-3 pt-1.5 pb-1">
        <span aria-hidden className={`h-[6px] w-[6px] rounded-full ${accent.dot}`} />
        <span className={`text-[9px] font-mono uppercase tracking-[0.16em] ${accent.text}`}>
          {label}
        </span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-gradient-to-r from-white/[0.04] to-transparent" />
      </div>
      <ul role="group" aria-label={label}>
        {locales.map((loc) => {
          const meta = LOCALE_META[loc];
          const isActive = activeLocale === loc;
          const isAvailable = availableSet ? availableSet.has(loc) : true;
          return (
            <li key={loc}>
              <button
                onClick={() => onPick(loc)}
                role="option"
                aria-selected={isActive}
                title={
                  isAvailable
                    ? meta.nativeName
                    : `${meta.nativeName} : traduction partielle (fallback EN sur les zones non traduites)`
                }
                className={`group/lang flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-all ${
                  isActive
                    ? `${accent.bgActive} ${accent.textActive}`
                    : isAvailable
                      ? "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100"
                      : "text-zinc-500 italic hover:bg-white/[0.025] hover:text-zinc-400"
                }`}
              >
                <span
                  className={`text-[16px] leading-none transition-transform group-hover/lang:scale-110 ${isAvailable ? "" : "opacity-50"}`}
                  aria-hidden
                >
                  {meta.flag}
                </span>
                <span className="flex-1">{meta.nativeName}</span>
                {!isAvailable && !isActive && (
                  <span className="rounded-sm border border-white/10 bg-white/[0.03] px-1 py-px font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                    partiel
                  </span>
                )}
                {isActive && <Check className={`size-3.5 ${accent.check}`} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </motion.li>
  );
}

/**
 * Couleur d'accent par famille linguistique. Chaque famille a sa propre
 * teinte subtile pour l'identifier sans surcharger l'UI (palette dark).
 */
const FAMILY_ACCENT: Record<LocaleFamily, {
  dot: string;
  text: string;
  bgActive: string;
  textActive: string;
  check: string;
}> = {
  english: {
    dot: "bg-sky-400/80 shadow-[0_0_6px_rgba(56,189,248,0.5)]",
    text: "text-sky-300/70",
    bgActive: "bg-sky-500/12",
    textActive: "text-sky-100",
    check: "text-sky-300",
  },
  romance: {
    dot: "bg-rose-400/80 shadow-[0_0_6px_rgba(251,113,133,0.5)]",
    text: "text-rose-300/70",
    bgActive: "bg-rose-500/12",
    textActive: "text-rose-100",
    check: "text-rose-300",
  },
  germanic: {
    dot: "bg-violet-400/80 shadow-[0_0_6px_rgba(167,139,250,0.5)]",
    text: "text-violet-300/70",
    bgActive: "bg-violet-500/15",
    textActive: "text-violet-100",
    check: "text-violet-300",
  },
};
