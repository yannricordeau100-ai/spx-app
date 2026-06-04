"use client";

/**
 * Wordmark variants registry — Logo Lab.
 *
 * 25 propositions visuelles de wordmark "Mettrik AI". Chaque variante est un
 * composant React isolé, prêt à être appliqué partout dans l'app via la
 * sélection `src/data/active-wordmark.json`.
 *
 * Toutes les variantes acceptent la même API :
 *   - size : "sm" | "md" | "lg" (tailles standardisées comme BrandWordmark)
 *   - animated? : booléen (entrée animée + pulse sur les variantes kinetic)
 *   - showRail? : trace un rail iridescent sous le wordmark
 *   - showSubtitle? : "KPI Intelligence" en mono uppercase
 *   - className? : pour le wrapper externe
 *
 * Une variante peut ignorer animated / showRail / showSubtitle si elle a sa
 * propre signature visuelle (ex : monogramme MK, glyph orbit). Mais elle DOIT
 * accepter ces props pour ne pas casser les callers.
 *
 * Police par défaut : --font-instrument (Bricolage Grotesque). Variantes
 * spécifiques utilisent --font-fraunces (serif italic), --font-jetbrains
 * (mono), --font-sans-app (Manrope) ou --font-sora.
 */

import { motion } from "motion/react";
import type { CSSProperties, FC } from "react";

export type WordmarkSize = "sm" | "md" | "lg";

export type WordmarkVariantProps = {
  size?: WordmarkSize;
  animated?: boolean;
  showRail?: boolean;
  showSubtitle?: boolean;
  className?: string;
};

const SIZE_FONT: Record<WordmarkSize, string> = {
  sm: "clamp(20px, 2.4vw, 26px)",
  md: "clamp(36px, 4.5vw, 56px)",
  lg: "clamp(56px, 9vw, 110px)",
};

const SIZE_RAIL_PX: Record<WordmarkSize, { mt: string; maxW: number }> = {
  sm: { mt: "mt-1.5", maxW: 160 },
  md: { mt: "mt-2.5", maxW: 360 },
  lg: { mt: "mt-4", maxW: 520 },
};

const BRAND = "Mettrik AI";

// ────────────────────────────────────────────────────────────────────────────
// Composants partagés utilitaires
// ────────────────────────────────────────────────────────────────────────────

function Rail({
  size = "lg",
  gradient,
  glow,
}: {
  size?: WordmarkSize;
  gradient: string;
  glow?: string;
}) {
  const cfg = SIZE_RAIL_PX[size];
  return (
    <div
      className={`${cfg.mt} h-[2px] rounded-full`}
      style={{
        width: `min(82%, ${cfg.maxW}px)`,
        background: gradient,
        boxShadow: glow ?? "0 0 12px rgba(168,85,247,0.4)",
      }}
    />
  );
}

function Subtitle({ size = "lg", color = "#d4d4d8" }: { size?: WordmarkSize; color?: string }) {
  const cls =
    size === "sm"
      ? "mt-1 text-[8.5px]"
      : size === "md"
      ? "mt-2 text-[10.5px]"
      : "mt-3 text-[11px] sm:text-[13px]";
  return (
    <div
      className={`font-mono font-semibold uppercase ${cls}`}
      style={{ letterSpacing: "0.42em", color }}
    >
      KPI Intelligence
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// V1.1 — Holographic Bricolage (référence actuelle, défaut)
// ────────────────────────────────────────────────────────────────────────────

const V1_1: FC<WordmarkVariantProps> = ({
  size = "lg",
  animated,
  showRail = true,
  showSubtitle = false,
  className = "",
}) => {
  const isAnimated = animated ?? size === "lg";
  const letters = BRAND.split("");
  const Letter = isAnimated ? motion.span : "span";
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="relative inline-flex items-baseline leading-none"
        style={{
          fontFamily: "var(--font-instrument), 'Bricolage Grotesque', sans-serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: SIZE_FONT[size],
          letterSpacing: "-0.04em",
        }}
      >
        {letters.map((ch, i) => {
          const isI = ch === "i";
          const animProps = isAnimated
            ? {
                initial: { opacity: 0, y: "30%", filter: "blur(8px)" },
                animate: { opacity: 1, y: 0, filter: "blur(0px)" },
                transition: {
                  duration: 0.7,
                  delay: 0.06 * i,
                  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
                },
              }
            : {};
          return (
            <Letter
              key={i}
              {...animProps}
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
                        background: "linear-gradient(180deg, #a855f7 0%, #22d3ee 100%)",
                        borderRadius: "0.06em",
                        transform: "translateY(-0.04em)",
                      }}
                    />
                  </span>
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
                </>
              ) : (
                ch
              )}
            </Letter>
          );
        })}
      </div>
      {showRail && (
        <Rail
          size={size}
          gradient="linear-gradient(90deg, transparent 0%, #a855f7 25%, #22d3ee 55%, #f472b6 85%, transparent 100%)"
          glow="0 0 12px rgba(168,85,247,0.4), 0 0 24px rgba(34,211,238,0.25)"
        />
      )}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V1.2 — Fraunces Holographic (le legacy MettrikWordmark)
