"use client";

import { motion } from "motion/react";

/**
 * Animated SVG sparkline with gradient fill.
 */
export function Sparkline({
  data,
  width = 320,
  height = 64,
  color = "#a78bfa",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height * 0.85 - height * 0.05;
    return [x, y] as const;
  });

  // smooth path via Catmull-Rom-ish quadratic
  const linePath = points
    .map(([x, y], i) => {
      if (i === 0) return `M ${x},${y}`;
      const [px, py] = points[i - 1];
      const cx = (px + x) / 2;
      return `Q ${cx},${py} ${x},${y}`;
    })
    .join(" ");

  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  // Stable id derived from props (no random → no hydration mismatch)
  const checksum = data.reduce((acc, v) => acc + v, 0);
  const id = `grad-${color.replace("#", "")}-${data.length}-${Math.round(checksum * 1000)}`;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1] }}
      />
      {/* end-point pulse */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="3.5"
        fill={color}
      >
        <animate
          attributeName="r"
          values="3.5;6;3.5"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="1;0.4;1"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
