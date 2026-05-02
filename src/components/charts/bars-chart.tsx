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
 * Generates "nice" round tick values between min and max for axis scale.
 * Rounds the step to 1, 2, 5, or 10 × magnitude so labels look clean
 * (10, 20, 50, 100 ...) instead of derived from raw data extremes.
 */
function niceTicks(min: number, max: number, count = 5): number[] {
  if (max === min) return [min];
  const range = max - min;
  const roughStep = range / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  let step;
  if (normalized < 1.5) step = 1;
  else if (normalized < 3) step = 2;
  else if (normalized < 7) step = 5;
  else step = 10;
  step *= magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 1000; v += step) {
    out.push(Math.round(v * 1e6) / 1e6); // strip float noise
  }
  return out;
}

const W = 920;
const H = 420;
const PAD_LEFT = 96;
const PAD_RIGHT = 50;
const PAD_TOP = 40;
const PAD_BOTTOM = 80;
const DX = 22;
const DY = -14;

/**
 * Bars chart — "Neon Outline" promoted from chart-lab. Hollow bars with a
 * vibrant neon stroke, soft inner glow halo behind, faint top-down inner
 * gradient. 3D depth via top + right wireframe outlines (parallelograms).
 *
 * Reverted from the rounded-top experiment (rejected). Pure SVG, single tree.
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

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const dataMin = Math.min(0, ...data);
  const dataMax = Math.max(...data, 0);
  // Compute "nice" tick values rounded to 1/2/5×magnitude. The chart's actual
  // scale spans the rounded min..max so the data fits within the gridlines.
  const tickValues = niceTicks(dataMin, dataMax, 5);
  const min = Math.min(...tickValues, dataMin);
  const max = Math.max(...tickValues, dataMax);
  const range = max - min || 1;
  const zeroY = PAD_TOP + ((max - 0) / range) * innerH;

  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.42, 56);

  const u = formatUnit(unit);
  const header = axisHeader(unit);
  const intTicks = isCurrencyLike(unit);

  const yoyPct = data.map((v, i) => {
    if (i === 0) return null;
    const prev = data[i - 1];
    if (!prev) return null;
    return ((v - prev) / Math.abs(prev)) * 100;
  });

  const ticks = tickValues.map((v) => ({
    v,
    y: PAD_TOP + ((max - v) / range) * innerH,
  }));

  const anomalyByIndex = new Map(anomalies.map((a) => [a.index, a]));

  const idGlow = `bn-glow-${color.slice(1)}`;
  const idFill = `bn-fill-${color.slice(1)}`;

  return (
    <div className="relative w-full">
      <div className="mb-2 flex items-center justify-start">
        <span className="font-mono text-[12px] font-semibold text-zinc-200">{header}</span>
      </div>

      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <filter id={idGlow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <linearGradient id={idFill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Y guidelines */}
        {ticks.map(({ y }, i) => (
          <line
            key={`gl-${i}`}
            x1={PAD_LEFT}
            x2={PAD_LEFT + innerW}
            y1={y}
            y2={y}
            stroke="#1a1a1a"
            strokeWidth={1}
            strokeDasharray="3 6"
          />
        ))}

        {/* Y labels — taille agrandie */}
        {ticks.map(({ v, y }, i) => (
          <text
            key={`yn-${i}`}
            x={PAD_LEFT - 12}
            y={y + 5}
            textAnchor="end"
            fontSize={16}
            fontWeight={500}
            fill="#e4e4e7"
            fontFamily="ui-monospace, monospace"
          >
            {intTicks ? Math.round(v).toLocaleString("fr-FR") : (Math.round(v * 10) / 10).toLocaleString("fr-FR")}
          </text>
        ))}

        {/* Zero line */}
        {min < 0 && max > 0 && (
          <line
            x1={PAD_LEFT}
            x2={PAD_LEFT + innerW}
            y1={zeroY}
            y2={zeroY}
            stroke="#3f3f46"
            strokeWidth={1.5}
          />
        )}

        {data.map((v, i) => {
          const x = PAD_LEFT + slot * i + (slot - barW) / 2;
          const yTop = PAD_TOP + ((max - Math.max(v, 0)) / range) * innerH;
          const yBot = PAD_TOP + ((max - Math.min(v, 0)) / range) * innerH;
          const h = Math.max(2, yBot - yTop);
          const isHover = hover === i;
          const yPct = yoyPct[i];
          const yoyColor =
            yPct == null ? "#a1a1aa" : yPct >= 0 ? "#10b981" : "#f43f5e";
          const isAnomaly = anomalyByIndex.has(i);

          const topPath = `M ${x},${yTop} L ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + DX},${yTop + DY} Z`;
          const sidePath = `M ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + barW + DX},${yBot + DY} L ${x + barW},${yBot} Z`;

          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.07 * i, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                opacity: hover === null || isHover ? 1 : 0.5,
                transition: "opacity 200ms ease-out",
                cursor: "pointer",
              }}
            >
              {/* Halo glow behind the bar */}
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={h}
                fill={color}
                fillOpacity={isHover ? 0.32 : 0.15}
                filter={`url(#${idGlow})`}
              />
              {/* Subtle inner gradient fill */}
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={h}
                fill={`url(#${idFill})`}
              />
              {/* Top face — outline only with glow */}
              <path
                d={topPath}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                filter={`url(#${idGlow})`}
              />
              <path
                d={topPath}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              {/* Right face — outline only, dimmer */}
              <path
                d={sidePath}
                fill="none"
                stroke={color}
                strokeWidth={1.2}
                strokeOpacity={0.6}
                strokeLinejoin="round"
              />
              {/* Front face — neon stroke, sharp corners */}
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={h}
                fill="none"
                stroke={color}
                strokeWidth={isHover ? 2.2 : 1.6}
              />

              {/* Anomaly marker */}
              {isAnomaly && (
                <circle
                  cx={x + barW / 2 + DX / 2}
                  cy={yTop + DY / 2}
                  r={4.5}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  filter={`url(#${idGlow})`}
                />
              )}

              {/* YoY % above — espace augmenté pour ne pas coller à la barre */}
              {yPct != null && (
                <motion.text
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.07 * i + 0.4, duration: 0.4 }}
                  x={x + barW / 2 + DX / 2}
                  y={yTop + DY - 24}
                  textAnchor="middle"
                  fontSize={17}
                  fontWeight={700}
                  fill={yoyColor}
                  fontFamily="ui-monospace, monospace"
                  style={{ filter: `drop-shadow(0 0 4px ${yoyColor})` }}
                >
                  {yPct >= 0 ? "+" : ""}
                  {yPct.toFixed(1)} %
                </motion.text>
              )}

              {/* Hover value — taille agrandie */}
              {isHover && (
                <text
                  x={x + barW / 2 + DX / 2}
                  y={yTop + DY - 48}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight={800}
                  fill="#fafafa"
                  fontFamily="ui-monospace, monospace"
                  style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                >
                  {v}
                  {u && (
                    <tspan fill="#a1a1aa" fontSize="14">
                      {" "}
                      {u}
                    </tspan>
                  )}
                </text>
              )}

              {/* X-axis label — taille agrandie */}
              <text
                x={x + barW / 2 + DX / 2}
                y={H - PAD_BOTTOM + 26}
                textAnchor="middle"
                fontSize={17}
                fill="#e4e4e7"
                fontFamily="ui-monospace, monospace"
                fontWeight={600}
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
