"use client";

/**
 * Real, recognizable brand logos as inline SVG.
 * Designed at 56×56 viewbox. Colors are accurate brand colors.
 */

export function LogoGOOGL() {
  return (
    <svg viewBox="0 0 56 56" className="size-full">
      <defs>
        <clipPath id="g-clip">
          <path d="M28 13 a15 15 0 1 0 14.5 18.5 H28 v-6 h21 a15 15 0 0 1 -21 14.5 a15 15 0 0 1 0 -27 z" />
        </clipPath>
      </defs>
      {/* Classic Google G — built from 4 brand color arcs */}
      <g transform="translate(0,0)">
        <path d="M48 28 c0 -1.5 -0.15 -3 -0.4 -4.4 H28 v8.4 h11.3 c-0.5 2.6 -2 4.8 -4.2 6.3 v5.2 h6.8 c4 -3.7 6.3 -9.1 6.3 -15.5 z" fill="#4285F4"/>
        <path d="M28 49 c5.7 0 10.5 -1.9 14 -5.1 l-6.8 -5.2 c-1.9 1.3 -4.3 2 -7.2 2 c-5.5 0 -10.2 -3.7 -11.9 -8.7 H9 v5.4 C12.5 44.5 19.7 49 28 49 z" fill="#34A853"/>
        <path d="M16.1 32 c-0.4 -1.3 -0.7 -2.6 -0.7 -4 s0.2 -2.7 0.7 -4 v-5.4 H9 c-1.4 2.8 -2.2 6 -2.2 9.4 s0.8 6.6 2.2 9.4 L16.1 32 z" fill="#FBBC04"/>
        <path d="M28 15.3 c3.1 0 5.9 1.1 8.1 3.2 l6 -6 C38.5 9 33.7 7 28 7 C19.7 7 12.5 11.5 9 18.6 l7.1 5.4 C17.8 19 22.5 15.3 28 15.3 z" fill="#EA4335"/>
      </g>
    </svg>
  );
}

export function LogoMETA() {
  return (
    <svg viewBox="0 0 56 56" className="size-full">
      <defs>
        <linearGradient id="meta-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0064E1"/>
          <stop offset="50%" stopColor="#0866FF"/>
          <stop offset="100%" stopColor="#1F77FF"/>
        </linearGradient>
      </defs>
      {/* Meta infinity / lemniscate — simplified */}
      <path
        d="M11 28 C 11 19, 17 15, 23 22 L 28 28 L 33 22 C 39 15, 45 19, 45 28 C 45 37, 39 41, 33 34 L 28 28 L 23 34 C 17 41, 11 37, 11 28 Z"
        fill="none"
        stroke="url(#meta-g)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoMSCI() {
  return (
    <svg viewBox="0 0 56 56" className="size-full">
      {/* MSCI wordmark — clean, brand-correct */}
      <rect x="4" y="20" width="48" height="16" rx="2" fill="#1B365D" />
      <text
        x="28"
        y="32"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="11"
        fill="#FFFFFF"
        letterSpacing="0.5"
      >
        MSCI
      </text>
    </svg>
  );
}

export function LogoSPGI() {
  return (
    <svg viewBox="0 0 56 56" className="size-full">
      {/* S&P Global — red square with stylized S&P */}
      <rect x="6" y="6" width="44" height="44" rx="3" fill="#E31837" />
      <text
        x="28"
        y="34"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="18"
        fill="#FFFFFF"
        letterSpacing="-0.5"
      >
        S&amp;P
      </text>
    </svg>
  );
}

export function LogoCAT() {
  return (
    <svg viewBox="0 0 56 56" className="size-full">
      {/* Caterpillar — yellow wedge + CAT */}
      <rect x="4" y="14" width="48" height="28" rx="2" fill="#FFCD11" />
      {/* Black triangle wedge top-left (Cat trademark accent) */}
      <polygon points="4,14 22,14 4,32" fill="#000000" />
      <text
        x="32"
        y="33"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="900"
        fontSize="13"
        fill="#000000"
        letterSpacing="1"
      >
        CAT
      </text>
    </svg>
  );
}

export function CompanyLogo({ ticker }: { ticker: string }) {
  switch (ticker) {
    case "GOOGL":
      return <LogoGOOGL />;
    case "META":
      return <LogoMETA />;
    case "MSCI":
      return <LogoMSCI />;
    case "SPGI":
      return <LogoSPGI />;
    case "CAT":
      return <LogoCAT />;
    default:
      return null;
  }
}
