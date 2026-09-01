"use client";

import { useRef, useState } from "react";
import type { CompanyEvent } from "@/lib/events";
import { EventDotsSVG, EventDotsOverlay } from "@/components/charts/event-dots";
import { buildYearGroups } from "@/lib/chart-export";
import { ChartMiniLogo } from "@/components/charts/chart-mini-logo";
import { useT } from "@/lib/i18n/provider";

/**
 * Essais variation 3D / iso (V11-V12) inspirés freepik.
 */

const W = 920, H = 420;
// PAD_BOTTOM = 100 (vs 80 avant) pour caser : (1) labels axe X
// trimestriels en T1/T2/T3/T4 + (2) year-band en dessous + (3) valeurs
// négatives qui s'affichent sous les bars rouges sans toucher le year-band.
// PAD_RIGHT 95 (vs 50) = même règle que curve/bars : pas de clipping TTM.
// Yann 8 août 2026 : plot élargi gauche+droite (96/95 -> 76/58), cf bars-3d.
const PAD_LEFT = 54, PAD_RIGHT = 58, PAD_TOP = 56, PAD_BOTTOM = 100;
const INNER_W = W - PAD_LEFT - PAD_RIGHT;
const INNER_H = H - PAD_TOP - PAD_BOTTOM;

/** Idem bars/curve : "T1 21" → quarter only, year extrait pour year-band. */
function splitQuarterLabel(label: string): { top: string; bottom: string; isQuarter: boolean } {
  if (!label) return { top: "", bottom: "", isQuarter: false };
  // Yann 17 juil 2026 (screen AAPL EN) : accepter aussi le préfixe "Q" (titre
  // du graph basculé EN) : sinon les 20 labels "Q1 21" s'affichent en entier
  // et se chevauchent au lieu d'être scindés trimestre / bande d'année.
  const m = label.match(/^([TQ][1-4]|[SH][12])\s+(\d{2,4})$/);
  if (m) return { top: m[1], bottom: m[2], isQuarter: true };
  return { top: label, bottom: "", isQuarter: false };
}

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
  color?: string;
  events?: CompanyEvent[];
  /** Titre injecté DANS le PNG exporté (KPI name_fr). */
  exportTitle?: string;
  /** Ticker injecté dans le PNG exporté → logo société à droite du titre. */
  exportTicker?: string;
  /** Yann 10 juin 2026 (Point 3) : CAGR annualisé déjà formaté (ex "CAGR
   *  +47,8 %/an"), affiché sous le titre dans le PNG. Calculé côté
   *  company-view sur la série de valeurs réelles du KPI (pas les deltas). */
  exportCagr?: string;
  /** Yann 8 juin 2026 (PRIO 3) : suffixe fréquence "par x" déjà localisé,
   *  fourni quand la fréquence ≠ année. Transmis tel quel à l'export. */
  exportFrequency?: string;
  /** Yann 10 juin 2026 : lead de l'interprétation IA (1 phrase, texte brut
   *  strippé HTML), même langue que le titre exporté. Posé en data-export-*
   *  pour rendu SOUS le graph dans le PNG. */
  exportInterpretation?: string;
};

const POS = "#10b981";
const NEG = "#f43f5e";

