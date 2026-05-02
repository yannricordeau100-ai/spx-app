"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AnomalyInfo } from "@/components/anomaly-info";
import type { Anomaly } from "@/lib/brand";
import { formatUnit } from "@/lib/data";
import type { CompanyEvent } from "@/lib/events";
import { EventDotsSVG, EventDotsOverlay } from "@/components/charts/event-dots";

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
function isPercentLike(unit: string): boolean {
  return ["%", "% YoY"].includes(unit);
}

/** Same niceTicks helper as bars-chart : rounds step to 1/2/5×magnitude. */
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
    out.push(Math.round(v * 1e6) / 1e6);
  }
  return out;
}

/**
 * Format Y-axis tick value following Mettrik's strict rule (CLAUDE.md §6) :
 *   - currency-like ("$B", "$M", "B", "M") → integer values only, FR locale
 *   - percent-like ("%", "% YoY") → 1 decimal max, FR locale
 *   - other → 1 decimal max, FR locale
 */
function formatYTick(v: number, unit: string): string {
  if (isCurrencyLike(unit)) {
    return Math.round(v).toLocaleString("fr-FR");
  }
  if (isPercentLike(unit)) {
    return (Math.round(v * 10) / 10).toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    });
  }
  return (Math.round(v * 10) / 10).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}

const W = 920;
const H = 420;
const PAD_LEFT = 96;
const PAD_RIGHT = 50;
const PAD_TOP = 40;
const PAD_BOTTOM = 80;
const DX = 22;          // 3D depth offset (rightward)
const DY = -14;         // 3D depth offset (upward in SVG)

/**
 * Curve chart — promoted from chart-lab "Neon Wire 3D" :
 *   - Front curve : color stroke with strong glow filter, white core on top
 *   - Back curve : offset by (DX, DY), dimmer glow, gives 3D depth
 *   - Wall under the front curve : faint color gradient down to baseline
 *   - Connector lines from each year point front → back (depth ticks)
 *   - Glowing pulsating nodes at each data point
 *   - Faint horizontal grid behind everything
 *
 * Y-axis ticks follow Mettrik's strict format rule : integer for currency,
 * 1 decimal max for percent, FR locale.
 */
