"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function DeltaChart({
  data,
  labels,
  unit,
}: {
  data: number[];
  labels: string[];
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const deltas = data.slice(1).map((v, i) => {
    const prev = data[i];
    if (prev === 0) return 0;
    return ((v - prev) / Math.abs(prev)) * 100;
  });

  // Match Bars/Curve dimensions so switching charts doesn't shift the layout.
  const W = 920;
  const H = 420;
  const padLeft = 96;
  const padRight = 50;
  const padTop = 56;
  const padBottom = 80;
  const padX = padLeft; // alias for back-compat below
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;
  const centerY = padTop + innerH / 2;

  const maxAbs = Math.max(...deltas.map(Math.abs), 1);
  const slot = innerW / deltas.length;
  const barW = Math.min(slot * 0.5, 56);

  return (
    <div className="relative w-full">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-sans text-[12px] font-medium uppercase tracking-[0.14em] text-zinc-300">
          Variation annuelle{" "}
          <span className="ml-1 font-sans text-[11px] italic normal-case tracking-normal text-zinc-400">
            (year-over-year)
          </span>
        </span>
        <div className="inline-flex items-center gap-3 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-1">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-zinc-100">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Croissance
          </span>
          <span className="h-3 w-px bg-[#3a3a3a]" />
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-zinc-100">
            <span className="size-1.5 rounded-full bg-rose-400" />
            Décroissance
          </span>
        </div>
      </div>

      <svg width="100%" height="420" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="delta-pos-shared" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.15} />
          </linearGradient>
          <linearGradient id="delta-neg-shared" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.15} />
          </linearGradient>
          <filter id="delta-glow-shared" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* center axis */}
        <line
          x1={padX - 4}
          x2={W - padX + 4}
          y1={centerY}
          y2={centerY}
          stroke="#3f3f46"
          strokeWidth={1.5}
        />
        <text
          x={padX - 8}
          y={centerY + 4}
          textAnchor="end"
          fontSize={11}
          fill="#a1a1aa"
          fontFamily="ui-monospace, monospace"
        >
          0 %
        </text>
        {[0.5, -0.5].map((mult) => {
          const y = centerY - (innerH / 2) * mult;
          const v = Math.round(maxAbs * mult);
          return (
            <g key={mult}>
              <line
                x1={padX - 4}
                x2={W - padX + 4}
                y1={y}
                y2={y}
                stroke="#1f1f1f"
                strokeWidth={1}
                strokeDasharray="3 6"
              />
              <text
                x={padX - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#a1a1aa"
                fontFamily="ui-monospace, monospace"
              >
                {v > 0 ? "+" : ""}
                {v} %
              </text>
            </g>
          );
        })}

        {deltas.map((pct, i) => {
          const x = padX + slot * i + (slot - barW) / 2;
          const isPos = pct >= 0;
          const h = (Math.abs(pct) / maxAbs) * (innerH / 2);
          const y = isPos ? centerY - h : centerY;
          const isHover = hover === i;

          return (
            <g key={i}>
              <motion.rect
                x={x}
                y={y}
                rx={5}
                width={barW}
                height={Math.max(h, 2)}
                fill={isPos ? "url(#delta-pos-shared)" : "url(#delta-neg-shared)"}
                filter={isHover ? "url(#delta-glow-shared)" : undefined}
                style={{ originY: isPos ? 1 : 0 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  duration: 0.7,
                  delay: 0.08 * i,
                  ease: [0.22, 1, 0.36, 1],
                }}
                opacity={hover === null || isHover ? 1 : 0.5}
              />
              <motion.text
                initial={{ opacity: 0, y: isPos ? 4 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i + 0.4 }}
                x={x + barW / 2}
                y={isPos ? y - 10 : y + h + 18}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill={isPos ? "#10b981" : "#f43f5e"}
                fontFamily="ui-monospace, monospace"
              >
                {isPos ? "+" : ""}
                {pct.toFixed(1)} %
              </motion.text>
              <text
                x={x + barW / 2}
                y={H - padBottom + 22}
                textAnchor="middle"
                fontSize={13}
                fill="#a1a1aa"
                fontFamily="ui-monospace, monospace"
                fontWeight={500}
              >
                {labels[i + 1] ?? ""}
              </text>
              <rect
                x={padX + slot * i}
                y={padTop}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* hover detail card */}
      {hover !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute right-3 top-12 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-xs shadow-xl"
        >
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
            {labels[hover]} → {labels[hover + 1]}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {deltas[hover] >= 0 ? (
              <ArrowUpRight className="size-3 text-emerald-400" />
            ) : (
              <ArrowDownRight className="size-3 text-rose-400" />
            )}
            <span className="font-mono font-semibold text-zinc-100">
              {data[hover]}
              {unit} → {data[hover + 1]}
              {unit}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
