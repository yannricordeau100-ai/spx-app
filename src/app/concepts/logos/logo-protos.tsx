"use client";

/**
 * 8 protos × 2 versions (horizontal + carré) = 16 composants SVG inline.
 *
 * Convention :
 *  - Horizontal : viewBox ratio ~5:1 (250×50), wordmark + glyph.
 *  - Carré : viewBox 128×128, glyph seul (favicon, avatar, app icon).
 *
 * Palette signature Mettrik :
 *  - violet : #a855f7
 *  - cyan   : #22d3ee
 *  - magenta: #f472b6
 *  - dark bg: #09090b (zinc-950)
 *  - light bg: #fafafa (zinc-50)
 *
 * Aucune dépendance externe, juste du SVG inline.
 */

type ThemeProp = { theme: "dark" | "light" };

const FONT_WORDMARK =
  "var(--font-instrument), 'Bricolage Grotesque', system-ui, sans-serif";

function textColor(theme: "dark" | "light"): string {
  return theme === "dark" ? "#fafafa" : "#09090b";
}
function subColor(theme: "dark" | "light"): string {
  return theme === "dark" ? "#a1a1aa" : "#52525b";
}

/* ────────────────────────────────────────────────────────────
 * 01. PULSE SIGNAL — wordmark + onde gradient sous le mot
 * ──────────────────────────────────────────────────────────── */

export function PulseSignalHorizontal({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 280 56"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-auto"
      aria-label="Mettrik AI"
    >
      <defs>
        <linearGradient id="pulse-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="34"
        fill={fg}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "-0.02em",
        }}
      >
        Mettrik
      </text>
      <text
        x="142"
        y="34"
        fill={subColor(theme)}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 500,
          fontSize: 14,
          letterSpacing: "0.1em",
        }}
      >
        AI
      </text>
      <path
        d="M 0 48 Q 30 40, 60 48 T 120 48 T 180 48 T 240 48"
        fill="none"
        stroke="url(#pulse-grad)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PulseSignalSquare({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      aria-label="Mettrik"
    >
      <defs>
        <linearGradient id="pulse-sq-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <text
        x="64"
        y="74"
        textAnchor="middle"
        fill={fg}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 700,
          fontSize: 64,
          letterSpacing: "-0.04em",
        }}
      >
        M
      </text>
      <path
        d="M 24 96 Q 44 88, 64 96 T 104 96"
        fill="none"
        stroke="url(#pulse-sq-grad)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * 02. ORBITAL M — M géométrique + orbite circulaire fine
 * ──────────────────────────────────────────────────────────── */

export function OrbitalMHorizontal({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 280 56"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-auto"
    >
      <defs>
        <linearGradient id="orb-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Glyph orbital M */}
      <g transform="translate(4, 8)">
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="url(#orb-grad)"
          strokeWidth="1"
          opacity="0.6"
        />
        <path
          d="M 9 28 L 9 12 L 20 22 L 31 12 L 31 28"
          fill="none"
          stroke={fg}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="35" cy="9" r="2" fill="#22d3ee" />
      </g>
      <text
        x="60"
        y="34"
        fill={fg}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "-0.02em",
        }}
      >
        Mettrik
      </text>
      <text
        x="195"
        y="34"
        fill={subColor(theme)}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "0.12em",
        }}
      >
        AI
      </text>
    </svg>
  );
}

