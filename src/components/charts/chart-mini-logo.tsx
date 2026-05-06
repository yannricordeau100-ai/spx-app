/**
 * ChartMiniLogo — wordmark "Mettrik AI" miniature inséré DANS un SVG chart.
 * Reproduit FIDÈLEMENT le BrandWordmark de la home (italique Fraunces 800,
 * gradient iridescent blanc → lilac → violet → cyan → rose), avec le 'i'
 * stylisé en barre violet→cyan + point violet (signature Mettrik).
 *
 * Différence avec home : pas d'animation (le PNG n'anime pas).
 *
 * Marqué `data-chart-logo="small"` : le bouton download exporte ce logo
 * tel quel dans le PNG.
 */
export function ChartMiniLogo({
  x,
  y,
  height = 14,
}: {
  x: number;
  y: number;
  /** Hauteur cible en unités viewBox du SVG parent (= cap height). */
  height?: number;
}) {
  // Approximation : font-size ≈ height × 1.15 (cap height ≈ 0.86em)
  const fontSize = Math.round(height * 1.15);
  // ID unique pour éviter collisions multi-charts.
  const idSuffix = `${Math.round(x * 100)}-${Math.round(y * 100)}`;
  const gradId = `mml-grad-${idSuffix}`;
  const barGradId = `mml-bar-${idSuffix}`;

  // Largeurs approximatives (italique 800) en unités font-size :
  //   "Mettr" ≈ 2.20em
  //   'i'     ≈ 0.32em (= largeur réservée pour la barre + dot)
  //   "k AI"  ≈ 1.95em
  // textAnchor middle pour centrer le wordmark sur (x, y).
  const totalW = fontSize * 4.47;
  const startX = x - totalW / 2;
  const baselineY = y;

  // Position du 'i' : après "Mettr" (2.20em) + half-width de la barre.
  const iX = startX + fontSize * 2.20;

  return (
    <g data-chart-logo="small">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#d8d8e4" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="78%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        {/* Barre du 'i' : gradient vertical violet→cyan, identique au home */}
        <linearGradient id={barGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* "Mettr" — partie gauche du wordmark */}
      <text
        x={startX}
        y={baselineY}
        textAnchor="start"
        fontFamily="var(--font-fraunces), Georgia, serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={fontSize}
        letterSpacing="-0.04em"
        fill={`url(#${gradId})`}
      >
        Mettr
      </text>

      {/* "k AI" — partie droite du wordmark, après le 'i' stylisé */}
      <text
        x={iX + fontSize * 0.32}
        y={baselineY}
        textAnchor="start"
        fontFamily="var(--font-fraunces), Georgia, serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={fontSize}
        letterSpacing="-0.04em"
        fill={`url(#${gradId})`}
      >
        k AI
      </text>

      {/* Barre verticale = corps du 'i' (violet → cyan) */}
      <rect
        x={iX + fontSize * 0.06}
        y={baselineY - fontSize * 0.62}
        width={fontSize * 0.12}
        height={fontSize * 0.62}
        rx={fontSize * 0.06}
        fill={`url(#${barGradId})`}
      />

      {/* Point violet au-dessus = "i-dot" signature Mettrik */}
      <circle
        cx={iX + fontSize * 0.12}
        cy={baselineY - fontSize * 0.78}
        r={fontSize * 0.13}
        fill="#a855f7"
      />
    </g>
  );
}
