"use client";

import { motion } from "motion/react";
import type { Locale } from "@/lib/i18n/types";
import { LocaleFlagsRow } from "@/components/locale-flags-row";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandWordmark } from "@/components/brand-wordmark";

type Strings = {
  headline: string;
  subhead: string;
  caption: string;
};

/**
 * MaintenanceClient : teaser pré-lancement.
 * Aucune action utilisateur sur le contenu (pas de form, pas d'ETA).
 * Mais on conserve les 2 contrôles globaux du site :
 *  - 8 drapeaux langues (LocaleFlagsRow) : reflète le réglage user.
 *  - Toggle thème clair/sombre (ThemeToggle) : reflète le réglage user
 *    (localStorage `mettrik:theme` + user_metadata.theme Supabase).
 */
export function MaintenanceClient({
  locale: _locale,
  strings,
}: {
  locale: Locale;
  strings: Strings;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#050507] via-[#0a0612] to-[#070512] text-zinc-100">
      <BackgroundStars />

      {/* Halos colorés très lents */}
      <motion.div
        className="pointer-events-none absolute -left-32 top-32 size-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.4, 0.3] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-24 bottom-32 size-96 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)" }}
        animate={{ scale: [1.05, 1, 1.05], opacity: [0.25, 0.35, 0.25] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Contrôles globaux : top-right (theme + langues) */}
      <div className="absolute right-5 top-5 z-10 flex items-center gap-3">
        <ThemeToggle />
      </div>

      {/* Contenu central */}
      <main className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
        {/* Wordmark Mettrik AI : repris du composant home (BrandWordmark)
            via le composant réutilisable MettrikWordmark — Fraunces 800
            italic, gradient holographique, pulse-dot intégré au i, rail
            iridescent. Yann le 7 mai 2026. */}
        <div className="mb-10">
          {/* Wordmark identique à /sandbox/v1-7 (BrandWordmark home) avec
              sous-titre "KPI Intelligence" + rail iridescent. Yann 8 mai 2026. */}
          <BrandWordmark size="lg" showSubtitle showRail />
        </div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="mt-10 font-display text-[36px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[52px]"
        >
          {strings.headline}
        </motion.h1>

        {/* Subhead teaser */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="mt-5 max-w-md text-[16px] leading-relaxed text-zinc-300"
        >
          {strings.subhead}
        </motion.p>

        {/* Caption fun en bas */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-16 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500"
        >
          {strings.caption}
        </motion.p>

        {/* Drapeaux 6 langues, en bas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-8"
        >
          <LocaleFlagsRow align="center" />
        </motion.div>
      </main>
    </div>
  );
}

/* ============================================================ */
/* BackgroundStars : 30 petites étoiles animées en background    */
/* ============================================================ */
function BackgroundStars() {
  const stars = Array.from({ length: 30 }).map((_, i) => ({
    x: ((i * 37) % 100),
    y: ((i * 53) % 100),
    size: 1 + (i % 3),
    delay: (i % 7) * 0.3,
    duration: 3 + (i % 4),
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            delay: s.delay,
            ease: "easeInOut",
          }}
          className="absolute rounded-full bg-violet-300"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            filter: "blur(0.5px)",
          }}
        />
      ))}
    </div>
  );
}
