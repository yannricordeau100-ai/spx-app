"use client";

import { useState } from "react";
import type { CompanyEvent } from "@/lib/events";
import { EventDotsSVG, EventDotsOverlay } from "@/components/charts/event-dots";

/**
 * Essais bars 3D / iso (B26-B27) inspirés freepik isométrique.
 * Drop-in : même API que les autres bars charts.
 */

/** Header d'unité affiché au-dessus du graphe (mêmes mappings que curve-chart). */
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

const W = 920, H = 420;
const PAD_LEFT = 96, PAD_RIGHT = 50, PAD_TOP = 40, PAD_BOTTOM = 80;
const INNER_W = W - PAD_LEFT - PAD_RIGHT;
const INNER_H = H - PAD_TOP - PAD_BOTTOM;

function niceTicks(min: number, max: number, count = 5): number[] {
  if (max === min) return [min];
  const range = max - min;
  const roughStep = range / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  let step = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  step *= magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 1000; v += step) {
    out.push(Math.round(v * 1e6) / 1e6);
  }
  return out;
}

type Props = {
  data: number[];
  labels: string[];
  unit?: string;
  color?: string;
  events?: CompanyEvent[];
  /** Trailing 12 months : barre supplémentaire à la fin si fourni. */
  ttm?: number | null;
  /** Label sous la barre TTM. Default "TTM". */
  ttmLabel?: string;
  /** Style visuel : iso3d (par défaut, perspective isométrique) ou classique 2D. */
  variant?: "iso3d" | "classic";
};