/* ============================================================ */
/* V11 — ISO STEP BARS 3D                                         */
/* Bars de variation en iso, hauteur en plus / moins du zéro.     */
/* ============================================================ */
export function VariationIsoSteps3D({ data, labels, events = [], exportTitle, exportTicker, exportCagr, exportFrequency, exportInterpretation }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Yann 10 juin 2026 (Point 6) : locale courante pour l'export PNG.
  const { locale } = useT();

  const deltas = data.slice(1).map((v, i) => {
    const prev = data[i];
    if (prev === 0) return 0;
    return ((v - prev) / Math.abs(prev)) * 100;
  });

  // labels[0] correspond à data[0] = la valeur de référence pour le 1er
  // delta. L'axe X de variation utilise donc labels[i+1].
  const xLabels = labels.slice(1, deltas.length + 1);
  const yearGroups = buildYearGroups(xLabels);

  const dataMin = Math.min(...deltas, 0);
  const dataMax = Math.max(...deltas, 0);
  const ticks = niceTicks(Math.min(dataMin, 0), Math.max(dataMax, 0), 5);
  const min = Math.min(...ticks, dataMin);
  const max = Math.max(...ticks, dataMax);
  const range = max - min || 1;
  const slot = INNER_W / Math.max(deltas.length, 1);
  const barW = Math.min(slot * 0.42, 56);
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  const zeroY = yFor(0);
  const DX = 26, DY = -16;

  return (
    <div className="relative w-full">
    <svg
      ref={svgRef}
      width="100%"
      height="420"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
      data-chart-export="true"
      data-export-prefix="variation"
      data-export-title={exportTitle || ""}
      data-export-ticker={exportTicker || ""}
      data-export-cagr={exportCagr || ""}
      data-export-frequency={exportFrequency || ""}
      data-export-interpretation={exportInterpretation || ""}
      data-export-locale={locale || ""}
    >
      {/* Header d'unité dans le SVG. Yann 2 juin 2026 : repositionné
          juste au-dessus du premier tick Y, aligné fin sur l'axe Y. */}
      <text x={PAD_LEFT - 6} y={PAD_TOP - 24} fontSize={13} fontWeight={600} fill="#e4e4e7" fontFamily="ui-monospace, monospace" textAnchor="end">
        {/* Les deltas sont calculés vs le point précédent de la série
            affichée : en trimestriel c'est vs le trimestre précédent,
            pas vs N-1. Le libellé doit suivre. */}
        {xLabels.some((l) => splitQuarterLabel(l).isQuarter) ? "% (vs trim. préc.)" : "% (vs N-1)"}
      </text>
      <defs>
        {[POS, NEG].map((c, k) => (
          <g key={k}>
            <linearGradient id={`v11-front-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={0.95} />
              <stop offset="100%" stopColor={c} stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id={`v11-side-${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c} stopOpacity={0.65} />
              <stop offset="100%" stopColor={c} stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id={`v11-top-${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity={0.85} />
              <stop offset="100%" stopColor={c} stopOpacity={0.85} />
            </linearGradient>
          </g>
        ))}
      </defs>
      {ticks.map((v, i) => (
        <line key={i} x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={yFor(v)} y2={yFor(v)}
          stroke="#1a1a1a" strokeDasharray="3 6" strokeWidth={1} />
      ))}
      {ticks.map((v, i) => (
        <text key={i} x={PAD_LEFT - 9} y={yFor(v) + 5} textAnchor="end" fontSize={16}
          fontWeight={500} fill="#e4e4e7" fontFamily="ui-monospace, monospace">
          {v > 0 ? "+" : ""}{(Math.round(v * 10) / 10).toLocaleString("fr-FR")} %
        </text>
      ))}
      <line x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={zeroY} y2={zeroY} stroke="#3f3f46" strokeWidth={1.5} />
      {deltas.map((pct, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const isPos = pct >= 0;
        const k = isPos ? 0 : 1;
        const c = isPos ? POS : NEG;
        const isH = hover === i;
        const yTop = Math.min(yFor(pct), zeroY);
        const yBot = Math.max(yFor(pct), zeroY);
        const front = `M ${x} ${yTop} L ${x + barW} ${yTop} L ${x + barW} ${yBot} L ${x} ${yBot} Z`;
        const side = `M ${x + barW} ${yTop} L ${x + barW + DX} ${yTop + DY} L ${x + barW + DX} ${yBot + DY} L ${x + barW} ${yBot} Z`;
        const top = `M ${x} ${yTop} L ${x + barW} ${yTop} L ${x + barW + DX} ${yTop + DY} L ${x + DX} ${yTop + DY} Z`;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.5, cursor: "pointer", transition: "opacity 200ms" }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={yBot + 4} rx={barW * 0.75} ry={6} fill="#000" fillOpacity={0.35} />
            <path d={front} fill={`url(#v11-front-${k})`} stroke="#050505" strokeWidth={0.6} />
            <path d={side} fill={`url(#v11-side-${k})`} stroke="#050505" strokeWidth={0.6} />
            <path d={top} fill={`url(#v11-top-${k})`} stroke="#050505" strokeWidth={0.6} />
            {/* Valeur : juste le chiffre, sans signe (+/-) ni % — la couleur
                vert/rouge indique le signe, le KPI est par construction en %.
                Taille agrandie (24 vs 14 avant) puisqu'on gagne la place du
                signe + %. Décision Yann 5 mai 2026. */}
            {(() => {
              const cx = x + barW / 2 + DX / 2;
              const numTxt = Math.abs(pct).toFixed(1).replace(".", ",");
              const numFz = 14;
              const yPos = (yTop + DY) - 10;       // au-dessus de la barre verte
              // Yann 15 mai 2026 : cap yNeg pour ne JAMAIS empiéter sur les
              // labels trimestre (T1/T2/T3/T4) placés à H-PAD_BOTTOM+26.
              // Si la barre descend très bas (ex -19%), on placerait le
              // label en dessous du quarter → chevauchement. Cap = baseline
              // chart - 12 px de clearance.
              const yNegRaw = yBot + 18;
              const yNegMax = H - PAD_BOTTOM - 12;
              const yNeg = Math.min(yNegRaw, yNegMax);
              return (
                <text
                  x={cx}
                  y={isPos ? yPos : yNeg}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                  fill={c}
                  fontWeight={700}
                  fontSize={numFz}
                  // Yann 1er sept 2026 : contour noir de la typo (paint-order)
                  // pour que le chiffre reste lisible devant une barre verte
                  // ou rouge, quel que soit son placement.
                  stroke="#000"
                  strokeWidth={3}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  {numTxt}
                </text>
              );
            })()}
            {/* Quarter only (T1/T2/T3/T4) ; year rendu UNE fois via year-band
                après la boucle, plus de "T2 T3 T4 T1 22 T2 T3 T4 T1 23". */}
            <text x={x + barW / 2 + DX / 2} y={H - PAD_BOTTOM + 26} textAnchor="middle"
              fontSize={15} fill="#e4e4e7" fontFamily="ui-monospace, monospace" fontWeight={600}>
              {splitQuarterLabel(labels[i + 1] ?? "").top}
            </text>
          </g>
        );
      })}
      <EventDotsSVG
        events={events}
        xLabels={labels}
        padLeft={PAD_LEFT}
        innerW={INNER_W}
        padTop={PAD_TOP}
        innerH={INNER_H}
        color="#a78bfa"
        xMode="slot"
        slotOffsetX={DX / 2}
        dotYOffset={72}
      />

      {/* Year band : 1 année = 1 bracket sous l'axe X. */}
      {yearGroups.map((g) => {
        const cxStart = PAD_LEFT + slot * g.startIdx + (slot - barW) / 2 + barW / 2 + DX / 2;
        const cxEnd = PAD_LEFT + slot * g.endIdx + (slot - barW) / 2 + barW / 2 + DX / 2;
        const yLine = H - PAD_BOTTOM + 46;
        const yText = H - PAD_BOTTOM + 60;
        const tickH = 4;
        const single = g.startIdx === g.endIdx;
        const yearFull = g.year.length === 2 ? `20${g.year}` : g.year;
        return (
          <g key={`yg-${g.startIdx}`}>
            {!single && (
              <>
                <line x1={cxStart} y1={yLine} x2={cxEnd} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                <line x1={cxStart} y1={yLine - tickH} x2={cxStart} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                <line x1={cxEnd} y1={yLine - tickH} x2={cxEnd} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
              </>
            )}
            <text x={(cxStart + cxEnd) / 2} y={yText} textAnchor="middle" fontSize={13} fill="#a1a1aa" fontFamily="ui-monospace, monospace" fontWeight={500}>
              {yearFull}
            </text>
          </g>
        );
      })}

      {/* Yann (1er juin 06:00) : mini-logo retiré web, gardé seulement sur
          download via chart-export.ts (Powered by + logo combiné). */}
    </svg>

    {/* Yann 8 juin 2026 : bouton télécharger DÉPLACÉ dans la barre d'onglets
        (ChartCycleControls). Récupère ce SVG via [data-chart-export]. */}
    <EventDotsOverlay
      events={events}
      xLabels={labels}
      svgW={W}
      svgH={H}
      padLeft={PAD_LEFT}
      innerW={INNER_W}
      padTop={PAD_TOP}
      innerH={INNER_H}
      color="#a78bfa"
      xMode="slot"
      slotOffsetX={DX / 2}
      dotYOffset={72}
    />
    </div>
  );
}

/* ============================================================ */
/* V12 — DIAMOND PRISMS                                           */
/* Variations en losanges 3D : pointe haut = +, pointe bas = -.    */
/* ============================================================ */
export function VariationDiamondPrisms({ data, labels }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const deltas = data.slice(1).map((v, i) => {
    const prev = data[i];
    if (prev === 0) return 0;
    return ((v - prev) / Math.abs(prev)) * 100;
  });

  const dataMin = Math.min(...deltas, 0);
  const dataMax = Math.max(...deltas, 0);
  const ticks = niceTicks(Math.min(dataMin, 0), Math.max(dataMax, 0), 5);
  const min = Math.min(...ticks, dataMin);
  const max = Math.max(...ticks, dataMax);
  const range = max - min || 1;
  const slot = INNER_W / Math.max(deltas.length, 1);
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  const zeroY = yFor(0);

  return (
    <svg width="100%" height="420" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        {[POS, NEG].map((c, k) => (
          <g key={k}>
            <linearGradient id={`v12-l-${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c} stopOpacity={1} />
              <stop offset="100%" stopColor={c} stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id={`v12-r-${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c} stopOpacity={0.6} />
              <stop offset="100%" stopColor={c} stopOpacity={0.3} />
            </linearGradient>
          </g>
        ))}
      </defs>
      {ticks.map((v, i) => (
        <line key={i} x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={yFor(v)} y2={yFor(v)}
          stroke="#1a1a1a" strokeDasharray="3 6" strokeWidth={1} />
      ))}
      {ticks.map((v, i) => (
        <text key={i} x={PAD_LEFT - 9} y={yFor(v) + 5} textAnchor="end" fontSize={16}
          fontWeight={500} fill="#e4e4e7" fontFamily="ui-monospace, monospace">
          {v > 0 ? "+" : ""}{(Math.round(v * 10) / 10).toLocaleString("fr-FR")} %
        </text>
      ))}
      <line x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={zeroY} y2={zeroY} stroke="#3f3f46" strokeWidth={1.5} />
      {deltas.map((pct, i) => {
        const cx = PAD_LEFT + slot * i + slot / 2;
        const isPos = pct >= 0;
        const k = isPos ? 0 : 1;
        const c = isPos ? POS : NEG;
        const isH = hover === i;
        const apexY = yFor(pct);
        const halfW = Math.min(slot * 0.3, 36);
        // Diamond : top apex = direction du delta, bottom apex = zero
        const topX = cx;
        const topY = isPos ? apexY : zeroY;
        const botX = cx;
        const botY = isPos ? zeroY : apexY;
        const midY = (topY + botY) / 2;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.5, cursor: "pointer", transition: "opacity 200ms" }}>
            {/* Left half */}
            <path d={`M ${topX} ${topY} L ${cx - halfW} ${midY} L ${botX} ${botY} Z`}
              fill={`url(#v12-l-${k})`} stroke="#050505" strokeWidth={0.6} />
            {/* Right half (darker for 3D depth) */}
            <path d={`M ${topX} ${topY} L ${cx + halfW} ${midY} L ${botX} ${botY} Z`}
              fill={`url(#v12-r-${k})`} stroke="#050505" strokeWidth={0.6} />
            <text x={cx} y={isPos ? apexY - 12 : apexY + 24} textAnchor="middle"
              fontSize={16} fontWeight={700} fill={c} fontFamily="ui-monospace, monospace"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}>
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={cx} y={H - PAD_BOTTOM + 26} textAnchor="middle"
              fontSize={17} fill="#e4e4e7" fontFamily="ui-monospace, monospace" fontWeight={600}>
              {labels[i + 1] ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
