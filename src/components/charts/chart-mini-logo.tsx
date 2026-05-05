/**
 * ChartMiniLogo — wordmark "Mettrik AI" miniature rendu DANS un SVG chart
 * (top-left), reproduit à petite échelle le BrandWordmark de la home :
 * italique Fraunces 800, gradient iridescent violet/cyan/rose.
 *
 * Marqué `data-chart-logo="small"` : ce flag est utilisé par
 * `downloadSvgAsPng()` pour le CACHER à l'export et le remplacer par un
 * watermark plus grand. Donc 1 seul logo visible à la fois (site OU
 * download), conformément à la demande Yann (5 mai 2026).
 *
 * Le composant rend un <g> SVG, à insérer DANS l'élément <svg> parent
 * (pas dans le DOM HTML).
 */
export function ChartMiniLogo({
  x,
  y,
  height = 14,
  gradientId,
}: {
  x: number;
  y: number;
  /** Hauteur cible en unités viewBox du SVG parent. */
  height?: number;
  /** Id unique du gradient (pour éviter collision si plusieurs instances). */
  gradientId: string;
}) {
  // Approximation : font-size ≈ height × 1.15 (cap height ≈ 0.86em)
  const fontSize = Math.round(height * 1.15);
  return (
    <g data-chart-logo="small">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#d8d8e4" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="78%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <text
        x={x}
        y={y}
        fontFamily="Georgia, serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={fontSize}
        letterSpacing="-0.04em"
        fill={`url(#${gradientId})`}
      >
        Mettrik AI
      </text>
    </g>
  );
}