export function OrbitalMSquare({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="orb-sq-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle
        cx="64"
        cy="64"
        r="54"
        fill="none"
        stroke="url(#orb-sq-grad)"
        strokeWidth="2"
        opacity="0.7"
      />
      <path
        d="M 30 88 L 30 40 L 64 70 L 98 40 L 98 88"
        fill="none"
        stroke={fg}
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="110" cy="30" r="6" fill="#22d3ee" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * 03. IRIDESCENT PRISM — cristal qui décompose la lumière
 * ──────────────────────────────────────────────────────────── */

export function PrismHorizontal({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 280 56"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-auto"
    >
      <defs>
        <linearGradient id="prism-face1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="prism-face2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="prism-beam" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <g transform="translate(4, 6)">
        {/* Prisme triangulaire bicolor */}
        <polygon points="22,4 4,40 40,40" fill="url(#prism-face1)" />
        <polygon points="22,4 40,40 28,16" fill="url(#prism-face2)" />
        {/* Rayons sortants */}
        <line x1="40" y1="32" x2="50" y2="32" stroke="url(#prism-beam)" strokeWidth="1.2" />
        <line x1="40" y1="36" x2="48" y2="36" stroke="url(#prism-beam)" strokeWidth="1.2" />
        <line x1="40" y1="28" x2="46" y2="28" stroke="url(#prism-beam)" strokeWidth="1.2" />
      </g>
      <text
        x="68"
        y="34"
        fill={fg}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "-0.02em",
        }}
      >
        Mettrik
      </text>
      <text
        x="203"
        y="34"
        fill={subColor(theme)}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "0.12em",
        }}
      >
        AI
      </text>
    </svg>
  );
}

export function PrismSquare({ theme: _theme }: ThemeProp) {
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="prism-sq-1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="prism-sq-2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="prism-sq-beam" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <polygon points="58,16 16,104 100,104" fill="url(#prism-sq-1)" />
      <polygon points="58,16 100,104 72,46" fill="url(#prism-sq-2)" />
      <line x1="100" y1="84" x2="120" y2="84" stroke="url(#prism-sq-beam)" strokeWidth="3" strokeLinecap="round" />
      <line x1="100" y1="94" x2="118" y2="94" stroke="url(#prism-sq-beam)" strokeWidth="3" strokeLinecap="round" />
      <line x1="100" y1="104" x2="116" y2="104" stroke="url(#prism-sq-beam)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * 04. CUBE STACK — trois cubes isométriques empilés
 * ──────────────────────────────────────────────────────────── */

export function CubeStackHorizontal({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 280 56"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-auto"
    >
      <defs>
        <linearGradient id="cube-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g transform="translate(4, 6)">
        <IsoCube x={14} y={8} size={10} colorTop="url(#cube-top)" colorLeft="#7c3aed" colorRight="#0891b2" />
        <IsoCube x={4} y={20} size={10} colorTop="url(#cube-top)" colorLeft="#7c3aed" colorRight="#0891b2" opacity={0.85} />
        <IsoCube x={24} y={20} size={10} colorTop="url(#cube-top)" colorLeft="#7c3aed" colorRight="#0891b2" opacity={0.85} />
      </g>
      <text
        x="64"
        y="34"
        fill={fg}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "-0.02em",
        }}
      >
        Mettrik
      </text>
      <text
        x="199"
        y="34"
        fill={subColor(theme)}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "0.12em",
        }}
      >
        AI
      </text>
    </svg>
  );
}

export function CubeStackSquare({ theme: _theme }: ThemeProp) {
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="cube-sq-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g transform="translate(8, 12)">
        <IsoCube x={40} y={8} size={28} colorTop="url(#cube-sq-top)" colorLeft="#7c3aed" colorRight="#0891b2" />
        <IsoCube x={12} y={42} size={28} colorTop="url(#cube-sq-top)" colorLeft="#7c3aed" colorRight="#0891b2" opacity={0.88} />
        <IsoCube x={68} y={42} size={28} colorTop="url(#cube-sq-top)" colorLeft="#7c3aed" colorRight="#0891b2" opacity={0.88} />
      </g>
    </svg>
  );
}

