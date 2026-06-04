"use client";

import { motion } from "motion/react";
import type { Locale } from "@/lib/i18n/types";
import { LocaleFlagsRow } from "@/components/locale-flags-row";
import { ThemeToggle } from "@/components/theme-toggle";
// BrandWordmark retiré 3 juin 2026 — remplacé par <img> du logo PNG combined.

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
        {/* Yann 4 juin 2026 v2 : REVERT PNG -> animation lettre par lettre.
            Les PNG fournis sont opaques (damier blanc/gris fait partie de
            l'image), donc creent rectangle visible sur fond sombre. */}
        <div className="mb-10">
          <div
            className="relative inline-flex items-baseline leading-none"
            style={{
              fontFamily: "var(--font-instrument), 'Bricolage Grotesque', sans-serif",
              fontWeight: 800,
              fontStyle: "italic",
              fontSize: "clamp(48px, 9vw, 96px)",
              letterSpacing: "-0.04em",
            }}
          >
            {"Mettrik AI".split("").map((ch, i) => {
              const isI = ch === "i";
              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: "30%", filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.7, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
                  className="relative inline-block"
                  style={{
                    background:
                      "linear-gradient(135deg, #ffffff 0%, #d8d8e4 30%, #a855f7 55%, #22d3ee 78%, #f472b6 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    color: "transparent",
                  }}
                >
                  {isI ? (
                    <>
                      <span aria-hidden style={{ visibility: "hidden" }}>i</span>
                      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-end justify-center">
                        <span style={{ display: "inline-block", width: "0.12em", height: "0.62em", background: "linear-gradient(180deg, #a855f7 0%, #22d3ee 100%)", borderRadius: "0.06em", transform: "translateY(-0.04em)" }} />
                      </span>
                      <motion.span aria-hidden initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.06 * i + 0.45, duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="absolute" style={{ left: "50%", top: "0.05em", width: "0.18em", height: "0.18em", borderRadius: "50%", background: "#a855f7", transform: "translateX(-50%)", boxShadow: "0 0 12px #a855f7, 0 0 24px #a855f7aa, 0 0 36px #a855f755" }}>
                        <motion.span animate={{ opacity: [1, 0.55, 1], scale: [1, 1.3, 1] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-full" style={{ background: "#a855f7" }} />
                      </motion.span>
                    </>
                  ) : (
                    ch
                  )}
                </motion.span>
              );
            })}
          </div>
          {/* Rail iridescent conservé sous le logo */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-4 h-[2px] w-[min(82%,480px)] origin-left rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, #a855f7 25%, #22d3ee 55%, #f472b6 85%, transparent 100%)",
              boxShadow:
                "0 0 12px rgba(168,85,247,0.4), 0 0 24px rgba(34,211,238,0.25)",
            }}
          />
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
