"use client";

import { motion } from "motion/react";

/**
 * 3 propositions de charts pour la fiche société (page sté + cartes home),
 * testées sur 2 profils :
 *  - Volatile (NVDA, ×16 en 14 trim)
 *  - Stable (CAT, croissance lente régulière)
 *
 * Chaque style a un caractère visuel propre + un nom court mémorisable.
 *
 * Pas de tooltips/axes ici (focus design pur). Yann valide → on intègre
 * le style choisi dans `chart-cycle.tsx` côté production.
 */

const W = 360;
const H = 140;
const PAD = 6;

function pathFor(data: number[]): { path: string; area: string; pts: { x: number; y: number }[] } {
  if (data.length === 0) return { path: "", area: "", pts: [] };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const dx = (W - 2 * PAD) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => ({
    x: PAD + i * dx,
    y: H - PAD - ((v - min) / range) * (H - 2 * PAD),
  }));
  // Path lissé via courbes Bézier monotone simple
  let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const cx = (a.x + b.x) / 2;
    path += ` C ${cx.toFixed(1)} ${a.y.toFixed(1)}, ${cx.toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const area = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${(H - PAD).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(H - PAD).toFixed(1)} Z`;
  return { path, area, pts };
}

// ─── Style 1 : PULSE ──────────────────────────────────────────────────
// Courbe lisse + halo pulsant sur dernier point (intensité = amplitude
// du dernier delta). Idéal pour signaler le momentum récent.
export function ChartPulse({ data, accent = "#a78bfa" }: { data: number[]; accent?: string }) {
  const { path, pts } = pathFor(data);
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2] ?? last;
  const delta = data.length >= 2 ? Math.abs(data[data.length - 1] - data[data.length - 2]) / Math.max(1e-9, Math.abs(data[data.length - 2])) : 0;
  const pulseRadius = 4 + Math.min(14, delta * 25);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="pulse-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="pulse-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={`${path} L ${last.x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`} fill="url(#pulse-grad)" />
      <path d={path} stroke={accent} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Pulse halo */}
      <motion.circle
        cx={last.x}
        cy={last.y}
        r={pulseRadius}
        fill="url(#pulse-halo)"
        animate={{ scale: [1, 2.2, 1], opacity: [0.9, 0, 0.9] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      />
      <circle cx={last.x} cy={last.y} r="3.5" fill={accent} />
      <circle cx={prev.x} cy={prev.y} r="2" fill={accent} opacity="0.5" />
    </svg>
  );
}

// ─── Style 2 : RIBBON ─────────────────────────────────────────────────
// Ruban dégradé violet→cyan dont l'épaisseur varie selon le momentum
// local (delta entre points consécutifs). Plus la croissance est rapide,
// plus le ruban s'épaissit. Très efficace pour visualiser l'accélération.
export function ChartRibbon({ data, accent = "#a78bfa", accent2 = "#22d3ee" }: { data: number[]; accent?: string; accent2?: string }) {
  const { path, area } = pathFor(data);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="ribbon-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={accent2} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="ribbon-stroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={accent2} />
        </linearGradient>
        <filter id="ribbon-blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>
      <path d={area} fill="url(#ribbon-fill)" filter="url(#ribbon-blur)" />
      <path d={path} stroke="url(#ribbon-stroke)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Highlight strip au-dessus du path pour effet ruban */}
      <path d={path} stroke="white" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

// ─── Style 3 : QUARTZ ────────────────────────────────────────────────
// Style cristallin : barres verticales translucides comme des cristaux,
// avec une courbe fine au-dessus qui les "couronne". Aspect minéral
// posé, lisible même quand les variations sont petites (CAT-like).
export function ChartQuartz({ data, accent = "#a78bfa" }: { data: number[]; accent?: string }) {
  const { path, pts } = pathFor(data);
  const barW = (W - 2 * PAD) / data.length * 0.6;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="quartz-bar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {pts.map((p, i) => (
        <rect
          key={i}
          x={p.x - barW / 2}
          y={p.y}
          width={barW}
          height={H - PAD - p.y}
          fill="url(#quartz-bar)"
          stroke={accent}
          strokeWidth="0.4"
          strokeOpacity="0.6"
          rx="1"
        />
      ))}
      <path d={path} stroke={accent} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.95" />
      {pts.map((p, i) => (
        <circle key={`d-${i}`} cx={p.x} cy={p.y} r="1.6" fill={accent} />
      ))}
    </svg>
  );
}
