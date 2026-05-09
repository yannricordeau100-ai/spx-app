"use client";

/**
 * Charts de répartition (catégoriel proportionnel) — 5 styles.
 *
 * Conçus pour 2 KPI spéciaux :
 *  1. Répartition des ventes par géographie
 *  2. Répartition des ventes par segments produits
 *
 * API publique commune et minimale. Pour intégrer dans l'app : il suffit
 * d'importer le composant choisi et de lui passer un tableau de slices.
 *
 *   import { RepartitionTreemap } from "@/components/charts/repartition-variants";
 *
 *   <RepartitionTreemap
 *     data={[{ label: "EMEA", value: 30 }, ...]}
 *     unit="Mds $"
 *     total={350.0}
 *     accent="#a78bfa"
 *   />
 */

export type RepartitionSlice = {
  label: string;
  value: number;
  color?: string;
};

export type RepartitionProps = {
  data: RepartitionSlice[];
  unit?: string;
  /** Total explicite (sinon = somme des values). Utile si valeurs en %. */
  total?: number;
  /** Couleur dominante (la plus grosse part). Défaut = violet brand. */
  accent?: string;
  /** Décimales affichées pour les pourcentages (cohérence visuelle). */
  decimals?: number;
};

/** Format pourcentage avec un nombre de décimales fixe. */
export function fmtPct(p: number, decimals = 1): string {
  return p.toFixed(decimals);
}

const PALETTE_BASE = ["#22d3ee", "#fb7185", "#facc15", "#a3e635", "#c084fc", "#f97316"];
function getColor(slice: RepartitionSlice, i: number, accent: string): string {
  if (slice.color) return slice.color;
  if (i === 0) return accent;
  return PALETTE_BASE[(i - 1) % PALETTE_BASE.length];
}

function fmt(v: number): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