function IsoCube({
  x,
  y,
  size,
  colorTop,
  colorLeft,
  colorRight,
  opacity = 1,
}: {
  x: number;
  y: number;
  size: number;
  colorTop: string;
  colorLeft: string;
  colorRight: string;
  opacity?: number;
}) {
  const s = size;
  const h = s * 0.5; // décalage iso
  return (
    <g transform={`translate(${x}, ${y})`} opacity={opacity}>
      {/* Top */}
      <polygon
        points={`0,${h} ${s},0 ${s * 2},${h} ${s},${s}`}
        fill={colorTop}
      />
      {/* Left */}
      <polygon
        points={`0,${h} ${s},${s} ${s},${s * 2} 0,${s * 1.5}`}
        fill={colorLeft}
      />
      {/* Right */}
      <polygon
        points={`${s},${s} ${s * 2},${h} ${s * 2},${s * 1.5} ${s},${s * 2}`}
        fill={colorRight}
      />
    </g>
  );
}

/* ────────────────────────────────────────────────────────────
 * 05. BICOLOR DROP — goutte mi-violet mi-cyan
 * ──────────────────────────────────────────────────────────── */

export function BicolorDropHorizontal({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 280 56"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-auto"
    >
      <defs>
        <clipPath id="drop-clip">
          <path d="M 24 4 C 14 18, 6 28, 6 36 C 6 47, 14 52, 24 52 C 34 52, 42 47, 42 36 C 42 28, 34 18, 24 4 Z" />
        </clipPath>
      </defs>
      <g transform="translate(0, 0)">
        <rect x="6" y="4" width="18" height="48" fill="#a855f7" clipPath="url(#drop-clip)" />
        <rect x="24" y="4" width="18" height="48" fill="#22d3ee" clipPath="url(#drop-clip)" />
        {/* highlight */}
        <ellipse cx="20" cy="20" rx="4" ry="6" fill="#ffffff" opacity="0.35" />
      </g>
      <text
        x="58"
        y="34"
        fill={fg}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "-0.02em",
        }}
      >
        Mettrik
      </text>
      <text
        x="193"
        y="34"
        fill={subColor(theme)}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "0.12em",
        }}
      >
        AI
      </text>
    </svg>
  );
}

export function BicolorDropSquare({ theme: _theme }: ThemeProp) {
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <defs>
        <clipPath id="drop-sq-clip">
          <path d="M 64 12 C 38 50, 22 76, 22 92 C 22 112, 40 122, 64 122 C 88 122, 106 112, 106 92 C 106 76, 90 50, 64 12 Z" />
        </clipPath>
      </defs>
      <rect x="22" y="12" width="42" height="110" fill="#a855f7" clipPath="url(#drop-sq-clip)" />
      <rect x="64" y="12" width="42" height="110" fill="#22d3ee" clipPath="url(#drop-sq-clip)" />
      <ellipse cx="54" cy="50" rx="8" ry="14" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * 06. BAR COMPASS — 4 barres gradient sparkline + cap
 * ──────────────────────────────────────────────────────────── */

export function BarCompassHorizontal({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 280 56"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-auto"
    >
      <defs>
        <linearGradient id="bar-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g transform="translate(4, 0)">
        <rect x="0" y="36" width="6" height="14" rx="1.5" fill="url(#bar-grad)" opacity="0.55" />
        <rect x="10" y="28" width="6" height="22" rx="1.5" fill="url(#bar-grad)" opacity="0.7" />
        <rect x="20" y="18" width="6" height="32" rx="1.5" fill="url(#bar-grad)" opacity="0.85" />
        <rect x="30" y="8" width="6" height="42" rx="1.5" fill="url(#bar-grad)" />
        <circle cx="33" cy="6" r="2.5" fill="#f472b6" />
      </g>
      <text
        x="56"
        y="34"
        fill={fg}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "-0.02em",
        }}
      >
        Mettrik
      </text>
      <text
        x="191"
        y="34"
        fill={subColor(theme)}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "0.12em",
        }}
      >
        AI
      </text>
    </svg>
  );
}

