"use client";

/**
 * Real, recognizable brand logos as inline SVG.
 * Designed at 56×56 viewbox. Colors are accurate brand colors.
 */

export function LogoGOOGL() {
  return (
    <svg viewBox="0 0 56 56" className="size-full" data-logo="true">
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
    <svg viewBox="0 0 56 56" className="size-full" data-logo="true">
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
    <svg viewBox="0 0 80 56" className="size-full" data-logo="true">
      {/* MSCI wordmark — bleu corporate MSCI, sans box, comme l'identité officielle */}
      <text
        x="40"
        y="38"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="900"
        fontSize="26"
        fill="#1F4F8B"
        letterSpacing="-0.5"
      >
        MSCI
      </text>
    </svg>
  );
}

export function LogoSPGI() {
  return (
    <svg viewBox="0 0 80 56" className="size-full" data-logo="true">
      {/* S&P Global — carré rouge S&P + wordmark Global, identité corporate */}
      <rect x="2" y="14" width="28" height="28" rx="2" fill="#E31837" />
      <text
        x="16"
        y="34"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="14"
        fill="#FFFFFF"
        letterSpacing="-0.5"
      >
        S&amp;P
      </text>
      <text
        x="36"
        y="34"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="600"
        fontSize="14"
        fill="#1A1A1A"
        letterSpacing="-0.3"
      >
        Global
      </text>
    </svg>
  );
}

export function LogoCAT() {
  return (
    <svg viewBox="0 0 80 56" className="size-full" data-logo="true">
      {/* Caterpillar — wordmark CAT noir + triangle jaune iconique sous le A */}
      <text
        x="40"
        y="34"
        textAnchor="middle"
        fontFamily="Helvetica, Arial, sans-serif"
        fontWeight="900"
        fontSize="28"
        fill="#000000"
        letterSpacing="-1"
      >
        CAT
      </text>
      {/* Triangle jaune sous le A central (signature visuelle Caterpillar) */}
      <polygon points="33,40 47,40 40,52" fill="#FFCD11" />
    </svg>
  );
}

/**
 * Fallback monogramme pour les sociétés sans logo SVG dédié (FPI cat 2,
 * Stoxx 600, etc.). Affiche les 2-4 premiers caractères du ticker dans
 * un cercle au gradient brand. Utilisé pour V2 sandbox.
 */
function LogoMonogram({ ticker }: { ticker: string }) {
  const display = ticker.length <= 4 ? ticker : ticker.slice(0, 3);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <defs>
        <linearGradient id={`mg-${ticker}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill={`url(#mg-${ticker})`} fillOpacity="0.15" stroke={`url(#mg-${ticker})`} strokeWidth="2" />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontSize={display.length <= 3 ? 30 : 24}
        fontWeight="700"
        fill="#fafafa"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="-0.5"
      >
        {display}
      </text>
    </svg>
  );
}

/**
 * Logos cachés localement dans public/logos/<TICKER>.png. Auto-fetch via
 * scripts/fetch-company-logos.ts depuis sources publiques (favicons HD).
 * Si présent → utilisé en priorité. Sinon fallback sur SVG hardcodés (V1)
 * ou monogramme lettre (V1.7+).
 */
const HARDCODED_TICKERS = new Set(["GOOGL", "META", "MSCI", "SPGI", "CAT"]);

export function CompanyLogo({ ticker }: { ticker: string }) {
  const t = ticker.toUpperCase();
  // V1 stés gardent leur SVG handcrafted (qualité supérieure).
  if (HARDCODED_TICKERS.has(t)) {
    if (t === "GOOGL") return <LogoGOOGL />;
    if (t === "META") return <LogoMETA />;
    if (t === "MSCI") return <LogoMSCI />;
    if (t === "SPGI") return <LogoSPGI />;
    if (t === "CAT") return <LogoCAT />;
  }
  // V1.7+ : logo PNG cache local. Fallback sur monogramme si load fail (onError).
  // Convention fichier : public/logos/<TICKER>.png (ex: public/logos/NFLX.png).
  // Le ticker peut contenir . ou - selon source. Convertit . en - pour fichier.
  const safeTicker = t.replace(/\./g, "-");
  return (
    <picture className="block size-full">
      <img
        src={`/logos/${safeTicker}.png`}
        alt=""
        className="company-logo-img size-full object-contain"
        loading="lazy"
        onError={(e) => {
          // Si pas de PNG cache, on bascule sur monogramme via state.
          (e.currentTarget as HTMLImageElement).style.display = "none";
          const next = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
          if (next) next.style.display = "block";
        }}
      />
      <span style={{ display: "none" }} className="block size-full">
        <LogoMonogram ticker={ticker} />
      </span>
    </picture>
  );
}

/**
 * Indique si le logo contient des couleurs sombres (proches du noir) qui
 * deviendraient invisibles sur le fond sombre Mettrik. Quand true, le
 * conteneur logo doit utiliser un fond blanc/clair pour assurer le contraste.
 *
 *  - GOOGL : 4 couleurs vives (bleu, rouge, jaune, vert) → visible sur dark
 *  - META : bleu gradient → visible sur dark
 *  - MSCI : bleu corporate #1F4F8B → trop foncé sur dark, fond clair requis
 *  - SPGI : carré rouge OK + texte "Global" #1A1A1A noir → fond clair requis
 *  - CAT : wordmark "CAT" noir + triangle jaune → fond clair requis
 *  - MU (Micron) : PNG officiel téléchargé était corrompu (carré noir
 *    uniforme 100% opaque rgb≈5,5,5). Supprimé → fallback monogramme "MU"
 *    visible sur fond sombre. Pas besoin de fond clair.
 */
const LIGHT_BG_TICKERS = new Set(["MSCI", "SPGI", "CAT"]);

export function logoNeedsLightBg(ticker: string): boolean {
  return LIGHT_BG_TICKERS.has(ticker.toUpperCase());
}
