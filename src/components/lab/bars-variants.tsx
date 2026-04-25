"use client";

import { motion } from "motion/react";

type Props = {
  data: number[];
  labels: string[];
  color: string;
  unit: string;
};

const W = 640;
const H = 340;
const padTop = 40;
const padBottom = 50;
const padLeft = 56;
const padRight = 28;
const innerW = W - padLeft - padRight;
const innerH = H - padTop - padBottom;

function scale(data: number[]) {
  const min = Math.min(0, ...data);
  const max = Math.max(...data, 0);
  const range = max - min || 1;
  return { min, max, range };
}

/* ------------------------------------------------------------------ */
/* 1. CRYSTAL — transparent glass bars with internal light streams      */
/* ------------------------------------------------------------------ */
export function BarsCrystal({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = slot * 0.55;
  const id = `crys-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="50%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const h = padTop + ((max - Math.min(v, 0)) / range) * innerH - y;
        return (
          <g key={i}>
            {/* Glass body */}
            <motion.rect
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.7, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: `${x}px ${y + h}px` }}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              fill={`url(#${id}-glass)`}
              stroke={`url(#${id}-edge)`}
              strokeWidth="1.2"
            />
            {/* Inner light stream */}
            <motion.rect
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.06 * i + 0.3 }}
              x={x + barW * 0.2}
              y={y + 3}
              width={barW * 0.18}
              height={h - 6}
              rx={1}
              fill="#ffffff"
              fillOpacity="0.4"
              filter={`url(#${id}-blur)`}
            />
            {/* Top facet */}
            <ellipse cx={x + barW / 2} cy={y} rx={barW / 2} ry={2.5} fill="#ffffff" fillOpacity="0.7" />
            <text x={x + barW / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2} y={y - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </g>
        );
      })}
      {/* Y axis line */}
      <line x1={padLeft - 8} x2={padLeft - 8} y1={padTop} y2={padTop + innerH} stroke={color} strokeOpacity="0.3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. HOLOGRAM — wireframe with neon scan lines                          */
/* ------------------------------------------------------------------ */
export function BarsHologram({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = slot * 0.55;
  const id = `holo-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id={`${id}-scan`} x="0" y="0" width="100%" height="6" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="100%" y2="0" stroke={color} strokeOpacity="0.18" />
        </pattern>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const h = padTop + ((max - Math.min(v, 0)) / range) * innerH - y;
        return (
          <g key={i}>
            <motion.g
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.06 * i }}
              style={{ transformOrigin: `${x}px ${y + h}px` }}
            >
              {/* Outer glow */}
              <rect x={x} y={y} width={barW} height={h} rx={2} fill={color} fillOpacity="0.08" filter={`url(#${id}-glow)`} />
              {/* Scan-line fill */}
              <rect x={x} y={y} width={barW} height={h} rx={2} fill={`url(#${id}-scan)`} />
              {/* Wireframe edges */}
              <rect x={x} y={y} width={barW} height={h} rx={2} fill="none" stroke={color} strokeWidth="1.5" />
              {/* Vertical accent */}
              <line x1={x + barW / 2} x2={x + barW / 2} y1={y} y2={y + h} stroke={color} strokeWidth="0.5" strokeOpacity="0.4" />
              {/* Top corners markers */}
              <circle cx={x} cy={y} r="2.5" fill={color} />
              <circle cx={x + barW} cy={y} r="2.5" fill={color} />
            </motion.g>
            <text x={x + barW / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2} y={y - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill={color} fontFamily="ui-monospace, monospace" style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 3. MERCURY — chrome/metallic reflective bars                         */
/* ------------------------------------------------------------------ */
export function BarsMercury({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = slot * 0.5;
  const id = `merc-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1a1a1f" />
          <stop offset="20%" stopColor={color} />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="80%" stopColor={color} />
          <stop offset="100%" stopColor="#1a1a1f" />
        </linearGradient>
      </defs>
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const h = padTop + ((max - Math.min(v, 0)) / range) * innerH - y;
        return (
          <g key={i}>
            <motion.rect
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.7, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: `${x}px ${y + h}px` }}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              fill={`url(#${id}-chrome)`}
              stroke="#ffffff"
              strokeOpacity="0.3"
              strokeWidth="0.8"
            />
            {/* Liquid drop reflection on top */}
            <ellipse cx={x + barW / 2} cy={y + 4} rx={barW * 0.4} ry={3} fill="#ffffff" fillOpacity="0.6" />
            {/* Drip shadow at base */}
            <ellipse cx={x + barW / 2} cy={y + h + 3} rx={barW * 0.5} ry={3} fill="#000" fillOpacity="0.5" />
            <text x={x + barW / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2} y={y - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 4. PARTICLE STREAM — bars made of vertical streaming particles        */
/* ------------------------------------------------------------------ */
export function BarsParticles({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = slot * 0.5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const h = padTop + ((max - Math.min(v, 0)) / range) * innerH - y;
        const particleCount = Math.max(8, Math.round(h / 6));
        return (
          <g key={i}>
            {/* Container outline */}
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={color} fillOpacity="0.05" stroke={color} strokeOpacity="0.25" />
            {/* Particles */}
            {Array.from({ length: particleCount }).map((_, j) => {
              // Deterministic pseudo-random from i + j
              const seed = (i * 31 + j * 17) % 100 / 100;
              const seed2 = (i * 13 + j * 23) % 100 / 100;
              const py = y + j * (h / particleCount) + seed * 3;
              const r = 1.5 + seed2 * 2;
              return (
                <motion.circle
                  key={j}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0.4] }}
                  transition={{
                    duration: 1.5 + seed * 2,
                    delay: 0.06 * i + j * 0.04,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                  cx={x + barW / 2 + (seed2 - 0.5) * (barW * 0.7)}
                  cy={py}
                  r={r}
                  fill={color}
                />
              );
            })}
            {/* Top glow ring */}
            <ellipse cx={x + barW / 2} cy={y} rx={barW / 2} ry={4} fill={color} fillOpacity="0.6" />
            <text x={x + barW / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2} y={y - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 5. FLOATING PANELS — flat luminous panels suspended at depth         */
/* ------------------------------------------------------------------ */
export function BarsFloating({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = slot * 0.6;
  const id = `flt-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.4" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const h = padTop + ((max - Math.min(v, 0)) / range) * innerH - y;
        // Float offset by index to give "depth"
        const dy = (i % 2 === 0 ? -4 : 4);
        return (
          <g key={i}>
            {/* Glow under panel */}
            <ellipse cx={x + barW / 2} cy={y + h + 12} rx={barW / 2} ry={6} fill={color} fillOpacity="0.6" filter={`url(#${id}-blur)`} />
            <motion.g
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: dy, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Outer glow rectangle */}
              <rect x={x - 2} y={y - 2} width={barW + 4} height={h + 4} rx={4} fill={color} fillOpacity="0.18" filter={`url(#${id}-blur)`} />
              {/* Main panel */}
              <rect x={x} y={y} width={barW} height={h} rx={2} fill={`url(#${id}-grad)`} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.8" />
              {/* Reflective highlight stripe */}
              <rect x={x + 2} y={y + 2} width={barW - 4} height={4} rx={1} fill="#ffffff" fillOpacity="0.4" />
            </motion.g>
            <text x={x + barW / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2} y={y + dy - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