export function BarCompassSquare({ theme: _theme }: ThemeProp) {
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="bar-sq-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g transform="translate(16, 16)">
        <rect x="0" y="64" width="16" height="32" rx="3" fill="url(#bar-sq-grad)" opacity="0.55" />
        <rect x="24" y="44" width="16" height="52" rx="3" fill="url(#bar-sq-grad)" opacity="0.7" />
        <rect x="48" y="22" width="16" height="74" rx="3" fill="url(#bar-sq-grad)" opacity="0.85" />
        <rect x="72" y="4" width="16" height="92" rx="3" fill="url(#bar-sq-grad)" />
        <circle cx="80" cy="0" r="6" fill="#f472b6" />
      </g>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * 07. MONOLITH M — M custom geometric, accent iridescent
 * ──────────────────────────────────────────────────────────── */

export function MonolithHorizontal({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 280 56"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-auto"
    >
      <defs>
        <linearGradient id="mono-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g transform="translate(4, 8)">
        {/* M custom dessiné en path */}
        <path
          d="M 0 40 L 0 0 L 7 0 L 20 22 L 33 0 L 40 0 L 40 40 L 33 40 L 33 13 L 22 31 L 18 31 L 7 13 L 7 40 Z"
          fill={fg}
        />
        {/* Accent iridescent en bas-droite */}
        <rect x="33" y="33" width="7" height="7" fill="url(#mono-accent)" />
      </g>
      <text
        x="56"
        y="34"
        fill={fg}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "-0.025em",
        }}
      >
        Mettrik
      </text>
      <text
        x="191"
        y="34"
        fill={subColor(theme)}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "0.12em",
        }}
      >
        AI
      </text>
    </svg>
  );
}

export function MonolithSquare({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="mono-sq-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g transform="translate(20, 24)">
        <path
          d="M 0 80 L 0 0 L 14 0 L 44 50 L 74 0 L 88 0 L 88 80 L 74 80 L 74 28 L 50 68 L 38 68 L 14 28 L 14 80 Z"
          fill={fg}
        />
        <rect x="74" y="66" width="14" height="14" fill="url(#mono-sq-accent)" />
      </g>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * 08. WORDMARK V2 — raffinement non-rupture du wordmark actuel
 * ──────────────────────────────────────────────────────────── */

export function WordmarkV2Horizontal({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 280 56"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-auto"
    >
      <defs>
        <linearGradient id="wm2-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={fg} />
          <stop offset="40%" stopColor={fg} />
          <stop offset="65%" stopColor="#a855f7" />
          <stop offset="85%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <radialGradient id="wm2-dot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a855f7" />
        </radialGradient>
      </defs>
      <text
        x="0"
        y="38"
        fill="url(#wm2-grad)"
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: 36,
          letterSpacing: "-0.045em",
        }}
      >
        Mettrik
      </text>
      {/* Dot iridescent retravaillé avec anneau orbital */}
      <g transform="translate(82, 11)">
        <circle cx="0" cy="0" r="6" fill="none" stroke="#a855f7" strokeWidth="0.8" opacity="0.5" />
        <circle cx="0" cy="0" r="3" fill="url(#wm2-dot)" />
      </g>
      <text
        x="148"
        y="38"
        fill={subColor(theme)}
        style={{
          fontFamily: FONT_WORDMARK,
          fontWeight: 500,
          fontSize: 14,
          letterSpacing: "0.18em",
        }}
      >
        AI
      </text>
    </svg>
  );
}

export function WordmarkV2Square({ theme }: ThemeProp) {
  const fg = textColor(theme);
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="wm2-sq-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={fg} />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id="wm2-sq-dot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a855f7" />
        </radialGradient>
      </defs>
      <text
        x="64"
        y="92"
        textAnchor="middle"
        fill="url(#wm2-sq-grad)"
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: 96,
          letterSpacing: "-0.05em",
        }}
      >
        M
      </text>
      {/* Anneau orbital + dot autour du sommet */}
      <g transform="translate(98, 32)">
        <circle cx="0" cy="0" r="14" fill="none" stroke="#a855f7" strokeWidth="1.2" opacity="0.55" />
        <circle cx="0" cy="0" r="7" fill="url(#wm2-sq-dot)" />
      </g>
    </svg>
  );
}
