"use client";

import { useState } from "react";

/**
 * 11 styles "Bars" thématisés par catégorie GICS (secteurs S&P).
 *
 * Chaque composant respecte la même API que `BarsChart` standard :
 *   { data: number[]; labels: string[]; unit: string; color?: string }
 *
 * → drop-in replacement direct dans `chart-cycle.tsx` selon le secteur de
 * la société. Pour intégrer : il suffit d'importer le composant choisi par
 * code (B15..B25) et de basculer dessus quand `company.sector` matche.
 *
 * Codes :
 *   B15 Energy           — "Voltage"
 *   B16 Materials        — "Ore Stratum"
 *   B17 Industrials      — "Smokestack"
 *   B18 ConsumerDiscr.   — "Boutique Neon"
 *   B19 ConsumerStaples  — "Granary"
 *   B20 HealthCare       — "Vital Signs"
 *   B21 Financials       — "Bullion"
 *   B22 InfoTechnology   — "Bit Cascade"
 *   B23 CommServices     — "Broadcast"
 *   B24 Utilities        — "Aqueduct"
 *   B25 RealEstate       — "Skyline"
 */

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
};

/* Hook commun : layout + ticks + hover */
function useChartLayout(data: number[]) {
  const [hover, setHover] = useState<number | null>(null);
  const dataMin = Math.min(0, ...data);
  const dataMax = Math.max(...data, 0);
  const ticks = niceTicks(dataMin, dataMax, 5);
  const min = Math.min(...ticks, dataMin);
  const max = Math.max(...ticks, dataMax);
  const range = max - min || 1;
  const slot = INNER_W / data.length;
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  return { hover, setHover, ticks, min, max, range, slot, yFor };
}

function YAxis({ ticks, yFor }: { ticks: number[]; yFor: (v: number) => number }) {
  return (
    <>
      {ticks.map((v, i) => (
        <line key={`gl-${i}`} x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={yFor(v)} y2={yFor(v)}
          stroke="#1a1a1a" strokeWidth={1} strokeDasharray="3 6" />
      ))}
      {ticks.map((v, i) => (
        <text key={`yt-${i}`} x={PAD_LEFT - 12} y={yFor(v) + 5} textAnchor="end" fontSize={16}
          fontWeight={500} fill="#e4e4e7" fontFamily="ui-monospace, monospace">
          {(Math.round(v * 10) / 10).toLocaleString("fr-FR")}
        </text>
      ))}
    </>
  );
}

function XLabel({ x, label }: { x: number; label: string }) {
  return (
    <text x={x} y={H - PAD_BOTTOM + 26} textAnchor="middle" fontSize={17} fill="#e4e4e7"
      fontFamily="ui-monospace, monospace" fontWeight={600}>{label}</text>
  );
}

/* ============================================================ */
/* B15 — ENERGY · "Voltage"                                       */
/* Bars néon + arcs électriques + glow au sommet                   */
/* ============================================================ */
export function BarsEnergyVoltage({ data, labels, color = "#fbbf24" }: Props) {
  const { hover, setHover, ticks, slot, yFor, max } = useChartLayout(data);
  const barW = Math.min(slot * 0.5, 60);
  const zeroY = yFor(0);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b15-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.9} />
          <stop offset="100%" stopColor={color} stopOpacity={0.3} />
        </linearGradient>
        <filter id="b15-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {/* glow halo */}
            <rect x={x - 4} y={yT - 4} width={barW + 8} height={h + 8} fill={color} fillOpacity={0.25} filter="url(#b15-glow)" />
            {/* bar */}
            <rect x={x} y={yT} width={barW} height={h} fill="url(#b15-fill)" stroke={color} strokeWidth={1.2} />
            {/* electric arc above */}
            <path
              d={`M ${x + 4} ${yT} l ${barW * 0.2} ${-6} l ${barW * 0.15} ${4} l ${barW * 0.2} ${-8} l ${barW * 0.15} ${5} l ${barW * 0.2} ${-7}`}
              fill="none" stroke="#fef3c7" strokeWidth={1.5} strokeLinejoin="miter"
              style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            />
            {/* lightning at top */}
            <circle cx={x + barW / 2} cy={yT - 14} r={3} fill="#fef9c3" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <XLabel x={x + barW / 2} label={labels[i]} />
            <text x={x + barW / 2} y={yT - 24} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fef3c7" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B16 — MATERIALS · "Ore Stratum"                                */