// ────────────────────────────────────────────────────────────────────────────

const V1_2: FC<WordmarkVariantProps> = ({
  size = "lg",
  animated,
  showRail = true,
  showSubtitle = false,
  className = "",
}) => {
  const isAnimated = animated ?? size === "lg";
  const letters = BRAND.split("");
  const Letter = isAnimated ? motion.span : "span";
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="relative inline-flex items-baseline leading-none"
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: SIZE_FONT[size],
          letterSpacing: "-0.04em",
        }}
      >
        {letters.map((ch, i) => {
          const isI = ch === "i";
          const animProps = isAnimated
            ? {
                initial: { opacity: 0, y: "30%", filter: "blur(8px)" },
                animate: { opacity: 1, y: 0, filter: "blur(0px)" },
                transition: { duration: 0.7, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
              }
            : {};
          return (
            <Letter
              key={i}
              {...animProps}
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
                </>
              ) : (
                ch
              )}
            </Letter>
          );
        })}
      </div>
      {showRail && (
        <Rail
          size={size}
          gradient="linear-gradient(90deg, transparent 0%, #a855f7 25%, #22d3ee 55%, #f472b6 85%, transparent 100%)"
          glow="0 0 12px rgba(168,85,247,0.4)"
        />
      )}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V2 — Mono ultra-condensed (JetBrains Mono uppercase, brutal)
// ────────────────────────────────────────────────────────────────────────────

const V2: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-jetbrains), monospace",
        fontWeight: 800,
        fontSize: SIZE_FONT[size],
        letterSpacing: "0.02em",
        color: "transparent",
        background:
          "linear-gradient(90deg, #f4f4f5 0%, #f4f4f5 60%, #a855f7 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textTransform: "uppercase",
      }}
    >
      METTRIK<span style={{ color: "#a855f7", WebkitTextFillColor: "#a855f7" }}>.</span>AI
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V3 — Sora ultralight + chrome (élégant, fintech haut de gamme)
// ────────────────────────────────────────────────────────────────────────────

const V3: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-sora), 'Bricolage Grotesque', sans-serif",
        fontWeight: 200,
        fontSize: SIZE_FONT[size],
        letterSpacing: "-0.02em",
        color: "transparent",
        background:
          "linear-gradient(180deg, #ffffff 0%, #e4e4e7 45%, #a1a1aa 60%, #ffffff 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      Mettrik <span style={{ fontWeight: 700 }}>AI</span>
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #e4e4e7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V4 — Neon glow (cyan signature, rétro futurist)
// ────────────────────────────────────────────────────────────────────────────

