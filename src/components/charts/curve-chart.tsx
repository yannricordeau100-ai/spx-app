"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AnomalyInfo } from "@/components/anomaly-info";
import type { Anomaly } from "@/lib/brand";
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
 * 3D axonometric curve chart — SAME projection as BarsChart for visual coherence.
 * The curve is drawn on the front vertical plane; its shadow is projected onto
 * the receding floor.
 */
export function CurveChart({
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

  const W = 920;
  const H = 420;
  const padLeft = 96;
  const padRight = 50;
  const padTop = 40;
  const padBottom = 80;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const dZ = 54;
  const dx = dZ * 0.82;
  const dy = -dZ * 0.48;

  const min = Math.min(0, ...data);
  const max = Math.max(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const zeroY = padTop + ((max - 0) / range) * innerH;

  const u = formatUnit(unit);
  const header = axisHeader(unit);
  const intTicks = isCurrencyLike(unit);

  // Front plane points — strict Y alignment
  const points = data.map((v, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + ((max - v) / range) * innerH;
    return [x, y] as const;
  });
  // Shadow projected onto floor (Z pushed back)
  const shadowPts = data.map((_, i) => {
    const x = padLeft + i * stepX + dx;
    const y = zeroY + dy;
    return [x, y] as const;
  });
  // But the shadow should represent the curve shape projected down —
  // so we use the x of each point and the floor-y (receding):
  const floorShadowPts = data.map((_, i) => {
    const [x] = points[i];
    return [x + dx, zeroY + dy] as const;
  });

  const linePath = (pts: readonly (readonly [number, number])[]) =>
    pts
      .map(([x, y], i) => {
        if (i === 0) return `M ${x},${y}`;
        const [px, py] = pts[i - 1];
        const cx = (px + x) / 2;
        return `Q ${cx},${py} ${x},${y}`;
      })
      .join(" ");

  const ticks = [
    max,
    max * 0.75 + min * 0.25,
    (max + min) / 2,
    max * 0.25 + min * 0.75,
    min,
  ].map((v) => ({ v, y: padTop + ((max - v) / range) * innerH }));

  const backLeft = padLeft + dx;
  const backTop = padTop + dy;
  const backRight = padLeft + innerW + dx;
  const backBottomY = zeroY + dy;

  const idArea = `c3d-area-${color.slice(1)}-${data.length}`;
  const idFloor = `c3d-floor-${color.slice(1)}`;
  const idSphere = `c3d-sphere-${color.slice(1)}`;

  const anomalyByIdx = new Map(anomalies.map((a) => [a.index, a]));

  return (
    <div className="relative w-full">
      <div className="mb-2 flex items-center justify-start">
        <span className="font-mono text-[12px] font-semibold text-zinc-200">{header}</span>
      </div>
      <svg width="100%" height="420" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={idArea} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={idFloor} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <radialGradient id={idSphere}>
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="40%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </radialGradient>
          <filter id="c3d-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Back-left wall */}
        <path
          d={`M ${padLeft} ${padTop} L ${backLeft} ${backTop} L ${backLeft} ${backBottomY} L ${padLeft} ${zeroY} Z`}
          fill={`url(#${idFloor})`}
          stroke={color}
          strokeOpacity="0.15"
          strokeWidth="1"
        />
        {/* Floor */}
        <path
          d={`M ${padLeft} ${zeroY} L ${padLeft + innerW} ${zeroY} L ${backRight} ${backBottomY} L ${backLeft} ${backBottomY} Z`}
          fill="#08080b"
          stroke={color}
          strokeOpacity="0.12"
          strokeWidth="1"
        />
        {/* Floor receding grid */}
        {[0.25, 0.5, 0.75].map((t, i) => {
          const fx1 = padLeft + dx * t;
          const fy1 = zeroY + dy * t;
          const fx2 = padLeft + innerW + dx * t;
          const fy2 = zeroY + dy * t;
          return (
            <line
              key={i}
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

        {/* Y-axis ticks (aligned with front plane curve) */}
        {ticks.map(({ v, y }, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              y1={y}
              x2={padLeft + dx}
              y2={y + dy}
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
        ))}

        {/* Shadow on floor (projected curve outline on the ground) */}
        <motion.path
          d={linePath(floorShadowPts)}
          fill="none"
          stroke="#000000"
          strokeWidth={5}
          strokeOpacity={0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#c3d-glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1] }}
        />

        {/* Vertical "stems" dropping from each point to the floor (ties curve to 3D space) */}
        {points.map(([x, y], i) => (
          <motion.line
            key={`stem-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 * i + 0.8 }}
            x1={x}
            y1={y}
            x2={x + dx}
            y2={zeroY + dy}
            stroke={color}
            strokeOpacity="0.3"
            strokeDasharray="2 4"
          />
        ))}

        {/* Area under curve on front plane */}
        <motion.path
          d={`${linePath(points)} L ${padLeft + innerW},${zeroY} L ${padLeft},${zeroY} Z`}
          fill={`url(#${idArea})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />

        {/* Main curve (front plane) */}
        <motion.path
          d={linePath(points)}
          fill="none"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1] }}
          style={{ filter: `drop-shadow(0 0 10px ${color}90)` }}
        />

        {/* 3D spheres at data points */}
        {points.map(([x, y], i) => {
          const isHover = hover === i;
          const isAnomaly = anomalyByIdx.has(i);
          const r = isAnomaly ? 8 : isHover ? 7 : 5.5;

          return (
            <g key={i}>
              {isAnomaly && (
                <circle cx={x} cy={y} r={22} fill={color} fillOpacity={0.18} />
              )}
              {/* Drop shadow on floor */}
              <ellipse
                cx={x + dx}
                cy={zeroY + dy}
                rx={r * 1.4}
                ry={r * 0.45}
                fill="#000000"
                fillOpacity={0.4}
              />
              {/* Sphere */}
              <circle cx={x} cy={y} r={r + 1.5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.7} />
              <circle cx={x} cy={y} r={r} fill={`url(#${idSphere})`} />
              <circle
                cx={x - r * 0.3}
                cy={y - r * 0.3}
                r={r * 0.35}
                fill="#ffffff"
                fillOpacity={0.8}
              />

              {isHover && (
                <text
                  x={x}
                  y={y - r - 12}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={800}
                  fill="#fafafa"
                  fontFamily="ui-monospace, monospace"
                >
                  {data[i]}
                  {u && <tspan fill="#a1a1aa" fontSize="12"> {u}</tspan>}
                </text>
              )}

              {/* X axis label on the floor */}
              <text
                x={x + dx}
                y={H - padBottom + 28}
                textAnchor="middle"
                fontSize={14}
                fill="#d4d4d8"
                fontFamily="ui-monospace, monospace"
                fontWeight={500}
              >
                {labels[i] ?? ""}
              </text>

              <rect
                x={x - stepX / 2}
                y={padTop}
                width={stepX}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
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
