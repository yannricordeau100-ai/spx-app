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

function getPoints(data: number[]) {
  const min = Math.min(0, ...data);
  const max = Math.max(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  return data.map((v, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + ((max - v) / range) * innerH;
    return [x, y] as const;
  });
}

function smoothPath(pts: readonly (readonly [number, number])[]) {
  return pts
    .map(([x, y], i) => {
      if (i === 0) return `M ${x},${y}`;
      const [px, py] = pts[i - 1];
      const cx = (px + x) / 2;
      return `Q ${cx},${py} ${x},${y}`;
    })
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* 1. ENERGY RIBBON — glowing thick line with electric trails           */
/* ------------------------------------------------------------------ */
export function CurveRibbon({ data, labels, color, unit }: Props) {
  const pts = getPoints(data);
  const path = smoothPath(pts);
  const id = `rib-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-rib`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Outer glow */}
      <motion.path d={path} fill="none" stroke={color} strokeWidth="14" strokeOpacity="0.25" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6 }} style={{ filter: `blur(8px)` }} />
      {/* Main ribbon */}
      <motion.path d={path} fill="none" stroke={`url(#${id}-rib)`} strokeWidth="6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} />
      {/* Bright core */}
      <motion.path d={path} fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} />
      {/* Energy nodes */}
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="10" fill={color} fillOpacity="0.3" />
          <circle cx={x} cy={y} r="4" fill="#ffffff" />
          <text x={x} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
        </g>
      ))}
      <text x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1] - 14} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
        {data[data.length - 1]}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. WIREFRAME TERRAIN — 3D mesh landscape with line as ridge           */
/* ------------------------------------------------------------------ */
export function CurveTerrain({ data, labels, color, unit }: Props) {
  const pts = getPoints(data);
  const path = smoothPath(pts);
  const floorY = padTop + innerH;
  const id = `ter-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-mesh`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Vertical mesh lines from floor up to ridge */}
      {pts.map(([x, y], i) => (
        <motion.line
          key={`vm-${i}`}
          x1={x}
          y1={floorY}
          x2={x}
          y2={y}
          stroke={color}
          strokeOpacity="0.4"
          strokeDasharray="2 3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, delay: 0.08 * i }}
        />
      ))}
      {/* Horizontal mesh lines (3 layers) */}
      {[0.33, 0.66, 1].map((t, idx) => {
        const layerPath = pts
          .map(([x, y], i) => {
            const yI = y + (floorY - y) * t;
            if (i === 0) return `M ${x},${yI}`;
            const [px, py] = pts[i - 1];
            const pyI = py + (floorY - py) * t;
            const cx = (px + x) / 2;
            return `Q ${cx},${pyI} ${x},${yI}`;
          })
          .join(" ");
        return (
          <motion.path
            key={`hm-${idx}`}
            d={layerPath}
            fill="none"
            stroke={color}
            strokeOpacity={0.3 - idx * 0.07}
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.4 + idx * 0.1 }}
          />
        );
      })}
      {/* Filled terrain */}
      <motion.path d={`${path} L ${pts[pts.length - 1][0]},${floorY} L ${pts[0][0]},${floorY} Z`} fill={`url(#${id}-mesh)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }} />
      {/* Ridge line */}
      <motion.path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="3.5" fill={color} stroke="#fff" strokeWidth="1" />
          <text x={x} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 3. LIGHT BEAM — laser beam with halo and orbiting particles          */
/* ------------------------------------------------------------------ */
export function CurveLightBeam({ data, labels, color, unit }: Props) {
  const pts = getPoints(data);
  const path = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Hot core (very thin, very bright) */}
      <motion.path d={path} fill="none" stroke="#ffffff" strokeWidth="1" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
      {/* Inner beam */}
      <motion.path d={path} fill="none" stroke={color} strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} style={{ filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})` }} />
      {/* Outer halo */}
      <motion.path d={path} fill="none" stroke={color} strokeWidth="10" strokeOpacity="0.18" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} style={{ filter: `blur(6px)` }} />
      {/* Orbiting particles around each point */}
      {pts.map(([x, y], i) => (
        <g key={i}>
          {[0, 1, 2].map((j) => (
            <motion.circle
              key={j}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{
                duration: 2,
                delay: 0.1 * i + j * 0.3,
                repeat: Infinity,
              }}
              cx={x + (j - 1) * 4}
              cy={y + (j - 1) * 4}
              r="2"
              fill="#ffffff"
            />
          ))}
          <circle cx={x} cy={y} r="6" fill={color} fillOpacity="0.6" />
          <circle cx={x} cy={y} r="2" fill="#ffffff" />
          <text x={x} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
        </g>
      ))}
      <text x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1] - 14} textAnchor="middle" fontSize="13" fontWeight="700" fill={color} fontFamily="ui-monospace, monospace" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
        {data[data.length - 1]}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 4. COSMIC TRAIL — comet tail through stars                            */
