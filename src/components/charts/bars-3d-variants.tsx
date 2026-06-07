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

/** Header d'unité (Yann 13 mai 2026 v4 : centralisé dans chart-axis-header). */
import { chartAxisHeader } from "@/lib/chart-axis-header";
import { useT } from "@/lib/i18n/provider";
const axisHeader = chartAxisHeader;

/** Yann 14 mai 2026 : format label barre ADAPTATIF (bug Tesla 0,41→0). */
function formatBarLabel(v: number, dataMax: number): string {
  if (!Number.isFinite(v)) return "—";
  let decimals: number;
  if (Math.abs(dataMax) < 1) decimals = 2;
  else if (Math.abs(dataMax) < 100) decimals = 1;
  else decimals = 0;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals > 0 ? 1 : 0 });
}

const W = 920, H = 420;
// PAD_RIGHT = 95 (vs 70 avant) pour garantir aucun clipping du label TTM
// horizontal (sinon coupé par le bord droit du SVG en mode crowded).
const PAD_LEFT = 96, PAD_RIGHT = 95, PAD_TOP = 40, PAD_BOTTOM = 90;

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
  /** Titre injecté DANS le PNG exporté (KPI name_fr). */
  exportTitle?: string;
  /** Ticker injecté dans le PNG exporté → logo société à droite du titre. */
  exportTicker?: string;
};

