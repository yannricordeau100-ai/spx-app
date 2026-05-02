"use client";

import { useState } from "react";

const POS = "#10b981";
const NEG = "#f43f5e";

// Same niceTicks helper as bars-chart : rounds step to 1/2/5×magnitude.
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

// Layout — match Bars / Curve so switching tabs doesn't shift the page.
const W = 920;
const H = 420;
const PAD_LEFT = 96;
const PAD_RIGHT = 50;
const PAD_TOP = 56;
const PAD_BOTTOM = 80;
const INNER_W = W - PAD_LEFT - PAD_RIGHT;
const INNER_H = H - PAD_TOP - PAD_BOTTOM;
const DX = 22;
const DY = -14;

/**
 * Variation chart — calque sur la structure de Bars : SVG static (pas de
 * rotation, pas d'effet 3D dynamique), même angle isométrique (DX/DY),
 * même Y-axis ticks (5 valeurs, format strict, taille agrandie), même
 * comportement de hover (dim des autres barres).
 *
 * Ce qui diffère de Bars : data (deltas YoY), bar style (Glass towers
 * translucides), couleurs (vert / rouge selon le signe).
 */
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

  const dataMax = Math.max(...deltas, 0);
  const dataMin = Math.min(...deltas, 0);
  const hasPositive = dataMax > 0;
  const hasNegative = dataMin < 0;
  // Échelle adaptative : si le data n'a que des positifs (ou que des
  // négatifs), on n'affiche pas l'axe symétrique inutile, on cale le zéro
  // sur le bord et l'axe utilise toute la hauteur du chart.
  const tickMin = hasNegative ? Math.min(dataMin, 0) : 0;
  const tickMax = hasPositive ? Math.max(dataMax, 0) : 0;
  const tickValues = niceTicks(tickMin, tickMax, 5);
  const niceMin = Math.min(...tickValues, tickMin);
  const niceMax = Math.max(...tickValues, tickMax);
  const niceRange = niceMax - niceMin || 1;
  const slot = INNER_W / Math.max(deltas.length, 1);
  const barW = Math.min(slot * 0.4, 50);

  // suppress "unused" warning on unit (kept in API for future use)
  void unit;

  // y position pour une valeur — linéaire entre niceMin (bas) et niceMax (haut)
  const yFor = (v: number) =>
    PAD_TOP + ((niceMax - v) / niceRange) * INNER_H;
  const zeroY = yFor(0);

  const ticks = tickValues.map((v) => ({ v, y: yFor(v) }));

  function topPath(x: number, y: number, w: number) {
    return `M ${x},${y} L ${x + w},${y} L ${x + w + DX},${y + DY} L ${x + DX},${y + DY} Z`;
  }
  function sidePath(x: number, y: number, h: number, w: number) {
    return `M ${x + w},${y} L ${x + w + DX},${y + DY} L ${x + w + DX},${y + h + DY} L ${x + w},${y + h} Z`;
  }

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

      <svg width="100%" height="420" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
        <defs>
          {[POS, NEG].map((c, k) => (
            <g key={k}>
              <linearGradient id={`dlt-front-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="0.55" />
                <stop offset="50%" stopColor={c} stopOpacity="0.3" />
                <stop offset="100%" stopColor={c} stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id={`dlt-top-${k}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
                <stop offset="100%" stopColor={c} stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id={`dlt-side-${k}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={c} stopOpacity="0.4" />
                <stop offset="100%" stopColor={c} stopOpacity="0.1" />
              </linearGradient>
              <radialGradient id={`dlt-halo-${k}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={c} stopOpacity="0.7" />
                <stop offset="100%" stopColor={c} stopOpacity="0" />
              </radialGradient>
            </g>
          ))}
        </defs>

        {/* Y guidelines + Y labels — comme dans Bars */}
        {ticks.map(({ y }, i) => (
          <line
            key={`gl-${i}`}
            x1={PAD_LEFT}
            x2={PAD_LEFT + INNER_W}
            y1={y}
            y2={y}
            stroke="#1a1a1a"
            strokeWidth={1}
            strokeDasharray="3 6"
          />
        ))}
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
            {v > 0 ? "+" : ""}
            {(Math.round(v * 10) / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
          </text>
        ))}

        {/* Zero line plus marquée */}
        <line
          x1={PAD_LEFT}
          x2={PAD_LEFT + INNER_W}
          y1={zeroY}
          y2={zeroY}
          stroke="#3f3f46"
          strokeWidth={1.5}
        />

        {deltas.map((pct, i) => {
          const x = PAD_LEFT + slot * i + (slot - barW) / 2;
          const isPos = pct >= 0;
          const k = isPos ? 0 : 1;
          const c = isPos ? POS : NEG;
          const isHover = hover === i;
          // Bar va de zéro à pct (haut ou bas selon le signe)
          const yTop = Math.min(yFor(pct), zeroY);
          const yBot = Math.max(yFor(pct), zeroY);
          const h = Math.max(2, yBot - yTop);

          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                opacity: hover === null || isHover ? 1 : 0.5,
                transition: "opacity 200ms ease-out",
                cursor: "pointer",
              }}
            >
              {/* Floor halo glow under tower */}
              <ellipse
                cx={x + barW / 2 + DX / 2}
                cy={yBot + 4}
                rx={barW * 1.2}
                ry={11}
                fill={`url(#dlt-halo-${k})`}
              />
              {/* Right (shadow) face */}
              <path
                d={sidePath(x, yTop, h, barW)}
                fill={`url(#dlt-side-${k})`}
                stroke={c}
                strokeOpacity={0.55}
                strokeWidth={0.6}
              />
              {/* Front face — translucent glass */}
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={h}
                rx={1.5}
                fill={`url(#dlt-front-${k})`}
                stroke={c}
                strokeOpacity={isHover ? 1 : 0.85}
                strokeWidth={isHover ? 1.5 : 1}
              />
              {/* Inner left-edge shine (glass cue) */}
              <rect
                x={x + 2}
                y={yTop + 2}
                width={Math.max(2, barW * 0.18)}
                height={h - 4}
                fill="#ffffff"
                fillOpacity={0.18}
                rx={1}
              />
              {/* Top face — light catching */}
              <path
                d={topPath(x, yTop, barW)}
                fill={`url(#dlt-top-${k})`}
                stroke={c}
                strokeOpacity={0.85}
                strokeWidth={0.5}
              />

              {/* Pct label — taille agrandie + plus d'espace */}
              <text
                x={x + barW / 2 + DX / 2}
                y={isPos ? yTop + DY - 20 : yBot + DY + 28}
                textAnchor="middle"
                fontSize={17}
                fontWeight={700}
                fill={c}
                fontFamily="ui-monospace, monospace"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
              >
                {isPos ? "+" : ""}
                {pct.toFixed(1)} %
              </text>

              {/* Year label — taille agrandie */}
              <text
                x={x + barW / 2 + DX / 2}
                y={H - PAD_BOTTOM + 26}
                textAnchor="middle"
                fontSize={17}
                fill="#e4e4e7"
                fontFamily="ui-monospace, monospace"
                fontWeight={600}
              >
                {labels[i + 1] ?? ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
