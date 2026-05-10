"use client";

/**
 * BrandWordmark — wordmark "Mettrik AI" canonique du projet.
 *
 * Source historique : initialement créé pour la home (`home-view.tsx`).
 * Yann 9 mai 2026 : devient le logo OBLIGATOIRE sur toutes les pages
 * (home, sté, pricing, sandbox, maintenance). Remplace le MettrikWordmark
 * Fraunces qu'on avait posé temporairement sur la page pricing.
 *
 * Caractéristiques :
 *   - Police : Instrument Serif italic 800
 *   - Gradient holographique violet → cyan → rose (#a855f7 → #22d3ee → #f472b6)
 *   - Le « i » a un point pulse violet (signature visuelle)
 *   - Rail iridescent sous le mot + sous-titre "KPI Intelligence"
 *
 * Props :
 *   - size : "sm" pour nav compacte (~22px), "md" intermédiaire, "lg" pour home (clamp 56-110px)
 *   - animated : true pour entrée lettres-par-lettre + pulse (par défaut sur lg).
 *     Sur sm/md la version statique est plus appropriée pour les nav.
 *   - showRail : trace le rail iridescent sous le wordmark
 *   - showSubtitle : "KPI Intelligence" en mono uppercase tracking sous le rail
 */
import { motion } from "motion/react";

type Size = "sm" | "md" | "lg";

const SIZE_FONT: Record<Size, string> = {
  sm: "clamp(20px, 2.4vw, 26px)",
  md: "clamp(36px, 4.5vw, 56px)",
  lg: "clamp(56px, 9vw, 110px)",
};

export function BrandWordmark({
  size = "lg",
  animated,
  showRail = true,
  showSubtitle = false,
  className = "",
}: {
  size?: Size;
  animated?: boolean;
  showRail?: boolean;
  showSubtitle?: boolean;
  className?: string;
}) {
  const isAnimated = animated ?? size === "lg";
  const letters = "Mettrik AI".split("");
  const fontSize = SIZE_FONT[size];

  const Letter = isAnimated ? motion.span : "span";

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="relative inline-flex items-baseline leading-none"
        style={{
          fontFamily: "var(--font-instrument), 'Bricolage Grotesque', sans-serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize,
          letterSpacing: "-0.04em",
        }}
      >
        {letters.map((ch, i) => {
          const isI = ch === "i";
          const animationProps = isAnimated
            ? {
                initial: { opacity: 0, y: "30%", filter: "blur(8px)" },
                animate: { opacity: 1, y: 0, filter: "blur(0px)" },
                transition: { duration: 0.7, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
              }
            : {};
          return (
            <Letter
              key={i}
              {...animationProps}
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
                  {/* Trait du i (sans le point natif) */}
                  <span aria-hidden className="pointer-events-none absolute inset-0 flex items-end justify-center">
                    <span
                      style={{
                        display: "inline-block",
                        width: "0.12em",
                        height: "0.62em",
                        background: "linear-gradient(180deg, #a855f7 0%, #22d3ee 100%)",
                        borderRadius: "0.06em",
                        transform: "translateY(-0.04em)",
                      }}
                    />
                  </span>
                  {/* Point pulse violet */}
                  {isAnimated ? (
                    <motion.span
                      aria-hidden
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.06 * i + 0.45, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute"
                      style={{
                        left: "50%",
                        top: "0.05em",
                        width: "0.18em",
                        height: "0.18em",
                        borderRadius: "50%",
                        background: "#a855f7",
                        transform: "translateX(-50%)",
                        boxShadow: "0 0 12px #a855f7, 0 0 24px #a855f7aa, 0 0 36px #a855f755",
                      }}
                    >
                      <motion.span
                        animate={{ opacity: [1, 0.55, 1], scale: [1, 1.3, 1] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full"
                        style={{ background: "#a855f7" }}
                      />
                    </motion.span>
                  ) : (
                    <span
                      aria-hidden
                      className="absolute"
                      style={{
                        left: "50%",
                        top: "0.05em",
                        width: "0.18em",
                        height: "0.18em",
                        borderRadius: "50%",
                        background: "#a855f7",
                        transform: "translateX(-50%)",
                        boxShadow: "0 0 8px #a855f7aa, 0 0 16px #a855f755",
                      }}
                    />
                  )}
                </>
              ) : (
                ch
              )}
            </Letter>
          );
        })}
      </div>

      {showRail && (
        <div
          className={size === "sm" ? "mt-1.5 h-[1px] w-[min(82%,160px)]" : size === "md" ? "mt-2.5 h-[1.5px] w-[min(70%,360px)]" : "mt-4 h-[2px] w-[min(82%,520px)]"}
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #a855f7 25%, #22d3ee 55%, #f472b6 85%, transparent 100%)",
            boxShadow: "0 0 12px rgba(168,85,247,0.4), 0 0 24px rgba(34,211,238,0.25)",
            borderRadius: "9999px",
          }}
        />
      )}

      {showSubtitle && (
        <div
          className={`font-mono font-semibold uppercase text-zinc-300 ${
            size === "sm" ? "mt-1 text-[8.5px]" : size === "md" ? "mt-2 text-[10.5px]" : "mt-3 text-[11px] sm:text-[13px]"
          }`}
          style={{ letterSpacing: "0.42em" }}
        >
          KPI Intelligence
        </div>
      )}
    </div>
  );
}
