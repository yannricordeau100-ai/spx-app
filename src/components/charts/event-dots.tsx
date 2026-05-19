"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { CompanyEvent } from "@/lib/events";

/**
 * Petits points de curiosité posés sur l'axe X d'un graph.
 *
 * Refonte Yann 17 mai 2026 :
 *  - Un SEUL point par année (peu importe le nombre d'events de cette
 *    année). Position du point = entre l'année N et l'année N+1 sur
 *    l'axe X (= au DROITE du dernier label de l'année).
 *  - Le popover liste TOUS les events de l'année (titre + body, séparés
 *    par mois si disponible).
 *  - Filtre strict : un event n'apparaît QUE si son année est plotted
 *    dans l'axe X courant (pas de dot hors zone, pas de dot sur TTM).
 *  - Couleur accent + halo pulse léger.
 */

/** Parse "T1 24" / "T1 2024" → { quarter, year } */
function parseQuarterLabel(label: string): { quarter: number; year: number } | null {
  const m = label.match(/^T([1-4])\s+(\d{2,4})$/);
  if (!m) return null;
  const q = parseInt(m[1], 10);
  let y = parseInt(m[2], 10);
  if (y < 100) y += 2000; // "24" → 2024
  return { quarter: q, year: y };
}

/** Parse "S1 24" / "S2 24" → { semester, year } */
function parseSemesterLabel(label: string): { semester: number; year: number } | null {
  const m = label.match(/^S([12])\s+(\d{2,4})$/);
  if (!m) return null;
  const s = parseInt(m[1], 10);
  let y = parseInt(m[2], 10);
  if (y < 100) y += 2000;
  return { semester: s, year: y };
}

