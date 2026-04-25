"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { Shareholder } from "@/lib/data";

/**
 * 3D cylindrical pie chart, modeled after the classic "Excel 3D pie" look but
 * built from scratch in pure SVG with a real cylindrical extrusion. Each slice
 * has a distinct rainbow-ish color so segments are easy to distinguish.
 *
 * Visual signature:
 *   - Cylinder seen from a 25° elevated angle
 *   - Each slice extruded with visible side wall (gradient bottom shadow)
 *   - The biggest slice is "exploded" (pulled outward) by default
 *   - Hover any slice to extract it instead
 *   - Floor shadow + ambient glow under the pie
 *   - Background remains readable (low-opacity backdrop, light blur)
 */

// Distinct, well-separated palette — slice index drives color, not type.
const SLICE_COLORS = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#fbbf24", // yellow
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
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
}: {
  shareholders: Shareholder[];
  title: string;
  open: boolean;
  onClose: () => void;
  accent?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const total = shareholders.reduce((a, b) => a + b.stake_pct, 0);
  const slices: Shareholder[] =
    total < 99
      ? [
          ...shareholders,
          {
            name: "Reste du flottant",
            stake_pct: 100 - total,
            type: "institutionnel" as const,
            role: "Autres détenteurs",
          },
        ]
      : shareholders;

  // Auto-explode the biggest slice by default
  const biggestIdx = slices.reduce(
    (best, s, i, arr) => (s.stake_pct > arr[best].stake_pct ? i : best),
    0
  );
  const explodedIdx = hover !== null ? hover : biggestIdx;

  // 3D cylinder geometry
  const cx = 280;
  const cy = 230;
  const rx = 200;
  const ry = 80; // small ry = strong tilt (higher elevation angle)
  const depth = 50;

  let acc = 0;
  const arcs = slices.map((s, i) => {
    const startAngle = (acc / 100) * Math.PI * 2 - Math.PI / 2;
    acc += s.stake_pct;
    const endAngle = (acc / 100) * Math.PI * 2 - Math.PI / 2;
    const mid = (startAngle + endAngle) / 2;
    const color = SLICE_COLORS[i % SLICE_COLORS.length];
    return { ...s, startAngle, endAngle, mid, color };
  });

  function topPath(start: number, end: number, ox: number, oy: number): string {
    const x1 = cx + ox + Math.cos(start) * rx;
    const y1 = cy + oy + Math.sin(start) * ry;
    const x2 = cx + ox + Math.cos(end) * rx;
    const y2 = cy + oy + Math.sin(end) * ry;
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${cx + ox} ${cy + oy} L ${x1} ${y1} A ${rx} ${ry} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  function sidePath(start: number, end: number, ox: number, oy: number): string {
    // Only render side wall for slices on the FRONT half of the cylinder
    // (i.e. where mid angle is in the lower half)
    const x1t = cx + ox + Math.cos(start) * rx;
    const y1t = cy + oy + Math.sin(start) * ry;
    const x2t = cx + ox + Math.cos(end) * rx;
    const y2t = cy + oy + Math.sin(end) * ry;
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1t} ${y1t} A ${rx} ${ry} 0 ${large} 1 ${x2t} ${y2t} L ${x2t} ${y2t + depth} A ${rx} ${ry} 0 ${large} 0 ${x1t} ${y1t + depth} Z`;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(5,5,8,0.5)", backdropFilter: "blur(2px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
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

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[3fr_2fr]">
              {/* 3D cylindrical pie */}
              <div className="relative">
                <svg viewBox="0 0 560 380" className="w-full">
                  <defs>
                    {arcs.map((s, i) => (
                      <g key={`g${i}`}>
                        <linearGradient
                          id={`pie-side-${i}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={s.color} stopOpacity="0.7" />
                          <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
                        </linearGradient>
                        <radialGradient
                          id={`pie-top-${i}`}
                          cx="50%"
                          cy="40%"
                          r="60%"
                        >
                          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                          <stop offset="40%" stopColor={s.color} stopOpacity="1" />
                          <stop offset="100%" stopColor={s.color} stopOpacity="0.7" />
                        </radialGradient>
                      </g>
                    ))}
                    <radialGradient id="pie-floor-shadow">
                      <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#000" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Floor shadow under cylinder */}
                  <ellipse
                    cx={cx}
                    cy={cy + depth + 14}
                    rx={rx + 16}
                    ry={ry / 2 + 8}
                    fill="url(#pie-floor-shadow)"
                  />

                  {/* SIDE WALLS — drawn first so they appear behind top */}
                  {arcs.map((s, i) => {
                    const isExploded = i === explodedIdx;
                    const ox = isExploded ? Math.cos(s.mid) * 22 : 0;
                    const oy = isExploded ? Math.sin(s.mid) * 9 : 0;
                    return (
                      <motion.path
                        key={`side-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.04 * i }}
                        d={sidePath(s.startAngle, s.endAngle, ox, oy)}
                        fill={`url(#pie-side-${i})`}
                        stroke="#000"
                        strokeOpacity="0.55"
                        strokeWidth="1"
                        style={{
                          transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)",
                        }}
                      />
                    );
                  })}

                  {/* TOP SLICES */}
                  {arcs.map((s, i) => {
                    const isExploded = i === explodedIdx;
                    const ox = isExploded ? Math.cos(s.mid) * 22 : 0;
                    const oy = isExploded ? Math.sin(s.mid) * 9 : 0;
                    return (
                      <motion.g
                        key={`top-${i}`}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.5,
                          delay: 0.04 * i + 0.1,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          cursor: "pointer",
                          transformOrigin: `${cx}px ${cy}px`,
                          transition: "filter 0.25s",
                          filter: isExploded
                            ? `drop-shadow(0 0 14px ${s.color}cc)`
                            : undefined,
                        }}
                      >
                        <path
                          d={topPath(s.startAngle, s.endAngle, ox, oy)}
                          fill={`url(#pie-top-${i})`}
                          stroke="#0a0a0a"
                          strokeWidth="2"
                          style={{
                            transition: "d 0.35s cubic-bezier(0.22,1,0.36,1)",
                          }}
                        />
                        {/* Stake label on slice */}
                        {s.stake_pct > 4 && (
                          <text
                            x={cx + ox + Math.cos(s.mid) * rx * 0.62}
                            y={cy + oy + Math.sin(s.mid) * ry * 0.62 + 3}
                            textAnchor="middle"
                            fontSize="14"
                            fontWeight="700"
                            fill="#fff"
                            fontFamily="ui-monospace, monospace"
                            style={{
                              textShadow: "0 1px 3px rgba(0,0,0,0.95)",
                              pointerEvents: "none",
                            }}
                          >
                            {s.stake_pct.toFixed(1)} %
                          </text>
                        )}
                      </motion.g>
                    );
                  })}

                  {/* Outer rim highlight on top edge */}
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={rx}
                    ry={ry}
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.25"
                    strokeWidth="1.2"
                  />
                </svg>
              </div>

              {/* Legend / details panel */}
              <div className="space-y-2">
                {arcs.map((s, i) => {
                  const isExploded = i === explodedIdx;
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      className={`rounded-lg border p-3 transition-colors ${
                        isExploded ? "border-white/30 bg-white/5" : "border-[#1a1a1a] bg-[#0a0a0a]"
                      }`}
                      style={
                        isExploded
                          ? { boxShadow: `0 0 16px ${s.color}55` }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-sm"
                          style={{ background: s.color }}
                        />
                        <span className="text-[14px] font-semibold text-zinc-50">
                          {s.name}
                        </span>
                        <span className="ml-auto font-mono text-[14px] font-bold tabular-nums text-zinc-50">
                          {s.stake_pct.toFixed(1)} %
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11.5px] text-zinc-400">
                        <span
                          className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                          style={{ background: `${s.color}1f`, color: s.color }}
                        >
                          {TYPE_LABEL[s.type]}
                        </span>
                        {s.role && <span>· {s.role}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-5 text-center font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
              Survolez une part pour la mettre en avant
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
