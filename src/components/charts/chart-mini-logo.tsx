/**
 * ChartMiniLogo — wordmark "Mettrik AI" miniature inséré DANS un SVG chart.
 *
 * Yann (12 mai 2026) v2 : refonte propre. Avant on essayait de simuler
 * la barre du 'i' du BrandWordmark home en SVG → rendu "éclaté" (mauvais
 * spacing, mauvais font, barre mal placée). Maintenant : 1 seul `<text>`
 * avec gradient iridescent identique au home + petit point violet
 * au-dessus du 'i' (signature Mettrik subtile, pas de barre artificielle).
 *
 * Reproduit le BrandWordmark home : Instrument Serif italic 800,
 * gradient blanc → lilac → violet → cyan → rose.
 *
 * Marqué `data-chart-logo="small"` : capturé dans le PNG download.
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
  const fontSize = Math.round(height * 1.15);
  const idSuffix = `${Math.round(x * 100)}-${Math.round(y * 100)}`;
  const gradId = `mml-grad-${idSuffix}`;

  return (
    <g data-chart-logo="small">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#d8d8e4" />
          <stop offset="65%" stopColor="#a855f7" />
          <stop offset="85%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>

      <text
        x={x}
        y={y}
        textAnchor="end"
        fontFamily="var(--font-instrument), 'Bricolage Grotesque', Georgia, serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={fontSize}
        letterSpacing="-0.02em"
        fill={`url(#${gradId})`}
      >
        Mettrik AI
      </text>
    </g>
  );
}
