"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { Shareholder } from "@/lib/data";

export type PieVariant = "chunky" | "callouts";

/**
 * 3D segmented pie chart with two visual variants :
 *
 *   "chunky"   → image-1 style : heavy depth, vivid saturated rainbow,
 *                exploded slices, cartoonish modern feel.
 *   "callouts" → image-2 style : thin disc + labels with callout lines
 *                pointing to each slice (large %, name).
 *
 * Both variants share : modal wrapper, robust outside-click + Escape close,
 * legend panel on the side. Pure SVG, no CSS preserve-3d, safe for the Mac.
 */

// "Chunky" palette : vivid, slightly cartoonish, distinct on light bg
const CHUNKY_COLORS = [
  "#ef4444", // red
  "#84cc16", // green
  "#facc15", // yellow
  "#3b82f6", // blue
  "#f97316", // orange
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
];

// "Callouts" palette : Mettrik DA, modern saturated tones for dark bg
const CALLOUTS_COLORS = [
  "#14b8a6", // teal
  "#ef4444", // red
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#1e3a8a", // navy
  "#a855f7", // purple
];

const TYPE_LABEL: Record<Shareholder["type"], string> = {
  institutionnel: "Institutionnel",
  particulier: "Particulier",
  insider: "Insider",
  fondateur: "Fondateur",
  "fonds souverain": "Fonds souverain",
};

