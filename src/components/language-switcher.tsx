"use client";

import { motion } from "motion/react";
import { ArrowLeftRight } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { usePickerVisible } from "@/lib/i18n/lang-picker-visibility";

/**
 * LanguageSwitcher — bouton drapeau FR ↔ US qui bascule la langue
 * de l'app. Posé dans la top-nav (à gauche du bouton « Mon Compte »).
 *
 * UX : le drapeau de la langue ACTIVE est mis en avant (pleine
 * opacité, légère lueur), le drapeau inactif est en demi-teinte.
 * Cliquer sur l'inactif bascule vers cette langue, recharge la page
 * pour que le SSR re-render correctement.
 */
function FRFlag({ className = "" }: { className?: string }) {
  return (
    <svg className={`preserve-colors ${className}`} viewBox="0 0 60 40" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <rect width="20" height="40" fill="#0055A4" />
      <rect x="20" width="20" height="40" fill="#FFFFFF" />
      <rect x="40" width="20" height="40" fill="#EF4135" />
    </svg>
  );
}

function USFlag({ className = "" }: { className?: string }) {
  return (
    <svg className={`preserve-colors ${className}`} viewBox="0 0 60 40" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="#B22234" />
      {/* 7 stripes blanches alternées */}
      {[1, 3, 5].map((i) => (
        <rect key={i} y={(i * 40) / 13} width="60" height={40 / 13} fill="#FFFFFF" />
      ))}
      {[7, 9, 11].map((i) => (
        <rect key={i} y={(i * 40) / 13} width="60" height={40 / 13} fill="#FFFFFF" />
      ))}
      {/* Canton bleu (1ère moitié verticale, 7 stripes top) */}
      <rect width="24" height={(40 * 7) / 13} fill="#3C3B6E" />
      {/* 5 lignes × 6 étoiles + 4 lignes × 5 étoiles, simplifié = grid de points blancs */}
      {Array.from({ length: 9 }).map((_, row) =>
        Array.from({ length: row % 2 === 0 ? 6 : 5 }).map((_, col) => {
          const x = row % 2 === 0 ? 2 + col * 4 : 4 + col * 4;
          const y = 1.5 + row * 2.2;
          return <circle key={`${row}-${col}`} cx={x} cy={y} r={0.7} fill="#FFFFFF" />;
        })
      )}
    </svg>
  );
}

export function LanguageSwitcher() {
  const visible = usePickerVisible();
  const { locale, setLocale, t } = useT();
  if (!visible) return null;
  const onSwitch = (target: Locale) => {
    if (target !== locale) setLocale(target);
  };
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#0a0a0e] p-0.5"
      role="group"
      aria-label={t("lang.switch_label")}
    >
      <button
        type="button"
        onClick={() => onSwitch("fr")}
        aria-label={t("lang.fr_label")}
        title={t("lang.fr_label")}
        className={`relative inline-flex size-7 items-center justify-center overflow-hidden rounded-full transition-all ${
          locale === "fr" ? "" : "opacity-40 hover:opacity-70"
        }`}
        style={
          locale === "fr"
            ? { boxShadow: "0 0 0 1.5px rgba(167,139,250,0.7), 0 0 8px rgba(167,139,250,0.45)" }
            : undefined
        }
      >
        <FRFlag className="size-5" />
        {locale === "fr" && (
          <motion.span
            layoutId="lang-active"
            className="absolute inset-0 rounded-full ring-2 ring-violet-400/40"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
      </button>

      <ArrowLeftRight className="size-3 text-zinc-500" aria-hidden />

      <button
        type="button"
        onClick={() => onSwitch("en")}
        aria-label={t("lang.en_label")}
        title={t("lang.en_label")}
        className={`relative inline-flex size-7 items-center justify-center overflow-hidden rounded-full transition-all ${
          locale === "en" ? "" : "opacity-40 hover:opacity-70"
        }`}
        style={
          locale === "en"
            ? { boxShadow: "0 0 0 1.5px rgba(167,139,250,0.7), 0 0 8px rgba(167,139,250,0.45)" }
            : undefined
        }
      >
        <USFlag className="size-5" />
        {locale === "en" && (
          <motion.span
            layoutId="lang-active"
            className="absolute inset-0 rounded-full ring-2 ring-violet-400/40"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
      </button>
    </div>
  );
}