const V4: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-instrument), 'Bricolage Grotesque', sans-serif",
        fontWeight: 700,
        fontSize: SIZE_FONT[size],
        letterSpacing: "-0.02em",
        color: "#22d3ee",
        textShadow:
          "0 0 4px #22d3ee, 0 0 14px #22d3ee, 0 0 28px rgba(34,211,238,0.55), 0 0 60px rgba(34,211,238,0.35)",
      }}
    >
      Mettrik AI
    </div>
    {showRail && (
      <Rail
        size={size}
        gradient="linear-gradient(90deg, transparent, #22d3ee 50%, transparent)"
        glow="0 0 14px #22d3ee, 0 0 28px rgba(34,211,238,0.4)"
      />
    )}
    {showSubtitle && <Subtitle size={size} color="#a5f3fc" />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V5 — Glyph orbit (point pulse en orbite autour du "i")
// ────────────────────────────────────────────────────────────────────────────

const V5: FC<WordmarkVariantProps> = ({
  size = "lg",
  animated,
  showRail = true,
  showSubtitle = false,
  className = "",
}) => {
  const isAnimated = animated ?? true;
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="relative leading-none"
        style={{
          fontFamily: "var(--font-instrument), sans-serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: SIZE_FONT[size],
          letterSpacing: "-0.03em",
          color: "#f4f4f5",
        }}
      >
        <span style={{ position: "relative", display: "inline-block" }}>
          Mettrik
          {isAnimated && (
            <motion.span
              aria-hidden
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: "0.18em",
                height: "0.18em",
                borderRadius: "50%",
                background: "#a855f7",
                boxShadow: "0 0 10px #a855f7, 0 0 20px #a855f7aa",
                transformOrigin: "0 0",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "1.2em",
                  top: "-0.1em",
                  display: "block",
                  width: "0.18em",
                  height: "0.18em",
                  borderRadius: "50%",
                  background: "inherit",
                  boxShadow: "inherit",
                }}
              />
            </motion.span>
          )}
        </span>{" "}
        <span style={{ color: "#a855f7" }}>AI</span>
      </div>
      {showRail && (
        <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />
      )}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V6 — Monogramme MK (carré gradient + lettres superposées)
// ────────────────────────────────────────────────────────────────────────────

const V6: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => {
  const px = size === "sm" ? 28 : size === "md" ? 56 : 110;
  const radius = px * 0.18;
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <div
          style={{
            width: px,
            height: px,
            borderRadius: radius,
            background:
              "conic-gradient(from 135deg, #a855f7, #22d3ee, #f472b6, #a855f7)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 24px rgba(168,85,247,0.35)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-instrument), sans-serif",
              fontWeight: 800,
              fontStyle: "italic",
              fontSize: px * 0.5,
              color: "#0a0a0a",
              letterSpacing: "-0.06em",
            }}
          >
            MK
          </span>
        </div>
        <div
          className="leading-none"
          style={{
            fontFamily: "var(--font-instrument), sans-serif",
            fontWeight: 700,
            fontSize: SIZE_FONT[size],
            color: "#f4f4f5",
            letterSpacing: "-0.03em",
          }}
        >
          Mettrik <span style={{ color: "#a855f7" }}>AI</span>
        </div>
      </div>
      {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V7 — Pulse equalizer ("i" remplacé par 3 barres équaliseur)
// ────────────────────────────────────────────────────────────────────────────

const V7: FC<WordmarkVariantProps> = ({
  size = "lg",
  animated,
  showRail = true,
  showSubtitle = false,
  className = "",
}) => {
  const isAnimated = animated ?? true;
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="relative inline-flex items-baseline leading-none"
        style={{
          fontFamily: "var(--font-instrument), sans-serif",
          fontWeight: 800,
          fontSize: SIZE_FONT[size],
          color: "#f4f4f5",
          letterSpacing: "-0.03em",
        }}
      >
        Mettr
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "flex-end",
            gap: "0.04em",
            height: "0.8em",
            marginRight: "0.04em",
            verticalAlign: "baseline",
          }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              style={{
                display: "inline-block",
                width: "0.1em",
                height: "0.5em",
                background: "linear-gradient(180deg, #a855f7, #22d3ee)",
                borderRadius: "0.05em",
              }}
              animate={isAnimated ? { scaleY: [0.5, 1, 0.7, 1, 0.5] } : { scaleY: 1 }}
              transition={
                isAnimated
                  ? { duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }
                  : undefined
              }
            />
          ))}
        </span>
        k <span style={{ color: "#a855f7" }}>AI</span>
      </div>
      {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, #22d3ee 80%, transparent)" />}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V8 — Holographic shift (gradient animé qui balaye)
// ────────────────────────────────────────────────────────────────────────────

const V8: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <motion.div
      className="leading-none"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 800,
        fontStyle: "italic",
        fontSize: SIZE_FONT[size],
        letterSpacing: "-0.04em",
        background:
          "linear-gradient(110deg, #a855f7 0%, #22d3ee 20%, #f472b6 40%, #a855f7 60%, #22d3ee 80%, #f472b6 100%)",
        backgroundSize: "300% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }}
      animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
    >
      Mettrik AI
    </motion.div>
    {showRail && (
      <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7, #22d3ee, #f472b6, transparent)" />
    )}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V9 — Underline scribble (trait au crayon sous "AI")
// ────────────────────────────────────────────────────────────────────────────

const V9: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 700,
        fontSize: SIZE_FONT[size],
        color: "#f4f4f5",
        letterSpacing: "-0.03em",
      }}
    >
      Mettrik{" "}
      <span style={{ position: "relative", display: "inline-block" }}>
        AI
        <svg
          aria-hidden
          viewBox="0 0 60 12"
          style={{
            position: "absolute",
            left: 0,
            bottom: "-0.18em",
            width: "100%",
            height: "0.22em",
            overflow: "visible",
          }}
        >
          <path
            d="M2 6 Q 15 1, 30 6 T 58 6"
            fill="none"
            stroke="#a855f7"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>
      </span>
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V10 — Glassmorphism block (texte sur card avec backdrop blur)
// ────────────────────────────────────────────────────────────────────────────

