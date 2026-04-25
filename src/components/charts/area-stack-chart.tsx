"use client";

import { motion } from "motion/react";

/**
 * Mini stacked-area visual : current value highlighted, previous years stacked behind.
 * For V1 it visually decomposes the historical contribution rather than real segments.
 */
export function AreaStackChart({
  data,
  labels,
  unit,
  color = "#a78bfa",
}: {
  data: number[];
  labels: string[];
  unit: string;
  color?: string;
}) {
  const W = 800;
  const H = 290;
  const padTop = 30;
  const padBottom = 44;
  const padX = 56;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const max = Math.max(...data, 0);
  const min = Math.min(0, ...data);
  const range = max - min || 1;

  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((v, i) => {
    const x = padX + i * stepX;
    const y = padTop + ((max - v) / range) * innerH;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => {
      if (i === 0) return `M ${x},${y}`;
      const [px, py] = points[i - 1];
      const cx = (px + x) / 2;
      return `Q ${cx},${py} ${x},${y}`;
    })
    .join(" ");
  const areaPath = `${linePath} L ${padX + innerW},${padTop + innerH} L ${padX},${padTop + innerH} Z`;

  return (
    <div className="relative h-[290px] w-full">
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="stack-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.7} />
            <stop offset="60%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
          {/* Layered second area for "stacked" feel */}
          <linearGradient id="stack-grad-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((t, i) => {
          const y = padTop + innerH * t;
          return (
            <line
              key={i}
              x1={padX}
              x2={padX + innerW}
              y1={y}
              y2={y}
              stroke="#1f1f1f"
              strokeDasharray="3 6"
            />
          );
        })}

        {/* back area (offset down for "stacked" feel) */}
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          d={areaPath}
          fill="url(#stack-grad-back)"
          transform="translate(0, 12)"
        />
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          d={areaPath}
          fill="url(#stack-grad)"
        />
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1] }}
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={points[i][0]}
            y={H - padBottom + 22}
            textAnchor="middle"
            fontSize={13}
            fill="#a1a1aa"
            fontFamily="ui-monospace, monospace"
            fontWeight={500}
          >
            {l}
          </text>
        ))}

        {/* y-axis */}
        {[max, max / 2, 0].map((v, i) => (
          <text
            key={i}
            x={padX - 8}
            y={padTop + innerH * (i / 2) + 4}
            textAnchor="end"
            fontSize={11}
            fill="#a1a1aa"
            fontFamily="ui-monospace, monospace"
          >
            {Math.round(v * 10) / 10}
          </text>
        ))}

        {/* end value tag */}
        <g transform={`translate(${points[points.length - 1][0] + 4}, ${points[points.length - 1][1] - 10})`}>
          <rect width="64" height="22" rx="4" fill="#0a0a0a" stroke={color} strokeOpacity="0.5" />
          <text x="32" y="15" textAnchor="middle" fontSize="12" fontWeight="600" fill={color} fontFamily="ui-monospace, monospace">
            {data[data.length - 1]}{unit}
          </text>
        </g>
      </svg>
    </div>
  );
}