export function CurveChart({
  data,
  labels,
  unit,
  color = "#a78bfa",
  anomalies = [],
  events = [],
}: {
  data: number[];
  labels: string[];
  unit: string;
  color?: string;
  anomalies?: Anomaly[];
  events?: CompanyEvent[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const dataMin = Math.min(0, ...data);
  const dataMax = Math.max(...data, 0);
  // Nice round ticks (rule Mettrik §6).
  const tickValues = niceTicks(dataMin, dataMax, 5);
  const min = Math.min(...tickValues, dataMin);
  const max = Math.max(...tickValues, dataMax);
  const range = max - min || 1;
  const baselineY = PAD_TOP + innerH;

  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((v, i) => [
    PAD_LEFT + i * stepX,
    PAD_TOP + ((max - v) / range) * innerH,
  ] as const);

  const u = formatUnit(unit);
  const header = axisHeader(unit);

  const ticks = tickValues.map((v) => ({
    v,
    y: PAD_TOP + ((max - v) / range) * innerH,
  }));

  // Smoothed paths : front curve and back-offset curve.
  function smoothFrom(pts: readonly (readonly [number, number])[]) {
    return pts
      .map(([x, y], i) => {
        if (i === 0) return `M ${x},${y}`;
        const [px, py] = pts[i - 1];
        const cx = (px + x) / 2;
        return `Q ${cx},${py} ${x},${y}`;
      })
      .join(" ");
  }

  const frontPath = smoothFrom(points);
  const backPts = points.map(([x, y]) => [x + DX, y + DY] as const);
  const wallPath = `${frontPath} L ${points[points.length - 1][0]},${baselineY} L ${points[0][0]},${baselineY} Z`;

  const anomalyByIndex = new Map(anomalies.map((a) => [a.index, a]));

  const idGlow = `cv-glow-${color.slice(1)}`;
  const idWall = `cv-wall-${color.slice(1)}`;

  return (
    <div className="relative w-full">
      {/* Header d'unité — hors SVG (n'ajoute PAS de hauteur au graph
          puisque la hauteur du graph est fixée par le viewBox SVG en
          dessous). On le décale vers la droite via padding-left
          proportionnel pour qu'il s'aligne approximativement sur l'axe Y
          (PAD_LEFT = 96 / W = 920 ≈ 10.4 %). */}
      {header && (
        <div
          className="mb-1 font-mono text-[12px] font-semibold text-zinc-200"
          style={{ paddingLeft: `${(PAD_LEFT / W) * 100}%` }}
        >
          {header}
        </div>
      )}
      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <filter id={idGlow} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <linearGradient id={idWall} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
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

        {/* Y-axis labels — strict Mettrik formatting + taille agrandie */}
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
            {formatYTick(v, unit)}
          </text>
        ))}

        {/* Wall under front curve */}
        <motion.path
          d={wallPath}
          fill={`url(#${idWall})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        />

        {/* Back curve (3D depth cue) */}
        <motion.path
          d={smoothFrom(backPts)}
          fill="none"
          stroke={color}
          strokeOpacity="0.55"
          strokeWidth={2}
          strokeLinecap="round"
          filter={`url(#${idGlow})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.3 }}
        />

        {/* Front curve — outer color glow */}
        <motion.path
          d={frontPath}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          filter={`url(#${idGlow})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4 }}
        />
        {/* Front curve — bright white core */}
        <motion.path
          d={frontPath}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4 }}
        />

        {/* Depth-tick connectors at each data point */}
        {points.map(([x, y], i) => (
          <line
            key={`c-${i}`}
            x1={x}
            y1={y}
            x2={x + DX}
            y2={y + DY}
            stroke={color}
            strokeOpacity="0.4"
            strokeWidth={1}
          />
        ))}

        {/* Year nodes */}
        {points.map(([x, y], i) => {
          const isHover = hover === i;
          const isAnomaly = anomalyByIndex.has(i);
          return (
            <g
              key={`n-${i}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={x} cy={y} r={isHover ? 11 : 8} fill={color} fillOpacity={0.55} filter={`url(#${idGlow})`} />
              <circle cx={x} cy={y} r={isHover ? 4 : 2.8} fill="#ffffff" />
              {isAnomaly && (
                <circle
                  cx={x}
                  cy={y}
                  r={6}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              )}
              <text
                x={x}
                y={H - PAD_BOTTOM + 26}
                textAnchor="middle"
                fontSize={17}
                fill="#e4e4e7"
                fontFamily="ui-monospace, monospace"
                fontWeight={600}
              >
                {labels[i] ?? ""}
              </text>
              {isHover && (
                <text
                  x={x}
                  y={y - 22}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight={800}
                  fill="#fafafa"
                  fontFamily="ui-monospace, monospace"
                  style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                >
                  {data[i]}
                  {u && (
                    <tspan fill="#a1a1aa" fontSize="14">
                      {" "}
                      {u}
                    </tspan>
                  )}
                </text>
              )}
            </g>
          );
        })}

        {/* Last value floating at the end of the curve — taille agrandie */}
        {data.length > 0 && hover === null && (
          <text
            x={points[points.length - 1][0] + DX}
            y={points[points.length - 1][1] + DY - 16}
            textAnchor="middle"
            fontSize={17}
            fontWeight={700}
            fill={color}
            fontFamily="ui-monospace, monospace"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          >
            {data[data.length - 1]}
            {u && (
              <tspan fill="#a1a1aa" fontSize="14">
                {" "}
                {u}
              </tspan>
            )}
          </text>
        )}
        {/* Points de curiosité (événements clefs) sur l'axe X */}
        <EventDotsSVG
          events={events}
          xLabels={labels}
          padLeft={PAD_LEFT}
          innerW={innerW}
          padTop={PAD_TOP}
          innerH={innerH}
          color={color}
        />
      </svg>
      {/* Overlay HTML pour les popovers d'événements (clic sur point) */}
      <EventDotsOverlay
        events={events}
        xLabels={labels}
        svgW={W}
        svgH={H}
        padLeft={PAD_LEFT}
        innerW={innerW}
        padTop={PAD_TOP}
        innerH={innerH}
        color={color}
      />

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
