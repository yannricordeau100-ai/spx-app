"use client";

import { motion } from "motion/react";

type Props = {
  data: number[];
  labels: string[];
  color: string;
};

const W = 640;
const H = 340;
const padTop = 40;
const padBottom = 50;
const padLeft = 56;
const padRight = 28;
const innerW = W - padLeft - padRight;
const innerH = H - padTop - padBottom;

function getDeltas(data: number[]) {
  return data.slice(1).map((v, i) => {
    const prev = data[i];
    if (prev === 0) return 0;
    return ((v - prev) / Math.abs(prev)) * 100;
  });
}

const POS = "#10b981";
const NEG = "#f43f5e";

/* ------------------------------------------------------------------ */
/* 1. RIPPLE WAVES — circular ripples emanating from each year            */
/* ------------------------------------------------------------------ */
export function VariationRippleWaves({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const slot = innerW / deltas.length;
  const maxAbs = Math.max(...deltas.map(Math.abs), 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {deltas.map((pct, i) => {
        const cx = padLeft + slot * i + slot / 2;
        const cy = padTop + innerH / 2;
        const intensity = Math.abs(pct) / maxAbs;
        const c = pct >= 0 ? POS : NEG;
        const baseR = 12 + intensity * 28;
        return (
          <g key={i}>
            {[0, 1, 2].map((j) => (
              <motion.circle
                key={j}
                cx={cx}
                cy={cy}
                fill="none"
                stroke={c}
                strokeWidth="1.5"
                initial={{ r: baseR * 0.4, opacity: 0.7 }}
                animate={{ r: baseR * (1.5 + j * 0.5), opacity: 0 }}
                transition={{ duration: 2.5, delay: j * 0.4, repeat: Infinity }}
              />
            ))}
            <circle cx={cx} cy={cy} r={baseR} fill={c} fillOpacity="0.25" />
            <circle cx={cx} cy={cy} r={baseR * 0.4} fill={c} />
            <text x={cx} y={cy - baseR - 8} textAnchor="middle" fontSize="14" fontWeight="700" fill={c} fontFamily="ui-monospace, monospace">
              {pct >= 0 ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={cx} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. GEYSER — vertical light columns shooting up/down                   */
/* ------------------------------------------------------------------ */
export function VariationGeyser({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const slot = innerW / deltas.length;
  const maxAbs = Math.max(...deltas.map(Math.abs), 1);
  const centerY = padTop + innerH / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Center axis */}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 4" />
      {deltas.map((pct, i) => {
        const cx = padLeft + slot * i + slot / 2;
        const isPos = pct >= 0;
        const c = isPos ? POS : NEG;
        const colHeight = (Math.abs(pct) / maxAbs) * (innerH / 2 - 20);
        const id = `gey-${i}`;
        return (
          <g key={i}>
            <defs>
              <linearGradient id={id} x1="0" y1={isPos ? "1" : "0"} x2="0" y2={isPos ? "0" : "1"}>
                <stop offset="0%" stopColor={c} stopOpacity="1" />
                <stop offset="100%" stopColor={c} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Wide outer geyser */}
            <motion.path
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ duration: 0.8, delay: 0.1 * i }}
              style={{ transformOrigin: `${cx}px ${centerY}px` }}
              d={`M ${cx - 18} ${centerY} Q ${cx} ${centerY + (isPos ? -colHeight : colHeight)} ${cx + 18} ${centerY}`}
              fill={`url(#${id})`}
              stroke="none"
            />
            {/* Inner bright stem */}
            <motion.line
              x1={cx}
              y1={centerY}
              x2={cx}
              y2={centerY + (isPos ? -colHeight : colHeight)}
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.1 * i + 0.3 }}
              style={{ filter: `drop-shadow(0 0 4px ${c})` }}
            />
            {/* Top cap */}
            <circle cx={cx} cy={centerY + (isPos ? -colHeight : colHeight)} r="5" fill={c} stroke="#fff" strokeWidth="1.5" />
            <text
              x={cx}
              y={centerY + (isPos ? -colHeight - 10 : colHeight + 18)}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill={c}
              fontFamily="ui-monospace, monospace"
            >
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={cx} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 3. TORNADO — twisted spirals showing growth direction                 */
/* ------------------------------------------------------------------ */
export function VariationTornado({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const slot = innerW / deltas.length;
  const maxAbs = Math.max(...deltas.map(Math.abs), 1);
  const centerY = padTop + innerH / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {deltas.map((pct, i) => {
        const cx = padLeft + slot * i + slot / 2;
        const isPos = pct >= 0;
        const c = isPos ? POS : NEG;
        const intensity = Math.abs(pct) / maxAbs;
        // Build a spiral path
        const turns = 2 + intensity * 1.5;
        const maxRadius = 25 + intensity * 18;
        const steps = 60;
        let d = "";
        for (let k = 0; k < steps; k++) {
          const t = k / steps;
          const angle = t * Math.PI * 2 * turns * (isPos ? 1 : -1);
          const r = t * maxRadius;
          const yOffset = (isPos ? -t : t) * (40 + intensity * 30);
          const x = cx + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r * 0.4 + yOffset;
          d += k === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
        }
        return (
          <g key={i}>
            <motion.path
              d={d}
              fill="none"
              stroke={c}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.4, delay: 0.1 * i, ease: [0.22, 1, 0.36, 1] }}
              style={{ filter: `drop-shadow(0 0 4px ${c})` }}
            />
            <text
              x={cx}
              y={isPos ? padTop + 14 : padTop + innerH - 4}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill={c}
              fontFamily="ui-monospace, monospace"
            >
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={cx} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </g>
        );
      })}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#3f3f46" strokeOpacity="0.5" strokeDasharray="2 4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 4. DIVING ARROWS — 3D perspective arrows                              */
/* ------------------------------------------------------------------ */
export function VariationArrows({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const slot = innerW / deltas.length;
  const maxAbs = Math.max(...deltas.map(Math.abs), 1);
  const centerY = padTop + innerH / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {deltas.map((pct, i) => {
        const cx = padLeft + slot * i + slot / 2;
        const isPos = pct >= 0;
        const c = isPos ? POS : NEG;
        const intensity = Math.abs(pct) / maxAbs;
        const len = 60 + intensity * 60;
        const startY = centerY + (isPos ? len / 2 : -len / 2);
        const endY = centerY + (isPos ? -len / 2 : len / 2);
        const id = `arr-${i}`;
        return (
          <g key={i}>
            <defs>
              <linearGradient id={id} x1="0" y1={isPos ? "1" : "0"} x2="0" y2={isPos ? "0" : "1"}>
                <stop offset="0%" stopColor={c} stopOpacity="0" />
                <stop offset="100%" stopColor={c} stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Shaft */}
            <motion.line
              x1={cx}
              y1={startY}
              x2={cx}
              y2={endY}
              stroke={`url(#${id})`}
              strokeWidth="6"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.1 * i }}
              style={{ filter: `drop-shadow(0 0 6px ${c})` }}
            />
            {/* Arrowhead (3D triangle) */}
            <motion.polygon
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 * i + 0.6 }}
              style={{ transformOrigin: `${cx}px ${endY}px` }}
              points={
                isPos
                  ? `${cx - 12},${endY + 10} ${cx + 12},${endY + 10} ${cx},${endY - 6}`
                  : `${cx - 12},${endY - 10} ${cx + 12},${endY - 10} ${cx},${endY + 6}`
              }
              fill={c}
              stroke="#ffffff"
              strokeWidth="1"
              strokeOpacity="0.5"
            />
            {/* Side highlight on arrowhead (3D) */}
            <polygon
              points={
                isPos
                  ? `${cx - 12},${endY + 10} ${cx},${endY + 10} ${cx},${endY - 6}`
                  : `${cx - 12},${endY - 10} ${cx},${endY - 10} ${cx},${endY + 6}`
              }
              fill="#ffffff"
              fillOpacity="0.25"
            />
            <text
              x={cx}
              y={isPos ? endY - 14 : endY + 22}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill={c}
              fontFamily="ui-monospace, monospace"
            >
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={cx} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </g>
        );
      })}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#3f3f46" strokeOpacity="0.4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 5. STACKED DISCS — floating discs with thickness = magnitude          */
/* ------------------------------------------------------------------ */
export function VariationDiscs({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const slot = innerW / deltas.length;
  const maxAbs = Math.max(...deltas.map(Math.abs), 1);
  const centerY = padTop + innerH / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {deltas.map((pct, i) => {
        const cx = padLeft + slot * i + slot / 2;
        const isPos = pct >= 0;
        const c = isPos ? POS : NEG;
        const intensity = Math.abs(pct) / maxAbs;
        const ry = 8 + intensity * 18;
        const rx = 38;
        const stack = Math.ceil(2 + intensity * 5);
        const spacing = 8;
        return (
          <g key={i}>
            {Array.from({ length: stack }).map((_, j) => {
              const dy = (isPos ? -1 : 1) * (j * spacing);
              return (
                <motion.ellipse
                  key={j}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 0.95 - j * 0.1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * i + j * 0.08 }}
                  cx={cx}
                  cy={centerY + dy}
                  rx={rx - j * 1.5}
                  ry={ry / 2}
                  fill={c}
                  fillOpacity={0.7 - j * 0.08}
                  stroke="#ffffff"
                  strokeOpacity={0.3}
                  strokeWidth="0.8"
                />
              );
            })}
            {/* Top reflection */}
            <ellipse
              cx={cx}
              cy={centerY + (isPos ? -((stack - 1) * spacing) : ((stack - 1) * spacing)) + (isPos ? -ry / 4 : ry / 4)}
              rx={rx * 0.55}
              ry="2"
              fill="#ffffff"
              fillOpacity="0.5"
            />
            <text
              x={cx}
              y={centerY + (isPos ? -((stack - 1) * spacing) - ry - 8 : ((stack - 1) * spacing) + ry + 18)}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill={c}
              fontFamily="ui-monospace, monospace"
            >
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={cx} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </g>
        );
      })}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#3f3f46" strokeOpacity="0.4" strokeDasharray="2 4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 6. ISOMETRIC BLOCKS — chaque variation = un bloc 3D isométrique     */
/* (vert si positif, rouge si négatif). Hauteur = magnitude. Idem     */
/* angle des références bars : front + top + right faces, glow au sol.*/
/* ------------------------------------------------------------------ */
export function VariationIsoBlocks({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d)), 1);
  const slot = innerW / deltas.length;
  const barW = Math.min(slot * 0.5, 50);
  const centerY = padTop + innerH / 2;
  const DX = 22;
  const DY = -14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="vib-pos-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={POS} stopOpacity="1" />
          <stop offset="100%" stopColor={POS} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="vib-pos-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor={POS} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="vib-pos-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={POS} stopOpacity="0.65" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="vib-neg-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NEG} stopOpacity="1" />
          <stop offset="100%" stopColor={NEG} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="vib-neg-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor={NEG} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="vib-neg-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={NEG} stopOpacity="0.65" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
        </linearGradient>
        <filter id="vib-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      {deltas.map((pct, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const isPos = pct >= 0;
        const c = isPos ? POS : NEG;
        const fillFront = isPos ? "url(#vib-pos-front)" : "url(#vib-neg-front)";
        const fillTop = isPos ? "url(#vib-pos-top)" : "url(#vib-neg-top)";
        const fillSide = isPos ? "url(#vib-pos-side)" : "url(#vib-neg-side)";
        const h = (Math.abs(pct) / maxAbs) * (innerH / 2 - 10);
        const yTop = isPos ? centerY - h : centerY;
        const yBot = isPos ? centerY : centerY + h;
        const topPath = `M ${x},${yTop} L ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + DX},${yTop + DY} Z`;
        const sidePath = `M ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + barW + DX},${yBot + DY} L ${x + barW},${yBot} Z`;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: isPos ? 12 : -12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={yBot + 6} rx={barW * 0.55} ry={3}
              fill="#000000" fillOpacity="0.5" filter="url(#vib-blur)" />
            <path d={sidePath} fill={fillSide} stroke={c} strokeOpacity="0.4" strokeWidth="0.5" />
            <rect x={x} y={yTop} width={barW} height={h} fill={fillFront} stroke={c} strokeOpacity="0.75" strokeWidth="0.6" rx="1" />
            <path d={topPath} fill={fillTop} stroke={c} strokeOpacity="0.85" strokeWidth="0.5" />
            <text x={x + barW / 2 + DX / 2} y={isPos ? yTop + DY - 8 : yBot + DY + 18}
              textAnchor="middle" fontSize="13" fontWeight="700" fill={c} fontFamily="ui-monospace, monospace">
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12"
              fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </motion.g>
        );
      })}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#3f3f46" strokeOpacity="0.4" strokeDasharray="2 4" />
    </svg>
  );
}