const V10: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => {
  const pad = size === "sm" ? "px-3 py-1.5" : size === "md" ? "px-5 py-2.5" : "px-8 py-4";
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className={`${pad} rounded-2xl border border-white/10`}
        style={{
          background:
            "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(34,211,238,0.1) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 4px 24px rgba(168,85,247,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-instrument), sans-serif",
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: SIZE_FONT[size],
            color: "#f4f4f5",
            letterSpacing: "-0.03em",
          }}
        >
          Mettrik <span style={{ color: "#a855f7" }}>AI</span>
        </span>
      </div>
      {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V11 — Stacked compact (logo carré "M" + "Mettrik AI" empilé)
// ────────────────────────────────────────────────────────────────────────────

const V11: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => {
  const px = size === "sm" ? 24 : size === "md" ? 44 : 72;
  return (
    <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      <div
        style={{
          width: px,
          height: px,
          borderRadius: px * 0.22,
          background: "linear-gradient(135deg, #a855f7, #22d3ee)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 24px rgba(168,85,247,0.4)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-fraunces), serif",
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: px * 0.55,
            color: "#0a0a0a",
            lineHeight: 1,
          }}
        >
          M
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument), sans-serif",
          fontWeight: 700,
          fontSize: size === "sm" ? 11 : size === "md" ? 16 : 22,
          color: "#f4f4f5",
          letterSpacing: "0.02em",
        }}
      >
        Mettrik AI
      </div>
      {showSubtitle && <Subtitle size={size} />}
      {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V12 — Italic chrome stripes (lettres avec rayures horizontales)
// ────────────────────────────────────────────────────────────────────────────

const V12: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 900,
        fontStyle: "italic",
        fontSize: SIZE_FONT[size],
        letterSpacing: "-0.04em",
        background:
          "repeating-linear-gradient(180deg, #ffffff 0px, #ffffff 3px, #a855f7 3px, #a855f7 5px, #ffffff 5px, #ffffff 8px, #22d3ee 8px, #22d3ee 10px)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }}
    >
      Mettrik AI
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #ffffff 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V13 — Outline + fill (lettres outline avec "AI" rempli)
// ────────────────────────────────────────────────────────────────────────────

const V13: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 800,
        fontSize: SIZE_FONT[size],
        letterSpacing: "-0.03em",
      }}
    >
      <span
        style={{
          color: "transparent",
          WebkitTextStroke: "1.5px #f4f4f5",
        }}
      >
        Mettrik
      </span>{" "}
      <span
        style={{
          background: "linear-gradient(135deg, #a855f7, #22d3ee)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }}
      >
        AI
      </span>
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V14 — Data dots (point i remplacé par mini bar-chart)
// ────────────────────────────────────────────────────────────────────────────

const V14: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="relative inline-flex items-baseline leading-none"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 800,
        fontStyle: "italic",
        fontSize: SIZE_FONT[size],
        color: "#f4f4f5",
        letterSpacing: "-0.03em",
      }}
    >
      Mettrik{" "}
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: "0.03em", marginLeft: "0.02em" }}>
        <span style={{ display: "inline-block", width: "0.12em", height: "0.25em", background: "#a855f7", borderRadius: "0.04em" }} />
        <span style={{ display: "inline-block", width: "0.12em", height: "0.45em", background: "#22d3ee", borderRadius: "0.04em" }} />
        <span style={{ display: "inline-block", width: "0.12em", height: "0.65em", background: "#f472b6", borderRadius: "0.04em" }} />
      </span>
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 30%, #22d3ee 60%, #f472b6 90%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V15 — Drop cap "M" (premier M très large, reste fin)
// ────────────────────────────────────────────────────────────────────────────

