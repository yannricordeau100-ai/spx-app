/**
 * ChartMiniLogo — wordmark "Mettrik AI" inséré DANS un SVG chart.
 *
 * Yann (12 mai 2026 v3) : utilise DIRECTEMENT le PNG /brand-mini-logo.png
 * (capture du vrai BrandWordmark home, 1424×270). Plus aucune tentative
 * de reproduction en SVG natif → garantit 100 % de fidélité avec le logo
 * de l'accueil, juste réduit.
 *
 * Le PNG est servi par Next.js depuis public/ et est public (cf proxy.ts
 * isPublicPath qui autorise .png).
 *
 * Marqué `data-chart-logo="small"` : capturé tel quel dans le PNG download.
 */
const LOGO_ASPECT = 1424 / 270; // ≈ 5.27

export function ChartMiniLogo({
  x,
  y,
  height = 18,
}: {
  /** Position X dans le viewBox du SVG parent (= bord droit du logo). */
  x: number;
  /** Position Y baseline du logo. */
  y: number;
  /** Hauteur cible en unités viewBox du SVG parent. */
  height?: number;
}) {
  const w = height * LOGO_ASPECT;
  return (
    <g data-chart-logo="small">
      <image
        href="/brand-mini-logo.png"
        x={x - w}
        y={y - height}
        width={w}
        height={height}
        preserveAspectRatio="xMaxYMid meet"
        style={{ imageRendering: "auto" }}
      />
    </g>
  );
}