/* ===== Helpers communs aux variantes 3D variation ===== */
function vTopPath(x: number, y: number, w: number, dx: number, dy: number) {
  return `M ${x},${y} L ${x + w},${y} L ${x + w + dx},${y + dy} L ${x + dx},${y + dy} Z`;
}
function vSidePath(x: number, y: number, h: number, w: number, dx: number, dy: number) {
  return `M ${x + w},${y} L ${x + w + dx},${y + dy} L ${x + w + dx},${y + h + dy} L ${x + w},${y + h} Z`;
}

/* ------------------------------------------------------------------ */
/* 7. GLASS — tours de verre vert/rouge translucides + halo au sol.    */
/* ------------------------------------------------------------------ */
export function VariationGlass({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d)), 1);
  const slot = innerW / deltas.length;
  const barW = Math.min(slot * 0.4, 44);
  const centerY = padTop + innerH / 2;
  const DX = 18, DY = -12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        {[POS, NEG].map((c, k) => (
          <g key={k}>
            <linearGradient id={`vg-front-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="0.55" />
              <stop offset="50%" stopColor={c} stopOpacity="0.3" />
              <stop offset="100%" stopColor={c} stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id={`vg-top-${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="100%" stopColor={c} stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id={`vg-side-${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c} stopOpacity="0.4" />
              <stop offset="100%" stopColor={c} stopOpacity="0.1" />
            </linearGradient>
            <radialGradient id={`vg-halo-${k}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity="0.7" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          </g>
        ))}
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#0a0a0f" />
      {deltas.map((pct, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const isPos = pct >= 0;
        const k = isPos ? 0 : 1;
        const c = isPos ? POS : NEG;
        const h = (Math.abs(pct) / maxAbs) * (innerH / 2 - 10);
        const yTop = isPos ? centerY - h : centerY;
        const yBot = isPos ? centerY : centerY + h;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: isPos ? 12 : -12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 * i }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={yBot + 4} rx={barW * 1.1} ry={9} fill={`url(#vg-halo-${k})`} />
            <path d={vSidePath(x, yTop, h, barW, DX, DY)} fill={`url(#vg-side-${k})`} stroke={c} strokeOpacity="0.55" strokeWidth="0.6" />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#vg-front-${k})`} stroke={c} strokeOpacity="0.85" strokeWidth="1" rx="1" />
            <rect x={x + 2} y={yTop + 2} width={Math.max(2, barW * 0.18)} height={h - 4} fill="#ffffff" fillOpacity="0.18" rx="1" />
            <path d={vTopPath(x, yTop, barW, DX, DY)} fill={`url(#vg-top-${k})`} stroke={c} strokeOpacity="0.85" strokeWidth="0.5" />
            <text x={x + barW / 2 + DX / 2} y={isPos ? yTop + DY - 8 : yBot + DY + 18}
              textAnchor="middle" fontSize="13" fontWeight="700" fill={c} fontFamily="ui-monospace, monospace">
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </motion.g>
        );
      })}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#3f3f46" strokeOpacity="0.4" strokeDasharray="2 4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 8. SOFT CLAY — claymorphism vert/rouge, coins arrondis, ombres douces */
/* ------------------------------------------------------------------ */
export function VariationSoftClay({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d)), 1);
  const slot = innerW / deltas.length;
  const barW = Math.min(slot * 0.4, 46);
  const centerY = padTop + innerH / 2;
  const DX = 18, DY = -12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        {[POS, NEG].map((c, k) => (
          <g key={k}>
            <linearGradient id={`vc-front-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="40%" stopColor={c} stopOpacity="0.95" />
              <stop offset="100%" stopColor={c} stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id={`vc-top-${k}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor={c} stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id={`vc-side-${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c} stopOpacity="0.7" />
              <stop offset="100%" stopColor={c} stopOpacity="0.45" />
            </linearGradient>
          </g>
        ))}
        <filter id="vc-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#1a1a22" />
      {deltas.map((pct, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const isPos = pct >= 0;
        const k = isPos ? 0 : 1;
        const c = isPos ? POS : NEG;
        const h = (Math.abs(pct) / maxAbs) * (innerH / 2 - 10);
        const yTop = isPos ? centerY - h : centerY;
        const yBot = isPos ? centerY : centerY + h;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: isPos ? 12 : -12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={yBot + 8} rx={barW * 0.6} ry={5} fill="#000000" fillOpacity="0.45" filter="url(#vc-soft)" />
            <path d={vSidePath(x, yTop, h, barW, DX, DY)} fill={`url(#vc-side-${k})`} />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#vc-front-${k})`} rx="6" />
            <ellipse cx={x + barW * 0.4} cy={yTop + h * 0.18} rx={barW * 0.25} ry={Math.max(2, h * 0.05)} fill="#ffffff" fillOpacity="0.45" />
            <path d={vTopPath(x, yTop, barW, DX, DY)} fill={`url(#vc-top-${k})`} />
            <text x={x + barW / 2 + DX / 2} y={isPos ? yTop + DY - 8 : yBot + DY + 18}
              textAnchor="middle" fontSize="13" fontWeight="700" fill={c} fontFamily="ui-monospace, monospace">
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </motion.g>
        );
      })}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#3f3f46" strokeOpacity="0.4" strokeDasharray="2 4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 9. NEON OUTLINE — bars creuses vert/rouge, contour glow néon         */
/* ------------------------------------------------------------------ */
export function VariationNeonOutline({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d)), 1);
  const slot = innerW / deltas.length;
  const barW = Math.min(slot * 0.42, 48);
  const centerY = padTop + innerH / 2;
  const DX = 22, DY = -14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="vn-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#070710" />
      {deltas.map((pct, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const isPos = pct >= 0;
        const c = isPos ? POS : NEG;
        const h = (Math.abs(pct) / maxAbs) * (innerH / 2 - 10);
        const yTop = isPos ? centerY - h : centerY;
        const yBot = isPos ? centerY : centerY + h;
        const top = vTopPath(x, yTop, barW, DX, DY);
        const side = vSidePath(x, yTop, h, barW, DX, DY);
        return (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.08 * i }}>
            <rect x={x} y={yTop} width={barW} height={h} fill={c} fillOpacity="0.12" stroke={c} strokeWidth="1.5" filter="url(#vn-glow)" />
            <rect x={x} y={yTop} width={barW} height={h} fill="none" stroke={c} strokeWidth="1.5" />
            <path d={top} fill="none" stroke={c} strokeWidth="1.5" filter="url(#vn-glow)" />
            <path d={top} fill="none" stroke={c} strokeWidth="1.5" />
            <path d={side} fill="none" stroke={c} strokeWidth="1.5" strokeOpacity="0.6" />
            <text x={x + barW / 2 + DX / 2} y={isPos ? yTop + DY - 8 : yBot + DY + 18}
              textAnchor="middle" fontSize="13" fontWeight="700" fill={c} fontFamily="ui-monospace, monospace" style={{ filter: `drop-shadow(0 0 4px ${c})` }}>
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </motion.g>
        );
      })}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="2 4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 10. CINEMATIC — 3D dramatique, rim light blanc + ombre profonde     */
