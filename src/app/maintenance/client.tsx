"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Locale } from "@/lib/i18n/types";

type Strings = {
  headline: string;
  subhead: string;
  body: string;
  notifyLabel: string;
  notifyPlaceholder: string;
  notifySubmit: string;
  notifySuccess: string;
  etaIntro: string;
  funCaption: string;
};

/**
 * MaintenanceClient : page fun (animations + ton léger) qui contrebalance
 * la frustration de l'user. Pas d'austérité.
 *
 * Animations :
 *   - Constellation flottante en fond (étoiles cyan/violet pulsantes)
 *   - Wordmark "Mettrik AI" qui respire (scale + opacity)
 *   - 3 outils flottants ("clé", "engrenage", "marteau") qui tournent doucement
 *   - Bouton CTA "Me prévenir" avec scale au hover
 *   - Switcher de langue FR/EN visible en haut à droite
 */
export function MaintenanceClient({
  locale,
  etaText,
  strings,
}: {
  locale: Locale;
  etaText: string;
  strings: Strings;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const otherLocaleHref = locale === "fr" ? "/maintenance" : "/fr/maintenance";
  const otherLocaleLabel = locale === "fr" ? "EN" : "FR";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    // Volontaire : pas de POST, pas de stockage côté serveur. Just UX.
    // (Si tu veux, on branchera Resend ou Supabase plus tard.)
    setSubmitted(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#050507] via-[#0a0612] to-[#070512] text-zinc-100">
      {/* Étoiles flottantes */}
      <BackgroundStars />

      {/* Halos colorés */}
      <div
        className="pointer-events-none absolute -left-32 top-32 size-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-32 size-96 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)" }}
      />

      {/* Switcher langue en haut à droite */}
      <div className="absolute right-5 top-5 z-10">
        <a
          href={otherLocaleHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-zinc-300 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-zinc-100"
        >
          {otherLocaleLabel}
        </a>
      </div>

      {/* Wordmark en haut à gauche */}
      <div className="absolute left-5 top-5 z-10">
        <span className="font-display text-[20px] font-bold tracking-tight text-zinc-100">
          Mettrik <span className="text-violet-300">AI</span>
        </span>
      </div>

      {/* Contenu central */}
      <main className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
        {/* Outils animés */}
        <FloatingTools />

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-12 font-display text-[36px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[48px]"
        >
          {strings.headline}
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="mt-4 max-w-md text-[15px] text-zinc-300"
        >
          {strings.subhead}
        </motion.p>

        {/* Body fun */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="mt-3 max-w-md text-[13px] leading-relaxed text-zinc-400"
        >
          {strings.body}
        </motion.p>

        {/* ETA pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[12px] text-violet-200"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-violet-400" />
          <span>
            {strings.etaIntro}
            <strong className="font-semibold text-violet-100">{etaText}</strong>
          </span>
        </motion.div>

        {/* Form notify */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: "easeOut" }}
          className="mt-10 w-full max-w-md"
        >
          {!submitted ? (
            <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={strings.notifyPlaceholder}
                aria-label={strings.notifyLabel}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[14px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-violet-400/50 focus:bg-white/[0.05]"
              />
              <button
                type="submit"
                className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-5 py-2.5 text-[14px] font-medium text-violet-100 transition-all hover:scale-[1.02] hover:bg-violet-500/25"
              >
                {strings.notifySubmit}
              </button>
            </form>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-200">
              ✓ {strings.notifySuccess}
            </div>
          )}
        </motion.div>

        {/* Caption fun en bas */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-12 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500"
        >
          {strings.funCaption}
        </motion.p>
      </main>
    </div>
  );
}

/* ============================================================ */
/* FloatingTools : 3 emojis outils qui flottent et tournent       */
/* ============================================================ */
function FloatingTools() {
  const tools = ["🔧", "⚙️", "🛠️"];
  return (
    <div className="relative flex items-center justify-center gap-8">
      {tools.map((emoji, i) => (
        <motion.span
          key={emoji}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: [0, -8, 0],
            rotate: i === 1 ? [0, 360] : [0, 8, -8, 0],
          }}
          transition={{
            opacity: { duration: 0.6, delay: i * 0.15 },
            y: { duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 },
            rotate: i === 1
              ? { duration: 8, repeat: Infinity, ease: "linear" }
              : { duration: 4 + i, repeat: Infinity, ease: "easeInOut" },
          }}
          className="text-[44px] sm:text-[56px]"
          aria-hidden
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
}

/* ============================================================ */
/* BackgroundStars : 30 petites étoiles animées en background    */
/* ============================================================ */
function BackgroundStars() {
  // Positions et delays figés (pas de Math.random côté SSR pour éviter
  // l'hydration mismatch).
  const stars = Array.from({ length: 30 }).map((_, i) => ({
    x: ((i * 37) % 100),
    y: ((i * 53) % 100),
    size: 1 + (i % 3),
    delay: (i % 7) * 0.3,
    duration: 2 + (i % 4),
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