/* ============================================================ */
/* B26 — ISO 3D BARS (parallépipèdes en isométrique vrai)         */
/* Avec support TTM (barre supplémentaire pointillée) et variant   */
/* "classic" pour basculer en 2D flat.                             */
/* ============================================================ */
export function BarsIso3DStack({ data, labels, unit = "", color = "#a78bfa", events = [], ttm = null, ttmLabel = "TTM", variant = "iso3d" }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  // Étend data + labels avec TTM si fourni. Dernière barre stylée distinctement.
  const hasTTM = ttm != null && Number.isFinite(ttm);
  const allData = hasTTM ? [...data, ttm as number] : data;
  const allLabels = hasTTM ? [...labels, ttmLabel] : labels;
  const ttmIndex = hasTTM ? allData.length - 1 : -1;
  const isClassic = variant === "classic";

  // Y-axis adaptive : si toutes les valeurs sont >> 0 (ex : NFLX abonnés
  // 200-325M), on évite d'ancrer à 0 qui écraserait la lecture du graph.
  // Heuristique : si dataMin > 30% de dataMax, on commence l'axe à un seuil
  // proche du min (rounding par niceTicks) au lieu de forcer 0.
  // Sinon (valeurs proches de 0 ou negatives), on garde 0 comme baseline.
  const dataMaxRaw = Math.max(...allData, 0);
  const dataMinRaw = Math.min(...allData, 0);
  const useDataMin = dataMinRaw > 0 && dataMinRaw > dataMaxRaw * 0.3;
  const ticks = niceTicks(useDataMin ? dataMinRaw : 0, dataMaxRaw, 5);
  const max = Math.max(...ticks, ...allData);
  const min = Math.min(...ticks, useDataMin ? dataMinRaw : 0);
  const range = (max - min) || 1;
  const slot = INNER_W / allData.length;
  const barW = Math.min(slot * 0.42, 56);
  const baseY = PAD_TOP + INNER_H;
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  // Densité crowded : > 12 colonnes -> rotate labels -45° + hide value
  // labels au-dessus des barres (sinon ils se chevauchent visuellement
  // comme '207.249.213' vu sur staging avec NFLX 21 colonnes).
  const isCrowded = allData.length > 12;
  const labelFontSize = isCrowded ? 11 : 17;
  const valueFontSize = isCrowded ? 0 : 15;
  const labelRotate = isCrowded ? -45 : 0;
  const DX = isClassic ? 0 : 26;
  const DY = isClassic ? 0 : -16;
  const header = axisHeader(unit);

  return (
    <div className="relative w-full">
      {/* Header d'unité — hors SVG, décalé vers la droite par padding-left
          proportionnel à PAD_LEFT pour s'aligner sur l'axe Y. */}
      {header && (
        <div
          className="mb-1 font-mono text-[12px] font-semibold text-zinc-200"
          style={{ paddingLeft: `${(PAD_LEFT / W) * 100}%` }}
        >
          {header}
        </div>
      )}
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b26-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.95} />
          <stop offset="100%" stopColor={color} stopOpacity={0.6} />
        </linearGradient>
        <linearGradient id="b26-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} stopOpacity={0.45} />
        </linearGradient>
        <linearGradient id="b26-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.85} />
          <stop offset="100%" stopColor={color} stopOpacity={0.85} />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <line key={i} x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={yFor(v)} y2={yFor(v)}
          stroke="#1a1a1a" strokeDasharray="3 6" strokeWidth={1} />
      ))}
      {ticks.map((v, i) => (
        <text key={i} x={PAD_LEFT - 12} y={yFor(v) + 5} textAnchor="end" fontSize={16}
          fontWeight={500} fill="#e4e4e7" fontFamily="ui-monospace, monospace">
          {(Math.round(v * 10) / 10).toLocaleString("fr-FR")}
        </text>
      ))}
      {allData.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(v);
        const h = baseY - yT;
        const isH = hover === i;
        const isTTM = i === ttmIndex;
        // TTM : opacité réduite + pointillé sur stroke pour signaler "12 derniers mois".
        const ttmDash = isTTM ? "5 4" : undefined;
        const ttmOpacity = isTTM ? 0.6 : 1;
        const top = `M ${x} ${yT} L ${x + barW} ${yT} L ${x + barW + DX} ${yT + DY} L ${x + DX} ${yT + DY} Z`;
        const side = `M ${x + barW} ${yT} L ${x + barW + DX} ${yT + DY} L ${x + barW + DX} ${baseY + DY} L ${x + barW} ${baseY} Z`;
        const front = `M ${x} ${yT} L ${x + barW} ${yT} L ${x + barW} ${baseY} L ${x} ${baseY} Z`;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: (hover === null || isH ? 1 : 0.5) * ttmOpacity, cursor: "pointer", transition: "opacity 200ms" }}>
            {/* shadow under bar (skip in classic / TTM) */}
            {!isClassic && !isTTM && (
              <ellipse cx={x + barW / 2 + DX / 2} cy={baseY + 6} rx={barW * 0.7} ry={6} fill="#000" fillOpacity={0.4} />
            )}
            {isClassic ? (
              /* Classic 2D flat bar */
              <rect
                x={x}
                y={yT}
                width={barW}
                height={h}
                fill={color}
                fillOpacity={isTTM ? 0.35 : 0.75}
                stroke={color}
                strokeWidth={isTTM ? 1.6 : 1.2}
                strokeDasharray={ttmDash}
                rx={2}
              />
            ) : (
              /* Iso 3D : front + side + top */
              <>
                <path d={front} fill="url(#b26-front)" stroke="#050505" strokeWidth={0.6} strokeDasharray={ttmDash} />
                <path d={side} fill="url(#b26-side)" stroke="#050505" strokeWidth={0.6} strokeDasharray={ttmDash} />
                <path d={top} fill="url(#b26-top)" stroke="#050505" strokeWidth={0.6} strokeDasharray={ttmDash} />
              </>
            )}
            {/* value above : caché en mode crowded (>12 cols) ou montré
                seulement au hover. Sinon les chiffres se chevauchent. */}
            {valueFontSize > 0 && (
              <text x={x + barW / 2 + (isClassic ? 0 : DX / 2)} y={yT + (isClassic ? -10 : DY - 12)} textAnchor="middle" fontSize={valueFontSize} fontWeight={700}
                fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}
              </text>
            )}
            {/* En mode crowded : montre la valeur uniquement sur la barre survolée. */}
            {valueFontSize === 0 && isH && (
              <text x={x + barW / 2 + (isClassic ? 0 : DX / 2)} y={yT + (isClassic ? -10 : DY - 12)} textAnchor="middle" fontSize={14} fontWeight={700}
                fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}
              </text>
            )}
            {/* x label : rotation -45° en crowded mode pour éviter chevauchement. */}
            <text
              x={x + barW / 2 + (isClassic ? 0 : DX / 2)}
              y={H - PAD_BOTTOM + 26}
              textAnchor={isCrowded ? "end" : "middle"}
              fontSize={isTTM ? Math.max(labelFontSize - 2, 11) : labelFontSize}
              fill={isTTM ? "#a1a1aa" : "#e4e4e7"}
              fontFamily="ui-monospace, monospace"
              fontWeight={isTTM ? 500 : 600}
              fontStyle={isTTM ? "italic" : "normal"}
              transform={labelRotate ? `rotate(${labelRotate}, ${x + barW / 2 + (isClassic ? 0 : DX / 2)}, ${H - PAD_BOTTOM + 26})` : undefined}
              style={isTTM ? { cursor: "help" } : undefined}
            >
              {allLabels[i]}
              {isTTM && (
                <title>TTM = Trailing Twelve Months : les 12 derniers mois publiés (4 derniers trimestres connus). Permet de voir la tendance la plus récente sans attendre la clôture annuelle.</title>
              )}
            </text>
          </g>
        );
      })}
      <EventDotsSVG
        events={events}
        xLabels={allLabels}
        padLeft={PAD_LEFT}
        innerW={INNER_W}
        padTop={PAD_TOP}
        innerH={INNER_H}
        color={color}
      />
    </svg>
    <EventDotsOverlay
      events={events}
      xLabels={allLabels}
      svgW={W}
      svgH={H}
      padLeft={PAD_LEFT}
      innerW={INNER_W}
      padTop={PAD_TOP}
      innerH={INNER_H}
      color={color}
    />
    </div>
  );
}

