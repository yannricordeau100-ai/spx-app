"use client";

import { motion } from "motion/react";

/**
 * MettrikWordmark — wordmark Mettrik AI réutilisable, dérivé du BrandWordmark
 * de la home (`src/components/home-view.tsx`).
 *
 * Caractéristiques signature Mettrik :
 *  - Fraunces 800 italic
 *  - Gradient holographique violet → cyan → magenta
 *  - Point du i = pulse-dot violet (signature)
 *  - Lettres animées au mount (entrée par-dessus + blur fade)
 *  - Rail iridescent traçé de gauche à droite
 *
 * Tailles disponibles :
 *  - sm = ~22px (top-nav pages internes)
 *  - md = ~36px (mid-page)
 *  - lg = ~56-110px (home / maintenance / hero)
 *
 * Cf. la home garde son implémentation interne pour ne pas casser le
 * périmètre CONV-BRAND. Une factorisation propre suivra quand validée.
 */

type Size = "sm" | "md" | "lg";

const SIZE_FONT: Record<Size, string> = {
  sm: "clamp(22px, 3vw, 28px)",
  md: "clamp(36px, 5vw, 48px)",
  lg: "clamp(56px, 9vw, 110px)",
};

const SIZE_RAIL: Record<Size, { mt: string; w: string }> = {
  sm: { mt: "mt-1.5", w: "min(60%, 220px)" },
  md: { mt: "mt-2.5", w: "min(70%, 360px)" },
  lg: { mt: "mt-4", w: "min(82%, 520px)" },
};

export function MettrikWordmark({
  size = "lg",
  showRail = true,
}: {
  size?: Size;
  showRail?: boolean;
}) {
  const letters = "Mettrik AI".split("");
  const fontSize = SIZE_FONT[size];
  const rail = SIZE_RAIL[size];

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative inline-flex items-baseline leading-none"
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize,
          letterSpacing: "-0.04em",
        }}
      >
        {letters.map((ch, i) => {
          const isI = ch === "i";
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: "30%", filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.7,
                delay: 0.06 * i,
                ease: [0.22, 1, 0.36, 1],
              }}
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
                  <span aria-hidden style={{ visibility: "hidden" }}>
                    i
                  </span>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-end justify-center"
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "0.12em",
                        height: "0.62em",
                        background:
                          "linear-gradient(180deg, #a855f7 0%, #22d3ee 100%)",
                        borderRadius: "0.06em",
                        transform: "translateY(-0.04em)",
                      }}
                    />
                  </span>
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.06 * i + 0.45,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute"
                    style={{
                      left: "50%",
                      top: "0.05em",
                      width: "0.18em",
                      height: "0.18em",
                      borderRadius: "50%",
                      background: "#a855f7",
                      transform: "translateX(-50%)",
                      boxShadow:
                        "0 0 12px #a855f7, 0 0 24px #a855f7aa, 0 0 36px #a855f755",
                    }}
                  >
                    <motion.span
                      animate={{ opacity: [1, 0.55, 1], scale: [1, 1.3, 1] }}
                      transition={{
                        duration: 2.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-0 rounded-full"
                      style={{ background: "#a855f7" }}
                    />
                  </motion.span>
                </>
              ) : (
                ch
              )}
            </motion.span>
          );
        })}
      </div>

      {showRail && (
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.55, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className={`${rail.mt} h-[2px] origin-left rounded-full`}
          style={{
            width: rail.w,
            background:
              "linear-gradient(90deg, transparent 0%, #a855f7 25%, #22d3ee 55%, #f472b6 85%, transparent 100%)",
            boxShadow:
              "0 0 12px rgba(168,85,247,0.4), 0 0 24px rgba(34,211,238,0.25)",
          }}
        />
      )}
    </div>
  );
}