const V15: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => {
  const baseFs = size === "sm" ? 22 : size === "md" ? 42 : 80;
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="inline-flex items-baseline leading-none"
        style={{
          fontFamily: "var(--font-fraunces), serif",
          color: "#f4f4f5",
          letterSpacing: "-0.04em",
        }}
      >
        <span
          style={{
            fontSize: baseFs * 1.6,
            fontWeight: 900,
            fontStyle: "italic",
            background: "linear-gradient(135deg, #a855f7, #22d3ee)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          M
        </span>
        <span style={{ fontSize: baseFs, fontWeight: 300, fontStyle: "italic" }}>ettrik AI</span>
      </div>
      {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V16 — Tag / bracketed [Mettrik AI]
// ────────────────────────────────────────────────────────────────────────────

const V16: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-jetbrains), monospace",
        fontWeight: 700,
        fontSize: SIZE_FONT[size],
        color: "#f4f4f5",
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ color: "#a855f7" }}>[</span>Mettrik<span style={{ color: "#22d3ee" }}> · </span>AI<span style={{ color: "#a855f7" }}>]</span>
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V17 — Embossed (effet relief, lumière haut gauche)
// ────────────────────────────────────────────────────────────────────────────

const V17: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 900,
        fontStyle: "italic",
        fontSize: SIZE_FONT[size],
        color: "#27272a",
        letterSpacing: "-0.04em",
        textShadow:
          "-1px -1px 0 rgba(255,255,255,0.15), 1px 1px 0 rgba(0,0,0,0.6), 2px 2px 8px rgba(168,85,247,0.3)",
      }}
    >
      Mettrik AI
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #52525b 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V18 — Aurora soft (gradient diffus, lavender + mint)
// ────────────────────────────────────────────────────────────────────────────

