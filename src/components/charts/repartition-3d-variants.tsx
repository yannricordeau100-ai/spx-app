"use client";

/**
 * 5 nouveaux styles répartition 3D / iso, inspirés freepik (R8-R12).
 * À comparer face à R6 (Pillar Pie 3D) et R7 (Honeycomb 3D).
 *
 * API identique aux R1-R7 : { data, unit?, total?, accent? }
 */

import { fmtPct, type RepartitionProps, type RepartitionSlice } from "./repartition-variants";

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
/* R8 — EXPLODED 3D PIE CYLINDER                                  */
/* Camembert cylindrique extrudé, slices détachées radialement.   */
/* Inspiration freepik : pies bleus 3D avec slices "pop-out".     */
/* ============================================================ */
export function RepartitionExplodedPie3D({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 480, H = 320;
  const cx = 240, cyTop = 130;
  const Rx = 130, Ry = 60;
  const depth = 36;
  const explode = 14;

  let acc = 0;
  const slices = sorted.map((d, i) => {
    const startAng = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const endAng = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    const midAng = (startAng + endAng) / 2;
    const c = getColor(d, i, accent);
    const ox = Math.cos(midAng) * explode;
    const oy = (Ry / Rx) * Math.sin(midAng) * explode;
    return { slice: d, startAng, endAng, midAng, c, pct: d.value / sum, ox, oy };
  });

  const ellipsePt = (ang: number, ccx: number, ccy: number) => ({
    x: ccx + Rx * Math.cos(ang),
    y: ccy + Ry * Math.sin(ang),
  });

  // Render walls (back-to-front), then top faces
  const ordered = [...slices.map((s, i) => ({ s, i }))]
    .sort((a, b) => Math.sin(a.s.midAng) - Math.sin(b.s.midAng));

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
          {slices.map((s, i) => (
            <linearGradient key={i} id={`r8-side-${i}-${s.c.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.c} stopOpacity={0.95} />
              <stop offset="100%" stopColor={s.c} stopOpacity={0.55} />
            </linearGradient>
          ))}
        </defs>

        {/* MURS (back-to-front) */}
        {ordered.map(({ s, i }) => {
          const ccx = cx + s.ox;
          const ccy = cyTop + s.oy;
          const top1 = ellipsePt(s.startAng, ccx, ccy);
          const top2 = ellipsePt(s.endAng, ccx, ccy);
          const bot1 = ellipsePt(s.startAng, ccx, ccy + depth);
          const bot2 = ellipsePt(s.endAng, ccx, ccy + depth);
          const large = (s.endAng - s.startAng) > Math.PI ? 1 : 0;
          const wall = `M ${top1.x} ${top1.y} A ${Rx} ${Ry} 0 ${large} 1 ${top2.x} ${top2.y} L ${bot2.x} ${bot2.y} A ${Rx} ${Ry} 0 ${large} 0 ${bot1.x} ${bot1.y} Z`;
          return (
            <path
              key={`r8-w-${i}`}
              d={wall}
              fill={`url(#r8-side-${i}-${s.c.slice(1)})`}
              stroke="#050505"
              strokeWidth={0.8}
            />
          );
        })}

        {/* TOP FACES */}
        {slices.map((s, i) => {
          const ccx = cx + s.ox;
          const ccy = cyTop + s.oy;
          const t1 = ellipsePt(s.startAng, ccx, ccy);
          const t2 = ellipsePt(s.endAng, ccx, ccy);
          const large = (s.endAng - s.startAng) > Math.PI ? 1 : 0;
          const path = `M ${ccx} ${ccy} L ${t1.x} ${t1.y} A ${Rx} ${Ry} 0 ${large} 1 ${t2.x} ${t2.y} Z`;
          const lblR = Rx * 0.55;
          const lblX = ccx + lblR * Math.cos(s.midAng);
          const lblY = ccy + (lblR * Ry / Rx) * Math.sin(s.midAng);
          return (
            <g key={`r8-t-${i}`}>
              <path d={path} fill={s.c} stroke="#050505" strokeWidth={1} />
              {s.pct > 0.04 && (
                <text x={lblX} y={lblY + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0a0a0a">
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
              <span className="font-mono text-[11.5px] tabular-nums text-zinc-500">{pct.toFixed(1)} %</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* R9 — ISO DETACHED WEDGES                                       */
/* Camembert plat iso, slices physiquement détachées du centre.   */
/* Inspiration freepik : iso colorful pies (image 4).              */
/* ============================================================ */
export function RepartitionIsoDetachedWedges({ data, unit = "", total, accent = "#a78bfa", decimals = 1 }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 480, H = 300;
  const cx = 240, cy = 150;
  const Rx = 110, Ry = 50; // tilt iso
  const depth = 14;
  const detach = 10;

  let acc = 0;
  const slices = sorted.map((d, i) => {
    const startAng = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const endAng = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    const midAng = (startAng + endAng) / 2;
    const c = getColor(d, i, accent);
    const ox = Math.cos(midAng) * detach;
    const oy = (Ry / Rx) * Math.sin(midAng) * detach;
    return { slice: d, startAng, endAng, midAng, c, pct: d.value / sum, ox, oy };
  });

  const ellipsePt = (ang: number, ccx: number, ccy: number) => ({
    x: ccx + Rx * Math.cos(ang),
    y: ccy + Ry * Math.sin(ang),
  });

  const ordered = [...slices.map((s, i) => ({ s, i }))]
    .sort((a, b) => Math.sin(a.s.midAng) - Math.sin(b.s.midAng));

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Total</span>
        <span className="font-mono text-[18px] font-bold tabular-nums text-zinc-50">
          {fmt(sum)} <span className="text-[11.5px] font-medium text-zinc-400">{unit}</span>
        </span>
      </div>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ display: "block" }}>
        {/* Faible ombre projetée sous chaque slice */}
        {ordered.map(({ s, i }) => {
          const ccx = cx + s.ox;
          const ccy = cy + s.oy + depth + 3;
          const t1 = ellipsePt(s.startAng, ccx, ccy);
          const t2 = ellipsePt(s.endAng, ccx, ccy);
          const large = (s.endAng - s.startAng) > Math.PI ? 1 : 0;
          return (
            <path key={`r9-sh-${i}`}
              d={`M ${ccx} ${ccy} L ${t1.x} ${t1.y} A ${Rx} ${Ry} 0 ${large} 1 ${t2.x} ${t2.y} Z`}
              fill="#000000" fillOpacity={0.3} />
          );
        })}
        {/* Murs slim */}
        {ordered.map(({ s, i }) => {
          const ccx = cx + s.ox;
          const ccy = cy + s.oy;
          const t1 = ellipsePt(s.startAng, ccx, ccy);
          const t2 = ellipsePt(s.endAng, ccx, ccy);
          const b1 = ellipsePt(s.startAng, ccx, ccy + depth);
          const b2 = ellipsePt(s.endAng, ccx, ccy + depth);
          const large = (s.endAng - s.startAng) > Math.PI ? 1 : 0;
          return (
            <g key={`r9-w-${i}`}>
              <path d={`M ${t1.x} ${t1.y} A ${Rx} ${Ry} 0 ${large} 1 ${t2.x} ${t2.y} L ${b2.x} ${b2.y} A ${Rx} ${Ry} 0 ${large} 0 ${b1.x} ${b1.y} Z`}
                fill={s.c} fillOpacity={0.65} stroke="#050505" strokeWidth={0.6} />
            </g>
          );
        })}
        {/* Top faces */}
        {slices.map((s, i) => {
          const ccx = cx + s.ox;
          const ccy = cy + s.oy;
          const t1 = ellipsePt(s.startAng, ccx, ccy);
          const t2 = ellipsePt(s.endAng, ccx, ccy);
          const large = (s.endAng - s.startAng) > Math.PI ? 1 : 0;
          const lblR = Rx * 0.55;
          const lx = ccx + lblR * Math.cos(s.midAng);
          const ly = ccy + (lblR * Ry / Rx) * Math.sin(s.midAng);
          return (
            <g key={`r9-t-${i}`}>
              <path
                d={`M ${ccx} ${ccy} L ${t1.x} ${t1.y} A ${Rx} ${Ry} 0 ${large} 1 ${t2.x} ${t2.y} Z`}
                fill={s.c} stroke="#050505" strokeWidth={1.2}
              />
              {s.pct > 0.05 && (
                <text x={lx} y={ly + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0a0a0a">
                  {fmtPct(s.pct * 100, decimals)} %
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
              {/* % avant le label (Yann 9 mai 2026) : flèche de navigation
                  cachait le % à droite. */}
              <span className="font-mono text-[11.5px] font-semibold tabular-nums text-zinc-200">{fmtPct(pct, decimals)} %</span>
              <span className="text-[12px] text-zinc-300">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* R10 — CONCENTRIC RINGS 3D ISO                                  */
/* Anneaux concentriques extrudés en iso, hauteur = part.         */
/* Inspiration freepik : donut concentrique 3D image 5 gauche.    */
/* ============================================================ */
export function RepartitionConcentricRings3D({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 460, H = 320;
  const cx = 230, cy = 160;
  const Rx = 130, Ry = 65;
  const ringW = 18;
  const baseDepth = 12;

  // ring i : outer radius = Rx - i*ringW, inner = outer - ringW
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
              <linearGradient key={i} id={`r10-${i}-${c.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={1} />
                <stop offset="100%" stopColor={c} stopOpacity={0.55} />
              </linearGradient>
            );
          })}
        </defs>
        {sorted.map((d, i) => {
          const c = getColor(d, i, accent);
          const pct = d.value / sum;
          const oRx = Rx - i * ringW;
          const iRx = oRx - ringW;
          const oRy = Ry - i * (ringW * Ry / Rx);
          const iRy = iRx * Ry / Rx;
          const depth = baseDepth + pct * 50;
          // ring back wall (outer side)
          return (
            <g key={i}>
              {/* outer side wall */}
              <path
                d={`M ${cx - oRx} ${cy} A ${oRx} ${oRy} 0 0 0 ${cx + oRx} ${cy} L ${cx + oRx} ${cy + depth} A ${oRx} ${oRy} 0 0 1 ${cx - oRx} ${cy + depth} Z`}
                fill={`url(#r10-${i}-${c.slice(1)})`}
                stroke="#050505" strokeWidth={0.6}
              />
              {/* top ring face */}
              <path
                d={`M ${cx - oRx} ${cy} A ${oRx} ${oRy} 0 1 1 ${cx + oRx} ${cy} A ${oRx} ${oRy} 0 1 1 ${cx - oRx} ${cy} M ${cx - iRx} ${cy} A ${iRx} ${iRy} 0 1 0 ${cx + iRx} ${cy} A ${iRx} ${iRy} 0 1 0 ${cx - iRx} ${cy}`}
                fill={c}
                fillRule="evenodd"
                stroke="#050505"
                strokeWidth={0.8}
              />
              {/* label sur le ring */}
              <text x={cx} y={cy - oRy + ringW / 2 - (i === 0 ? 0 : 2)} textAnchor="middle"
                fontSize={11} fontWeight={700} fill="#0a0a0a">
                {(pct * 100).toFixed(0)} %
              </text>
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
              <span className="font-mono text-[11.5px] tabular-nums text-zinc-500">{pct.toFixed(1)} %</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* R11 — WEDGE CONES                                              */
/* Chaque segment = un cône 3D, hauteur = part.                   */
/* Inspiration freepik : cones colorés image 4.                    */
/* ============================================================ */
export function RepartitionWedgeCones({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 540, H = 300;
  const baseY = 230;
  const baseR = 22;
  const maxH = 180;
  const slot = (W - 80) / sorted.length;
  const startX = 40 + slot / 2;

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
              <linearGradient key={i} id={`r11-${i}-${c.slice(1)}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={c} stopOpacity={1} />
                <stop offset="50%" stopColor={c} stopOpacity={0.8} />
                <stop offset="100%" stopColor={c} stopOpacity={0.55} />
              </linearGradient>
            );
          })}
        </defs>
        {sorted.map((d, i) => {
          const c = getColor(d, i, accent);
          const pct = d.value / sum;
          const h = 30 + pct * maxH;
          const cx = startX + slot * i;
          const apex = { x: cx, y: baseY - h };
          const left = { x: cx - baseR, y: baseY };
          const right = { x: cx + baseR, y: baseY };
          return (
            <g key={i}>
              {/* shadow ellipse */}
              <ellipse cx={cx} cy={baseY + 6} rx={baseR * 1.1} ry={5} fill="#000" fillOpacity={0.4} />
              {/* cone body (triangle with curved base look) */}
              <path
                d={`M ${left.x} ${left.y} L ${apex.x} ${apex.y} L ${right.x} ${right.y} A ${baseR} ${baseR * 0.35} 0 0 0 ${left.x} ${left.y} Z`}
                fill={`url(#r11-${i}-${c.slice(1)})`}
                stroke="#050505" strokeWidth={0.6}
              />
              {/* base ellipse top edge for 3D feel */}
              <ellipse cx={cx} cy={baseY} rx={baseR} ry={baseR * 0.35}
                fill="none" stroke="#050505" strokeWidth={0.6} />
              {/* % label above */}
              <text x={cx} y={apex.y - 8} textAnchor="middle" fontSize={14} fontWeight={700}
                fill="#fafafa" fontFamily="ui-monospace, monospace">
                {(pct * 100).toFixed(0)} %
              </text>
              {/* label below */}
              <text x={cx} y={baseY + 26} textAnchor="middle" fontSize={11} fill="#e4e4e7">
                {d.label.length > 14 ? d.label.slice(0, 12) + "…" : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================ */
/* R12 — LAYER PYRAMID ISO                                        */
/* Pyramide stratifiée iso, chaque couche = un segment.            */
/* Inspiration freepik : pyramide colorée image 5.                 */
/* ============================================================ */
export function RepartitionLayerPyramid({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const W = 460, H = 320;
  const cx = 230;
  const baseY = 280;
  const baseHalfW = 160;
  const layerH = Math.min(40, 180 / sorted.length);
  const tilt = 0.45; // ellipse vertical squash

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Total</span>
        <span className="font-mono text-[18px] font-bold tabular-nums text-zinc-50">
          {fmt(sum)} <span className="text-[11.5px] font-medium text-zinc-400">{unit}</span>
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {/* Render bottom-up : largest at base */}
        {sorted.map((d, i) => {
          const c = getColor(d, i, accent);
          const pct = d.value / sum;
          // chaque couche occupe baseHalfW * (1 - i*0.18)
          const wTop = baseHalfW * (1 - (i + 1) * 0.18);
          const wBot = baseHalfW * (1 - i * 0.18);
          const yTop = baseY - (i + 1) * layerH;
          const yBot = baseY - i * layerH;
          // ellipses pour les bordures tilt
          return (
            <g key={i}>
              {/* face avant trapèze */}
              <path
                d={`M ${cx - wBot} ${yBot} L ${cx - wTop} ${yTop} L ${cx + wTop} ${yTop} L ${cx + wBot} ${yBot} Z`}
                fill={c} stroke="#050505" strokeWidth={0.8}
              />
              {/* top ellipse (tranche supérieure visible) */}
              <ellipse cx={cx} cy={yTop} rx={wTop} ry={wTop * tilt}
                fill={c} fillOpacity={0.85} stroke="#050505" strokeWidth={0.8}
                style={{ filter: `brightness(1.15)` }} />
              {/* % label */}
              <text x={cx + wBot + 16} y={(yTop + yBot) / 2 + 4} fontSize={12} fontWeight={700}
                fill={c} fontFamily="ui-monospace, monospace">
                {(pct * 100).toFixed(0)} %
              </text>
              {/* label */}
              <text x={cx + wBot + 60} y={(yTop + yBot) / 2 + 4} fontSize={11} fill="#e4e4e7">
                {d.label.length > 22 ? d.label.slice(0, 20) + "…" : d.label}
              </text>
            </g>
          );
        })}
        {/* base ellipse (largest layer bottom edge) */}
        <ellipse cx={cx} cy={baseY} rx={baseHalfW} ry={baseHalfW * tilt}
          fill="none" stroke="#050505" strokeWidth={0.8} />
      </svg>
    </div>
  );
}

/* ============================================================ */
/* R13 — STACKED COLUMNS 3D ISOMETRIC                             */
/* Colonnes 3D isométriques (vue 3/4), une par segment, hauteur   */
/* proportionnelle à la valeur, faces avant/dessus/côté distincts.*/
/* Idéal pour répartition geo + segment qui veut "voir" le poids. */
/* ============================================================ */
export function RepartitionIsoColumns3D({ data, unit = "", total, accent = "#a78bfa" }: RepartitionProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, b) => a + b.value, 0);
  const maxV = sorted[0]?.value || 1;

  const W = 460;
  const H = 320;
  const baseY = 260;
  const colW = 46;
  const gap = 20;
  const totalW = sorted.length * (colW + gap) - gap;
  const startX = (W - totalW) / 2;
  // iso offset : décalage 3D (top + side)
  const DX = 14;
  const DY = -10;
  const maxColH = 200;

  function darken(hex: string, amount = 0.65): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.round(r * amount);
    const dg = Math.round(g * amount);
    const db = Math.round(b * amount);
    return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          {sorted.map((slice, i) => {
            const c = getColor(slice, i, accent);
            return (
              <linearGradient key={i} id={`iso-front-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="1" />
                <stop offset="100%" stopColor={c} stopOpacity="0.78" />
              </linearGradient>
            );
          })}
        </defs>

        {/* baseline iso (sol) */}
        <line
          x1={startX - 20}
          y1={baseY}
          x2={startX + totalW + 20 + DX}
          y2={baseY + DY}
          stroke="#27272a"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {sorted.map((slice, i) => {
          const c = getColor(slice, i, accent);
          const cSide = darken(c, 0.62);
          const cTop = darken(c, 1.18 > 1 ? 1 : 1.18);
          const h = (slice.value / maxV) * maxColH;
          const x = startX + i * (colW + gap);
          const yTop = baseY - h;
          const pct = sum > 0 ? (slice.value / sum) * 100 : 0;

          // 3 faces : front rect, side parallelogram, top parallelogram
          const frontPath = `M ${x} ${yTop} L ${x + colW} ${yTop} L ${x + colW} ${baseY} L ${x} ${baseY} Z`;
          const sidePath = `M ${x + colW} ${yTop} L ${x + colW + DX} ${yTop + DY} L ${x + colW + DX} ${baseY + DY} L ${x + colW} ${baseY} Z`;
          const topPath = `M ${x} ${yTop} L ${x + colW} ${yTop} L ${x + colW + DX} ${yTop + DY} L ${x + DX} ${yTop + DY} Z`;

          return (
            <g key={slice.label}>
              {/* shadow at base */}
              <ellipse cx={x + colW / 2 + DX / 2} cy={baseY + 8} rx={colW * 0.55} ry={3} fill="#000" opacity="0.4" />
              {/* side face */}
              <path d={sidePath} fill={cSide} />
              {/* front face */}
              <path d={frontPath} fill={`url(#iso-front-${i})`} />
              {/* top face */}
              <path d={topPath} fill="#ffffff" fillOpacity="0.18" stroke={cTop} strokeWidth="0.8" />
              {/* edges crisp */}
              <path d={frontPath} fill="none" stroke={darken(c, 0.55)} strokeWidth="0.7" />

              {/* value above column */}
              <text
                x={x + colW / 2 + DX / 2}
                y={yTop + DY - 12}
                textAnchor="middle"
                fontSize="11.5"
                fontWeight="700"
                fill="#fafafa"
                fontFamily="ui-monospace, monospace"
              >
                {fmt(slice.value)}
                {unit && <tspan fontSize="9" fill="#a1a1aa"> {unit}</tspan>}
              </text>
              <text
                x={x + colW / 2 + DX / 2}
                y={yTop + DY - 1}
                textAnchor="middle"
                fontSize="9.5"
                fill={c}
                fontFamily="ui-monospace, monospace"
              >
                {pct.toFixed(1)} %
              </text>

              {/* label below */}
              <text
                x={x + colW / 2}
                y={baseY + 22}
                textAnchor="middle"
                fontSize="11"
                fill="#d4d4d8"
                fontFamily="ui-sans-serif, system-ui"
              >
                {slice.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