/* ------------------------------------------------------------------ */
export function VariationCinematic({ data, labels }: Props) {
  const deltas = getDeltas(data);
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d)), 1);
  const slot = innerW / deltas.length;
  const barW = Math.min(slot * 0.42, 50);
  const centerY = padTop + innerH / 2;
  const DX = 26, DY = -16;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        {[POS, NEG].map((c, k) => (
          <g key={k}>
            <linearGradient id={`vci-front-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="0.95" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id={`vci-top-${k}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="100%" stopColor={c} stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id={`vci-side-${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c} stopOpacity="0.4" />
              <stop offset="100%" stopColor="#000000" stopOpacity="1" />
            </linearGradient>
          </g>
        ))}
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#000000" />
      {deltas.map((pct, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const isPos = pct >= 0;
        const k = isPos ? 0 : 1;
        const c = isPos ? POS : NEG;
        const h = (Math.abs(pct) / maxAbs) * (innerH / 2 - 10);
        const yTop = isPos ? centerY - h : centerY;
        const yBot = isPos ? centerY : centerY + h;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: isPos ? 18 : -18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i }}>
            <path d={vSidePath(x, yTop, h, barW, DX, DY)} fill={`url(#vci-side-${k})`} />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#vci-front-${k})`} />
            <rect x={x} y={yTop} width={1.5} height={h} fill="#ffffff" fillOpacity="0.7" />
            <rect x={x} y={yTop} width={barW} height={1.5} fill="#ffffff" fillOpacity="0.85" />
            <path d={vTopPath(x, yTop, barW, DX, DY)} fill={`url(#vci-top-${k})`} />
            <text x={x + barW / 2 + DX / 2} y={isPos ? yTop + DY - 8 : yBot + DY + 18}
              textAnchor="middle" fontSize="13" fontWeight="700" fill={c} fontFamily="ui-monospace, monospace">
              {isPos ? "+" : ""}{pct.toFixed(1)} %
            </text>
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i + 1]}</text>
          </motion.g>
        );
      })}
      <line x1={padLeft} x2={padLeft + innerW} y1={centerY} y2={centerY} stroke="#3f3f46" strokeOpacity="0.4" strokeDasharray="2 4" />
    </svg>
  );
}