/** Parse "2024" annual label → year. */
function parseAnnualLabel(label: string): number | null {
  const m = label.match(/^(\d{4})$/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Pour un set de xLabels donné (annuel, semestriel ou trimestriel),
 * retourne pour chaque année plotted la POSITION en idx fractionnaire
 * où afficher le dot d'event (= entre cette année et la suivante).
 *
 * Règle : idx = idx du DERNIER label appartenant à cette année + 0.5.
 * Si c'est la dernière année plotted (pas de "suivante"), idx = lastLabelIdx
 * (sans le +0.5 pour ne pas dépasser le bord droit du chart).
 */
function yearToFractionalIdx(xLabels: string[]): Map<number, number> {
  // Yann 17 mai 2026 — règle EXPLICITE confirmée par Yann :
  // L'event dot d'une année X apparait ENTRE le label année X et X+1.
  // = position fractionnaire `lastIdxOfYear + 0.5` (à droite du dernier
  //   data point de l'année X, juste avant le premier data point de X+1).
  //
  // Trimestriel : year 2023 (T1-T4 aux idx 8-11) → pos = 11.5 (entre T4 2023
  // et T1 2024 = entre label "2023" et "2024").
  // Annuel : year 2023 (idx 2 unique dans [2021..2026]) → pos = 2.5 (entre
  // data point 2023 et 2024).
  //
  // Cas particulier : si l'année est la DERNIÈRE plottée, on cap à
  // lastIdxAllowed (sinon le dot sortirait du chart).
  const firstQ = parseQuarterLabel(xLabels[0] ?? "");
  const firstS = parseSemesterLabel(xLabels[0] ?? "");
  const yearLastIdx = new Map<number, number>();

  if (firstQ) {
    xLabels.forEach((l, idx) => {
      const p = parseQuarterLabel(l);
      if (p) yearLastIdx.set(p.year, idx);
    });
  } else if (firstS) {
    xLabels.forEach((l, idx) => {
      const p = parseSemesterLabel(l);
      if (p) yearLastIdx.set(p.year, idx);
    });
  } else {
    xLabels.forEach((l, idx) => {
      const y = parseAnnualLabel(l);
      if (y != null) yearLastIdx.set(y, idx);
    });
  }

  // Ne pas mapper sur TTM (label synthétique).
  const lastIdx = xLabels.length - 1;
  const lastLabel = xLabels[lastIdx] ?? "";
  const lastIdxAllowed = /^TTM$/i.test(lastLabel) ? lastIdx - 1 : lastIdx;

  const out = new Map<number, number>();
  for (const [year, idx] of yearLastIdx.entries()) {
    if (idx > lastIdxAllowed) continue;
    const pos = idx + 0.5;
    out.set(year, Math.min(pos, lastIdxAllowed));
  }
  return out;
}

/**
 * Groupe les events par année et associe chacun à une position
 * fractionnaire sur l'axe X (entre année N et N+1).
 */
function groupEventsByYear(
  events: CompanyEvent[],
  xLabels: string[]
): Array<{ year: number; x: number; events: CompanyEvent[] }> {
  const yearIdx = yearToFractionalIdx(xLabels);
  const byYear = new Map<number, CompanyEvent[]>();
  for (const e of events) {
    if (!yearIdx.has(e.year)) continue; // hors zone plotted
    if (!byYear.has(e.year)) byYear.set(e.year, []);
    byYear.get(e.year)!.push(e);
  }
  return [...byYear.entries()]
    .map(([year, evs]) => ({
      year,
      x: yearIdx.get(year)!,
      // Tri par mois (events sans mois en dernier)
      events: evs.sort((a, b) => (a.month ?? 99) - (b.month ?? 99)),
    }))
    .sort((a, b) => a.year - b.year);
}

const MONTH_FR = [
  "", "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Convertit une position fractionnaire idx (ex 2.5 = entre label idx=2 et 3)
 * en coordonnée X dans le viewBox du chart parent.
 *
 * Yann 17 mai 2026 : 2 modes pour aligner les dots SOUS le centre du label
 * année / quarter selon le type de chart parent.
 *  - "step" (curve charts) : data points à `padLeft + i * innerW/(N-1)`.
 *  - "slot" (bars charts)  : barres centrées à
 *      `padLeft + slot*i + slot/2 + slotOffsetX` avec slot = innerW/N.
 *      slotOffsetX = DX/2 pour bars 3D, 0 pour bars 2D.
 *
 * Sans cette distinction, les EventDots étaient calés sur "step" tandis que
 * les barres / labels année utilisaient "slot" → décalage visible à droite
 * sous le label année en mode bars.
 */
function fractionalIdxToX(
  pos: number,
  padLeft: number,
  innerW: number,
  N: number,
  xMode: "step" | "slot",
  slotOffsetX: number
): number {
  if (xMode === "slot") {
    const slot = innerW / Math.max(N, 1);
    return padLeft + slot * pos + slot / 2 + slotOffsetX;
  }
  // step (curve) : N points, écart = innerW / (N-1)
  const stepX = innerW / Math.max(N - 1, 1);
  return padLeft + pos * stepX;
}

/**
 * SVG fragment : dots groupés par année (1 cercle par année, peu importe
 * le nombre d'events). Inclure dans le <svg> parent juste avant fermeture.
 *
 * Note : le popover HTML est rendu par EventDotsOverlay (en sibling du svg).
 * EventDotsSVG ne dessine que les cercles (interaction = via overlay).
 *
 * Yann 17 mai 2026 : nouveaux props xMode + slotOffsetX pour ALIGNER les
 * dots avec les centres de barres/labels selon le type de chart parent.
 * Default = "step" (compat curve charts).
 */
export function EventDotsSVG({
  events,
  xLabels,
  padLeft,
  innerW,
  padTop,
  innerH,
  color = "#a78bfa",
  xMode = "step",
  slotOffsetX = 0,
  dotYOffset = 0,
}: {
  events: CompanyEvent[];
  xLabels: string[];
  padLeft: number;
  innerW: number;
  padTop: number;
  innerH: number;
  color?: string;
  /** "step" pour curve charts, "slot" pour bars charts. Default "step". */
  xMode?: "step" | "slot";
  /** Offset horizontal additionnel (= DX/2 pour bars 3D). Ignoré si xMode="step". */
  slotOffsetX?: number;
  /**
   * Offset vertical additionnel pour positionner le dot SOUS le texte de
   * l'année (Yann 19 mai 2026, demandé "plein de fois"). Default 0 (dot
   * sur l'axe X). Passer ~22-28 pour le placer sous le label année.
   */
  dotYOffset?: number;
}) {
  if (!events.length || xLabels.length < 2) return null;
  const dotY = padTop + innerH + dotYOffset;
  const groups = groupEventsByYear(events, xLabels);
  if (groups.length === 0) return null;

  return (
    <g>
      {groups.map(({ year, x }) => {
        const cx = fractionalIdxToX(x, padLeft, innerW, xLabels.length, xMode, slotOffsetX);
        return (
          <g key={year} style={{ pointerEvents: "none" }}>
            {/* Halo pulse */}
            <circle
              cx={cx}
              cy={dotY}
              r={5}
              fill={color}
              opacity={0.18}
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
              cx={cx}
              cy={dotY}
              r={3.5}
              fill={color}
              stroke="#fff"
              strokeWidth={1}
              opacity={0.85}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Wrapper HTML qui rend les popovers d'événements en absolute par-dessus
 * le SVG. Un seul popover par année qui liste tous les events de cette
 * année (mois + titre + body).
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
  xMode = "step",
  slotOffsetX = 0,
  dotYOffset = 0,
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
  /** Cf EventDotsSVG : "slot" pour bars, "step" pour curve. Default "step". */
  xMode?: "step" | "slot";
  /** Offset horizontal additionnel (= DX/2 pour bars 3D). Ignoré si xMode="step". */
  slotOffsetX?: number;
  /** Cf EventDotsSVG.dotYOffset : positionne le hit-target sous le label année. */
  dotYOffset?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!events.length || xLabels.length < 2) return null;
  const dotY = padTop + innerH + dotYOffset;
  const groups = groupEventsByYear(events, xLabels);
  if (groups.length === 0) return null;

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        {groups.map(({ year, x, events: evs }) => {
          const isOpen = open === year;
          const pxX = fractionalIdxToX(x, padLeft, innerW, xLabels.length, xMode, slotOffsetX);
          const leftPct = (pxX / svgW) * 100;
          const topPct = (dotY / svgH) * 100;
          return (
            <div
              key={year}
              className="absolute"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : year)}
                aria-label={`Événements ${year} (${evs.length})`}
                className="pointer-events-auto relative inline-flex size-5 items-center justify-center rounded-full bg-transparent transition-transform hover:scale-110"
              />
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 2, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="pointer-events-auto absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border bg-[#0a0a0e]/95 p-3 text-left shadow-2xl backdrop-blur"
                    style={{ borderColor: `${color}55` }}
                  >
                    {/* Header année */}
                    <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-2">
                      <div
                        className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color }}
                      >
                        Événements {year}
                        {evs.length > 1 && (
                          <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {evs.length}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                        aria-label="Fermer"
                      >
                        ×
                      </button>
                    </div>
                    {/* Liste des events de l'année */}
                    <div className="mt-2 max-h-72 space-y-2.5 overflow-y-auto">
                      {evs.map((e, i) => (
                        <div
                          key={i}
                          className={
                            i > 0
                              ? "border-t border-white/[0.05] pt-2"
                              : ""
                          }
                        >
                          {e.month != null && e.month >= 1 && e.month <= 12 && (
                            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                              {MONTH_FR[e.month]}
                            </div>
                          )}
                          <div className="text-[13px] font-semibold leading-snug text-zinc-50">
                            {e.title}
                          </div>
                          <div className="mt-1 text-[12px] leading-relaxed text-zinc-300">
                            {e.body}
                          </div>
                        </div>
                      ))}
                    </div>
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
