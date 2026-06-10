"use client";

/**
 * bars-style-proposals.tsx — Yann 11 juin 2026 : nouvelles propositions de
 * style pour le graphe BARRES (2D + 3D). Yann n'aime pas les barres actuelles
 * (iso3d + classic). 8 propositions, 50 % gardent le style néon.
 *
 * Affichées dans /concepts/charts-bars pour choix visuel. Aucune n'est encore
 * branchée sur l'app live : c'est une galerie de sélection.
 */
import React from "react";

export type BarStyleProposal = {
  id: string;
  title: string;
  neon: boolean;
  dim: "2D" | "3D";
  description: string;
};

export const BAR_STYLE_PROPOSALS: BarStyleProposal[] = [
  { id: "neon-glow", title: "1 · Néon Glow (2D)", neon: true, dim: "2D", description: "Barres plates remplies d'un dégradé accent vers transparent, contour néon lumineux + halo externe doux. Sommet arrondi. Le néon reste sur la barre, pas entre les barres." },
  { id: "neon-tube", title: "2 · Néon Tube creux (2D)", neon: true, dim: "2D", description: "Barres en tube/capsule arrondi, intérieur sombre, contour néon fin avec lueur interne. Effet enseigne lumineuse, très sobre." },
  { id: "neon-edge-3d", title: "3 · Néon Arête 3D", neon: true, dim: "3D", description: "Barres extrudées en 3D, faces sombres, seules les ARÊTES sont néon lumineuses. Profondeur sans surcharge." },
  { id: "neon-wire-3d", title: "4 · Néon Wireframe 3D", neon: true, dim: "3D", description: "Boîtes 3D en fil de fer, uniquement les arêtes brillent (faces transparentes). Look holographique futuriste." },
  { id: "glass-2d", title: "5 · Verre dépoli (2D)", neon: false, dim: "2D", description: "Barres translucides effet verre givré, bord subtil clair + reflet en haut. Élégant, lisible, sans néon." },
  { id: "gradient-solid-2d", title: "6 · Dégradé plein (2D)", neon: false, dim: "2D", description: "Dégradé vertical propre, plat, sommet arrondi, aucune lueur. Le plus sobre pour comparer des chiffres." },
  { id: "metallic-3d", title: "7 · Métal brossé (3D)", neon: false, dim: "3D", description: "Barres 3D avec faces métalliques (dessus clair, face moyenne, côté sombre). Effet matière premium, sans néon." },
  { id: "minimal-cap-2d", title: "8 · Minimal capuchon (2D)", neon: false, dim: "2D", description: "Barres fines neutres surmontées d'un capuchon accent épais. Ultra épuré, focus sur la tendance." },
];

const W = 460;
const H = 250;
const PAD_L = 14;
const PAD_R = 70;
const PAD_T = 24;
const PAD_B = 34;

type Props = {
  styleId: string;
  data: number[];
  labels: string[];
  unit?: string;
  color?: string;
  ttm?: number;
};

export function BarStyleChart({
  styleId,
  data,
  labels,
  unit = "",
  color = "#a78bfa",
  ttm,
}: Props) {
  const all = ttm != null ? [...data, ttm] : data;
  const allLabels = ttm != null ? [...labels, "TTM"] : labels;
  const max = Math.max(...all, 0.0001);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const baseY = PAD_T + plotH;
  const n = all.length;
  const slot = plotW / n;
  const bw = Math.min(slot * 0.56, 44);

  const bars = all.map((v, i) => {
    const h = (v / max) * plotH;
    const x = PAD_L + slot * i + (slot - bw) / 2;
    const y = baseY - h;
    return { v, h, x, y, w: bw, isTtm: ttm != null && i === n - 1, label: allLabels[i] };
  });

  const uid = styleId.replace(/[^a-z0-9]/gi, "");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Style ${styleId}`}>
      <defs>
        <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`metal-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.85" />
          <stop offset="50%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0.22" />
        </linearGradient>
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* baseline */}
      <line x1={PAD_L} y1={baseY} x2={W - PAD_R + 8} y2={baseY} stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" />

      {bars.map((b, i) => (
        <g key={i} opacity={b.isTtm ? 0.62 : 1}>
          {renderBar(styleId, b, color, uid)}
          <text x={b.x + b.w / 2} y={baseY + 16} textAnchor="middle" fontSize="9" fill="#a1a1aa" fontFamily="monospace">
            {b.label}
          </text>
          <text x={b.x + b.w / 2} y={b.y - 5} textAnchor="middle" fontSize="9" fill="#e4e4e7" fontFamily="monospace" fontWeight="600">
            {b.v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          </text>
        </g>
      ))}
      {unit ? (
        <text x={W - PAD_R + 12} y={PAD_T + 6} fontSize="9" fill="#71717a" fontFamily="monospace">{unit}</text>
      ) : null}
    </svg>
  );
}

