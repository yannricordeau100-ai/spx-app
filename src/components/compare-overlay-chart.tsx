"use client";

import { motion } from "motion/react";

/**
 * Two normalized lines drawn on the same canvas, indexed at 100 = first year.
 * Lets the eye compare *trajectories* even when the absolute scales differ.
 */
export function CompareOverlayChart({
  a,
  b,
  labels,
}: {
  a: { name: string; ticker: string; data: number[]; color: string };
  b: { name: string; ticker: string; data: number[]; color: string };
  labels: string[];
}) {
  // Index to base 100 = first non-zero value
  const norm = (xs: number[]) => {
    const base = xs.find((v) => v !== 0) ?? 1;
    return xs.map((v) => (base === 0 ? 0 : (v / Math.abs(base)) * 100));
  };
  const an = norm(a.data);
  const bn = norm(b.data);

  const W = 720;
  const H = 220;
  const padTop = 28;
  const padBottom = 36;
  const padX = 56;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const all = [...an, ...bn];
  const min = Math.min(...all, 0);
  const max = Math.max(...all);
  const range = max - min || 1;

  const stepX = an.length > 1 ? innerW / (an.length - 1) : innerW;

  const path = (xs: number[]) => {
    const pts = xs.map((v, i) => {
      const x = padX + i * stepX;
      const y = padTop + ((max - v) / range) * innerH;
      return [x, y] as const;
    });
    return pts
      .map(([x, y], i) => {
        if (i === 0) return `M ${x},${y}`;
        const [px, py] = pts[i - 1];
        const cx = (px + x) / 2;
        return `Q ${cx},${py} ${x},${y}`;
      })
      .join(" ");
  };

  const baseY = padTop + ((max - 100) / range) * innerH;

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
          Trajectoires normalisées <span className="ml-1 font-sans text-[11px] italic normal-case tracking-normal text-zinc-400">(base 100 = année initiale)</span>
        </span>
        <div className="inline-flex items-center gap-3 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-1 text-[11.5px] text-zinc-100">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: a.color }} />
            {a.ticker}
          </span>
          <span className="h-3 w-px bg-[#3a3a3a]" />
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: b.color }} />
            {b.ticker}
          </span>
        </div>
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* gridlines + Y labels */}
        {[max, (max + min) / 2, min].map((v, i) => {
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
                x={padX - 10}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#a1a1aa"
                fontFamily="ui-monospace, monospace"
              >
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {/* base 100 reference line */}
        <line
          x1={padX}
          x2={W - padX}
          y1={baseY}
          y2={baseY}
          stroke="#3f3f46"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <text
          x={W - padX + 8}
          y={baseY + 4}
          fontSize={10}
          fill="#71717a"
          fontFamily="ui-monospace, monospace"
        >
          100
        </text>

        {/* lines */}
        {[
          { d: an, color: a.color, name: a.ticker },
          { d: bn, color: b.color, name: b.ticker },
        ].map((line, idx) => (
          <g key={idx}>
            <motion.path
              d={path(line.d)}
              fill="none"
              stroke={line.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1], delay: idx * 0.15 }}
            />
            {line.d.map((v, i) => (
              <circle
                key={i}
                cx={padX + i * stepX}
                cy={padTop + ((max - v) / range) * innerH}
                r={3.5}
                fill="#0a0a0a"
                stroke={line.color}
                strokeWidth={2}
              />
            ))}
            {/* end label */}
            <g transform={`translate(${padX + (line.d.length - 1) * stepX + 8}, ${padTop + ((max - line.d[line.d.length - 1]) / range) * innerH - 8})`}>
              <text
                fontSize={11.5}
                fontWeight={700}
                fontFamily="ui-monospace, monospace"
                fill={line.color}
              >
                {Math.round(line.d[line.d.length - 1])}
              </text>
            </g>
          </g>
        ))}

        {/* x labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={padX + i * stepX}
            y={H - padBottom + 22}
            textAnchor="middle"
            fontSize={12}
            fill="#d4d4d8"
            fontFamily="ui-monospace, monospace"
          >
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}