export function HolographicPie({
  shareholders,
  title,
  open,
  onClose,
  accent = "#a78bfa",
  variant = "chunky",
}: {
  shareholders: Shareholder[];
  title: string;
  open: boolean;
  onClose: () => void;
  accent?: string;
  variant?: PieVariant;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Robust close-on-outside-click + Escape. document-level listeners
  // bypass any motion.div / pointer-events quirks.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Le Flottant n'est PLUS dans le camembert. On affiche uniquement les
  // actionnaires nommés, normalisés pour remplir tout le cercle. Les labels
  // gardent les vrais % (pas les % normalisés). Le total et le flottant sont
  // indiqués hors-camembert dans une note explicite sous le SVG.
  const slices = shareholders;
  const namedTotal = slices.reduce((a, b) => a + b.stake_pct, 0);
  const flottantPct = Math.max(0, 100 - namedTotal);

  const COLORS = variant === "chunky" ? CHUNKY_COLORS : CALLOUTS_COLORS;
  let acc = 0;
  const arcs = slices.map((s, i) => {
    // Normalisation : chaque slice prend son poids relatif au total nommé.
    const displayPct = namedTotal > 0 ? (s.stake_pct / namedTotal) * 100 : 0;
    const startAngle = (acc / 100) * Math.PI * 2 - Math.PI / 2;
    acc += displayPct;
    const endAngle = (acc / 100) * Math.PI * 2 - Math.PI / 2;
    const mid = (startAngle + endAngle) / 2;
    const color = COLORS[i % COLORS.length];
    return { ...s, startAngle, endAngle, mid, color, isReste: false };
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(5,5,8,0.5)", backdropFilter: "blur(2px)" }}
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-4xl rounded-3xl border border-[#2a2a2a] bg-gradient-to-b from-[#0c0c10] to-[#04040a] p-7 shadow-2xl"
            style={{
              boxShadow: `0 30px 100px rgba(0,0,0,0.7), 0 0 60px ${accent}33`,
            }}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-2 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Fermer"
            >
              <X className="size-5" />
            </button>

            <div className="mb-3 flex items-center gap-2">
              <span
                className="size-1.5 animate-pulse-dot rounded-full"
                style={{ background: accent }}
              />
              <span
                className="font-sans text-[12.5px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: accent }}
              >
                {title}
              </span>
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="relative">
                {variant === "chunky" ? (
                  <PieChunky arcs={arcs} hover={hover} setHover={setHover} />
                ) : (
                  <PieCallouts arcs={arcs} hover={hover} setHover={setHover} />
                )}
              </div>

              {/* Legend / details panel */}
              <div className="space-y-2">
                {arcs.map((s, i) => {
                  const isHover = i === hover;
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      className={`rounded-lg border p-3 transition-colors ${
                        isHover
                          ? "border-white/30 bg-white/5"
                          : "border-[#1a1a1a] bg-[#0a0a0a]"
                      }`}
                      style={
                        isHover
                          ? { boxShadow: `0 0 16px ${s.color}55` }
                          : undefined
                      }
                    >
                      {/* Règles universelles légende :
                          (1) Pastille couleur top-aligned avec la 1re ligne
                              du nom (jamais centrée si le nom wrap).
                          (2) Nom + rôle dans une colonne `min-w-0` qui
                              wrap proprement quand long.
                          (3) % strictement à droite, `shrink-0`, insécable
                              (jamais de retour à la ligne `61.0` / `%`).
                          (4) Type-badge sur sa propre ligne sous le nom. */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span
                            className="mt-[5px] size-3 shrink-0 rounded-sm"
                            style={{ background: s.color }}
                          />
                          <div className="min-w-0">
                            <div className="text-[14.5px] font-semibold leading-tight text-zinc-50">
                              {s.name}
                            </div>
                            {s.role && (
                              <div className="mt-0.5 text-[12px] leading-tight text-zinc-400">
                                {s.role}
                              </div>
                            )}
                            <div className="mt-1.5">
                              <span
                                className="rounded-sm px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider"
                                style={{ background: `${s.color}1f`, color: s.color }}
                              >
                                {TYPE_LABEL[s.type]}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 whitespace-nowrap font-mono text-[19px] font-bold leading-tight tabular-nums text-zinc-50">
                          {s.stake_pct.toFixed(1).replace(".", ",")}&nbsp;%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note explicite hors-camembert : total represente + flottant
                non détaillé. Indispensable pour la lecture honnête, puisque
                le pie est désormais normalisé sur les actionnaires nommés. */}
            {/* Footer normalisé : tous les éléments (labels + chiffres) sont
                à la MÊME police, MÊME taille, MÊME tracking. Le chiffre
                garde le tabular-nums et un poids semi-bold pour rester
                lisible mais sans rupture visuelle. Insécable sur le
                « X % ». S'applique à TOUS les pies (1 composant unique). */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-[#1f1f1f] bg-[#080810] px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-300">
                  Top {arcs.length} represente
                </span>
                <span className="whitespace-nowrap font-mono text-[12px] font-semibold uppercase tracking-wider tabular-nums text-zinc-100">
                  {namedTotal.toFixed(1).replace(".", ",")}&nbsp;%
                </span>
                <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-300">
                  du capital total
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-300">
                  Reste du capital (flottant)
                </span>
                <span className="whitespace-nowrap font-mono text-[12px] font-semibold uppercase tracking-wider tabular-nums text-zinc-100">
                  {flottantPct.toFixed(1).replace(".", ",")}&nbsp;%
                </span>
              </div>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
//  Variant A — CHUNKY 3D
//  Heavy cylinder, vivid colors, all slices clearly exploded
//  (matches reference image 1).
// ============================================================

type ArcData = {
  name: string;
  stake_pct: number;
  startAngle: number;
  endAngle: number;
  mid: number;
  color: string;
  isReste: boolean;
};

function PieChunky({
  arcs,
  hover,
  setHover,
}: {
  arcs: ArcData[];
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const cx = 280;
  const cy = 200;
  const rx = 200;
  const ry = 95;          // moderate tilt
  const depth = 90;       // chunky uniform depth
  const baseExplode = 14; // visible spacing on all slices
  const hoverExplode = 22;

  const drawOrder = arcs
    .map((a, i) => ({ a, i }))
    .sort((u, v) => Math.sin(u.a.mid) - Math.sin(v.a.mid));

  function topPath(start: number, end: number, ox: number, oy: number) {
    const x1 = cx + ox + Math.cos(start) * rx;
    const y1 = cy + oy + Math.sin(start) * ry;
    const x2 = cx + ox + Math.cos(end) * rx;
    const y2 = cy + oy + Math.sin(end) * ry;
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${cx + ox} ${cy + oy} L ${x1} ${y1} A ${rx} ${ry} 0 ${large} 1 ${x2} ${y2} Z`;
  }
  function sidePath(start: number, end: number, ox: number, oy: number) {
    const x1 = cx + ox + Math.cos(start) * rx;
    const y1 = cy + oy + Math.sin(start) * ry;
    const x2 = cx + ox + Math.cos(end) * rx;
    const y2 = cy + oy + Math.sin(end) * ry;
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${rx} ${ry} 0 ${large} 1 ${x2} ${y2} L ${x2} ${y2 + depth} A ${rx} ${ry} 0 ${large} 0 ${x1} ${y1 + depth} Z`;
  }
  function frontWallSegment(start: number, end: number) {
    const s = Math.max(start, 0);
    const e = Math.min(end, Math.PI);
    return e > s ? { s, e } : null;
  }

  return (
    <svg viewBox="0 0 560 380" className="w-full">
      <defs>
        {arcs.map((s, i) => (
          <g key={`g-${i}`}>
            <linearGradient id={`pck-side-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id={`pck-top-${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="1" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.85" />
            </linearGradient>
          </g>
        ))}
        <radialGradient id="pck-shadow">
          <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Floor shadow */}
      <ellipse
        cx={cx}
        cy={cy + depth + 18}
        rx={rx + 24}
        ry={ry / 2 + 12}
        fill="url(#pck-shadow)"
      />

      {/* Side walls — front-half only, drawn back-to-front */}
      {drawOrder.map(({ a: s, i }) => {
        const seg = frontWallSegment(s.startAngle, s.endAngle);
        if (!seg) return null;
        const isHover = i === hover;
        const explode = isHover ? baseExplode + hoverExplode : baseExplode;
        const ox = Math.cos(s.mid) * explode;
        const oy = Math.sin(s.mid) * (explode * (ry / rx));
        return (
          <motion.path
            key={`side-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.04 * i }}
            d={sidePath(seg.s, seg.e, ox, oy)}
            fill={`url(#pck-side-${i})`}
            stroke="#000"
            strokeOpacity="0.5"
            strokeWidth="1"
            style={{ transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)" }}
          />
        );
      })}

      {/* Top slices */}
      {drawOrder.map(({ a: s, i }) => {
        const isHover = i === hover;
        const explode = isHover ? baseExplode + hoverExplode : baseExplode;
        const ox = Math.cos(s.mid) * explode;
        const oy = Math.sin(s.mid) * (explode * (ry / rx));
        return (
          <motion.g
            key={`top-${i}`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.04 * i + 0.1, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              cursor: "pointer",
              transformOrigin: `${cx}px ${cy}px`,
              filter: isHover ? `drop-shadow(0 0 18px ${s.color}cc)` : undefined,
              transition: "filter 0.25s",
            }}
          >
            <path
              d={topPath(s.startAngle, s.endAngle, ox, oy)}
              fill={`url(#pck-top-${i})`}
              stroke="#0a0a0a"
              strokeWidth="2"
              style={{ transition: "d 0.35s cubic-bezier(0.22,1,0.36,1)" }}
            />
            {/* Règle universelle : on n'affiche le label dans le camembert
                que si la part est >= 8 %. Sous ce seuil, le label est
                lisible UNIQUEMENT dans la légende droite (où il a la
                place et où il ne chevauche jamais une autre part). */}
            {s.stake_pct >= 8 && (
              <text
                x={cx + ox + Math.cos(s.mid) * rx * 0.62}
                y={cy + oy + Math.sin(s.mid) * ry * 0.62 + 3}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill="#fff"
                fontFamily="ui-monospace, monospace"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.95)", pointerEvents: "none" }}
              >
                {s.stake_pct.toFixed(1).replace(".", ",")} %
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

// ============================================================
//  Variant B — FLAT WITH CALLOUTS
//  Thin disc + lines pointing outward to large %, name labels
//  (matches reference image 2 — infographic style).
// ============================================================

function PieCallouts({
  arcs,
  hover,
  setHover,
}: {
  arcs: ArcData[];
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  // Pie + callouts dimensionnés pour rentrer ENTIÈREMENT dans le SVG
  // viewBox 540×380, sans débordement ni superposition. Pop-out abandonné.
  const cx = 260;
  const cy = 170;
  const rx = 110;
  const ry = 75;
  const depth = 26;          // chunkier 3D (was 18) — relief plus marqué
  const labelDist = 32;

  function topPath(start: number, end: number) {
    const x1 = cx + Math.cos(start) * rx;
    const y1 = cy + Math.sin(start) * ry;
    const x2 = cx + Math.cos(end) * rx;
    const y2 = cy + Math.sin(end) * ry;
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${rx} ${ry} 0 ${large} 1 ${x2} ${y2} Z`;
  }
  function sidePath(start: number, end: number) {
    const x1 = cx + Math.cos(start) * rx;
    const y1 = cy + Math.sin(start) * ry;
    const x2 = cx + Math.cos(end) * rx;
    const y2 = cy + Math.sin(end) * ry;
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${rx} ${ry} 0 ${large} 1 ${x2} ${y2} L ${x2} ${y2 + depth} A ${rx} ${ry} 0 ${large} 0 ${x1} ${y1 + depth} Z`;
  }
  function frontWallSegment(start: number, end: number) {
    const s = Math.max(start, 0);
    const e = Math.min(end, Math.PI);
    return e > s ? { s, e } : null;
  }

  return (
    <svg
      viewBox="0 0 540 380"
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {arcs.map((s, i) => (
          <linearGradient key={`g-${i}`} id={`pco-top-${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="1" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.85" />
          </linearGradient>
        ))}
      </defs>

      {/* Floor shadow — sous le bas du cylindre, fine pour ne pas paraître
          comme un deuxième disque parasite. */}
      <ellipse
        cx={cx}
        cy={cy + ry + depth + 5}
        rx={rx * 0.9}
        ry={4}
        fill="#000"
        fillOpacity="0.55"
      />

      {/* Side walls (front-half) */}
      {arcs.map((s, i) => {
        const seg = frontWallSegment(s.startAngle, s.endAngle);
        if (!seg) return null;
        const isHover = i === hover;
        return (
          <motion.path
            key={`side-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.04 * i }}
            d={sidePath(seg.s, seg.e)}
            fill={s.color}
            fillOpacity={isHover ? 0.95 : 0.75}
            stroke="#000"
            strokeOpacity="0.4"
            strokeWidth="0.8"
          />
        );
      })}

      {/* Top slices */}
      {arcs.map((s, i) => {
        const isHover = i === hover;
        return (
          <motion.path
            key={`top-${i}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.04 * i + 0.1, ease: [0.22, 1, 0.36, 1] }}
            d={topPath(s.startAngle, s.endAngle)}
            fill={`url(#pco-top-${i})`}
            stroke="#ffffff"
            strokeOpacity="0.25"
            strokeWidth="1"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              cursor: "pointer",
              transformOrigin: `${cx}px ${cy}px`,
              filter: isHover ? `drop-shadow(0 0 14px ${s.color}cc)` : undefined,
              transition: "filter 0.25s",
            }}
          />
        );
      })}

      {/* Callouts avec algo anti-overlap UNIVERSEL :
          (1) Filtre les parts < 4 % → elles n'ont pas de callout (lisibles
              uniquement dans la légende droite).
          (2) Calcule la position naturelle de chaque label.
          (3) Sépare les labels en 2 colonnes (gauche / droite du pie).
          (4) Trie par Y croissant dans chaque colonne, puis force un
              espacement minimum (38 px = hauteur d'un label 2 lignes +
              respiration) en poussant chaque label vers le bas / haut.
          (5) Clamp dans les bornes du SVG pour ne pas déborder du cadre.
          Résultat : tous les % visibles se lisent au 1er coup d'œil,
          sans chevauchement entre labels, ni avec le pie, ni avec le bord.
          Marche pour TOUS les pies de TOUTES les sociétés. */}
      {(() => {
        const minGap = 38;
        const svgTop = 14;
        const svgBottom = 380 - 14;
        type Layout = {
          i: number;
          s: ArcData;
          rimX: number;
          rimY: number;
          outX: number;
          outY: number;
          goesRight: boolean;
          isHover: boolean;
          name: string;
        };
        const visible: Layout[] = arcs
          .map((s, i) => {
            if (s.stake_pct < 4) return null;
            const sin = Math.sin(s.mid);
            const cos = Math.cos(s.mid);
            const front = sin > 0;
            const yShift = front ? depth : 0;
            return {
              i,
              s,
              rimX: cx + cos * rx,
              rimY: cy + sin * ry + yShift,
              outX: cx + cos * (rx + labelDist),
              outY: cy + sin * (ry + labelDist) + yShift,
              goesRight: cos >= 0,
              isHover: i === hover,
              name: s.name.length > 16 ? s.name.slice(0, 15) + "…" : s.name,
            };
          })
          .filter((v): v is Layout => v !== null);

        // Push apart vertically per side (right vs left)
        const adjust = (items: Layout[]) => {
          items.sort((a, b) => a.outY - b.outY);
          for (let i = 1; i < items.length; i++) {
            if (items[i].outY - items[i - 1].outY < minGap) {
              items[i].outY = items[i - 1].outY + minGap;
            }
          }
          // Clamp top : si tout déborde en bas, remonte d'autant
          const last = items[items.length - 1];
          if (last && last.outY > svgBottom) {
            const shift = last.outY - svgBottom;
            for (const it of items) it.outY = Math.max(svgTop, it.outY - shift);
          }
          // Clamp top : si le 1er passe au-dessus, repousse tout
          for (let i = 1; i < items.length; i++) {
            if (items[i].outY - items[i - 1].outY < minGap) {
              items[i].outY = items[i - 1].outY + minGap;
            }
          }
        };
        adjust(visible.filter((v) => v.goesRight));
        adjust(visible.filter((v) => !v.goesRight));

        return visible.map(({ i, s, rimX, rimY, outX, outY, goesRight, isHover, name }) => {
          const labelX = outX + (goesRight ? 8 : -8);
          const anchor: "start" | "end" = goesRight ? "start" : "end";
          return (
            <g
              key={`call-${i}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <line
                x1={rimX}
                y1={rimY}
                x2={outX}
                y2={outY}
                stroke={s.color}
                strokeWidth={isHover ? 2 : 1.4}
                strokeLinecap="round"
                opacity={isHover ? 1 : 0.85}
              />
              <circle cx={rimX} cy={rimY} r={isHover ? 4.5 : 3} fill={s.color} />
              <text
                x={labelX}
                y={outY - 5}
                textAnchor={anchor}
                fontSize="18"
                fontWeight="800"
                fill={s.color}
                fontFamily="ui-monospace, monospace"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
              >
                {s.stake_pct.toFixed(1).replace(".", ",")}
                <tspan fontSize="12" dx="1">
                  %
                </tspan>
              </text>
              <text
                x={labelX}
                y={outY + 12}
                textAnchor={anchor}
                fontSize="12"
                fill="#e4e4e7"
                fontFamily="ui-sans-serif, system-ui"
                fontWeight="500"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
              >
                {name}
              </text>
            </g>
          );
        });
      })()}
    </svg>
  );
}
