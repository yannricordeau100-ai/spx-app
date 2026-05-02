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

/* ------------------------------------------------------------------ */
/* 6. ISOMETRIC MODERN — flat-colored 3D blocks (image 1 réf : rainbow */
/* infographic). Strong isometric angle, modern flat colors, soft     */
/* floor shadow per bar, faint isometric grid backdrop.               */
/* ------------------------------------------------------------------ */
export function BarsIsometricModern({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.42, 50);
  const DX = 26;
  const DY = -16;
  const id = `iso-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="60%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={padLeft} y={padTop} width={innerW + DX} height={innerH + Math.abs(DY)} fill={`url(#${id}-grid)`} />
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        const topPath = `M ${x},${yTop} L ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + DX},${yTop + DY} Z`;
        const sidePath = `M ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + barW + DX},${yBot + DY} L ${x + barW},${yBot} Z`;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={yBot + 7} rx={barW * 0.6} ry={3.5}
              fill="#000000" fillOpacity="0.55" filter={`url(#${id}-blur)`} />
            <path d={sidePath} fill={`url(#${id}-side)`} stroke={color} strokeOpacity="0.4" strokeWidth="0.5" />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#${id}-front)`} stroke={color} strokeOpacity="0.75" strokeWidth="0.6" rx="1" />
            <path d={topPath} fill={`url(#${id}-top)`} stroke={color} strokeOpacity="0.85" strokeWidth="0.5" />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12"
              fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700"
                fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 7. GLASS TOWERS — translucent bars + floor halo glow (image 4 réf : */
/* glass towers on dark with floor lights). Soft inner highlight,     */
/* glass-like edges, floor radial glow under each bar.                */
/* ------------------------------------------------------------------ */
export function BarsGlassTowers({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.36, 42);
  const DX = 18;
  const DY = -12;
  const id = `glass-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="50%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="60%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#0a0a0f" />
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        const topPath = `M ${x},${yTop} L ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + DX},${yTop + DY} Z`;
        const sidePath = `M ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + barW + DX},${yBot + DY} L ${x + barW},${yBot} Z`;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={yBot + 4} rx={barW * 1.1} ry={10} fill={`url(#${id}-halo)`} />
            <path d={sidePath} fill={`url(#${id}-side)`} stroke={color} strokeOpacity="0.6" strokeWidth="0.8" />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#${id}-front)`} stroke={color} strokeOpacity="0.85" strokeWidth="1" rx="1" />
            <rect x={x + 2} y={yTop + 2} width={Math.max(2, barW * 0.18)} height={h - 4} fill={`url(#${id}-shine)`} rx="1" />
            <path d={`M ${x + 1},${yTop + h * 0.55} Q ${x + barW / 2},${yTop + h * 0.5} ${x + barW - 1},${yTop + h * 0.55}`}
              fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
            <path d={topPath} fill={`url(#${id}-top)`} stroke={color} strokeOpacity="0.9" strokeWidth="0.8" />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12"
              fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700"
                fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 8. DEEP PERSPECTIVE — strong 3D + glossy specular (images 2-3 réfs).*/
/* Stronger isometric depth, polished specular highlight strip on top,*/
/* deep right-face shadow, ground reflection.                         */
/* ------------------------------------------------------------------ */
export function BarsDeepPerspective({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.42, 52);
  const DX = 32;
  const DY = -20;
  const id = `deep-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="15%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${id}-reflection`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        const topPath = `M ${x},${yTop} L ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + DX},${yTop + DY} Z`;
        const sidePath = `M ${x + barW},${yTop} L ${x + barW + DX},${yTop + DY} L ${x + barW + DX},${yBot + DY} L ${x + barW},${yBot} Z`;
        const reflectionH = h * 0.35;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}>
            <rect x={x} y={yBot} width={barW} height={reflectionH} fill={`url(#${id}-reflection)`}
              transform={`scale(1 -1) translate(0 ${-2 * (yBot + reflectionH / 2)})`} opacity="0.5" />
            <ellipse cx={x + barW / 2 + DX / 2} cy={yBot + 9} rx={barW * 0.7} ry={4.5}
              fill="#000000" fillOpacity="0.7" filter={`url(#${id}-blur)`} />
            <path d={sidePath} fill={`url(#${id}-side)`} stroke="#000000" strokeOpacity="0.5" strokeWidth="0.5" />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#${id}-front)`} stroke={color} strokeOpacity="0.85" strokeWidth="0.7" rx="1.5" />
            <rect x={x + barW * 0.78} y={yTop + 3} width={2.5} height={h - 6} fill="#ffffff" fillOpacity="0.55" rx="1" />
            <path d={topPath} fill={`url(#${id}-top)`} stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.5" />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12"
              fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700"
                fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ===== Helpers communs aux 3D bars ===== */
function topFacePath(x: number, y: number, w: number, dx: number, dy: number) {
  return `M ${x},${y} L ${x + w},${y} L ${x + w + dx},${y + dy} L ${x + dx},${y + dy} Z`;
}
function sideFacePath(x: number, y: number, h: number, w: number, dx: number, dy: number) {
  return `M ${x + w},${y} L ${x + w + dx},${y + dy} L ${x + w + dx},${y + h + dy} L ${x + w},${y + h} Z`;
}

/* ------------------------------------------------------------------ */
/* 9. GLASSMORPHISM — verre dépoli moderne (Apple Vision Pro / Linear) */
/* Fill très transparent + bord net + reflet diagonal en haut.        */
/* ------------------------------------------------------------------ */
export function BarsGlassmorphism({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.42, 50);
  const DX = 22, DY = -14;
  const id = `gm-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="50%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor={color} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#0a0a0f" />
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        return (
          <motion.g key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 * i }}>
            <path d={sideFacePath(x, yTop, h, barW, DX, DY)} fill={`url(#${id}-side)`} stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.6" />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#${id}-front)`} stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1" rx="3" />
            <polygon points={`${x + 3},${yTop + 3} ${x + barW * 0.55},${yTop + 3} ${x + 3},${yTop + h * 0.4}`} fill="#ffffff" fillOpacity="0.18" />
            <path d={topFacePath(x, yTop, barW, DX, DY)} fill={`url(#${id}-top)`} stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.6" />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 10. AURORA GRADIENT — dégradé fluide multi-stops sans bord, halo    */
/* lumineux. Inspiration : aurores boréales, Stripe gradients.         */
/* ------------------------------------------------------------------ */
export function BarsAurora({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.42, 50);
  const DX = 22, DY = -14;
  const id = `aur-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="20%" stopColor={color} stopOpacity="1" />
          <stop offset="60%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor={color} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#08080c" />
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        return (
          <motion.g key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i }}>
            <rect x={x - 8} y={yTop} width={barW + 16} height={h} fill={color} fillOpacity="0.4" filter={`url(#${id}-glow)`} />
            <path d={sideFacePath(x, yTop, h, barW, DX, DY)} fill={`url(#${id}-side)`} />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#${id}-front)`} rx="2" />
            <path d={topFacePath(x, yTop, barW, DX, DY)} fill={`url(#${id}-top)`} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.5" />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 11. NEON OUTLINE — bars creuses, contour néon glow, fond vide.      */
/* Inspiration : Tron, cyberpunk, Vercel dashboards.                   */
/* ------------------------------------------------------------------ */
export function BarsNeonOutline({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.42, 50);
  const DX = 22, DY = -14;
  const id = `neo-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#070710" />
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        const top = topFacePath(x, yTop, barW, DX, DY);
        const side = sideFacePath(x, yTop, h, barW, DX, DY);
        return (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.08 * i }}>
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#${id}-fill)`} stroke={color} strokeWidth="1.5" filter={`url(#${id}-glow)`} />
            <rect x={x} y={yTop} width={barW} height={h} fill="none" stroke={color} strokeWidth="1.5" />
            <path d={top} fill="none" stroke={color} strokeWidth="1.5" filter={`url(#${id}-glow)`} />
            <path d={top} fill="none" stroke={color} strokeWidth="1.5" />
            <path d={side} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill={color} fontFamily="ui-monospace, monospace" style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 12. SOFT CLAY — surfaces molles, coins arrondis, ombres douces.     */
/* Inspiration : Apple icon style, Notion 3D, Claymorphism.            */
/* ------------------------------------------------------------------ */
export function BarsSoftClay({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.4, 48);
  const DX = 18, DY = -12;
  const id = `clay-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="40%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor={color} stopOpacity="0.45" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#1a1a22" />
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        return (
          <motion.g key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={yBot + 8} rx={barW * 0.6} ry={5} fill="#000000" fillOpacity="0.45" filter={`url(#${id}-soft)`} />
            <path d={sideFacePath(x, yTop, h, barW, DX, DY)} fill={`url(#${id}-side)`} />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#${id}-front)`} rx="6" />
            <ellipse cx={x + barW * 0.4} cy={yTop + h * 0.18} rx={barW * 0.25} ry={h * 0.05} fill="#ffffff" fillOpacity="0.45" />
            <path d={topFacePath(x, yTop, barW, DX, DY)} fill={`url(#${id}-top)`} />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 13. CINEMATIC RIM LIGHT — bloc 3D dramatique, rim light blanc fort, */
/* contraste poussé. Inspiration : posters cinéma, Linear marketing.   */
/* ------------------------------------------------------------------ */
export function BarsCinematic({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.42, 52);
  const DX = 28, DY = -18;
  const id = `cin-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#000000" />
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        return (
          <motion.g key={i} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i }}>
            <path d={sideFacePath(x, yTop, h, barW, DX, DY)} fill={`url(#${id}-side)`} />
            <rect x={x} y={yTop} width={barW} height={h} fill={`url(#${id}-front)`} />
            <rect x={x} y={yTop} width={1.5} height={h} fill="#ffffff" fillOpacity="0.7" />
            <rect x={x} y={yTop} width={barW} height={1.5} fill="#ffffff" fillOpacity="0.85" />
            <path d={topFacePath(x, yTop, barW, DX, DY)} fill={`url(#${id}-top)`} />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 14. LAYERED SLICES — bars composées de tranches horizontales        */
/* empilées (effet matériau stratifié). Inspiration : Origami, paper. */
/* ------------------------------------------------------------------ */
export function BarsLayered({ data, labels, color, unit }: Props) {
  const { min, max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.4, 48);
  const DX = 22, DY = -14;
  const id = `lay-${color.slice(1)}`;
  const SLICE_H = 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="100%" stopColor={color} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {data.map((v, i) => {
        const x = padLeft + slot * i + (slot - barW) / 2;
        const yTop = padTop + ((max - Math.max(v, 0)) / range) * innerH;
        const yBot = padTop + ((max - Math.min(v, 0)) / range) * innerH;
        const h = Math.max(2, yBot - yTop);
        const slices = Math.max(1, Math.floor(h / SLICE_H));
        return (
          <motion.g key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 * i }}>
            <path d={sideFacePath(x, yTop, h, barW, DX, DY)} fill={`url(#${id}-side)`} />
            {Array.from({ length: slices }).map((_, k) => {
              const ratio = k / Math.max(1, slices - 1);
              const opacity = 0.5 + ratio * 0.5;
              return (
                <rect key={k} x={x} y={yTop + k * SLICE_H} width={barW} height={SLICE_H - 1.2}
                  fill={color} fillOpacity={opacity} stroke="#000000" strokeOpacity="0.4" strokeWidth="0.4" />
              );
            })}
            <path d={topFacePath(x, yTop, barW, DX, DY)} fill={`url(#${id}-top)`} stroke={color} strokeOpacity="0.8" strokeWidth="0.5" />
            <text x={x + barW / 2 + DX / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
            {i === data.length - 1 && (
              <text x={x + barW / 2 + DX / 2} y={yTop + DY - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
                {v}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 18. CLASSIC — barres 2D pleines, ombre douce, label au-dessus       */
/* ------------------------------------------------------------------ */
export function BarsClassic({ data, labels, color, unit }: Props) {
  const { max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = slot * 0.62;
  const id = `cls-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="3" />
          <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = padTop + innerH * t;
        return <line key={i} x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="#1f1f23" strokeWidth="1" />;
      })}
      {data.map((v, i) => {
        const h = (v / range) * innerH;
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + innerH - h;
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
          >
            <rect x={x} y={y} width={barW} height={h} fill={color} filter={`url(#${id}-shadow)`} />
            <text x={x + barW / 2} y={y - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#e4e4e7" fontFamily="ui-monospace, monospace">
              {v}{unit && <tspan fontSize="9" fill="#a1a1aa"> {unit}</tspan>}
            </text>
            <text x={x + barW / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="11" fill="#a1a1aa" fontFamily="ui-monospace, monospace">{labels[i]}</text>
          </motion.g>
        );
      })}
      {[0, 0.5, 1].map((t, i) => {
        const v = max - (max - 0) * t;
        const y = padTop + innerH * t;
        return (
          <text key={i} x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#52525b" fontFamily="ui-monospace, monospace">
            {Math.round(v)}
          </text>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 19. RIBBON — barres 2D gradient vertical, coins arrondis top        */
/* ------------------------------------------------------------------ */
export function BarsRibbon({ data, labels, color, unit }: Props) {
  const { max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = slot * 0.5;
  const id = `rib-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <line x1={padLeft} y1={padTop + innerH} x2={W - padRight} y2={padTop + innerH} stroke="#27272a" strokeWidth="1" />
      {data.map((v, i) => {
        const h = (v / range) * innerH;
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + innerH - h;
        const r = Math.min(barW / 2, 8);
        const path = `M ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + barW - r} ${y} Q ${x + barW} ${y} ${x + barW} ${y + r} L ${x + barW} ${y + h} L ${x} ${y + h} Z`;
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: i * 0.07, duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ transformOrigin: `${x + barW / 2}px ${padTop + innerH}px` }}
          >
            <path d={path} fill={`url(#${id}-grad)`} />
            <line x1={x + 2} y1={y + 1} x2={x + barW - 2} y2={y + 1} stroke={color} strokeWidth="1.5" strokeOpacity="0.9" strokeLinecap="round" />
            <text x={x + barW / 2} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="600" fill={color} fontFamily="ui-monospace, monospace">
              {v}{unit && <tspan fontSize="9" fill="#a1a1aa"> {unit}</tspan>}
            </text>
            <text x={x + barW / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="11" fill="#a1a1aa" fontFamily="ui-monospace, monospace">{labels[i]}</text>
          </motion.g>
        );
      })}
      <text x={padLeft - 8} y={padTop + 6} textAnchor="end" fontSize="10" fill="#52525b" fontFamily="ui-monospace, monospace">{Math.round(max)}</text>
      <text x={padLeft - 8} y={padTop + innerH + 4} textAnchor="end" fontSize="10" fill="#52525b" fontFamily="ui-monospace, monospace">0</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 20. TRACK — barres dans un "track" gris (max value visualisé)       */
/* ------------------------------------------------------------------ */
export function BarsTrack({ data, labels, color, unit }: Props) {
  const { max, range } = scale(data);
  const slot = innerW / data.length;
  const barW = slot * 0.45;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      {data.map((v, i) => {
        const h = (v / range) * innerH;
        const x = padLeft + slot * i + (slot - barW) / 2;
        const y = padTop + innerH - h;
        const trackY = padTop;
        const trackH = innerH;
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
          >
            <rect x={x} y={trackY} width={barW} height={trackH} rx="3" fill="#1a1a1d" />
            <motion.rect
              x={x}
              width={barW}
              rx="3"
              fill={color}
              initial={{ y: trackY + trackH, height: 0 }}
              animate={{ y: y, height: h }}
              transition={{ delay: i * 0.05 + 0.1, duration: 0.6, ease: "easeOut" }}
            />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
              {v}
            </text>
            <text x={x + barW / 2} y={H - padBottom + 22} textAnchor="middle" fontSize="11" fill="#a1a1aa" fontFamily="ui-monospace, monospace">{labels[i]}</text>
          </motion.g>
        );
      })}
      <text x={W - padRight} y={padTop - 12} textAnchor="end" fontSize="10" fill="#71717a" fontFamily="ui-monospace, monospace">{unit}</text>
      <text x={padLeft - 8} y={padTop + 6} textAnchor="end" fontSize="10" fill="#52525b" fontFamily="ui-monospace, monospace">{Math.round(max)}</text>
    </svg>
  );
}