const V18: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 600,
        fontSize: SIZE_FONT[size],
        letterSpacing: "-0.02em",
        background:
          "linear-gradient(120deg, #fbcfe8 0%, #c4b5fd 40%, #a5f3fc 70%, #d8b4fe 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }}
    >
      Mettrik AI
    </div>
    {showRail && (
      <Rail
        size={size}
        gradient="linear-gradient(90deg, transparent, #fbcfe8, #c4b5fd, #a5f3fc, transparent)"
        glow="0 0 20px rgba(196,181,253,0.4)"
      />
    )}
    {showSubtitle && <Subtitle size={size} color="#c4b5fd" />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V19 — Vertical (Mettrik vertical + AI horizontal, mode portrait)
// ────────────────────────────────────────────────────────────────────────────

const V19: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => {
  const fs = size === "sm" ? 14 : size === "md" ? 22 : 38;
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="flex items-end gap-2">
        <div
          style={{
            fontFamily: "var(--font-instrument), sans-serif",
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: fs,
            color: "#f4f4f5",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            letterSpacing: "0.1em",
          }}
        >
          Mettrik
        </div>
        <div
          style={{
            fontFamily: "var(--font-instrument), sans-serif",
            fontWeight: 900,
            fontSize: fs * 1.6,
            color: "transparent",
            background: "linear-gradient(135deg, #a855f7, #22d3ee)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1,
          }}
        >
          AI
        </div>
      </div>
      {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V20 — Liquid mercury (silver gradient avec reflets)
// ────────────────────────────────────────────────────────────────────────────

const V20: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-fraunces), serif",
        fontWeight: 700,
        fontStyle: "italic",
        fontSize: SIZE_FONT[size],
        letterSpacing: "-0.03em",
        background:
          "linear-gradient(180deg, #fafafa 0%, #71717a 30%, #d4d4d8 50%, #18181b 70%, #a1a1aa 90%, #fafafa 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }}
    >
      Mettrik AI
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #d4d4d8 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V21 — Constellation (points + lignes derrière le texte)
// ────────────────────────────────────────────────────────────────────────────

const V21: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div className="relative">
      <svg
        aria-hidden
        viewBox="0 0 200 60"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.5,
        }}
      >
        <g stroke="#a855f7" strokeWidth={0.5} fill="#22d3ee">
          <line x1="10" y1="10" x2="40" y2="30" />
          <line x1="40" y1="30" x2="80" y2="15" />
          <line x1="80" y1="15" x2="140" y2="45" />
          <line x1="140" y1="45" x2="180" y2="20" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="40" cy="30" r="1.5" />
          <circle cx="80" cy="15" r="1.5" />
          <circle cx="140" cy="45" r="1.5" />
          <circle cx="180" cy="20" r="1.5" />
        </g>
      </svg>
      <div
        className="relative leading-none"
        style={{
          fontFamily: "var(--font-instrument), sans-serif",
          fontWeight: 700,
          fontSize: SIZE_FONT[size],
          color: "#f4f4f5",
          letterSpacing: "-0.03em",
          padding: "0.1em 0.2em",
        }}
      >
        Mettrik <span style={{ color: "#a855f7" }}>AI</span>
      </div>
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V22 — Slash separator (Mettrik / AI avec gros slash violet)
// ────────────────────────────────────────────────────────────────────────────