/* Bars composées de strates horizontales (couches sédimentaires) */
/* ============================================================ */
export function BarsMaterialsStratum({ data, labels, color = "#a16207" }: Props) {
  const { hover, setHover, ticks, slot, yFor, max } = useChartLayout(data);
  const barW = Math.min(slot * 0.55, 70);
  const zeroY = yFor(0);
  const stratumH = 8;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        const strata = Math.max(2, Math.floor(h / stratumH));
        const tones = ["#78350f", "#92400e", "#a16207", "#b45309", "#a16207"];
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {Array.from({ length: strata }).map((_, k) => {
              const ly = yT + k * stratumH;
              if (ly + stratumH > zeroY) return null;
              return (
                <rect key={k} x={x} y={ly} width={barW} height={stratumH - 1}
                  fill={tones[k % tones.length]} stroke="#3f1d0e" strokeWidth={0.5} />
              );
            })}
            {/* speckles for ore texture */}
            {Array.from({ length: 6 }).map((_, k) => (
              <circle key={k} cx={x + ((k * 17) % barW)} cy={yT + 8 + ((k * 11) % Math.max(1, h - 16))}
                r={1.2} fill="#fef3c7" fillOpacity={0.4} />
            ))}
            <rect x={x} y={yT} width={barW} height={h} fill="none" stroke="#fef3c7" strokeOpacity={isH ? 0.6 : 0.25} strokeWidth={1} />
            <XLabel x={x + barW / 2} label={labels[i]} />
            <text x={x + barW / 2} y={yT - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fef3c7" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B17 — INDUSTRIALS · "Smokestack"                               */
/* Cheminées d'usine + plumes de vapeur en haut + rivets latéraux */
/* ============================================================ */
export function BarsIndustrialsSmokestack({ data, labels, color = "#78716c" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.38, 50);
  const zeroY = yFor(0);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b17-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#44403c" />
          <stop offset="50%" stopColor="#78716c" />
          <stop offset="100%" stopColor="#44403c" />
        </linearGradient>
      </defs>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {/* steam plume */}
            {Array.from({ length: 3 }).map((_, k) => (
              <ellipse key={k} cx={x + barW / 2 + (k - 1) * 6} cy={yT - 14 - k * 8}
                rx={12 + k * 3} ry={6 + k * 2} fill="#e4e4e7" fillOpacity={0.18 - k * 0.04} />
            ))}
            {/* chimney body */}
            <rect x={x} y={yT} width={barW} height={h} fill="url(#b17-metal)" />
            {/* top cap */}
            <rect x={x - 3} y={yT - 4} width={barW + 6} height={5} fill="#1c1917" />
            {/* rivets */}
            {Array.from({ length: Math.floor(h / 22) }).map((_, k) => (
              <g key={k}>
                <circle cx={x + 3} cy={yT + 12 + k * 22} r={1.5} fill="#1c1917" />
                <circle cx={x + barW - 3} cy={yT + 12 + k * 22} r={1.5} fill="#1c1917" />
              </g>
            ))}
            <rect x={x} y={yT} width={barW} height={h} fill="none" stroke="#fbbf24" strokeOpacity={isH ? 0.7 : 0.2} strokeWidth={1} />
            <XLabel x={x + barW / 2} label={labels[i]} />
            <text x={x + barW / 2} y={yT - 36} textAnchor="middle" fontSize={14} fontWeight={700} fill="#e4e4e7" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B18 — CONSUMER DISCRETIONARY · "Boutique Neon"                 */
/* Néon rose magenta façon enseigne retail + étiquette prix       */
/* ============================================================ */
export function BarsConsDiscrNeon({ data, labels, color = "#ec4899" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.42, 56);
  const zeroY = yFor(0);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <filter id="b18-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {/* outer glow */}
            <rect x={x - 2} y={yT - 2} width={barW + 4} height={h + 4} rx={4} fill={color} fillOpacity={0.25} filter="url(#b18-glow)" />
            {/* hollow neon */}
            <rect x={x} y={yT} width={barW} height={h} rx={3} fill="none" stroke={color} strokeWidth={2.5} />
            <rect x={x + 4} y={yT + 4} width={barW - 8} height={h - 8} rx={2} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.5} />
            {/* price tag */}
            <g transform={`translate(${x + barW / 2 - 22} ${yT - 24})`}>
              <path d="M 0 0 L 36 0 L 44 8 L 36 16 L 0 16 Z" fill={color} stroke="#fdf2f8" strokeWidth={0.8} />
              <text x={18} y={11} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0a0a0a" fontFamily="ui-monospace, monospace">{v}</text>
              <circle cx={36} cy={8} r={1.8} fill="#fdf2f8" />
            </g>
            <XLabel x={x + barW / 2} label={labels[i]} />
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B19 — CONSUMER STAPLES · "Granary"                             */
/* Bars solides empilées en blocs (silos), tons blé/wheat         */
/* ============================================================ */
export function BarsConsStaplesGranary({ data, labels, color = "#d97706" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.5, 64);
  const zeroY = yFor(0);
  const blockH = 16;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        const blocks = Math.max(2, Math.floor(h / blockH));
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {Array.from({ length: blocks }).map((_, k) => {
              const ly = zeroY - (k + 1) * blockH;
              if (ly < yT - blockH / 2) return null;
              const shade = k % 2 === 0 ? "#d97706" : "#b45309";
              return <rect key={k} x={x} y={Math.max(ly, yT)} width={barW} height={Math.min(blockH - 2, zeroY - ly)} rx={2} fill={shade} stroke="#451a03" strokeWidth={0.6} />;
            })}
            {/* dome top (silo) */}
            <ellipse cx={x + barW / 2} cy={yT} rx={barW / 2} ry={6} fill="#fbbf24" stroke="#451a03" strokeWidth={0.8} />
            <XLabel x={x + barW / 2} label={labels[i]} />
            <text x={x + barW / 2} y={yT - 12} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fef3c7" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B20 — HEALTH CARE · "Vital Signs"                              */
/* ECG line traversant les sommets + bars teal douce               */
/* ============================================================ */
export function BarsHealthVitalSigns({ data, labels, color = "#14b8a6" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.4, 52);
  const zeroY = yFor(0);

  // ECG path: traverse all bar tops with QRS-like spike at each
  const ecgPts = data.map((v, i) => {
    const cx = PAD_LEFT + slot * i + slot / 2;
    return { cx, y: yFor(Math.max(v, 0)) };
  });
  const ecgPath = ecgPts.map((p, i) => {
    if (i === 0) return `M ${PAD_LEFT} ${zeroY - 4} L ${p.cx - 18} ${zeroY - 4} L ${p.cx - 8} ${p.y - 12} L ${p.cx} ${p.y + 6} L ${p.cx + 8} ${p.y - 4} L ${p.cx + 18} ${zeroY - 4}`;
    return `L ${p.cx - 18} ${zeroY - 4} L ${p.cx - 8} ${p.y - 12} L ${p.cx} ${p.y + 6} L ${p.cx + 8} ${p.y - 4} L ${p.cx + 18} ${zeroY - 4}`;
  }).join(" ") + ` L ${PAD_LEFT + INNER_W} ${zeroY - 4}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b20-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} stopOpacity={0.15} />
        </linearGradient>
      </defs>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            <rect x={x} y={yT} width={barW} height={h} rx={2} fill="url(#b20-fill)" stroke={color} strokeWidth={1} />
            <XLabel x={x + barW / 2} label={labels[i]} />
            <text x={x + barW / 2} y={yT - 26} textAnchor="middle" fontSize={14} fontWeight={700} fill="#5eead4" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
      {/* ECG line traversing all */}
      <path d={ecgPath} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="miter"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

/* ============================================================ */
/* B21 — FINANCIALS · "Bullion"                                   */
/* Bars gold gradient + lingot stack visuel + ornement            */
/* ============================================================ */
export function BarsFinancialsBullion({ data, labels, color = "#eab308" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.48, 60);
  const zeroY = yFor(0);
  const ingotH = 14;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b21-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
      </defs>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        const ingots = Math.max(2, Math.floor(h / ingotH));
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {Array.from({ length: ingots }).map((_, k) => {
              const ly = zeroY - (k + 1) * ingotH;
              if (ly < yT - ingotH / 2) return null;
              const inset = (k % 2) * 4;
              return (
                <g key={k}>
                  <rect x={x + inset} y={Math.max(ly, yT)} width={barW - inset * 2} height={ingotH - 1.5}
                    rx={2} fill="url(#b21-gold)" stroke="#78350f" strokeWidth={0.6} />
                  <line x1={x + inset + 4} y1={Math.max(ly, yT) + 2} x2={x + barW - inset - 4} y2={Math.max(ly, yT) + 2}
                    stroke="#fef3c7" strokeWidth={0.8} strokeOpacity={0.7} />
                </g>
              );
            })}
            <XLabel x={x + barW / 2} label={labels[i]} />
            <text x={x + barW / 2} y={yT - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fde68a" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B22 — INFORMATION TECHNOLOGY · "Bit Cascade"                   */
/* Bars composées de pixels/cubes qui tombent (matrix vibe)        */
/* ============================================================ */
export function BarsITPixelCascade({ data, labels, color = "#22d3ee" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.45, 56);
  const zeroY = yFor(0);
  const px = 6;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        const cols = Math.max(1, Math.floor(barW / px));
        const rows = Math.max(1, Math.floor(h / px));
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {Array.from({ length: rows * cols }).map((_, k) => {
              const r = Math.floor(k / cols);
              const c = k % cols;
              const seed = ((i * 31 + k * 17) % 100) / 100;
              if (r < 3 && seed < 0.4) return null; // sparse top
              const intensity = r > rows - 4 ? 1 : 0.6 + seed * 0.4;
              return (
                <rect key={k} x={x + c * px} y={yT + r * px} width={px - 1} height={px - 1}
                  fill={color} fillOpacity={intensity} />
              );
            })}
            {/* leading edge glow */}
            <rect x={x - 2} y={yT - 2} width={barW + 4} height={4} fill={color} fillOpacity={0.6}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <XLabel x={x + barW / 2} label={labels[i]} />
            <text x={x + barW / 2} y={yT - 12} textAnchor="middle" fontSize={14} fontWeight={700} fill={color} fontFamily="ui-monospace, monospace"
              style={{ filter: `drop-shadow(0 0 3px ${color})` }}>{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B23 — COMMUNICATION SERVICES · "Broadcast"                     */
/* Bars violettes + ondes radio émanant du sommet                  */
/* ============================================================ */
export function BarsCommBroadcast({ data, labels, color = "#a78bfa" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.42, 54);
  const zeroY = yFor(0);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b23-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.85} />
          <stop offset="100%" stopColor={color} stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        const cx = x + barW / 2;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {/* radio waves */}
            {[14, 22, 30].map((r, k) => (
              <path key={k} d={`M ${cx - r} ${yT - 4} A ${r} ${r * 0.6} 0 0 1 ${cx + r} ${yT - 4}`}
                fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.9 - k * 0.25}
                style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
            ))}
            <rect x={x} y={yT} width={barW} height={h} rx={2} fill="url(#b23-fill)" stroke={color} strokeWidth={1.2} />
            {/* antenna */}
            <line x1={cx} y1={yT} x2={cx} y2={yT - 8} stroke={color} strokeWidth={1.5} />
            <circle cx={cx} cy={yT - 10} r={2.5} fill="#ffffff" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
            <XLabel x={cx} label={labels[i]} />
            <text x={cx} y={yT - 38} textAnchor="middle" fontSize={14} fontWeight={700} fill={color} fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B24 — UTILITIES · "Aqueduct"                                   */
/* Tubes/pipes cylindriques avec fluide à l'intérieur + jauges    */
/* ============================================================ */
export function BarsUtilitiesAqueduct({ data, labels, color = "#3b82f6" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.4, 50);
  const zeroY = yFor(0);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b24-pipe" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="50%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id="b24-fluid" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0c4a6e" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0c4a6e" />
        </linearGradient>
      </defs>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        const cx = x + barW / 2;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {/* pipe outer */}
            <rect x={x - 4} y={yT - 8} width={barW + 8} height={h + 8} rx={barW / 2 + 4} fill="url(#b24-pipe)" />
            {/* fluid inside */}
            <rect x={x} y={yT} width={barW} height={h} rx={barW / 2} fill="url(#b24-fluid)" />
            {/* gauge dial */}
            <circle cx={cx} cy={yT - 14} r={8} fill="#0a0a0a" stroke="#60a5fa" strokeWidth={1} />
            <line x1={cx} y1={yT - 14} x2={cx + 5} y2={yT - 18} stroke="#22d3ee" strokeWidth={1.5} />
            <XLabel x={cx} label={labels[i]} />
            <text x={cx} y={yT - 30} textAnchor="middle" fontSize={14} fontWeight={700} fill="#bfdbfe" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ */
/* B25 — REAL ESTATE · "Skyline"                                  */
/* Bars stylisées en buildings : fenêtres allumées + spires        */
/* ============================================================ */
export function BarsRealEstateSkyline({ data, labels, color = "#475569" }: Props) {
  const { hover, setHover, ticks, slot, yFor } = useChartLayout(data);
  const barW = Math.min(slot * 0.5, 64);
  const zeroY = yFor(0);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b25-bld" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <YAxis ticks={ticks} yFor={yFor} />
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(Math.max(v, 0));
        const h = Math.abs(yFor(v) - zeroY);
        const isH = hover === i;
        const cx = x + barW / 2;
        const winRows = Math.floor((h - 12) / 10);
        const winCols = Math.floor((barW - 12) / 8);
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || isH ? 1 : 0.45, cursor: "pointer", transition: "opacity 200ms" }}>
            {/* building body */}
            <rect x={x} y={yT} width={barW} height={h} fill="url(#b25-bld)" stroke="#1e293b" strokeWidth={0.8} />
            {/* windows */}
            {Array.from({ length: winRows * winCols }).map((_, k) => {
              const r = Math.floor(k / winCols);
              const c = k % winCols;
              const seed = ((i * 13 + k * 7) % 100) / 100;
              const lit = seed > 0.3;
              const wx = x + 6 + c * 8;
              const wy = yT + 8 + r * 10;
              return (
                <rect key={k} x={wx} y={wy} width={5} height={6}
                  fill={lit ? "#fde68a" : "#0f172a"} fillOpacity={lit ? 0.85 : 1}
                  stroke="#0f172a" strokeWidth={0.5} />
              );
            })}
            {/* spire */}
            <line x1={cx} y1={yT} x2={cx} y2={yT - 14} stroke="#94a3b8" strokeWidth={1.5} />
            <circle cx={cx} cy={yT - 16} r={1.8} fill="#fbbf24" />
            <XLabel x={cx} label={labels[i]} />
            <text x={cx} y={yT - 28} textAnchor="middle" fontSize={14} fontWeight={700} fill="#cbd5e1" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}
