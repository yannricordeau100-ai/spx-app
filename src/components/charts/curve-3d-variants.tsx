"use client";

/**
 * Essais courbe 3D / iso (C14-C15) inspirés freepik.
 * Drop-in : même API que les autres curve charts.
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

/* ============================================================ */
/* C14 — ISO MOUNTAIN RANGE 3D                                    */
/* Aire courbe rendue en relief iso, fond multi-couches.          */
/* Inspiration freepik : iso mountain charts (image 5 droite).     */
/* ============================================================ */
export function CurveIsoMountain3D({ data, labels, color = "#22d3ee" }: Props) {
  const ticks = niceTicks(0, Math.max(...data, 0), 5);
  const min = 0;
  const max = Math.max(...ticks, ...data);
  const range = max - min || 1;
  const stepX = INNER_W / (data.length - 1);
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  const baseY = PAD_TOP + INNER_H;

  // Iso skew offset
  const SKEW_X = 28;
  const SKEW_Y = -16;

  // 3 layers en parallaxe
  const LAYERS = [
    { color: color, opacity: 0.95, scale: 1.0, dx: 0, dy: 0 },
    { color: color, opacity: 0.55, scale: 0.85, dx: -20, dy: 14 },
    { color: color, opacity: 0.3, scale: 0.7, dx: -40, dy: 28 },
  ];

  const buildPath = (scale: number, dx: number, dy: number) => {
    const pts = data.map((v, i) => ({
      x: PAD_LEFT + stepX * i + dx,
      y: baseY - (baseY - yFor(v)) * scale + dy,
    }));
    let d = `M ${pts[0].x} ${baseY + dy}`;
    pts.forEach((p, i) => {
      if (i === 0) d += ` L ${p.x} ${p.y}`;
      else {
        const prev = pts[i - 1];
        const c1x = (prev.x + p.x) / 2;
        d += ` Q ${c1x} ${prev.y} ${(prev.x + p.x) / 2} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`;
      }
    });
    d += ` L ${pts[pts.length - 1].x} ${baseY + dy} Z`;
    return d;
  };

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        {LAYERS.map((l, i) => (
          <linearGradient key={i} id={`c14-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={l.color} stopOpacity={l.opacity} />
            <stop offset="100%" stopColor={l.color} stopOpacity={0.05} />
          </linearGradient>
        ))}
      </defs>
      {/* Y guidelines */}
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
      {/* Mountain layers (back-to-front, with iso skew) */}
      {[...LAYERS].reverse().map((l, i) => {
        const idx = LAYERS.length - 1 - i;
        return (
          <g key={i} transform={`translate(${l.dx + SKEW_X * idx} ${l.dy + SKEW_Y * idx})`}>
            <path d={buildPath(l.scale, 0, 0)} fill={`url(#c14-${idx})`} stroke={l.color}
              strokeOpacity={l.opacity * 0.6} strokeWidth={1.2} />
          </g>
        );
      })}
      {/* Top ridge (foreground) */}
      <g transform={`translate(${SKEW_X * 0} ${SKEW_Y * 0})`}>
        <path
          d={data.map((v, i) => `${i === 0 ? "M" : "L"} ${PAD_LEFT + stepX * i} ${yFor(v)}`).join(" ")}
          fill="none" stroke="#ffffff" strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
        {data.map((v, i) => (
          <circle key={i} cx={PAD_LEFT + stepX * i} cy={yFor(v)} r={3} fill="#fff"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        ))}
      </g>
      {/* X labels */}
      {data.map((_, i) => (
        <text key={i} x={PAD_LEFT + stepX * i} y={H - PAD_BOTTOM + 26} textAnchor="middle"
          fontSize={17} fill="#e4e4e7" fontFamily="ui-monospace, monospace" fontWeight={600}>
          {labels[i]}
        </text>
      ))}
      {/* Values above ridge */}
      {data.map((v, i) => (
        <text key={i} x={PAD_LEFT + stepX * i} y={yFor(v) - 12} textAnchor="middle"
          fontSize={14} fontWeight={700} fill="#fafafa" fontFamily="ui-monospace, monospace">
          {v}
        </text>
      ))}
    </svg>
  );
}

/* ============================================================ */
/* C15 — STACKED WAVE 3D ISO                                      */
/* Vague iso à 3 couches décalées en profondeur.                   */
/* ============================================================ */
export function CurveStackedWave3D({ data, labels, color = "#a78bfa" }: Props) {
  const ticks = niceTicks(0, Math.max(...data, 0), 5);
  const min = 0;
  const max = Math.max(...ticks, ...data);
  const range = max - min || 1;
  const stepX = INNER_W / (data.length - 1);
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  const baseY = PAD_TOP + INNER_H;

  const TIERS = [
    { dx: 0, dy: 0, alpha: 0.85, c: color },
    { dx: -18, dy: 14, alpha: 0.55, c: color },
    { dx: -36, dy: 28, alpha: 0.28, c: color },
  ];

  const smoothPath = (offsetY = 0) => {
    const pts = data.map((v, i) => ({ x: PAD_LEFT + stepX * i, y: yFor(v) + offsetY }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      d += ` C ${cx1} ${p0.y} ${cx1} ${p1.y} ${p1.x} ${p1.y}`;
    }
    return d;
  };

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        {TIERS.map((t, i) => (
          <linearGradient key={i} id={`c15-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.c} stopOpacity={t.alpha} />
            <stop offset="100%" stopColor={t.c} stopOpacity={0.05} />
          </linearGradient>
        ))}
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
      {[...TIERS].reverse().map((t, k) => {
        const i = TIERS.length - 1 - k;
        const path = smoothPath();
        const fillPath = `${path} L ${PAD_LEFT + INNER_W} ${baseY} L ${PAD_LEFT} ${baseY} Z`;
        return (
          <g key={k} transform={`translate(${t.dx} ${t.dy})`}>
            <path d={fillPath} fill={`url(#c15-${i})`} stroke={t.c} strokeOpacity={t.alpha} strokeWidth={1.5} />
          </g>
        );
      })}
      {data.map((_, i) => (
        <text key={i} x={PAD_LEFT + stepX * i} y={H - PAD_BOTTOM + 26} textAnchor="middle"
          fontSize={17} fill="#e4e4e7" fontFamily="ui-monospace, monospace" fontWeight={600}>
          {labels[i]}
        </text>
      ))}
      {data.map((v, i) => (
        <text key={i} x={PAD_LEFT + stepX * i} y={yFor(v) - 10} textAnchor="middle"
          fontSize={14} fontWeight={700} fill="#fafafa" fontFamily="ui-monospace, monospace">
          {v}
        </text>
      ))}
    </svg>
  );
}
