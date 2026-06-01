/**
 * ChartMiniLogo : icône Mettrik AI inline SVG, watermark discret sur les charts.
 *
 * Refonte Yann (31 mai 2026) : remplace le wordmark texte par le VRAI logo
 * Mettrik AI icône :
 *   - 3 lignes courbes ascendantes (gauche bas → droite haut), dégradé argenté
 *   - 1 trait horizontal court foncé (3e ligne, en bas)
 *   - 1 triangle équilatéral gradient violet→bleu→rose, pointe vers le haut,
 *     positionné à droite, "remplit" l'espace entre les courbes
 *
 * Marqué `data-chart-logo="small"` : capturé tel quel dans le PNG download.
 * Opacité globale faible pour ne pas dominer le chart.
 */

// Logo carré : ratio largeur / hauteur = 1
const LOGO_ASPECT = 1;

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
    <g
      data-chart-logo="small"
      transform={`translate(${x - w}, ${y - height})`}
      opacity={0.5}
    >
      <defs>
        <linearGradient id="chartMiniLogoLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E5E7EB" />
          <stop offset="100%" stopColor="#F9FAFB" />
        </linearGradient>
        <linearGradient id="chartMiniLogoTriGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>

      <svg
        x={0}
        y={0}
        width={w}
        height={height}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ligne 1 (haut) : longue courbe ascendante */}
        <path
          d="M 10 55 Q 50 50 90 18"
          stroke="url(#chartMiniLogoLineGrad)"
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          opacity={0.95}
        />

        {/* Ligne 2 (milieu) : courbe parallèle plus courte */}
        <path
          d="M 10 70 Q 45 65 75 42"
          stroke="url(#chartMiniLogoLineGrad)"
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />

        {/* Ligne 3 (bas) : trait horizontal court foncé */}
        <line
          x1={15}
          y1={88}
          x2={65}
          y2={88}
          stroke="#374151"
          strokeWidth={7}
          strokeLinecap="round"
          opacity={0.9}
        />

        {/* Triangle gradient violet/bleu/rose, pointe vers le haut */}
        <polygon
          points="78,68 90,55 90,78"
          fill="url(#chartMiniLogoTriGrad)"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={0.5}
        />
      </svg>
    </g>
  );
}