/* ------------------------------------------------------------------ */
export function CurveCosmic({ data, labels, color, unit }: Props) {
  const pts = getPoints(data);
  const path = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Stars background — deterministic seeds */}
      {Array.from({ length: 60 }).map((_, i) => {
        const sa = ((i * 137) % 1000) / 1000;
        const sb = ((i * 251) % 1000) / 1000;
        const sc = ((i * 31) % 100) / 100;
        const sx = padLeft + sa * innerW;
        const sy = padTop + sb * innerH;
        const sr = sc * 1.2 + 0.3;
        return (
          <motion.circle
            key={`star-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0.3] }}
            transition={{
              duration: 2 + sc * 3,
              repeat: Infinity,
              repeatType: "reverse",
              delay: sa,
            }}
            cx={sx}
            cy={sy}
            r={sr}
            fill="#ffffff"
          />
        );
      })}
      {/* Trail (gradient gets brighter as it progresses to head) */}
      <motion.path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6 }} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
      {/* Comet head — last point */}
      {(() => {
        const [hx, hy] = pts[pts.length - 1];
        return (
          <g>
            <circle cx={hx} cy={hy} r="14" fill={color} fillOpacity="0.4" />
            <circle cx={hx} cy={hy} r="7" fill={color} />
            <circle cx={hx - 1} cy={hy - 1} r="3" fill="#ffffff" />
            <text x={hx} y={hy - 22} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fafafa" fontFamily="ui-monospace, monospace">
              {data[data.length - 1]}<tspan fontSize="10" fill="#a1a1aa"> {unit}</tspan>
            </text>
          </g>
        );
      })()}
      {pts.map(([x], i) => (
        <text key={i} x={x} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 5. LIQUID WAVE — organic flowing line with wave dynamics              */
/* ------------------------------------------------------------------ */
export function CurveLiquid({ data, labels, color, unit }: Props) {
  const pts = getPoints(data);
  const path = smoothPath(pts);
  const floorY = padTop + innerH;
  const id = `liq-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="50%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-displ`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </defs>
      {/* Main wave fill (with subtle displacement) */}
      <motion.path
        d={`${path} L ${pts[pts.length - 1][0]},${floorY} L ${pts[0][0]},${floorY} Z`}
        fill={`url(#${id}-fill)`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
        filter={`url(#${id}-displ)`}
      />
      {/* Secondary wave underneath (offset down) */}
      <motion.path
        d={smoothPath(pts.map(([x, y]) => [x, y + 14]))}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, delay: 0.2 }}
      />
      {/* Main crest line */}
      <motion.path d={path} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      {/* Droplet bubbles at each point */}
      {pts.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="6" ry="4" fill={color} fillOpacity="0.7" />
          <ellipse cx={x - 1} cy={y - 1} rx="2" ry="1" fill="#ffffff" />
          <text x={x} y={H - padBottom + 22} textAnchor="middle" fontSize="12" fill="#d4d4d8" fontFamily="ui-monospace, monospace">{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
}
