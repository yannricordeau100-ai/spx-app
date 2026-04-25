"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Anomaly } from "@/lib/brand";
import { AnomalyInfo } from "@/components/anomaly-info";
import { formatUnit } from "@/lib/data";

function axisHeader(unit: string): string {
  switch (unit) {
    case "$B": return "$ en Mds";
    case "$M": return "$ en M";
    case "B": return "en Mds";
    case "M": return "en M";
    case "%": return "%";
    case "% YoY": return "% (YoY)";
    case "$": return "$";
    default: return unit || "";
  }
}
function isCurrencyLike(unit: string): boolean {
  return ["$B", "$M", "B", "M"].includes(unit);
}

/**
 * True axonometric 3D bars chart.
 *
 * Projection rule: Y axis is VERTICAL and UNDISTORTED. Y-axis ticks on the
 * back-left wall align HORIZONTALLY with the TOP of each bar's FRONT face,
 * so the data scale stays readable.
 *
 * The 3D illusion comes from:
 *   - receding floor grid (back-left vanishing)
 *   - back-left wall with Y ticks
 *   - each bar = 3D box (front + top + right face) with consistent light source
 *   - drop shadows on the floor
 */
export function BarsChart({
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

  // SVG canvas
  const W = 920;
  const H = 420;

  // Chart plane (inside walls)
  const padLeft = 96;      // Y axis wall + ticks space
  const padRight = 50;
  const padTop = 40;
  const padBottom = 80;    // room for X labels + tilted floor
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  // 3D depth vector (toward back-right)
  const dZ = 54;
  const dx = dZ * 0.82;  // cos 35°
  const dy = -dZ * 0.48; // sin 29° (negative = up)

  const min = Math.min(0, ...data);
  const max = Math.max(...data, 0);
  const range = max - min || 1;
  const zeroY = padTop + ((max - 0) / range) * innerH;

  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.46, 56);

  const u = formatUnit(unit);
  const header = axisHeader(unit);
  const intTicks = isCurrencyLike(unit);

  const yoyPct = data.map((v, i) => {
    if (i === 0) return null;
    const prev = data[i - 1];
    if (!prev) return null;
    return ((v - prev) / Math.abs(prev)) * 100;
  });

  const ticks = [
    max,
    max * 0.75 + min * 0.25,
    (max + min) / 2,
    max * 0.25 + min * 0.75,
    min,
  ].map((v) => ({ v, y: padTop + ((max - v) / range) * innerH }));

  const idFront = `b3d-front-${color.slice(1)}`;
  const idTop = `b3d-top-${color.slice(1)}`;
  const idSide = `b3d-side-${color.slice(1)}`;
  const idFloorLine = `b3d-floor-${color.slice(1)}`;
  const idWallFade = `b3d-wall-${color.slice(1)}`;

  const anomalyByIndex = new Map(anomalies.map((a) => [a.index, a]));

  // Front face X position (left edge of bar)
  const barX = (i: number) => padLeft + slot * i + (slot - barW) / 2;

  // Back-plane coords
  const backLeft = padLeft + dx;
  const backTop = padTop + dy;
  const backRight = padLeft + innerW + dx;
  const backBottomY = zeroY + dy;

  return (
    <div className="relative w-full">
      <div className="mb-2 flex items-center justify-start">
        <span className="font-mono text-[12px] font-semibold text-zinc-200">{header}</span>
      </div>
      <svg width="100%" height="420" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={idFront} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id={idTop} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.65} />
            <stop offset="100%" stopColor={color} stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id={idSide} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id={idWallFade} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <filter id="b3d-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Back-left wall (Y axis plane) — parallelogram */}
        <path
          d={`M ${padLeft} ${padTop} L ${backLeft} ${backTop} L ${backLeft} ${backBottomY} L ${padLeft} ${zeroY} Z`}
          fill={`url(#${idWallFade})`}
          stroke={color}
          strokeOpacity="0.15"
          strokeWidth="1"
        />

        {/* Floor plane (horizontal receding) */}
        <path
          d={`M ${padLeft} ${zeroY} L ${padLeft + innerW} ${zeroY} L ${backRight} ${backBottomY} L ${backLeft} ${backBottomY} Z`}
          fill="#08080b"
          stroke={color}
          strokeOpacity="0.12"
          strokeWidth="1"
        />

        {/* Floor grid lines (parallel to back edge — receding) */}
        {[0.25, 0.5, 0.75].map((t, i) => {
          const fx1 = padLeft + dx * t;
          const fy1 = zeroY + dy * t;
          const fx2 = padLeft + innerW + dx * t;
          const fy2 = zeroY + dy * t;
          return (
            <line
              key={`hfloor-${i}`}
              x1={fx1}
              y1={fy1}
              x2={fx2}
              y2={fy2}
              stroke={color}
              strokeOpacity="0.07"
              strokeDasharray="3 6"
            />
          );
        })}

        {/* Y-axis ticks on the LEFT WALL — horizontal line extends from front-left to back-left */}
        {ticks.map(({ v, y }, i) => {
          const bx = padLeft + dx;
          const by = y + dy;
          return (
            <g key={i}>
              {/* guideline across chart plane (on back wall + through air) */}
              <line
                x1={padLeft}
                y1={y}
                x2={bx}
                y2={by}
                stroke={color}
                strokeOpacity="0.15"
                strokeDasharray="2 4"
              />
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + innerW}
                y2={y}
                stroke="#1f1f1f"
                strokeWidth={1}
                strokeDasharray="3 6"
              />
              <text
                x={padLeft - 12}
                y={y + 4}
                textAnchor="end"
                fontSize={12.5}
                fill="#d4d4d8"
                fontFamily="ui-monospace, monospace"
              >
                {intTicks ? Math.round(v) : Math.round(v * 10) / 10}
              </text>
            </g>
          );
        })}

        {min < 0 && max > 0 && (
          <line
            x1={padLeft}
            x2={padLeft + innerW}
            y1={zeroY}
            y2={zeroY}
            stroke="#3f3f46"
            strokeWidth={1.5}
          />
        )}

        {/* 3D bars */}
        {data.map((v, i) => {
          const x = barX(i);
          const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
          const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
          const h = Math.max(2, yBot - yTop);
          const isHover = hover === i;
          const yPct = yoyPct[i];
          const yoyColor = yPct == null ? "#a1a1aa" : yPct >= 0 ? "#10b981" : "#f43f5e";
          const isAnomaly = anomalyByIndex.has(i);

          // Front face rectangle: (x, yTop) → (x+barW, yBot)
          // Top face parallelogram: front-top edge pushed by (dx, dy)
          const ftL = [x, yTop];
          const ftR = [x + barW, yTop];
          const btL = [x + dx, yTop + dy];
          const btR = [x + barW + dx, yTop + dy];

          // Right face parallelogram: right-front edge pushed
          const frT = [x + barW, yTop];
          const frB = [x + barW, yBot];
          const brT = [x + barW + dx, yTop + dy];
          const brB = [x + barW + dx, yBot + dy];

          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
              filter={isHover || isAnomaly ? "url(#b3d-glow)" : undefined}
              style={{ opacity: hover === null || isHover ? 1 : 0.55 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Drop shadow on floor */}
              <ellipse
                cx={x + barW / 2 + dx / 2}
                cy={yBot + 5}
                rx={barW * 0.55}
                ry={4}
                fill="#000000"
                fillOpacity={0.5}
              />
              {/* Right face (in shadow) */}
              <motion.path
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.7, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: `${x + barW}px ${yBot}px` }}
                d={`M ${frT[0]} ${frT[1]} L ${brT[0]} ${brT[1]} L ${brB[0]} ${brB[1]} L ${frB[0]} ${frB[1]} Z`}
                fill={`url(#${idSide})`}
                stroke={color}
                strokeOpacity="0.3"
                strokeWidth={0.5}
              />
              {/* Front face (main data rectangle) */}
              <motion.rect
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.7, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: `${x}px ${yBot}px` }}
                x={x}
                y={yTop}
                rx={2}
                width={barW}
                height={h}
                fill={`url(#${idFront})`}
                stroke={color}
                strokeOpacity="0.6"
                strokeWidth={0.5}
              />
              {/* Top face (catches light) */}
              <motion.path
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.08 * i + 0.4 }}
                d={`M ${ftL[0]} ${ftL[1]} L ${ftR[0]} ${ftR[1]} L ${btR[0]} ${btR[1]} L ${btL[0]} ${btL[1]} Z`}
                fill={`url(#${idTop})`}
                stroke={color}
                strokeOpacity="0.7"
                strokeWidth={0.5}
              />

              {/* Anomaly marker on top face */}
              {isAnomaly && (
                <circle
                  cx={x + barW / 2 + dx / 2}
                  cy={yTop + dy / 2}
                  r={5}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              )}

              {/* YoY % above bar (on the back side so it floats) */}
              {yPct != null && (
                <motion.text
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i + 0.6 }}
                  x={x + barW / 2 + dx / 2}
                  y={yTop + dy - 10}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill={yoyColor}
                  fontFamily="ui-monospace, monospace"
                >
                  {yPct >= 0 ? "+" : ""}
                  {yPct.toFixed(1)} %
                </motion.text>
              )}

              {/* Hover value */}
              {isHover && (
                <motion.text
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  x={x + barW / 2 + dx / 2}
                  y={yTop + dy - 28}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={800}
                  fill="#fafafa"
                  fontFamily="ui-monospace, monospace"
                >
                  {v}
                  {u && <tspan fill="#a1a1aa" fontSize="12"> {u}</tspan>}
                </motion.text>
              )}

              {/* X axis label (on the floor, slight offset for alignment) */}
              <text
                x={x + barW / 2 + dx / 2}
                y={H - padBottom + 28}
                textAnchor="middle"
                fontSize={14}
                fill="#d4d4d8"
                fontFamily="ui-monospace, monospace"
                fontWeight={500}
              >
                {labels[i] ?? ""}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {anomalies.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[12px] text-zinc-300">
          {anomalies.map((a) => (
            <span key={a.index} className="inline-flex items-center gap-1.5">
              <span className="font-mono text-zinc-300">{labels[a.index]}</span>
              <AnomalyInfo anomaly={a} color={color} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
