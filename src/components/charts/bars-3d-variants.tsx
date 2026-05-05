"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import type { CompanyEvent } from "@/lib/events";
import { EventDotsSVG, EventDotsOverlay } from "@/components/charts/event-dots";
import { downloadSvgAsPng, buildYearGroups } from "@/lib/chart-export";
import { ChartMiniLogo } from "@/components/charts/chart-mini-logo";

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
// PAD_RIGHT = 70 (vs 50 avant) pour donner de la place au label TTM
// horizontal (sinon coupé par le bord droit du SVG en mode crowded).
const PAD_LEFT = 96, PAD_RIGHT = 70, PAD_TOP = 40, PAD_BOTTOM = 90;

/**
 * Split d'un label trimestriel "T1 21" → { top: "T1", bottom: "21" }.
 * - "T1 21" → { top: "T1", bottom: "21" } (rendu sur 2 lignes)
 * - "TTM"   → { top: "TTM", bottom: "" }  (1 ligne, pas de year)
 * - "2024"  → { top: "2024", bottom: "" } (label année simple, pas split)
 * Permet aux charts d'afficher quarter sur ligne 1 + year sur ligne 2 sans
 * rotation -45° (rejetée par Yann le 4 mai 2026 = doit rester horizontal).
 */
function splitQuarterLabel(label: string): { top: string; bottom: string; isQuarter: boolean } {
  if (!label) return { top: "", bottom: "", isQuarter: false };
  const m = label.match(/^(T[1-4])\s+(\d{2,4})$/);
  if (m) return { top: m[1], bottom: m[2], isQuarter: true };
  return { top: label, bottom: "", isQuarter: false };
}
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
  const svgRef = useRef<SVGSVGElement>(null);

  // Étend data + labels avec TTM si fourni. Dernière barre stylée distinctement.
  const hasTTM = ttm != null && Number.isFinite(ttm);
  const allData = hasTTM ? [...data, ttm as number] : data;
  const allLabels = hasTTM ? [...labels, ttmLabel] : labels;
  // Year groups (visualisation type "bracket" sous l'axe X) : chaque groupe
  // de quarters consécutifs même année est rendu via une barre + année une
  // seule fois, au lieu de répéter le chiffre 4 fois.
  const yearGroups = buildYearGroups(allLabels);
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
  // Densité crowded : > 12 colonnes. En quarters on bascule en mode
  // "quarter only" (T1/T2/T3/T4) avec un year-band en-dessous (groupage
  // visuel 1 année = 4 quarters = 1 seul libellé d'année).
  const isCrowded = allData.length > 12;
  const labelFontSize = isCrowded ? 13 : 17;
  // Valeurs TOUJOURS affichées au-dessus de chaque barre (demande Yann
  // 5 mai 2026), font-size adapté à la densité pour éviter les chevauchements.
  const valueFontSize = isCrowded ? 11 : 15;
  const DX = isClassic ? 0 : 26;
  const DY = isClassic ? 0 : -16;
  const header = axisHeader(unit);

  return (
    <div className="relative w-full">
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      {/* Header d'unité dans le SVG (au-dessus de l'axe Y) pour qu'il
          apparaisse aussi dans l'export PNG. Demande Yann 5 mai 2026. */}
      {header && (
        <text x={PAD_LEFT} y={22} fontSize={13} fontWeight={600} fill="#e4e4e7" fontFamily="ui-monospace, monospace">
          {header}
        </text>
      )}
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
        {/* Filtre néon "whaou" : halo lumineux puissant + souflé secondaire
            pour effet tube néon style enseigne. stdDeviation 8 (vs 5 avant)
            pour un glow plus présent. (5 mai 2026) */}
        <filter id={`b26-neon-${color.slice(1)}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={`b26-neon-soft-${color.slice(1)}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
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
              /* Classic 2D — style néon "whaou" : double halo (soft + sharp)
                 derrière + fill semi-transparent + stroke vif + cap blanc
                 brillant en haut + edge highlight blanc lumineux gauche. */
              <>
                {!isTTM && (
                  <>
                    {/* Halo soft (large, diffus) — atmosphère lumineuse */}
                    <rect x={x} y={yT} width={barW} height={h} fill={color} fillOpacity={0.45} rx={3} filter={`url(#b26-neon-soft-${color.slice(1)})`} />
                    {/* Halo sharp (proche bar, plus défini) */}
                    <rect x={x} y={yT} width={barW} height={h} fill={color} fillOpacity={0.65} rx={2} filter={`url(#b26-neon-${color.slice(1)})`} />
                  </>
                )}
                {/* Bar principale : fill semi-transparent + stroke néon */}
                <rect
                  x={x}
                  y={yT}
                  width={barW}
                  height={h}
                  fill={color}
                  fillOpacity={isTTM ? 0.18 : 0.42}
                  stroke={color}
                  strokeWidth={isTTM ? 1.6 : 1.8}
                  strokeDasharray={ttmDash}
                  rx={2}
                />
                {!isTTM && (
                  <>
                    {/* Edge highlight blanc gauche (tube néon réflexion) */}
                    <line x1={x + 1.2} y1={yT + 3} x2={x + 1.2} y2={baseY - 2} stroke="#ffffff" strokeWidth={1} strokeOpacity={0.5} strokeLinecap="round" />
                    {/* Top cap blanc brillant */}
                    <line x1={x + 1.5} y1={yT + 0.5} x2={x + barW - 1.5} y2={yT + 0.5} stroke="#ffffff" strokeWidth={1.6} strokeOpacity={0.95} strokeLinecap="round" />
                  </>
                )}
              </>
            ) : (
              /* Iso 3D — style néon "whaou" : double halo derrière + faces
                 semi-transparentes + arête frontale blanche brillante + edge
                 highlight gauche. */
              <>
                {!isTTM && (
                  <>
                    <path d={front} fill={color} fillOpacity={0.4} filter={`url(#b26-neon-soft-${color.slice(1)})`} />
                    <path d={front} fill={color} fillOpacity={0.6} filter={`url(#b26-neon-${color.slice(1)})`} />
                  </>
                )}
                <path d={front} fill="url(#b26-front)" stroke={color} strokeWidth={1.4} strokeDasharray={ttmDash} fillOpacity={isTTM ? 0.4 : 0.85} />
                <path d={side} fill="url(#b26-side)" stroke="#050505" strokeWidth={0.4} strokeDasharray={ttmDash} fillOpacity={isTTM ? 0.4 : 0.85} />
                <path d={top} fill="url(#b26-top)" stroke="#ffffff" strokeWidth={isTTM ? 0.6 : 1.3} strokeOpacity={isTTM ? 0.4 : 0.95} strokeDasharray={ttmDash} />
                {!isTTM && (
                  /* Edge highlight gauche (réflexion néon) */
                  <line x1={x + 0.8} y1={yT + 3} x2={x + 0.8} y2={baseY - 2} stroke="#ffffff" strokeWidth={0.9} strokeOpacity={0.55} strokeLinecap="round" />
                )}
              </>
            )}
            {/* Valeur au-dessus de chaque barre (toujours visible). Format
                entier, sans virgule ni point (demande Yann 5 mai 2026). */}
            <text
              x={x + barW / 2 + (isClassic ? 0 : DX / 2)}
              y={yT + (isClassic ? -10 : DY - 12)}
              textAnchor="middle"
              fontSize={valueFontSize}
              fontWeight={700}
              fill="#fafafa"
              fontFamily="ui-monospace, monospace"
            >
              {Math.round(Number(v))}
            </text>
            {/* x label : quarter uniquement (T1/T2/T3/T4) sur ligne 1. Le
                year apparaît UNE SEULE FOIS par groupe via le year-band
                rendu après la boucle (cf. bloc yearGroups.map plus bas).
                Labels non-trimestriels ("2024", "TTM") rendus tel quel. */}
            {(() => {
              const cx = x + barW / 2 + (isClassic ? 0 : DX / 2);
              const yQuarter = H - PAD_BOTTOM + 26;
              const split = splitQuarterLabel(allLabels[i]);
              const fz = labelFontSize;
              const fill = isTTM ? "#a1a1aa" : "#e4e4e7";
              const fw = isTTM ? 500 : 600;
              return (
                <text
                  x={cx}
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

      {/* Year band : 1 année = 1 bracket horizontal sous l'axe X. Au lieu de
          répéter "21 / 21 / 21 / 21" sous T1/T2/T3/T4, on dessine un trait
          subtil reliant le centre de T1 au centre de T4 + l'année écrite UNE
          fois au milieu. Solution créative pour gagner de la lisibilité sur
          les graphes trimestriels longs. */}
      {yearGroups.map((g) => {
        const slot2 = INNER_W / allData.length;
        const cxStart = PAD_LEFT + slot2 * g.startIdx + (slot2 - barW) / 2 + barW / 2 + (isClassic ? 0 : DX / 2);
        const cxEnd = PAD_LEFT + slot2 * g.endIdx + (slot2 - barW) / 2 + barW / 2 + (isClassic ? 0 : DX / 2);
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
            <text
              x={(cxStart + cxEnd) / 2}
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

      {/* Mini-logo Mettrik AI (italic Fraunces, gradient iridescent) — version
          home-style miniature. Marqué `data-chart-logo="small"` : caché à
          l'export et remplacé par un grand watermark (cf. chart-export.ts). */}
      <ChartMiniLogo x={W * 0.25} y={PAD_TOP - 18} height={14} />
    </svg>

    {/* Bouton download (capture SVG + watermark → PNG) */}
    <button
      type="button"
      onClick={() => {
        if (svgRef.current) {
          downloadSvgAsPng(svgRef.current, `mettrik-bars-${Date.now()}.png`);
        }
      }}
      aria-label="Télécharger le graphique"
      className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full border border-white/5 bg-black/20 text-zinc-500 opacity-50 backdrop-blur transition-all hover:border-white/20 hover:bg-black/50 hover:text-zinc-100 hover:opacity-100"
    >
      <Download className="size-4" />
    </button>
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
