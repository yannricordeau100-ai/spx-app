"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Download } from "lucide-react";
import { AnomalyInfo } from "@/components/anomaly-info";
import type { Anomaly } from "@/lib/brand";
import { formatUnit } from "@/lib/data";
import type { CompanyEvent } from "@/lib/events";
import { EventDotsSVG, EventDotsOverlay } from "@/components/charts/event-dots";
import { downloadSvgAsPng, buildYearGroups } from "@/lib/chart-export";
import { ChartMiniLogo } from "@/components/charts/chart-mini-logo";

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
// PAD_RIGHT = 70 (vs 50 avant) pour donner de la place au label TTM
// horizontal (sinon coupé par le bord droit du SVG en mode crowded).
const PAD_RIGHT = 70;
const PAD_TOP = 40;
const PAD_BOTTOM = 90;

/**
 * Split d'un label trimestriel "T1 21" → { top: "T1", bottom: "21" }.
 * Mêmes specs que dans bars-3d-variants.tsx (template uniforme).
 */
function splitQuarterLabel(label: string): { top: string; bottom: string; isQuarter: boolean } {
  if (!label) return { top: "", bottom: "", isQuarter: false };
  const m = label.match(/^(T[1-4])\s+(\d{2,4})$/);
  if (m) return { top: m[1], bottom: m[2], isQuarter: true };
  return { top: label, bottom: "", isQuarter: false };
}
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
  ttm = null,
  ttmLabel = "TTM",
}: {
  data: number[];
  labels: string[];
  unit: string;
  color?: string;
  anomalies?: Anomaly[];
  events?: CompanyEvent[];
  /** Trailing 12 months : point + segment pointillé en fin de courbe. */
  ttm?: number | null;
  ttmLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Garde-fou : si pas de data utilisable, ne rien afficher au lieu de crasher.
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  // Étend data + labels avec TTM si fourni. Le dernier point est rendu
  // en pointillé pour signaler "12 derniers mois" (pas une année calendaire).
  const hasTTM = ttm != null && Number.isFinite(ttm);
  const allData = hasTTM ? [...data, ttm as number] : data;
  const allLabels = hasTTM ? [...labels, ttmLabel] : labels;
  const ttmIndex = hasTTM ? allData.length - 1 : -1;
  const yearGroups = buildYearGroups(allLabels);

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  // Y-axis adaptive : si toutes les valeurs sont >> 0 (NFLX abonnés
  // 200-325M), on évite d'ancrer à 0 qui écraserait la lecture du graph.
  // Heuristique : si dataMin > 30% de dataMax, axe commence proche du min.
  const dataMaxRaw = Math.max(...allData, 0);
  const dataMinRaw = Math.min(...allData, 0);
  const useDataMin = dataMinRaw > 0 && dataMinRaw > dataMaxRaw * 0.3;
  const dataMin = useDataMin ? dataMinRaw : Math.min(0, ...allData);
  const dataMax = dataMaxRaw;
  const tickValues = niceTicks(dataMin, dataMax, 5);
  const min = Math.min(...tickValues, dataMin);
  const max = Math.max(...tickValues, dataMax);
  const range = max - min || 1;
  // Densité crowded : > 12 points -> labels sur 2 lignes horizontales
  // (T1/T2/T3/T4 ligne 1, année ligne 2). Rotation -45° rejetée par Yann.
  const isCrowded = allData.length > 12;
  const xLabelFontSize = isCrowded ? 13 : 14;
  const baselineY = PAD_TOP + innerH;

  const stepX = allData.length > 1 ? innerW / (allData.length - 1) : innerW;
  const points = allData.map((v, i) => [
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
        ref={svgRef}
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

        {/* Segment pointillé entre dernier point calendaire et TTM (si présent) */}
        {hasTTM && points.length >= 2 && (() => {
          const last = points[points.length - 1];
          const prev = points[points.length - 2];
          return (
            <line
              x1={prev[0]}
              y1={prev[1]}
              x2={last[0]}
              y2={last[1]}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeLinecap="round"
              opacity={0.7}
            />
          );
        })()}

        {/* Year nodes (+ TTM dot stylé différemment) */}
        {points.map(([x, y], i) => {
          const isHover = hover === i;
          const isAnomaly = anomalyByIndex.has(i);
          const isTTM = i === ttmIndex;
          return (
            <g
              key={`n-${i}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer", opacity: isTTM ? 0.8 : 1 }}
            >
              {isTTM ? (
                /* TTM : cercle creux pointillé (vs cercle plein pour années) */
                <circle cx={x} cy={y} r={isHover ? 9 : 7} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 2" />
              ) : (
                <>
                  <circle cx={x} cy={y} r={isHover ? 11 : 8} fill={color} fillOpacity={0.55} filter={`url(#${idGlow})`} />
                  <circle cx={x} cy={y} r={isHover ? 4 : 2.8} fill="#ffffff" />
                </>
              )}
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
              {(() => {
                // Quarter only sur l'axe X (T1/T2/T3/T4). Year est rendu UNE
                // SEULE FOIS via le year-band en bas (cf. yearGroups.map).
                const split = splitQuarterLabel(allLabels[i] ?? "");
                const yQuarter = H - PAD_BOTTOM + 26;
                const fz = xLabelFontSize;
                const fill = isTTM ? "#a1a1aa" : "#e4e4e7";
                const fw = isTTM ? 500 : 600;
                return (
                  <text
                    x={x}
                    y={yQuarter}
                    textAnchor="middle"
                    fontSize={fz}
                    fill={fill}
                    fontFamily="ui-monospace, monospace"
                    fontWeight={fw}
                    fontStyle={isTTM ? "italic" : "normal"}
                    style={isTTM ? { cursor: "help" } : undefined}
                  >
                    {split.top}
                    {isTTM && (
                      <title>TTM = Trailing Twelve Months : les 12 derniers mois publiés (4 derniers trimestres connus). Permet de voir la tendance la plus récente sans attendre la clôture annuelle.</title>
                    )}
                  </text>
                );
              })()}
              {/* Valeur au-dessus de CHAQUE point (toujours visible). En mode
                  crowded on alterne up/down pour éviter chevauchements. */}
              {!isTTM && (
                <text
                  x={x}
                  y={isCrowded ? (i % 2 === 0 ? y - 14 : y - 26) : y - 18}
                  textAnchor="middle"
                  fontSize={isCrowded ? 11 : 14}
                  fontWeight={isHover ? 800 : 600}
                  fill={isHover ? "#fafafa" : "#d4d4d8"}
                  fontFamily="ui-monospace, monospace"
                  style={isHover ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
                >
                  {Math.round(Number(allData[i]))}
                </text>
              )}
            </g>
          );
        })}

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

        {/* Year band : 1 année = 1 bracket sous l'axe X. L'année apparaît
            UNE seule fois par groupe de quarters consécutifs. */}
        {yearGroups.map((g) => {
          const xStart = points[g.startIdx]?.[0] ?? 0;
          const xEnd = points[g.endIdx]?.[0] ?? 0;
          const yLine = H - PAD_BOTTOM + 46;
          const yText = H - PAD_BOTTOM + 60;
          const tickH = 4;
          const single = g.startIdx === g.endIdx;
          const yearFull = g.year.length === 2 ? `20${g.year}` : g.year;
          return (
            <g key={`yg-${g.startIdx}`}>
              {!single && (
                <>
                  <line x1={xStart} y1={yLine} x2={xEnd} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                  <line x1={xStart} y1={yLine - tickH} x2={xStart} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                  <line x1={xEnd} y1={yLine - tickH} x2={xEnd} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                </>
              )}
              <text
                x={(xStart + xEnd) / 2}
                y={yText}
                textAnchor="middle"
                fontSize={13}
                fill="#a1a1aa"
                fontFamily="ui-monospace, monospace"
                fontWeight={500}
              >
                {yearFull}
              </text>
            </g>
          );
        })}

        {/* Mini-logo Mettrik AI (home-style). Caché à l'export et remplacé
            par un grand watermark (cf. chart-export.ts). */}
        <ChartMiniLogo x={PAD_LEFT + 6} y={PAD_TOP - 18} height={14} gradientId="mini-logo-curve" />
      </svg>

      {/* Bouton download (capture SVG + watermark → PNG) */}
      <button
        type="button"
        onClick={() => {
          if (svgRef.current) {
            downloadSvgAsPng(svgRef.current, `mettrik-curve-${Date.now()}.png`);
          }
        }}
        aria-label="Télécharger le graphique"
        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full border border-white/5 bg-black/20 text-zinc-500 opacity-50 backdrop-blur transition-all hover:border-white/20 hover:bg-black/50 hover:text-zinc-100 hover:opacity-100"
      >
        <Download className="size-4" />
      </button>
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
