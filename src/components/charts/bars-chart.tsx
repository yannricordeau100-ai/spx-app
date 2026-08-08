"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Anomaly } from "@/lib/brand";
import { AnomalyInfo } from "@/components/anomaly-info";
import { formatUnit } from "@/lib/data";
import { chartAxisHeader, isCurrencyLikeUnit } from "@/lib/chart-axis-header";
import { useT } from "@/lib/i18n/provider";

// Yann 13 mai 2026 v4 : helpers axisHeader/isCurrency centralisés.
const axisHeader = chartAxisHeader;
function isCurrencyLike(unit: string): boolean {
  return isCurrencyLikeUnit(unit);
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
// Yann 8 août 2026 : plot élargi gauche+droite (96/50 -> 76/44), cf bars-3d.
const PAD_LEFT = 76;
const PAD_RIGHT = 44;
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
  ttm = null,
  ttmLabel = "TTM",
  variant = "neon3d",
}: {
  data: number[];
  labels: string[];
  unit: string;
  color?: string;
  anomalies?: Anomaly[];
  /** Trailing 12 months : barre supplémentaire à la fin si fourni (Q-1+Q-2+Q-3+Q-4). */
  ttm?: number | null;
  /** Label affiché sous la barre TTM. Default "TTM". */
  ttmLabel?: string;
  /** Style visuel du chart : neon3d (par défaut) ou classique 2D simple. */
  variant?: "neon3d" | "classic";
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Yann 15 mai 2026 : axis header locale-aware.
  const { locale } = useT();
  // Yann 15 mai 2026 : click sur la zone axe Y → toggle gauche / droite.
  const [yOnRight, setYOnRight] = useState(false);

  // Étend data + labels avec la barre TTM si fournie. La dernière barre
  // est ensuite stylée différemment (pointillé / opacité réduite) pour
  // qu'on comprenne que c'est "12 derniers mois" et pas une année calendaire.
  // Yann 15 mai 2026 : si TTM est un OUTLIER (somme cumulée 4Q >> max
  // périodes), on ne render PAS la barre TTM ni le label X. Affiché en
  // chip séparé en haut du chart (cf curve-chart.tsx pour l'implémentation).
  const rawHasTTM = ttm != null && Number.isFinite(ttm);
  const dataOnlyMaxRaw = data.length > 0 ? Math.max(...data) : 0;
  const ttmIsCumul = rawHasTTM && (ttm as number) > dataOnlyMaxRaw * 2;
  const hasTTM = rawHasTTM && !ttmIsCumul;
  const allData = hasTTM ? [...data, ttm as number] : data;
  const allLabels = hasTTM ? [...labels, ttmLabel] : labels;
  const ttmIndex = hasTTM ? allData.length - 1 : -1;

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  // Y-axis adaptive (Yann 13 mai 2026 v3, cohérent avec curve-chart).
  // Heuristique calculée sur `data` SEUL (sans TTM qui peut être un cumul
  // faussant la range). Zoom si range < 40 % de dataMax.
  // Si TTM est outlier (> 2x dataMax), exclu aussi de dataMax pour éviter
  // un axe Y qui va jusqu'au TTM-cumul (= barres data écrasées).
  const dataOnlyMax = Math.max(...data);
  const dataOnlyMin = Math.min(...data);
  const dataOnlyRange = dataOnlyMax - dataOnlyMin;
  const useDataMin =
    dataOnlyMin > 0 && dataOnlyRange < dataOnlyMax * 0.4;
  const ttmIsOutlier = hasTTM && (ttm as number) > dataOnlyMax * 2;
  const dataMaxRaw = ttmIsOutlier ? dataOnlyMax : Math.max(...allData);
  const dataMin = useDataMin ? dataOnlyMin : Math.min(0, ...allData);
  const dataMax = dataMaxRaw;
  const tickValues = niceTicks(dataMin, dataMax, 5);
  const min = Math.min(...tickValues, dataMin);
  const max = Math.max(...tickValues, dataMax);
  const range = max - min || 1;
  // baseline visuelle : si on n'ancre pas à 0, baseline = min de l'axe
  // (= bas de la chart), sinon = position du 0.
  const baselineValue = useDataMin ? min : 0;
  const zeroY = PAD_TOP + ((max - baselineValue) / range) * innerH;

  const slot = innerW / allData.length;
  const barW = Math.min(slot * 0.42, 56);

  const u = formatUnit(unit);
  const header = axisHeader(unit, locale);
  const intTicks = isCurrencyLike(unit);
  // Yann 15 mai 2026 : précision adaptative pour éviter doublons "29, 29".
  const intRounded = tickValues.map((v) => Math.round(v));
  const needsDecimal = intTicks && new Set(intRounded).size < tickValues.length;
  const formatTick = (v: number): string => {
    if (needsDecimal) {
      return (Math.round(v * 10) / 10).toLocaleString("fr-FR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
    }
    if (intTicks) return Math.round(v).toLocaleString("fr-FR");
    return (Math.round(v * 10) / 10).toLocaleString("fr-FR");
  };

  const yoyPct = allData.map((v, i) => {
    if (i === 0) return null;
    const prev = allData[i - 1];
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
      {/* Yann 17 mai 2026 : margin-bottom augmenté (mb-2 → mb-4) pour
          aérer la zone entre le label et le tick Y le plus haut. */}
      <div className="mb-4 flex items-center justify-start">
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

        {/* Yann 15 mai 2026 : TTM cumul affiché comme chip séparé en haut
            (pas comme barre, sinon écrase l'échelle). Position : haut-gauche
            si Y axis droite, haut-droite sinon. */}
        {ttmIsCumul && rawHasTTM && (() => {
          {/* Yann 9 août 2026 : unité = en-tête d'axe locale-aware + largeur
              adaptée au texte (120 fixe débordait sur "Mds $" longs). */}
          const ttmValueStr = (ttm as number).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
          const chipText = `TTM ${ttmValueStr}${header ? ` ${header}` : ""}`;
          const chipW = Math.max(90, Math.round(chipText.length * 6.8) + 16);
          const chipX = yOnRight ? PAD_LEFT + 180 : W - PAD_RIGHT - chipW - 10;
          return (
            <g>
              <rect
                x={chipX}
                y={8}
                width={chipW}
                height={24}
                rx={6}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.12)"
              />
              <text
                x={chipX + 8}
                y={24}
                fontSize={11}
                fontFamily="ui-monospace, monospace"
                fill="#a1a1aa"
              >
                TTM&nbsp;
                <tspan fill="#e4e4e7" fontWeight={600}>
                  {ttmValueStr}
                </tspan>
                {header ? <tspan fill="#a1a1aa">&nbsp;{header}</tspan> : null}
              </text>
            </g>
          );
        })()}

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

        {/* Y labels — taille agrandie. Yann 15 mai 2026 : côté toggle. */}
        {ticks.map(({ v, y }, i) => (
          <text
            key={`yn-${i}`}
            x={yOnRight ? PAD_LEFT + innerW + 12 : PAD_LEFT - 12}
            y={y + 5}
            textAnchor={yOnRight ? "start" : "end"}
            fontSize={16}
            fontWeight={500}
            fill="#e4e4e7"
            fontFamily="ui-monospace, monospace"
          >
            {formatTick(v)}
          </text>
        ))}

        {/* Zone cliquable invisible sur l'axe Y pour toggler gauche/droite.
            Yann 15 mai 2026. */}
        <rect
          x={yOnRight ? PAD_LEFT + innerW : 0}
          y={0}
          width={yOnRight ? W - (PAD_LEFT + innerW) : PAD_LEFT}
          height={H}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onClick={() => setYOnRight((v) => !v)}
        >
          <title>Cliquer pour basculer l&apos;axe Y à {yOnRight ? "gauche" : "droite"}</title>
        </rect>

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

        {allData.map((v, i) => {
          const x = PAD_LEFT + slot * i + (slot - barW) / 2;
          // En mode adaptif (useDataMin=true), les barres partent du bas
          // de l'axe (= baselineValue = min) jusqu'à la valeur.
          // En mode normal (anchor 0), comportement classique : bar va de 0
          // à v si positif, de v à 0 si négatif.
          const yTop = useDataMin
            ? PAD_TOP + ((max - v) / range) * innerH
            : PAD_TOP + ((max - Math.max(v, 0)) / range) * innerH;
          const yBot = useDataMin
            ? zeroY
            : PAD_TOP + ((max - Math.min(v, 0)) / range) * innerH;
          const h = Math.max(2, yBot - yTop);
          const isHover = hover === i;
          const yPct = yoyPct[i];
          const yoyColor =
            yPct == null ? "#a1a1aa" : yPct >= 0 ? "#10b981" : "#f43f5e";
          const isAnomaly = anomalyByIndex.has(i);
          const isTTM = i === ttmIndex;

          const topPath = `M ${x},${yTop} L ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + DX},${yTop + DY} Z`;
          const sidePath = `M ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + barW + DX},${yBot + DY} L ${x + barW},${yBot} Z`;

          // Style classique : pas de 3D depth, fill plein.
          // Style neon3d : faces top + right + stroke.
          // TTM : pointillé partout (différencier des années calendaires).
          const ttmDash = isTTM ? "4 3" : undefined;
          const isClassic = variant === "classic";

          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.07 * i, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(i)}
              onClick={() => setHover((prev) => (prev === i ? null : i))}
              style={{
                opacity: hover === null || isHover ? 1 : 0.5,
                transition: "opacity 200ms ease-out",
                cursor: "pointer",
                touchAction: "manipulation" as const,
              }}
            >
              {isClassic ? (
                /* === Classic 2D bar === */
                <>
                  <rect
                    x={x}
                    y={yTop}
                    width={barW}
                    height={h}
                    fill={color}
                    fillOpacity={isTTM ? 0.35 : (isHover ? 0.85 : 0.7)}
                    stroke={color}
                    strokeWidth={isTTM ? 1.6 : 1.2}
                    strokeDasharray={ttmDash}
                    rx={2}
                  />
                </>
              ) : (
                /* === Neon3D bar (default) === */
                <>
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
                    strokeDasharray={ttmDash}
                    filter={`url(#${idGlow})`}
                  />
                  <path
                    d={topPath}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray={ttmDash}
                    strokeLinejoin="round"
                  />
                  {/* Right face — outline only, dimmer */}
                  <path
                    d={sidePath}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.2}
                    strokeOpacity={0.6}
                    strokeDasharray={ttmDash}
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
                    strokeDasharray={ttmDash}
                  />
                </>
              )}

              {/* Anomaly marker */}
              {isAnomaly && (
                <circle
                  cx={x + barW / 2 + (isClassic ? 0 : DX / 2)}
                  cy={yTop + (isClassic ? 0 : DY / 2)}
                  r={4.5}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  filter={isClassic ? undefined : `url(#${idGlow})`}
                />
              )}

              {/* YoY % above — espace augmenté pour ne pas coller à la barre */}
              {yPct != null && (
                <motion.text
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.07 * i + 0.4, duration: 0.4 }}
                  x={x + barW / 2 + (isClassic ? 0 : DX / 2)}
                  y={yTop + (isClassic ? -10 : DY - 24)}
                  textAnchor="middle"
                  fontSize={17}
                  fontWeight={700}
                  fill={yoyColor}
                  fontFamily="ui-monospace, monospace"
                  style={isClassic ? undefined : { filter: `drop-shadow(0 0 4px ${yoyColor})` }}
                >
                  {yPct >= 0 ? "+" : ""}
                  {yPct.toFixed(1)} %
                </motion.text>
              )}

              {/* Hover value — taille agrandie */}
              {isHover && (
                <text
                  x={x + barW / 2 + (isClassic ? 0 : DX / 2)}
                  y={yTop + (isClassic ? -34 : DY - 48)}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight={800}
                  fill="#fafafa"
                  fontFamily="ui-monospace, monospace"
                  style={isClassic ? undefined : { filter: `drop-shadow(0 0 4px ${color})` }}
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

              {/* X-axis label — taille agrandie. TTM en italique pour distinguer. */}
              <text
                x={x + barW / 2 + (variant === "classic" ? 0 : DX / 2)}
                y={H - PAD_BOTTOM + 26}
                textAnchor="middle"
                fontSize={isTTM ? 15 : 17}
                fill={isTTM ? "#a1a1aa" : "#e4e4e7"}
                fontFamily="ui-monospace, monospace"
                fontWeight={isTTM ? 500 : 600}
                fontStyle={isTTM ? "italic" : "normal"}
              >
                {allLabels[i] ?? ""}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {/* Yann 14 mai 2026 : bloc anomalies retiré (cf curve-chart). */}
    </div>
  );
}
