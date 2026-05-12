/**
 * Concept page : 3 propositions de "hint scroll/swipe" pour le rectangle
 * RotatingPunchline sur la home. Yann choisit la variante préférée.
 *
 * URL locale : http://localhost:3000/concepts/punchline-hint
 *
 * Variantes :
 *   A — Chevron animé en gradient violet→cyan (variante par défaut posée
 *       en home, mais ici juxtaposée pour comparaison)
 *   B — Roue de souris + "swipe" texte mini en mono uppercase
 *   C — Petit point de progression circulaire (orbital) + flèche fine
 */
"use client";

import { useState } from "react";
import { motion } from "motion/react";

const PUNCHLINES = [
  "Combien de KPIs Mettrik traque pour Apple ? | Plus de 150, mis à jour à chaque earning.",
  "Le marché monte. Ça veut dire quoi pour mon portefeuille ? | Ça dépend des moteurs. Mettrik te les nomme.",
  "Pourquoi NVIDIA dépasse les analystes ? | Réponse : Data Center +154 % YoY. Voilà la métrique.",
  "Quel est le KPI qui prédit le mieux Netflix ? | DAP cross-apps. On l'a depuis 2014.",
];

type Variant = "A" | "B" | "C";

function PunchlineFrame({ variant }: { variant: Variant }) {
  const [idx, setIdx] = useState(0);
  const advance = () => setIdx((i) => (i + 1) % PUNCHLINES.length);
  const raw = PUNCHLINES[idx] ?? "";
  const [part1, part2] = raw.split(" | ");

  return (
    <div className="mx-auto max-w-xl" style={{ perspective: "1200px" }}>
      <div
        className="relative w-full"
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: "center bottom",
          transform: "rotateX(6deg)",
        }}
      >
        {/* Halo */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-2xl opacity-60 blur-2xl"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 50%, rgba(139, 92, 246, 0.35) 0%, rgba(34, 211, 238, 0.18) 45%, transparent 75%)",
          }}
        />
        {/* Ombres 3D */}
        <span aria-hidden className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-xl border border-white/15 bg-[#06060a]/40" />
        <span aria-hidden className="absolute inset-0 translate-x-[6px] translate-y-[6px] rounded-xl border border-white/8 bg-[#04040a]/30" />
        <span aria-hidden className="absolute inset-0 translate-x-[9px] translate-y-[9px] rounded-xl border border-white/5 bg-[#020208]/20" />
        {/* Cadre */}
        <div
          className="relative z-10 flex min-h-[170px] items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-[#0a0a0e]/85 px-5 py-4 pr-14 backdrop-blur-sm"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 18px 40px -12px rgba(139, 92, 246, 0.35), 0 8px 18px -6px rgba(0,0,0,0.6)",
          }}
        >
          <div className="w-full text-center">
            <p className="text-balance font-display text-[18px] italic leading-[1.4] text-zinc-300/80">{part1}</p>
            {part2 && (
              <p className="mt-2 text-balance font-display text-[20px] font-semibold italic leading-[1.35]">
                <span className="mr-2 inline-block align-middle text-cyan-300/80">↳</span>
                <span
                  className="bg-gradient-to-r from-violet-200 via-violet-100 to-cyan-200 bg-clip-text text-transparent"
                  style={{ WebkitBackgroundClip: "text", backgroundClip: "text" }}
                >
                  {part2}
                </span>
              </p>
            )}
          </div>

          {/* HINT — variante */}
          {variant === "A" && (
            <button
              type="button"
              onClick={advance}
              aria-label="Suivant"
              className="absolute inset-y-0 right-0 flex items-center justify-center px-4"
              style={{
                background:
                  "linear-gradient(270deg, rgba(139, 92, 246, 0.18) 0%, rgba(34, 211, 238, 0.08) 60%, transparent 100%)",
              }}
            >
              <motion.span
                animate={{ x: [0, 5, 0], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                style={{ filter: "drop-shadow(0 0 6px rgba(168,85,247,0.6))" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="cv-a" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <path d="M9 6l6 6-6 6" stroke="url(#cv-a)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.span>
            </button>
          )}

          {variant === "B" && (
            <button
              type="button"
              onClick={advance}
              aria-label="Suivant"
              className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1.5 px-3"
              style={{
                background:
                  "linear-gradient(270deg, rgba(139, 92, 246, 0.15) 0%, transparent 100%)",
              }}
            >
              {/* Roue souris stylisée */}
              <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
                <rect x="1" y="1" width="14" height="22" rx="7" stroke="#a78bfa" strokeWidth="1.4" fill="none" />
                <motion.rect
                  x="6.5"
                  y="5"
                  width="3"
                  height="5"
                  rx="1.5"
                  fill="url(#cv-b-grad)"
                  animate={{ y: [5, 11, 5], opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
                <defs>
                  <linearGradient id="cv-b-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.2em] text-violet-300/90">swipe</span>
            </button>
          )}

          {variant === "C" && (
            <button
              type="button"
              onClick={advance}
              aria-label="Suivant"
              className="absolute inset-y-0 right-0 flex items-center justify-center px-4"
            >
              {/* Orbite + flèche */}
              <div className="relative h-9 w-9">
                <motion.span
                  className="absolute inset-0 rounded-full border-2"
                  style={{
                    borderColor: "rgba(168,85,247,0.45)",
                    borderTopColor: "rgba(34,211,238,0.9)",
                    borderRightColor: "rgba(244,114,182,0.7)",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke="#e4e4e7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PunchlineHintConcepts() {
  return (
    <div className="min-h-screen bg-[#06060a] py-16 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6">
        <h1 className="text-center font-display text-3xl font-semibold">
          Punchline hint — 3 propositions
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Auto-rotation 10 s. Clic ou swipe gauche pour avancer manuellement.
        </p>

        <div className="mt-12 grid gap-16">
          <section>
            <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.3em] text-violet-300">
              Variante A · Chevron gradient
            </h2>
            <PunchlineFrame variant="A" />
          </section>

          <section>
            <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.3em] text-violet-300">
              Variante B · Roue de souris + swipe
            </h2>
            <PunchlineFrame variant="B" />
          </section>

          <section>
            <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.3em] text-violet-300">
              Variante C · Orbite iridescente
            </h2>
            <PunchlineFrame variant="C" />
          </section>
        </div>

        <p className="mt-12 text-center text-xs text-zinc-500">
          Variante actuellement posée sur la home : <strong className="text-violet-300">A</strong>.
        </p>
      </div>
    </div>
  );
}