/* ============================================================ */
/* B26 — ISO 3D BARS (parallépipèdes en isométrique vrai)         */
/* Avec support TTM (barre supplémentaire pointillée) et variant   */
/* "classic" pour basculer en 2D flat.                             */
/* ============================================================ */
export function BarsIso3DStack({ data, labels, unit = "", color = "#a78bfa", events = [], ttm = null, ttmLabel = "TTM", variant = "iso3d", exportTitle, exportTicker }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Yann 15 mai 2026 : axis header locale-aware.
  const { locale } = useT();
  // Yann 15 mai 2026 : click sur la zone axe Y → toggle gauche / droite.
  const [yOnRight, setYOnRight] = useState(false);

  // Étend data + labels avec TTM si fourni. Dernière barre stylée distinctement.
  // Yann 15 mai 2026 : si TTM est un OUTLIER (cumul 4Q >> max périodes),
  // on ne le render PAS comme barre, mais comme chip séparé en haut.
  const rawHasTTM = ttm != null && Number.isFinite(ttm);
  const dataOnlyMaxRaw = data.length > 0 ? Math.max(...data) : 0;
  const ttmIsCumul = rawHasTTM && (ttm as number) > dataOnlyMaxRaw * 2;
  const hasTTM = rawHasTTM && !ttmIsCumul;
  const allData = hasTTM ? [...data, ttm as number] : data;
  const allLabels = hasTTM ? [...labels, ttmLabel] : labels;
  // Year groups (visualisation type "bracket" sous l'axe X) : chaque groupe
  // de quarters consécutifs même année est rendu via une barre + année une
  // seule fois, au lieu de répéter le chiffre 4 fois.
  const yearGroups = buildYearGroups(allLabels);
  const ttmIndex = hasTTM ? allData.length - 1 : -1;
  const isClassic = variant === "classic";

  // Y-axis adaptive (Yann 13 mai 2026 v3) : heuristique sur `data` SEUL
  // (sans TTM qui peut être un cumul faussant la range). Zoom si range
  // < 40 % de dataMax. Si TTM outlier (> 2x dataMax), exclu de la max.
  const dataOnlyMax = Math.max(...data);
  const dataOnlyMin = Math.min(...data);
  const dataOnlyRange = dataOnlyMax - dataOnlyMin;
  const useDataMin =
    dataOnlyMin > 0 && dataOnlyRange < dataOnlyMax * 0.4;
  const ttmIsOutlier = hasTTM && (ttm as number) > dataOnlyMax * 2;
  const dataMaxRaw = ttmIsOutlier ? dataOnlyMax : Math.max(...allData);
  const ticks = niceTicks(useDataMin ? dataOnlyMin : 0, dataMaxRaw, 5);
  const max = Math.max(...ticks, ...allData);
  const min = Math.min(...ticks, useDataMin ? dataOnlyMin : 0);
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
  const header = axisHeader(unit, locale);
  // Yann 15 mai 2026 : précision adaptative Y axis pour éviter doublons.
  const intRounded = ticks.map((v) => Math.round(v));
  const needsDecimal = new Set(intRounded).size < ticks.length;
  const formatTick = (v: number): string =>
    needsDecimal
      ? (Math.round(v * 10) / 10).toLocaleString("fr-FR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : (Math.round(v * 10) / 10).toLocaleString("fr-FR");

  return (
    <div className="relative w-full">
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      {/* Header d'unité dans le SVG (au-dessus de l'axe Y) pour qu'il
          apparaisse aussi dans l'export PNG. Demande Yann 5 mai 2026.
          Yann 17 mai 2026 : label décalé vers le haut (y=22 → y=10) pour
          aérer la zone entre le label et le tick Y le plus haut. */}
      {/* Yann 2 juin 2026 : repositionné juste au-dessus du premier tick Y
          (PAD_TOP - 14), aligné fin sur l'axe Y, cohérent web + PNG. */}
      {header && (
        <text
          x={yOnRight ? PAD_LEFT + INNER_W + 20 : PAD_LEFT - 20}
          y={PAD_TOP - 24}
          fontSize={13}
          fontWeight={600}
          fill="#e4e4e7"
          fontFamily="ui-monospace, monospace"
          textAnchor={yOnRight ? "start" : "end"}
        >
          {header}
        </text>
      )}
      {/* Yann 15 mai 2026 : TTM cumul = chip en haut, pas comme barre. */}
      {ttmIsCumul && rawHasTTM && (() => {
        const chipX = yOnRight ? PAD_LEFT + 180 : W - PAD_RIGHT - 130;
        return (
          <g>
            <rect
              x={chipX}
              y={8}
              width={120}
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
                {(ttm as number).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
              </tspan>
              <tspan fill="#a1a1aa">&nbsp;{unit}</tspan>
            </text>
          </g>
        );
      })()}
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
        <text
          key={i}
          x={yOnRight ? PAD_LEFT + INNER_W + 12 : PAD_LEFT - 12}
          y={yFor(v) + 5}
          textAnchor={yOnRight ? "start" : "end"}
          fontSize={16}
          fontWeight={500}
          fill="#e4e4e7"
          fontFamily="ui-monospace, monospace"
        >
          {formatTick(v)}
        </text>
      ))}
      {/* Zone cliquable invisible sur l'axe Y. Yann 15 mai 2026. */}
      <rect
        x={yOnRight ? PAD_LEFT + INNER_W : 0}
        y={0}
        width={yOnRight ? W - (PAD_LEFT + INNER_W) : PAD_LEFT}
        height={H}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onClick={() => setYOnRight((v) => !v)}
      >
        <title>Cliquer pour basculer l&apos;axe Y à {yOnRight ? "gauche" : "droite"}</title>
      </rect>
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
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} onClick={() => setHover((prev) => (prev === i ? null : i))}
            style={{ opacity: (hover === null || isH ? 1 : 0.5) * ttmOpacity, cursor: "pointer", transition: "opacity 200ms", touchAction: "manipulation" }}>
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
              {formatBarLabel(Number(v), dataOnlyMax)}
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
        xMode="slot"
        slotOffsetX={isClassic ? 0 : DX / 2}
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

      {/* Yann (1er juin 06:00) : mini-logo retiré web, gardé seulement sur
          download via chart-export.ts (Powered by + logo combiné). */}
    </svg>

    {/* Bouton download (capture SVG + watermark → PNG) */}
    <button
      type="button"
      onClick={() => {
        if (svgRef.current) {
          downloadSvgAsPng(svgRef.current, `mettrik-bars-${Date.now()}.png`, { title: exportTitle, ticker: exportTicker });
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
      xMode="slot"
      slotOffsetX={isClassic ? 0 : DX / 2}
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
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} onClick={() => setHover((prev) => (prev === i ? null : i))}
            style={{ opacity: hover === null || isH ? 1 : 0.5, cursor: "pointer", transition: "opacity 200ms", touchAction: "manipulation" }}>
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
