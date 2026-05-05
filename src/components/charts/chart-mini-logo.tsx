/**
 * ChartMiniLogo — wordmark "Mettrik.AI" miniature inséré DANS un SVG chart
 * (top-left). Reproduit le style home (italique Fraunces 800) mais en
 * monochrome (zinc gris) sur le site live, conformément à la demande
 * Yann (5 mai 2026 : "couleur comme la version précédente, pas de couleur").
 *
 * Marqué `data-chart-logo="small"` : ce flag est utilisé par
 * `downloadSvgAsPng()` pour le CACHER à l'export et le remplacer par un
 * watermark plus visible et coloré (gradient iridescent home-style),
 * positionné en haut-droite du PNG. Donc 1 seul logo visible à la fois.
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
  return (
    <text
      data-chart-logo="small"
      x={x}
      y={y}
      fontFamily="Georgia, serif"
      fontStyle="italic"
      fontWeight={800}
      fontSize={fontSize}
      letterSpacing="-0.02em"
      fill="#a1a1aa"
      fillOpacity={0.7}
    >
      Mettrik<tspan fontWeight={400} fill="#a1a1aa" fillOpacity={0.55}>.</tspan>AI
    </text>
  );
}
