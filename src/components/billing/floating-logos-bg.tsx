"use client";

/**
 * FloatingLogosBg — fond logos statique pour la page pricing.
 *
 * Yann (31 mai 2026, refonte v2) : "très faible opacité, pas derrière
 * texte / cards / CTA / FAQ / form. Zone safe entre les sections, dans
 * les vides visuels uniquement". Anciens canvas animé retiré : trop
 * envahissant, ressemblait à un bug.
 *
 * Implémentation :
 * - DOM fixed full-height, z-index -1 (sous tout le contenu)
 * - 4 colonnes verticales (2 à gauche, 2 à droite) hors zone centrale
 *   max-w-5xl (= zone safe texte + cards + FAQ + form CTA)
 * - 6 logos espacés verticalement par colonne, sélection top 12-15 stés
 * - Opacité 0.06, filtre invert pour silhouette blanche translucide
 * - Logos centrés horizontalement dans chaque colonne marginale
 *
 * Les logos viennent de /public/logos/<TICKER>.png (mêmes fichiers que
 * les pages société). Vérification 31 mai 2026 : NVDA AAPL MSFT GOOGL
 * META AMZN TSLA V JPM BRK-B ASML JNJ UNH WMT XOM MC tous présents.
 */

// Top 14 stés mondial par capi (sélection diversifiée tech + finance +
// luxe + santé + énergie pour éviter monoculture tech). Tickers
// vérifiés présents dans /public/logos/.
const TOP_LOGOS = [
  "NVDA",
  "AAPL",
  "MSFT",
  "GOOGL",
  "META",
  "AMZN",
  "TSLA",
  "V",
  "JPM",
  "BRK-B",
  "ASML",
  "JNJ",
  "UNH",
  "MC",
];

export function FloatingLogosBg({ tickers: _tickers }: { tickers?: string[] }) {
  // Prop tickers gardée pour compat ascendante mais ignorée :
  // sélection canonique top 14 utilisée. Évite cross-pollution si le
  // parent passe v1-8-tickers-sorted.json (qui contient des ADR sans
  // logo PNG).

  // 4 colonnes : 2 gauche (en dehors max-w-5xl), 2 droite. Chaque
  // colonne a 4 positions verticales espacées (8 logos par côté = 16
  // au total, capés à 14 logos uniques pour éviter doublons proches).
  const leftLogos = TOP_LOGOS.slice(0, 7);
  const rightLogos = TOP_LOGOS.slice(7, 14);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -1 }}
    >
      {/* Colonne gauche : 5 % du viewport, 7 logos espacés
          verticalement. La zone safe centrale (max-w-5xl ~ 64rem =
          1024 px sur desktop) reste libre. */}
      <div className="absolute inset-y-0 left-0 hidden w-[8%] flex-col items-center justify-around py-24 lg:flex">
        {leftLogos.map((ticker, idx) => (
          <LogoStatic key={`l-${ticker}-${idx}`} ticker={ticker} />
        ))}
      </div>

      {/* Colonne droite : miroir */}
      <div className="absolute inset-y-0 right-0 hidden w-[8%] flex-col items-center justify-around py-24 lg:flex">
        {rightLogos.map((ticker, idx) => (
          <LogoStatic key={`r-${ticker}-${idx}`} ticker={ticker} />
        ))}
      </div>
    </div>
  );
}

function LogoStatic({ ticker }: { ticker: string }) {
  return (
    <div
      className="relative h-12 w-12 lg:h-14 lg:w-14"
      style={{
        opacity: 0.06,
        filter: "invert(1) brightness(0.9) contrast(1.2)",
      }}
    >
      <img
        src={`/logos/${ticker}.png`}
        alt=""
        className="h-full w-full object-contain"
        loading="lazy"
        onError={(e) => {
          // Logo manquant : silently hide
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}