/* ============================================================ */
/* B27 — RIBBON STAIRS 3D                                         */
/* Marches d'escalier en perspective, chaque marche = une année.  */
/* Inspiration freepik : 3D bar with ribbon top freepik image 4.   */
/* ============================================================ */
export function BarsRibbonStairs3D({ data, labels, color = "#22d3ee" }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(0, Math.max(...data, 0), 5);
  const max = Math.max(...ticks, ...data);
  const range = max || 1;
  const slot = INNER_W / data.length;
  const barW = Math.min(slot * 0.5, 64);
  const baseY = PAD_TOP + INNER_H;
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  const DX = 32, DY = -20;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b27-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <line key={i} x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={yFor(v)} y2={yFor(v)}
          stroke="#1a1a1a" strokeDasharray="3 6" strokeWidth={1} />
      ))}
      {ticks.map((v, i) => (
        <text key={i} x={PAD_LEFT - 12} y={yFor(v) + 5} textAnchor="end" fontSize={16}
          fontWeight={500} fill="#e4e4e7" fontFamily="ui-monospace, monospace">
          {(Math.round(v * 10) / 10).toLocaleString("fr-FR")}
        </text>
      ))}
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(v);
        const h = baseY - yT;
        const isH = hover === i;
        // ribbon-top : top face avec arrondi avant
        const top = `M ${x} ${yT} L ${x + barW} ${yT} Q ${x + barW + DX / 2} ${yT + DY / 2} ${x + barW + DX} ${yT + DY} L ${x + DX} ${yT + DY} Q ${x + DX / 2} ${yT + DY / 2} ${x} ${yT} Z`;
        const side = `M ${x + barW} ${yT} L ${x + barW + DX} ${yT + DY} L ${x + barW + DX} ${baseY + DY} L ${x + barW} ${baseY} Z`;
        const front = `M ${x} ${yT} L ${x + barW} ${yT} L ${x + barW} ${baseY} L ${x} ${baseY} Z`;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.5, cursor: "pointer", transition: "opacity 200ms" }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={baseY + 6} rx={barW * 0.75} ry={6} fill="#000" fillOpacity={0.4} />
            <path d={front} fill="url(#b27-front)" stroke="#050505" strokeWidth={0.6} />
            <path d={side} fill={color} fillOpacity={0.55} stroke="#050505" strokeWidth={0.6} />
            <path d={top} fill="#ffffff" fillOpacity={0.9} stroke="#050505" strokeWidth={0.6} />
            <text x={x + barW / 2 + DX / 2} y={yT + DY - 12} textAnchor="middle" fontSize={15} fontWeight={700}
              fill="#fafafa" fontFamily="ui-monospace, monospace">
              {v}
            </text>
            <text x={x + barW / 2 + DX / 2} y={H - PAD_BOTTOM + 26} textAnchor="middle" fontSize={17}
              fill="#e4e4e7" fontFamily="ui-monospace, monospace" fontWeight={600}>
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