/* ============================================================ */
/* R1 — DONUT (anneau classique premium + légende latérale)       */
/* ============================================================ */
export function RepartitionDonut({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const cx = 130, cy = 130, R = 110, r = 72;
  let acc = 0;
  const arcs = sorted.map((d, i) => {
    const start = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const end = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
    const xi1 = cx + r * Math.cos(end), yi1 = cy + r * Math.sin(end);
    const xi2 = cx + r * Math.cos(start), yi2 = cy + r * Math.sin(start);
    return {
      path: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi2} ${yi2} Z`,
      color: getColor(d, i, accent),
      pct: d.value / sum,
      label: d.label,
      value: d.value,
    };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={260} height={260} viewBox="0 0 260 260" className="shrink-0">
        <defs>
          {arcs.map((a, i) => (
            <radialGradient key={i} id={`don-${i}-${a.color.slice(1)}`} cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor={a.color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={a.color} stopOpacity={0.7} />
            </radialGradient>
          ))}
        </defs>
        {arcs.map((a, i) => (
          <path
            key={i}
            d={a.path}
            fill={`url(#don-${i}-${a.color.slice(1)})`}
            stroke="#070707"
            strokeWidth={2}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={28} fontWeight={700} fill="#fafafa" fontFamily="ui-monospace, monospace">
          {fmt(sum)}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="#a1a1aa" fontFamily="ui-monospace, monospace">
          {unit || "total"}
        </text>
      </svg>
      <div className="flex-1 space-y-2.5">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="size-3 shrink-0 rounded" style={{ background: a.color }} />
            <span className="flex-1 truncate text-[13px] text-zinc-200">{a.label}</span>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-zinc-100">
              {(a.pct * 100).toFixed(1)} %
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
/* R2 — STACKED BAR 100% (barre horizontale segmentée)            */
/* ============================================================ */
export function RepartitionStackedBar({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Total</span>
        <span className="font-mono text-[20px] font-bold tabular-nums text-zinc-50">
          {fmt(sum)} <span className="text-[12px] font-medium text-zinc-400">{unit}</span>
        </span>
      </div>
      <div className="relative flex h-14 w-full overflow-hidden rounded-lg shadow-inner">
        {sorted.map((d, i) => {
          const w = (d.value / sum) * 100;
          const c = getColor(d, i, accent);
          return (
            <div
              key={i}
              className="relative flex items-center justify-center transition-all"
              style={{
                width: `${w}%`,
                background: `linear-gradient(180deg, ${c}, ${c}cc)`,
              }}
              title={`${d.label} : ${w.toFixed(1)} %`}
            >
              {w > 8 && (
                <span className="font-mono text-[14px] font-bold text-black/85">
                  {w.toFixed(0)} %
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {sorted.map((d, i) => {
          const c = getColor(d, i, accent);
          const w = (d.value / sum) * 100;
          return (
            <div key={i} className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ background: c }} />
              <span className="text-[12px] text-zinc-300">{d.label}</span>
              <span className="font-mono text-[11.5px] tabular-nums text-zinc-500">
                {w.toFixed(1)} %
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* R3 — TREEMAP (slice-and-dice, label + % dans chaque rectangle) */
/* ============================================================ */
type Box = { x: number; y: number; w: number; h: number };

function dice(values: number[], box: Box): Box[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [box];
  const total = values.reduce((a, b) => a + b, 0);
  const isWide = box.w >= box.h;
  const first = values[0];
  if (isWide) {
    const w = (first / total) * box.w;
    return [
      { x: box.x, y: box.y, w, h: box.h },
      ...dice(values.slice(1), { x: box.x + w, y: box.y, w: box.w - w, h: box.h }),
    ];
  }
  const h = (first / total) * box.h;
  return [
    { x: box.x, y: box.y, w: box.w, h },
    ...dice(values.slice(1), { x: box.x, y: box.y + h, w: box.w, h: box.h - h }),
  ];
}

export function RepartitionTreemap({ data, unit = "", total, accent = "#a78bfa", decimals = 1 }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 540, H = 280;
  const boxes = dice(sorted.map((d) => d.value), { x: 0, y: 0, w: W, h: H });

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Total</span>
        <span className="font-mono text-[20px] font-bold tabular-nums text-zinc-50">
          {fmt(sum)} <span className="text-[12px] font-medium text-zinc-400">{unit}</span>
        </span>
      </div>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ display: "block" }}>
        {boxes.map((b, i) => {
          const item = sorted[i];
          const c = getColor(item, i, accent);
          const pct = (item.value / sum) * 100;
          const big = b.w > 90 && b.h > 60;
          const med = b.w > 50 && b.h > 36;
          return (
            <g key={i}>
              <rect
                x={b.x + 2}
                y={b.y + 2}
                width={Math.max(0, b.w - 4)}
                height={Math.max(0, b.h - 4)}
                fill={c}
                fillOpacity={0.88}
                rx={6}
              />
              {big && (
                <foreignObject x={b.x + 10} y={b.y + 10} width={Math.max(0, b.w - 20)} height={Math.max(0, b.h - 20)}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      color: "#0a0a0a",
                      fontFamily: "inherit",
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                      overflowWrap: "break-word",
                      wordBreak: "normal",
                      hyphens: "auto",
                      lineHeight: 1.15,
                    }}
                  >
                    <span style={{ fontSize: Math.max(11, Math.min(13, b.w / 18)), fontWeight: 600 }}>{item.label}</span>
                    <span style={{ fontSize: Math.max(14, Math.min(22, b.w / 8)), fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                      {fmtPct(pct, decimals)} %
                    </span>
                  </div>
                </foreignObject>
              )}
              {!big && med && (
                <foreignObject x={b.x + 6} y={b.y + 6} width={Math.max(0, b.w - 12)} height={Math.max(0, b.h - 12)}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      color: "#0a0a0a",
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                      overflowWrap: "break-word",
                      wordBreak: "normal",
                      hyphens: "auto",
                      lineHeight: 1.1,
                    }}
                  >
                    <span style={{ fontSize: Math.max(8, Math.min(11, b.w / 10)), fontWeight: 600, padding: "0 2px" }}>{item.label}</span>
                    <span style={{ fontSize: Math.max(10, Math.min(13, b.w / 6)), fontWeight: 700, fontFamily: "ui-monospace, monospace", marginTop: 2 }}>
                      {fmtPct(pct, decimals)} %
                    </span>
                  </div>
                </foreignObject>
              )}
              {!big && !med && b.w > 24 && (
                <foreignObject x={b.x + 4} y={b.y + 4} width={Math.max(0, b.w - 8)} height={Math.max(0, b.h - 8)}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      color: "#0a0a0a",
                      width: "100%",
                      height: "100%",
                      fontSize: Math.max(8, Math.min(10, b.w / 6)),
                      fontWeight: 700,
                      overflow: "hidden",
                    }}
                  >
                    {fmtPct(pct, decimals)} %
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================ */
/* R4 — RADIAL (anneaux concentriques, 1 anneau = 1 segment)      */
/* ============================================================ */
export function RepartitionRadial({ data, unit = "", total, accent = "#a78bfa", decimals = 1 }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const cx = 140, cy = 140;
  const ringWidth = 14;
  const gap = 5;
  const baseR = 46;

  return (
    <div className="flex h-full items-center gap-6">
      <svg width="100%" height="100%" viewBox="0 0 280 280" preserveAspectRatio="xMidYMid meet" className="h-full max-h-full flex-1 min-w-0" style={{ maxWidth: "min(100%, 480px)" }}>
        {sorted.map((d, i) => {
          const c = getColor(d, i, accent);
          const pct = d.value / sum;
          const radius = baseR + i * (ringWidth + gap);
          const circ = 2 * Math.PI * radius;
          const filled = pct * circ;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#161616" strokeWidth={ringWidth} />
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={c}
                strokeWidth={ringWidth}
                strokeDasharray={`${filled} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ filter: `drop-shadow(0 0 4px ${c}88)` }}
              />
            </g>
          );
        })}
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={20} fontWeight={700} fill="#fafafa" fontFamily="ui-monospace, monospace">
          {fmt(sum)}
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize={10} fill="#a1a1aa" fontFamily="ui-monospace, monospace">
          {unit}
        </text>
      </svg>
      <div className="flex-1 space-y-2.5 pr-12">
        {sorted.map((d, i) => {
          const c = getColor(d, i, accent);
          const pct = (d.value / sum) * 100;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}99` }} />
              {/* % avant le label (Yann 9 mai 2026) : la flèche de navigation
                  cachait le % à droite. Largeur fixe pour alignement vertical. */}
              <span className="w-14 shrink-0 font-mono text-[13px] font-semibold tabular-nums text-zinc-100">
                {fmtPct(pct, decimals)} %
              </span>
              <span className="flex-1 truncate text-[13px] text-zinc-200">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* R6 — PILLAR PIE 3D (camembert tilté + extrusion variable)      */
/* Innovation : la part est encodée à la fois par l'angle ET par  */
/* la hauteur d'extrusion. Aspect "wedding cake" en perspective.  */
/* ============================================================ */
export function RepartitionPillarPie3D({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 460, H = 280;
  const cx = 230, cyTop = 110;
  const Rx = 130, Ry = 50;        // tilt : Ry < Rx
  const ri = 26;                  // donut intérieur sur top face
  const baseDepth = 30;
  const extraDepth = 80;          // amplitude variation hauteur

  let acc = 0;
  const slices = sorted.map((d, i) => {
    const startAng = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const endAng = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    const c = getColor(d, i, accent);
    const depth = baseDepth + (d.value / sorted[0].value) * extraDepth;
    return { slice: d, startAng, endAng, c, pct: d.value / sum, depth };
  });

  const ellipsePt = (ang: number, cy: number) => ({
    x: cx + Rx * Math.cos(ang),
    y: cy + Ry * Math.sin(ang),
  });

  // Z-ordering : on rend les murs des slices ARRIÈRE d'abord (centre angulaire en haut),
  // puis murs avant, puis top faces (pour que les murs avant masquent ceux derrière).
  const sortedForRender = [...slices]
    .map((s, i) => ({ s, i, mid: (s.startAng + s.endAng) / 2 }))
    // arrière = sin(mid) <= 0 (haut), avant = sin(mid) > 0 (bas)
    .sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Total</span>
        <span className="font-mono text-[18px] font-bold tabular-nums text-zinc-50">
          {fmt(sum)} <span className="text-[11.5px] font-medium text-zinc-400">{unit}</span>
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        <defs>
          {sorted.map((d, i) => {
            const c = getColor(d, i, accent);
            return (
              <linearGradient key={i} id={`pp-side-${i}-${c.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.85} />
                <stop offset="100%" stopColor={c} stopOpacity={0.45} />
              </linearGradient>
            );
          })}
        </defs>

        {/* MURS — du plus arrière au plus avant */}
        {sortedForRender.map(({ s, i }) => {
          const top1 = ellipsePt(s.startAng, cyTop);
          const top2 = ellipsePt(s.endAng, cyTop);
          const cyBot = cyTop + s.depth;
          const bot1 = ellipsePt(s.startAng, cyBot);
          const bot2 = ellipsePt(s.endAng, cyBot);
          const large = (s.endAng - s.startAng) > Math.PI ? 1 : 0;
          // mur extérieur (visible si la slice touche la moitié basse de l'ellipse)
          const wall = `M ${top1.x} ${top1.y} A ${Rx} ${Ry} 0 ${large} 1 ${top2.x} ${top2.y} L ${bot2.x} ${bot2.y} A ${Rx} ${Ry} 0 ${large} 0 ${bot1.x} ${bot1.y} Z`;
          return (
            <path
              key={`w-${i}`}
              d={wall}
              fill={`url(#pp-side-${i}-${s.c.slice(1)})`}
              stroke="#050505"
              strokeWidth={0.8}
            />
          );
        })}

        {/* TOP FACES */}
        {slices.map((s, i) => {
          const t1 = ellipsePt(s.startAng, cyTop);
          const t2 = ellipsePt(s.endAng, cyTop);
          const i1 = { x: cx + ri * Math.cos(s.startAng), y: cyTop + (ri * Ry / Rx) * Math.sin(s.startAng) };
          const i2 = { x: cx + ri * Math.cos(s.endAng), y: cyTop + (ri * Ry / Rx) * Math.sin(s.endAng) };
          const large = (s.endAng - s.startAng) > Math.PI ? 1 : 0;
          const path = `M ${t1.x} ${t1.y} A ${Rx} ${Ry} 0 ${large} 1 ${t2.x} ${t2.y} L ${i2.x} ${i2.y} A ${ri} ${ri * Ry / Rx} 0 ${large} 0 ${i1.x} ${i1.y} Z`;
          // label au milieu de la slice, au sommet (yTop)
          const mid = (s.startAng + s.endAng) / 2;
          const lblR = (Rx + ri) / 2;
          const lblY = cyTop + (lblR * Ry / Rx) * Math.sin(mid);
          const lblX = cx + lblR * Math.cos(mid);
          const showLbl = s.pct > 0.06;
          return (
            <g key={`t-${i}`}>
              <path
                d={path}
                fill={s.c}
                stroke="#050505"
                strokeWidth={1}
              />
              {showLbl && (
                <text x={lblX} y={lblY + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0a0a0a">
                  {(s.pct * 100).toFixed(0)} %
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {sorted.map((d, i) => {
          const c = getColor(d, i, accent);
          const pct = (d.value / sum) * 100;
          return (
            <div key={i} className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ background: c }} />
              <span className="text-[12px] text-zinc-300">{d.label}</span>
              <span className="font-mono text-[11.5px] tabular-nums text-zinc-500">
                {pct.toFixed(1)} %
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* R7 — HONEYCOMB 3D (cellules hexagonales en perspective iso)    */
/* Hex sized par share, extrusion iso légère, glow.               */
/* ============================================================ */
export function RepartitionHoneycomb3D({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 540, H = 280, cx = W / 2, cy = H / 2;
  const sMax = 80;                              // côté hex max
  const sides = sorted.map((d) => Math.max(22, sMax * Math.sqrt(d.value / sorted[0].value)));

  // Layout : la plus grosse au centre, les autres en orbite
  const positions = sorted.map((_, i) => {
    if (i === 0) return { x: cx, y: cy };
    const angle = ((i - 1) / Math.max(1, sorted.length - 1)) * 2 * Math.PI - Math.PI / 2;
    const orbit = sides[0] + sides[i] + 4;
    return { x: cx + Math.cos(angle) * orbit, y: cy + Math.sin(angle) * orbit };
  });

  // Hex pointy-top : 6 sommets autour du centre
  const hexPts = (cx_: number, cy_: number, side: number, dz = 0) => {
    const pts: string[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      pts.push(`${cx_ + side * Math.cos(a)},${cy_ + side * Math.sin(a) + dz}`);
    }
    return pts.join(" ");
  };

  // Iso depth offset (vers haut-droit pour une 3D élégante)
  const DZ_X = 8, DZ_Y = 8;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Total</span>
        <span className="font-mono text-[18px] font-bold tabular-nums text-zinc-50">
          {fmt(sum)} <span className="text-[11.5px] font-medium text-zinc-400">{unit}</span>
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        <defs>
          {sorted.map((d, i) => {
            const c = getColor(d, i, accent);
            return (
              <linearGradient key={i} id={`hc-${i}-${c.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={1} />
                <stop offset="100%" stopColor={c} stopOpacity={0.7} />
              </linearGradient>
            );
          })}
        </defs>
        {/* Render order : back-to-front (highest y first = back) */}
        {[...sorted].map((_, i) => i).sort((a, b) => positions[a].y - positions[b].y).map((i) => {
          const d = sorted[i];
          const c = getColor(d, i, accent);
          const p = positions[i];
          const side = sides[i];
          const pct = (d.value / sum) * 100;
          // Bottom hex (offset down-right pour iso depth)
          const bottom = hexPts(p.x + DZ_X, p.y + DZ_Y, side);
          // Top hex
          const top = hexPts(p.x, p.y, side);
          // Side walls : 3 faces visibles (les 3 du bas-droite)
          const topPts = top.split(" ").map((s) => s.split(",").map(Number));
          const botPts = bottom.split(" ").map((s) => s.split(",").map(Number));
          // Faces visibles : indices 1,2,3 (selon orientation pointy-top)
          const visibleFaces = [1, 2, 3];
          return (
            <g key={i}>
              {/* Shadow ground */}
              <ellipse cx={p.x + DZ_X} cy={p.y + DZ_Y + side * 0.4} rx={side * 0.75} ry={side * 0.18} fill="#000000" fillOpacity={0.35} />
              {/* Bottom hex (légère teinte plus sombre) */}
              <polygon points={bottom} fill={c} fillOpacity={0.45} />
              {/* Side faces */}
              {visibleFaces.map((fi) => {
                const a = topPts[fi];
                const b = topPts[(fi + 1) % 6];
                const bb = botPts[(fi + 1) % 6];
                const aa = botPts[fi];
                return (
                  <polygon
                    key={fi}
                    points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${bb[0]},${bb[1]} ${aa[0]},${aa[1]}`}
                    fill={c}
                    fillOpacity={0.55}
                    stroke={c}
                    strokeOpacity={0.3}
                    strokeWidth={0.5}
                  />
                );
              })}
              {/* Top face */}
              <polygon
                points={top}
                fill={`url(#hc-${i}-${c.slice(1)})`}
                stroke="#050505"
                strokeWidth={1}
                style={{ filter: `drop-shadow(0 0 4px ${c}66)` }}
              />
              {side > 30 && (
                <>
                  <text x={p.x} y={p.y - 4} textAnchor="middle" fontSize={Math.max(10, side * 0.16)} fontWeight={600} fill="#0a0a0a">
                    {d.label}
                  </text>
                  <text x={p.x} y={p.y + side * 0.28} textAnchor="middle" fontSize={Math.max(11, side * 0.22)} fontWeight={700} fontFamily="ui-monospace, monospace" fill="#0a0a0a">
                    {pct.toFixed(0)} %
                  </text>
                </>
              )}
              {side <= 30 && side > 18 && (
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0a0a0a">
                  {pct.toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================ */
/* R5 — BUBBLE PACK (constellation : grosse au centre + orbite)   */
/* ============================================================ */
export function RepartitionBubble({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 520, H = 280, cx = W / 2, cy = H / 2;
  const maxR = 78;
  const rs = sorted.map((d) => Math.max(18, maxR * Math.sqrt(d.value / sorted[0].value)));

  // Centre = la plus grosse, les autres en orbite serrée
  const positions = sorted.map((_, i) => {
    if (i === 0) return { x: cx, y: cy };
    const angle = ((i - 1) / Math.max(1, sorted.length - 1)) * 2 * Math.PI - Math.PI / 2;
    const orbit = rs[0] + rs[i] + 8;
    return { x: cx + Math.cos(angle) * orbit, y: cy + Math.sin(angle) * orbit };
  });

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Total</span>
        <span className="font-mono text-[18px] font-bold tabular-nums text-zinc-50">
          {fmt(sum)} <span className="text-[11.5px] font-medium text-zinc-400">{unit}</span>
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        <defs>
          {sorted.map((d, i) => {
            const c = getColor(d, i, accent);
            return (
              <radialGradient key={i} id={`bub-${i}-${c.slice(1)}`} cx="35%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.4} />
                <stop offset="40%" stopColor={c} stopOpacity={0.9} />
                <stop offset="100%" stopColor={c} stopOpacity={0.65} />
              </radialGradient>
            );
          })}
        </defs>
        {sorted.map((d, i) => {
          const c = getColor(d, i, accent);
          const r = rs[i];
          const p = positions[i];
          const pct = (d.value / sum) * 100;
          const showLabel = r > 26;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={r} fill={`url(#bub-${i}-${c.slice(1)})`} stroke={c} strokeWidth={1.5} />
              {showLabel && (
                <>
                  <text x={p.x} y={p.y - 4} textAnchor="middle" fontSize={Math.max(10, r * 0.18)} fontWeight={600} fill="#0a0a0a">
                    {d.label}
                  </text>
                  <text x={p.x} y={p.y + r * 0.32} textAnchor="middle" fontSize={Math.max(11, r * 0.24)} fontWeight={700} fontFamily="ui-monospace, monospace" fill="#0a0a0a">
                    {pct.toFixed(0)} %
                  </text>
                </>
              )}
              {!showLabel && r > 14 && (
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0a0a0a">
                  {pct.toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================ */
/* R8 — VERTICAL BARS LADDER (2D classique trié décroissant)      */
/* Barres horizontales empilées verticalement, % et valeur à      */
/* droite, fond gris léger pour scale, accent sur la plus grosse. */
/* ============================================================ */
export function RepartitionBarsLadder({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 380;
  const rowH = 36;
  const labelW = 110;
  const valueW = 90;
  const barAreaW = W - labelW - valueW - 20;
  const H = sorted.length * rowH + 24;
  const maxV = sorted[0]?.value || 1;

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: H }}>
        {sorted.map((slice, i) => {
          const color = getColor(slice, i, accent);
          const pct = sum > 0 ? (slice.value / sum) * 100 : 0;
          const barW = (slice.value / maxV) * barAreaW;
          const y = 12 + i * rowH;
          return (
            <g key={slice.label}>
              <text x={4} y={y + rowH / 2 + 4} fontSize="12" fill="#e4e4e7" fontFamily="ui-sans-serif, system-ui">
                {slice.label}
              </text>
              <rect
                x={labelW}
                y={y + 7}
                width={barAreaW}
                height={rowH - 14}
                rx={4}
                fill="#1a1a1d"
              />
              <rect
                x={labelW}
                y={y + 7}
                width={barW}
                height={rowH - 14}
                rx={4}
                fill={color}
                opacity={i === 0 ? 1 : 0.85}
              />
              <text
                x={labelW + barAreaW + 8}
                y={y + rowH / 2 + 4}
                fontSize="11.5"
                fontWeight="600"
                fill="#fafafa"
                fontFamily="ui-monospace, monospace"
              >
                {fmt(slice.value)}{unit && <tspan fontSize="9.5" fill="#a1a1aa"> {unit}</tspan>}
              </text>
              <text
                x={labelW + barAreaW + 8}
                y={y + rowH / 2 + 16}
                fontSize="9.5"
                fill="#71717a"
                fontFamily="ui-monospace, monospace"
              >
                {pct.toFixed(1)} %
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
