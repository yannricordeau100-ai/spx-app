"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  type CompanyEvent,
  eventFractionalIndex,
} from "@/lib/events";

/**
 * Petits points de curiosité posés sur l'axe X d'un graph (entre 2
 * années en fonction de la date de l'événement). Cliquer sur un point
 * révèle un mini-popover avec le titre et le body de l'événement.
 *
 * Règles :
 *   - Le point n'altère JAMAIS le tracé du graph (overlay au-dessus, en
 *     pointer-events sur le point uniquement).
 *   - Couleur accent (violet par défaut) avec ring blanc subtil pour
 *     rester lisible sur fond clair ou sombre.
 *   - Pulse léger pour signaler l'interactivité.
 *   - Position calculée via eventFractionalIndex : si la date est connue
 *     au mois près, place entre 2 années ; sinon, à la moitié de l'année.
 *
 * Utilisation :
 *   <EventDots events={...} xLabels={...} padLeft={96} padRight={50}
 *              padTop={40} innerW={...} innerH={...} svgW={920} svgH={420}
 *              color="#a78bfa" />
 *
 * Le composant retourne un fragment SVG (à inclure dans le <svg> parent
 * juste avant le closing tag, pour qu'il soit au-dessus de tout le reste).
 */
export function EventDotsSVG({
  events,
  xLabels,
  padLeft,
  innerW,
  padTop,
  innerH,
  color = "#a78bfa",
}: {
  events: CompanyEvent[];
  xLabels: string[];
  padLeft: number;
  innerW: number;
  padTop: number;
  innerH: number;
  color?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!events.length || xLabels.length < 2) return null;
  const stepX = innerW / (xLabels.length - 1);
  // Yann (12 mai 2026) : les "i" sur l'axe du temps (pas en dessous).
  const dotY = padTop + innerH;

  const positioned = events
    .map((e, i) => {
      const idx = eventFractionalIndex(e, xLabels);
      if (idx == null) return null;
      return {
        i,
        e,
        x: padLeft + idx * stepX,
      };
    })
    .filter((p): p is { i: number; e: CompanyEvent; x: number } => p !== null)
    // Spread horizontal si plusieurs events proches (même année / même
    // mois) : on les étale côte à côte avec offset 14px max.
    .sort((a, b) => a.x - b.x);
  const SPREAD = 18;
  for (let i = 1; i < positioned.length; i++) {
    const prev = positioned[i - 1];
    const cur = positioned[i];
    if (cur.x - prev.x < SPREAD) {
      cur.x = prev.x + SPREAD;
    }
  }

  return (
    <g>
      {positioned.map(({ i, e, x }) => {
        const isOpen = open === i;
        return (
          <g
            key={i}
            onClick={(ev) => {
              ev.stopPropagation();
              setOpen(isOpen ? null : i);
            }}
            style={{ cursor: "pointer" }}
          >
            {/* Halo pulse */}
            <circle
              cx={x}
              cy={dotY}
              r={isOpen ? 9 : 5}
              fill={color}
              opacity={isOpen ? 0.25 : 0.18}
            >
              <animate
                attributeName="r"
                values="4;6;4"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Point central */}
            <circle
              cx={x}
              cy={dotY}
              r={3.5}
              fill={color}
              stroke="#fff"
              strokeWidth={1}
              opacity={isOpen ? 1 : 0.85}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Wrapper HTML qui rend les popovers d'événements en absolute par-dessus
 * le SVG (impossible de mettre du HTML interactif dans un SVG sans
 * <foreignObject>, qu'on évite pour la compat). Utilisé conjointement
 * avec EventDotsSVG : le SVG dessine les points, ce wrapper gère le
 * popover au clic.
 */
export function EventDotsOverlay({
  events,
  xLabels,
  svgW,
  svgH,
  padLeft,
  innerW,
  padTop,
  innerH,
  color = "#a78bfa",
}: {
  events: CompanyEvent[];
  xLabels: string[];
  svgW: number;
  svgH: number;
  padLeft: number;
  innerW: number;
  padTop: number;
  innerH: number;
  color?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!events.length || xLabels.length < 2) return null;

  const stepX = innerW / (xLabels.length - 1);
  const dotY = padTop + innerH;

  // Positions en pixels SVG d'abord (pour appliquer spread), puis en %
  const pxPositioned = events
    .map((e, i) => {
      const idx = eventFractionalIndex(e, xLabels);
      if (idx == null) return null;
      return { i, e, x: padLeft + idx * stepX };
    })
    .filter((p): p is { i: number; e: CompanyEvent; x: number } => p !== null)
    .sort((a, b) => a.x - b.x);
  const SPREAD = 18;
  for (let i = 1; i < pxPositioned.length; i++) {
    if (pxPositioned[i].x - pxPositioned[i - 1].x < SPREAD) {
      pxPositioned[i].x = pxPositioned[i - 1].x + SPREAD;
    }
  }
  const positioned = pxPositioned.map((p) => ({
    i: p.i,
    e: p.e,
    leftPct: (p.x / svgW) * 100,
    topPct: (dotY / svgH) * 100,
  }));

  return (
    <>
      {/* Overlay clic : intercepte les clics sur les points (en plus du
          SVG, pour mobile / tactile). Aussi fournit la zone d'ouverture. */}
      <div className="pointer-events-none absolute inset-0">
        {positioned.map(({ i, e, leftPct, topPct }) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-label={`Événement : ${e.title}`}
                className="pointer-events-auto relative inline-flex size-5 items-center justify-center rounded-full bg-transparent transition-transform hover:scale-110"
              />
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 2, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="pointer-events-auto absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border bg-[#0a0a0e]/95 p-3 text-left shadow-2xl backdrop-blur"
                    style={{ borderColor: `${color}55` }}
                  >
                    <div
                      className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color }}
                    >
                      {e.year}
                      {e.month != null && (
                        <span className="ml-1 text-zinc-400">
                          · {String(e.month).padStart(2, "0")}/{e.year}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[13.5px] font-semibold text-zinc-50">
                      {e.title}
                    </div>
                    <div className="mt-1.5 text-[12px] leading-relaxed text-zinc-300">
                      {e.body}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                      aria-label="Fermer"
                    >
                      ×
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
}
