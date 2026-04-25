"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Anomaly } from "@/lib/brand";

/**
 * Lollipop chart : thin vertical line + circle at value.
 * Anomaly years are highlighted with a glowing ring + bigger circle.
 */
export function LollipopChart({
  data,
  labels,
  unit,
  color = "#a78bfa",
  anomalies = [],
}: {
  data: number[];
  labels: string[];
  unit: string;
  color?: string;
  anomalies?: Anomaly[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 800;
  const H = 290;
  const padTop = 40;
  const padBottom = 44;
  const padX = 56;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const min = Math.min(0, ...data);
  const max = Math.max(...data, 0);
  const range = max - min || 1;
  const zeroY = padTop + ((max - 0) / range) * innerH;

  const slot = innerW / data.length;
  const r = 10;
  const ticks = [max, (max + min) / 2, min];
  const anomalyByIdx = new Map(anomalies.map((a) => [a.index, a]));

  return (
    <div className="relative h-[290px] w-full">
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <radialGradient id="lol-glow">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {ticks.map((v, i) => {
          const y = padTop + ((max - v) / range) * innerH;
          return (
            <g key={i}>
              <line
                x1={padX}
                x2={W - padX}
                y1={y}
                y2={y}
                stroke="#1f1f1f"
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
                {Math.round(v * 10) / 10}
              </text>
            </g>
          );
        })}

        {data.map((v, i) => {
          const x = padX + slot * i + slot / 2;
          const y = padTop + ((max - v) / range) * innerH;
          const isHover = hover === i;
          const isAnomaly = anomalyByIdx.has(i);
          return (
            <g key={i}>
              {/* stem */}
              <motion.line
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.06 * i }}
                x1={x}
                x2={x}
                y1={zeroY}
                y2={y}
                stroke={color}
                strokeOpacity={0.45}
                strokeWidth={2}
              />
              {/* glow halo on anomaly */}
              {isAnomaly && (
                <circle cx={x} cy={y} r={28} fill="url(#lol-glow)" />
              )}
              {/* dot */}
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 0.06 * i + 0.3,
                  type: "spring",
                  stiffness: 220,
                }}
                cx={x}
                cy={y}
                r={isHover ? r + 3 : isAnomaly ? r + 1 : r}
                fill="#0a0a0a"
                stroke={color}
                strokeWidth={isAnomaly ? 3 : 2.5}
              />
              {(isHover || isAnomaly) && (
                <text
                  x={x}
                  y={y - r - 8}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="#fafafa"
                  fontFamily="ui-monospace, monospace"
                >
                  {v}
                  <tspan fontSize={11} fill="#71717a">
                    {unit}
                  </tspan>
                </text>
              )}
              <text
                x={x}
                y={H - padBottom + 22}
                textAnchor="middle"
                fontSize={13}
                fill="#a1a1aa"
                fontFamily="ui-monospace, monospace"
                fontWeight={500}
              >
                {labels[i] ?? ""}
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
    </div>
  );
}