const V22: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="inline-flex items-center leading-none"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 800,
        fontStyle: "italic",
        fontSize: SIZE_FONT[size],
        color: "#f4f4f5",
        letterSpacing: "-0.03em",
        gap: "0.2em",
      }}
    >
      <span>Mettrik</span>
      <span
        style={{
          fontWeight: 200,
          fontSize: "1.4em",
          color: "#a855f7",
          lineHeight: 0.8,
          transform: "translateY(-0.05em)",
        }}
      >
        /
      </span>
      <span
        style={{
          background: "linear-gradient(135deg, #a855f7, #22d3ee)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        AI
      </span>
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V23 — Tech badge (background semi-opaque + chip "AI" lumineux)
// ────────────────────────────────────────────────────────────────────────────

const V23: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="inline-flex items-center"
      style={{
        fontFamily: "var(--font-instrument), sans-serif",
        fontWeight: 700,
        fontSize: SIZE_FONT[size],
        color: "#f4f4f5",
        letterSpacing: "-0.02em",
        gap: "0.3em",
      }}
    >
      <span>Mettrik</span>
      <span
        style={{
          display: "inline-block",
          padding: "0.05em 0.4em",
          fontSize: "0.55em",
          fontWeight: 900,
          letterSpacing: "0.1em",
          background: "linear-gradient(135deg, #a855f7, #22d3ee)",
          color: "#0a0a0a",
          borderRadius: "0.4em",
          textTransform: "uppercase",
          verticalAlign: "middle",
          boxShadow: "0 0 12px rgba(168,85,247,0.5)",
        }}
      >
        AI
      </span>
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V24 — Light beam (rayon de lumière qui traverse le texte)
// ────────────────────────────────────────────────────────────────────────────

const V24: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = true,
  showSubtitle = false,
  className = "",
}) => {
  const textStyle: CSSProperties = {
    fontFamily: "var(--font-instrument), sans-serif",
    fontWeight: 800,
    fontStyle: "italic",
    fontSize: SIZE_FONT[size],
    letterSpacing: "-0.04em",
    color: "#f4f4f5",
  };
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative inline-block overflow-hidden">
        <div style={textStyle}>Mettrik AI</div>
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)",
            mixBlendMode: "screen",
          }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
        />
      </div>
      {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// V25 — Pixel grid (texte avec effet pixellisé, grain)
// ────────────────────────────────────────────────────────────────────────────

const V25: FC<WordmarkVariantProps> = ({
  size = "lg",
  showRail = false,
  showSubtitle = false,
  className = "",
}) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div
      className="leading-none"
      style={{
        fontFamily: "var(--font-jetbrains), monospace",
        fontWeight: 800,
        fontSize: SIZE_FONT[size],
        letterSpacing: "0.04em",
        color: "transparent",
        background:
          "radial-gradient(circle at 30% 30%, #a855f7, #22d3ee 60%, #f472b6)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textTransform: "uppercase",
        filter: "contrast(1.1)",
      }}
    >
      Mettr<span style={{ background: "#a855f7", color: "#0a0a0a", WebkitBackgroundClip: "initial", WebkitTextFillColor: "#0a0a0a", padding: "0 0.1em" }}>i</span>k AI
    </div>
    {showRail && <Rail size={size} gradient="linear-gradient(90deg, transparent, #a855f7 50%, transparent)" />}
    {showSubtitle && <Subtitle size={size} />}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// V_PNG2 — PNG transparent canonique (Yann 4 juin 2026)
// Combine visuel coloré gauche + wordmark "Mettrik AI" + dot violet.
// 2 versions selon thème : noir (fond clair) / blanc (fond sombre).
// Active par défaut depuis 4 juin 2026 sur toutes les pages.
// ────────────────────────────────────────────────────────────────────────────

const V_PNG2: FC<WordmarkVariantProps> = ({
  size = "lg",
  showSubtitle = false,
  className = "",
}) => {
  // Tailles cibles harmonisées avec les autres variantes (cf SIZE_FONT).
  // Le PNG natif fait 2048×1024 (ratio 2:1). On garde le ratio en jouant
  // sur la hauteur calée sur la font-size équivalente.
  const heightPx: Record<WordmarkSize, string> = {
    sm: "clamp(24px, 3vw, 32px)",
    md: "clamp(44px, 5.5vw, 68px)",
    lg: "clamp(68px, 11vw, 132px)",
  };
  // Mettrik n'utilise PAS Tailwind dark class : le thème est porté par
  // html[data-theme="light"] (cf globals.css). Par défaut → dark (white
  // wordmark). En thème clair → black wordmark via CSS attribute selector
  // injecté inline (idiomatique React pour 2 <img>).
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <span className="wordmark-png-v2 relative inline-block" style={{ height: heightPx[size] }}>
        <img
          src="/brand/mettrik-ai-white-purple.png"
          alt="Mettrik AI"
          className="wordmark-png-dark block h-full w-auto select-none"
          draggable={false}
        />
        <img
          src="/brand/mettrik-ai-black-purple.png"
          alt=""
          aria-hidden
          className="wordmark-png-light absolute inset-0 hidden h-full w-auto select-none"
          draggable={false}
        />
        <style>{`
          html[data-theme="light"] .wordmark-png-dark { display: none; }
          html[data-theme="light"] .wordmark-png-light { display: block !important; position: static !important; }
        `}</style>
      </span>
      {showSubtitle && <Subtitle size={size} />}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Registry export
// ────────────────────────────────────────────────────────────────────────────

export const WORDMARK_VARIANTS: Record<string, FC<WordmarkVariantProps>> = {
  "logo-mtk-png-v2": V_PNG2,
  "logo-mtk-v1.1": V1_1,
  "logo-mtk-v1.2": V1_2,
  "logo-mtk-v2": V2,
  "logo-mtk-v3": V3,
  "logo-mtk-v4": V4,
  "logo-mtk-v5": V5,
  "logo-mtk-v6": V6,
  "logo-mtk-v7": V7,
  "logo-mtk-v8": V8,
  "logo-mtk-v9": V9,
  "logo-mtk-v10": V10,
  "logo-mtk-v11": V11,
  "logo-mtk-v12": V12,
  "logo-mtk-v13": V13,
  "logo-mtk-v14": V14,
  "logo-mtk-v15": V15,
  "logo-mtk-v16": V16,
  "logo-mtk-v17": V17,
  "logo-mtk-v18": V18,
  "logo-mtk-v19": V19,
  "logo-mtk-v20": V20,
  "logo-mtk-v21": V21,
  "logo-mtk-v22": V22,
  "logo-mtk-v23": V23,
  "logo-mtk-v24": V24,
  "logo-mtk-v25": V25,
};

export type WordmarkVariantMeta = {
  id: string;
  label: string;
  family: string;
};

export const WORDMARK_VARIANT_META: WordmarkVariantMeta[] = [
  { id: "logo-mtk-png-v2", label: "PNG transparent v2 (canonique 4 juin 2026)", family: "PNG" },
  { id: "logo-mtk-v1.1", label: "Holographic Bricolage (référence)", family: "Gradient" },
  { id: "logo-mtk-v1.2", label: "Fraunces holographic italic", family: "Gradient" },
  { id: "logo-mtk-v2", label: "Mono ultra-condensed", family: "Mono / Brutaliste" },
  { id: "logo-mtk-v3", label: "Sora ultralight chrome", family: "Élégant fintech" },
  { id: "logo-mtk-v4", label: "Neon cyan glow", family: "Rétro futurist" },
  { id: "logo-mtk-v5", label: "Glyph orbit (pulse satellite)", family: "Kinetic" },
  { id: "logo-mtk-v6", label: "Monogramme MK", family: "Monogram" },
  { id: "logo-mtk-v7", label: "Pulse equalizer (i remplacé)", family: "Kinetic" },
  { id: "logo-mtk-v8", label: "Holographic shift animé", family: "Kinetic gradient" },
  { id: "logo-mtk-v9", label: "Underline scribble", family: "Hand-drawn" },
  { id: "logo-mtk-v10", label: "Glassmorphism block", family: "Glass / blur" },
  { id: "logo-mtk-v11", label: "Stacked M + Mettrik AI", family: "Monogram" },
  { id: "logo-mtk-v12", label: "Italic chrome stripes", family: "Texture" },
  { id: "logo-mtk-v13", label: "Outline + AI fill", family: "Outline" },
  { id: "logo-mtk-v14", label: "Data dots bar-chart", family: "Glyph integration" },
  { id: "logo-mtk-v15", label: "Drop cap M serif", family: "Editorial" },
  { id: "logo-mtk-v16", label: "Tag [Mettrik · AI]", family: "Mono / Bracketed" },
  { id: "logo-mtk-v17", label: "Embossed relief", family: "3D" },
  { id: "logo-mtk-v18", label: "Aurora soft pastel", family: "Gradient doux" },
  { id: "logo-mtk-v19", label: "Vertical Mettrik + AI", family: "Layout" },
  { id: "logo-mtk-v20", label: "Liquid mercury silver", family: "Texture" },
  { id: "logo-mtk-v21", label: "Constellation network", family: "Glyph integration" },
  { id: "logo-mtk-v22", label: "Slash separator", family: "Typographie" },
  { id: "logo-mtk-v23", label: "AI badge chip", family: "Multi-locale" },
  { id: "logo-mtk-v24", label: "Light beam sweep", family: "Kinetic" },
  { id: "logo-mtk-v25", label: "Pixel highlight i", family: "Mono / Pixel" },
];

export const DEFAULT_WORDMARK_ID = "logo-mtk-v1.1";

export function getWordmarkVariant(id: string): FC<WordmarkVariantProps> {
  return WORDMARK_VARIANTS[id] ?? WORDMARK_VARIANTS[DEFAULT_WORDMARK_ID];
}
