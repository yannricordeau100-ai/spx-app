/**
 * ChartMiniLogo — wordmark "Mettrik AI" miniature inséré DANS un SVG chart.
 * Reproduit le style home (italique Fraunces 800, gradient iridescent
 * blanc → lilac → violet → cyan → rose), version SVG via <linearGradient>.
 *
 * Positionnement : juste sous la barre des onglets de fréquence (Trimestriel/
 * Annuel · 5/10/20 ans · A M S J H m s), centré sur la zone A M S etc.
 *
 * Marqué `data-chart-logo="small"` : ce flag est utilisé par
 * `downloadSvgAsPng()` pour le CACHER à l'export et le remplacer par un
 * watermark plus visible en haut-droite du PNG. Donc 1 seul logo visible
 * à la fois (live = mini coloré, PNG download = watermark plus grand).
 */
export function ChartMiniLogo({
  x,
  y,
  height = 14,
}: {
  x: number;
  y: number;
  /** Hauteur cible en unités viewBox du SVG parent. */
  height?: number;
}) {
  // Approximation : font-size ≈ height × 1.15 (cap height ≈ 0.86em)
  const fontSize = Math.round(height * 1.15);
  // ID unique pour éviter les collisions si plusieurs charts montés.
  const gradId = `mettrik-mini-logo-grad-${Math.round(x * 100)}-${Math.round(y * 100)}`;
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
      </defs>
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontFamily="var(--font-fraunces), Georgia, serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={fontSize}
        letterSpacing="-0.02em"
        fill={`url(#${gradId})`}
      >
        Mettrik<tspan fontWeight={400}>.</tspan>AI
      </text>
    </g>
  );
}