type Bar = { v: number; h: number; x: number; y: number; w: number; isTtm: boolean; label: string };

function renderBar(styleId: string, b: Bar, color: string, uid: string): React.ReactNode {
  const dx = 9; // 3D depth x
  const dy = -7; // 3D depth y
  const r = Math.min(5, b.w / 2);

  switch (styleId) {
    case "neon-glow":
      return (
        <g filter={`url(#glow-${uid})`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={r} fill={`url(#fill-${uid})`} stroke={color} strokeWidth="1.6" />
          <line x1={b.x + 1.5} y1={b.y + r} x2={b.x + 1.5} y2={b.y + b.h} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1" />
        </g>
      );

    case "neon-tube": {
      const cap = Math.min(b.w / 2, 8);
      return (
        <g filter={`url(#glow-${uid})`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={cap} fill={color} fillOpacity="0.06" stroke={color} strokeWidth="1.6" />
          <rect x={b.x + 2.5} y={b.y + 2.5} width={b.w - 5} height={Math.max(b.h - 5, 0)} rx={Math.max(cap - 2, 0)} fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
        </g>
      );
    }

    case "neon-edge-3d": {
      const top = `${b.x},${b.y} ${b.x + b.w},${b.y} ${b.x + b.w + dx},${b.y + dy} ${b.x + dx},${b.y + dy}`;
      const side = `${b.x + b.w},${b.y} ${b.x + b.w + dx},${b.y + dy} ${b.x + b.w + dx},${b.y + b.h + dy} ${b.x + b.w},${b.y + b.h}`;
      return (
        <g>
          <polygon points={side} fill={color} fillOpacity="0.1" />
          <polygon points={top} fill={color} fillOpacity="0.18" />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={color} fillOpacity="0.06" />
          <g filter={`url(#glow-${uid})`} stroke={color} strokeWidth="1.4" fill="none">
            <rect x={b.x} y={b.y} width={b.w} height={b.h} />
            <polygon points={top} />
            <polyline points={`${b.x + b.w},${b.y + b.h} ${b.x + b.w + dx},${b.y + b.h + dy} ${b.x + b.w + dx},${b.y + dy}`} />
          </g>
        </g>
      );
    }

    case "neon-wire-3d": {
      const top = `${b.x},${b.y} ${b.x + b.w},${b.y} ${b.x + b.w + dx},${b.y + dy} ${b.x + dx},${b.y + dy}`;
      return (
        <g filter={`url(#glow-${uid})`} stroke={color} strokeWidth="1.2" fill="none" strokeOpacity="0.92">
          <rect x={b.x} y={b.y} width={b.w} height={b.h} />
          <polygon points={top} />
          <line x1={b.x + b.w} y1={b.y} x2={b.x + b.w + dx} y2={b.y + dy} />
          <line x1={b.x + b.w} y1={b.y + b.h} x2={b.x + b.w + dx} y2={b.y + b.h + dy} />
          <line x1={b.x + b.w + dx} y1={b.y + dy} x2={b.x + b.w + dx} y2={b.y + b.h + dy} />
        </g>
      );
    }

    case "glass-2d":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={r} fill={color} fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
          <rect x={b.x + 2} y={b.y + 2} width={b.w - 4} height={Math.min(b.h * 0.4, 18)} rx={r} fill="#ffffff" fillOpacity="0.12" />
        </g>
      );

    case "gradient-solid-2d":
      return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={r} fill={`url(#fill-${uid})`} />;

    case "metallic-3d": {
      const top = `${b.x},${b.y} ${b.x + b.w},${b.y} ${b.x + b.w + dx},${b.y + dy} ${b.x + dx},${b.y + dy}`;
      const side = `${b.x + b.w},${b.y} ${b.x + b.w + dx},${b.y + dy} ${b.x + b.w + dx},${b.y + b.h + dy} ${b.x + b.w},${b.y + b.h}`;
      return (
        <g>
          <polygon points={side} fill={color} fillOpacity="0.3" />
          <polygon points={top} fill="#ffffff" fillOpacity="0.28" />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={`url(#metal-${uid})`} />
        </g>
      );
    }

    case "minimal-cap-2d":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={color} fillOpacity="0.16" />
          <rect x={b.x} y={b.y} width={b.w} height={3.5} fill={color} />
        </g>
      );

    default:
      return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={r} fill={color} />;
  }
}
