"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { AnomalyInfo } from "@/components/anomaly-info";
import type { Anomaly } from "@/lib/brand";
import { formatUnit } from "@/lib/data";
import type { CompanyEvent } from "@/lib/events";
import { EventDotsSVG, EventDotsOverlay } from "@/components/charts/event-dots";
import { buildYearGroups } from "@/lib/chart-export";
import { ChartMiniLogo } from "@/components/charts/chart-mini-logo";
import { chartAxisHeader, isCurrencyLikeUnit } from "@/lib/chart-axis-header";
import { translateUnitFrToEn } from "@/lib/i18n/unit-translations";
import { useT } from "@/lib/i18n/provider";

// Yann 13 mai 2026 v4 : helpers axisHeader/isCurrency centralisés dans
// `@/lib/chart-axis-header` (DRY, partagés avec bars-chart + bars-3d).
// Anciennement dupliqués dans 3 fichiers, ce qui causait des oublis lors
// des updates.
const axisHeader = chartAxisHeader;
const isCurrencyLike = isCurrencyLikeUnit;
function isPercentLike(unit: string): boolean {
  return ["%", "% YoY"].includes(unit);
}

/** Same niceTicks helper as bars-chart : rounds step to 1/2/5×magnitude. */
function niceTicks(min: number, max: number, count = 5): number[] {
  if (max === min) return [min];
  const range = max - min;
  const roughStep = range / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  let step;
  if (normalized < 1.5) step = 1;
  else if (normalized < 3) step = 2;
  else if (normalized < 7) step = 5;
  else step = 10;
  step *= magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 1000; v += step) {
    out.push(Math.round(v * 1e6) / 1e6);
  }
  return out;
}

/**
 * Yann 14 mai 2026 : format label des data points ADAPTATIF à la magnitude.
 *
 * Bug à corriger : Math.round(0.41) = 0 → tous les points Tesla affichaient
 * "0" alors que les vraies valeurs étaient 0.3-0.5 (M units / véhicules).
 *
 * Règle universelle (marche sur TOUTES les stés actuelles et futures) :
 *   - dataMax < 1   → 2 décimales (ex Tesla M units 0,41)
 *   - dataMax < 10  → 1 décimale (ex marges %, ratios)
 *   - dataMax < 100 → 1 décimale (ex EPS $)
 *   - dataMax >= 100 → entier (Mds $, revenus)
 */
function formatDataPointLabel(v: number, dataMax: number): string {
  if (!Number.isFinite(v)) return "—";
  let decimals: number;
  if (Math.abs(dataMax) < 1) decimals = 2;
  else if (Math.abs(dataMax) < 100) decimals = 1;
  else decimals = 0;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals > 0 ? 1 : 0 });
}

/**
 * Format Y-axis tick value following Mettrik's strict rule (CLAUDE.md §6) :
 *   - currency-like ("$B", "$M", "B", "M") → integer values only, FR locale
 *   - percent-like ("%", "% YoY") → 1 decimal max, FR locale
 *   - other → 1 decimal max, FR locale
 *
 * Yann 15 mai 2026 : paramètre `decimals` ajouté pour forcer la précision
 * (utilisé par pickYTickDecimals quand le rounding integer crée des doublons
 * style "27, 28, 29, 29, 30" sur les ranges étroits).
 */
function formatYTick(v: number, unit: string, decimals?: number): string {
  if (decimals !== undefined) {
    return v.toLocaleString("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  // Yann 14 mai 2026 : fallback adaptatif si la valeur tick est < 1
  // (ex Tesla M units 0,1 0,2 0,3) on garde la décimale au lieu d'écrire "0".
  if (isCurrencyLike(unit)) {
    if (Math.abs(v) < 1 && v !== 0) {
      return (Math.round(v * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    }
    return Math.round(v).toLocaleString("fr-FR");
  }
  if (isPercentLike(unit)) {
    return (Math.round(v * 10) / 10).toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    });
  }
  return (Math.round(v * 10) / 10).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}

/**
 * Yann 15 mai 2026 : calcule combien de décimales utiliser pour les ticks Y
 * afin d'éviter les doublons après rounding. Ex META DAP range [27.4, 29.2]
 * → ticks [27.5, 28, 28.5, 29, 29.5] → integer = [28, 28, 29, 29, 30] (doublons).
 * On bascule à 1 décimale dans ce cas → [27,5, 28, 28,5, 29, 29,5].
 */
function pickYTickDecimals(tickValues: number[], unit: string): number | undefined {
  if (!isCurrencyLike(unit)) return undefined; // % et autres gardent leur logique
  // Test : si arrondi entier crée doublons, on monte à 1 décimale.
  const intRounded = tickValues.map((v) => Math.round(v));
  if (new Set(intRounded).size < tickValues.length) {
    // Test 1 décimale : si toujours doublons, monte à 2 (rare).
    const d1Rounded = tickValues.map((v) => Math.round(v * 10) / 10);
    if (new Set(d1Rounded).size < tickValues.length) return 2;
    return 1;
  }
  return undefined; // integer default OK
}

const W = 920;
const H = 420;
const PAD_LEFT = 96;
// PAD_RIGHT = 95 (vs 70 avant) pour garantir qu'aucun label X (ex : "TTM"
// italique 13-14px) ne soit coupé par le bord droit du SVG, sur tous les
// viewports (mobile narrow, conteneurs avec overflow hidden, etc.)
const PAD_RIGHT = 95;
const PAD_TOP = 40;
const PAD_BOTTOM = 90;

/**
 * Split d'un label trimestriel "T1 21" → { top: "T1", bottom: "21" }.
 * Mêmes specs que dans bars-3d-variants.tsx (template uniforme).
 */
function splitQuarterLabel(label: string): { top: string; bottom: string; isQuarter: boolean } {
  if (!label) return { top: "", bottom: "", isQuarter: false };
  const m = label.match(/^(T[1-4])\s+(\d{2,4})$/);
  if (m) return { top: m[1], bottom: m[2], isQuarter: true };
  return { top: label, bottom: "", isQuarter: false };
}
const DX = 22;          // 3D depth offset (rightward)
const DY = -14;         // 3D depth offset (upward in SVG)

/**
 * Curve chart — promoted from chart-lab "Neon Wire 3D" :
 *   - Front curve : color stroke with strong glow filter, white core on top
 *   - Back curve : offset by (DX, DY), dimmer glow, gives 3D depth
 *   - Wall under the front curve : faint color gradient down to baseline
 *   - Connector lines from each year point front → back (depth ticks)
 *   - Glowing pulsating nodes at each data point
 *   - Faint horizontal grid behind everything
 *
 * Y-axis ticks follow Mettrik's strict format rule : integer for currency,
 * 1 decimal max for percent, FR locale.
 */
export function CurveChart({
  data,
  labels,
  unit,
  color = "#a78bfa",
  anomalies = [],
  events = [],
  ttm = null,
  ttmLabel = "TTM",
  exportTitle,
  exportTicker,
  exportCagr,
  exportFrequency,
  exportInterpretation,
  titleLocale,
}: {
  data: number[];
  labels: string[];
  unit: string;
  color?: string;
  anomalies?: Anomaly[];
  events?: CompanyEvent[];
  /** Trailing 12 months : point + segment pointillé en fin de courbe. */
  ttm?: number | null;
  ttmLabel?: string;
  /** Titre injecté DANS le PNG exporté (KPI name_fr). Pas affiché live (= titre HTML déjà visible côté parent). */
  exportTitle?: string;
  /** Ticker injecté dans le PNG exporté → logo société à droite du titre. */
  exportTicker?: string;
  /** Yann 10 juin 2026 (Point 3) : CAGR annualisé déjà formaté (ex "CAGR
   *  +47,8 %/an"), affiché sous le titre dans le PNG. Locale-aware côté
   *  appelant (company-view). */
  exportCagr?: string;
  /** Yann 8 juin 2026 (PRIO 3) : suffixe fréquence "par x" déjà localisé
   *  (ex "par mois"), fourni UNIQUEMENT quand la fréquence ≠ année. Transmis
   *  tel quel à l'export pour styler ce segment du sous-titre (2 pts plus
   *  petit, bleu-violet, opacité 0.85). Le suffixe est déjà inclus dans
   *  exportTitle ; cette prop sert uniquement à le localiser pour le style. */
  exportFrequency?: string;
  /** Yann 10 juin 2026 : lead de l'interprétation IA (1 phrase, texte brut
   *  strippé HTML), même langue que le titre exporté. Posé en data-export-*
   *  pour rendu SOUS le graph dans le PNG. */
  exportInterpretation?: string;
  /** Yann 8 juin 2026 (Point 4) : override locale axe Y depuis KpiSwapTitle.
   *  'en' force la traduction des mots d'echelle (Mds -> Bn) ET des unites
   *  textuelles non monetaires (unites -> units, abonnes -> subscribers, etc).
   *  Les unites monetaires ($/EUR/etc) restent inchangees. Si undefined,
   *  l'axe Y suit la locale globale de l'app. */
  titleLocale?: "fr" | "en";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Yann 15 mai 2026 : axis header locale-aware (DE / NL / SV / DA / EN).
  const { locale } = useT();
  // Yann 8 juin 2026 (Point 4) : si KpiSwapTitle a bascule le titre en EN,
  // l'axe Y suit. Sinon on garde la locale globale.
  const effectiveLocale = titleLocale === "en" ? "en" : locale;
  // Yann 15 mai 2026 : click sur la zone axe Y → toggle gauche / droite.
  const [yOnRight, setYOnRight] = useState(false);

  // Garde-fou : si pas de data utilisable, ne rien afficher au lieu de crasher.
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  // Étend data + labels avec TTM si fourni. Le dernier point est rendu
  // en pointillé pour signaler "12 derniers mois" (pas une année calendaire).
  // Yann 15 mai 2026 : si TTM est un OUTLIER (somme cumulée 4Q >> max
  // périodes affichées), on ne le render PAS sur le chart pour éviter la
  // courbe pointillée qui sort par le haut + le X label "TTM" orphelin.
  // Le TTM cumul est alors affiché comme chip séparé sous le chart.
  const rawHasTTM = ttm != null && Number.isFinite(ttm);
  const dataOnlyMaxRaw = data.length > 0 ? Math.max(...data) : 0;
  const ttmIsCumul = rawHasTTM && (ttm as number) > dataOnlyMaxRaw * 2;
  const hasTTM = rawHasTTM && !ttmIsCumul;
  const allData = hasTTM ? [...data, ttm as number] : data;
  const allLabels = hasTTM ? [...labels, ttmLabel] : labels;
  const ttmIndex = hasTTM ? allData.length - 1 : -1;
  const yearGroups = buildYearGroups(allLabels);

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  // Y-axis adaptive (Yann 13 mai 2026 v3) :
  //   1. La heuristique de zoom est calculée sur `data` SEUL (sans TTM).
  //      TTM est souvent un cumul (somme 4Q) qui explose la range et fausse
  //      le calcul. Ex AAPL Services Revenue : data 19-24, ttm 112.
  //   2. Seuil abaissé : zoom si range < 40 % de dataMax pour montrer la
  //      tendance même sur des croissances faibles.
  //   3. Si TTM est un OUTLIER (> 2x dataMax), on l'EXCLUT aussi du dataMax
  //      (sinon Y axis irait jusqu'à TTM → graph plat). Le point TTM serait
  //      alors hors-graph, ce qui est attendu pour les TTM cumul.
  //   4. Si TTM est dans la range (= vrai dernier quarter), on l'inclut.
  const dataOnlyMax = Math.max(...data);
  const dataOnlyMin = Math.min(...data);
  const dataOnlyRange = dataOnlyMax - dataOnlyMin;
  const useDataMin =
    dataOnlyMin > 0 && dataOnlyRange < dataOnlyMax * 0.4;
  // TTM-cumul detection : si TTM > 2x dataMax (= ce n'est pas un point
  // périodique mais un total), on l'exclut de la range Y.
  const ttmIsOutlier = hasTTM && (ttm as number) > dataOnlyMax * 2;
  const dataMaxRaw = ttmIsOutlier ? dataOnlyMax : Math.max(...allData);
  const dataMin = useDataMin ? dataOnlyMin : Math.min(0, ...allData);
  const dataMax = dataMaxRaw;
  const tickValues = niceTicks(dataMin, dataMax, 5);
  const min = Math.min(...tickValues, dataMin);
  const max = Math.max(...tickValues, dataMax);
  const range = max - min || 1;
  // Densité crowded : > 12 points -> labels sur 2 lignes horizontales
  // (T1/T2/T3/T4 ligne 1, année ligne 2). Rotation -45° rejetée par Yann.
  const isCrowded = allData.length > 12;
  const xLabelFontSize = isCrowded ? 13 : 14;
  const baselineY = PAD_TOP + innerH;

  const stepX = allData.length > 1 ? innerW / (allData.length - 1) : innerW;
  const points = allData.map((v, i) => [
    PAD_LEFT + i * stepX,
    PAD_TOP + ((max - v) / range) * innerH,
  ] as const);

  const u = formatUnit(unit);
  // Yann 8 juin 2026 (Point 4) : si KpiSwapTitle force EN, l'axe Y traduit
  // les mots d'echelle via la locale 'en' (Mds -> Bn) et les unites
  // textuelles non monetaires via translateUnitFrToEn (unites -> units, etc).
  // Les symboles monetaires ($/EUR/etc) restent inchanges.
  const headerUnit = titleLocale === "en" ? translateUnitFrToEn(unit) : unit;
  const header = axisHeader(headerUnit, effectiveLocale);

  const ticks = tickValues.map((v) => ({
    v,
    y: PAD_TOP + ((max - v) / range) * innerH,
  }));
  // Yann 15 mai 2026 : précision adaptative pour éviter doublons type "29, 29".
  const tickDecimals = pickYTickDecimals(tickValues, unit);

  // Smoothed paths : front curve and back-offset curve.
  function smoothFrom(pts: readonly (readonly [number, number])[]) {
    return pts
      .map(([x, y], i) => {
        if (i === 0) return `M ${x},${y}`;
        const [px, py] = pts[i - 1];
        const cx = (px + x) / 2;
        return `Q ${cx},${py} ${x},${y}`;
      })
      .join(" ");
  }

  const frontPath = smoothFrom(points);
  const backPts = points.map(([x, y]) => [x + DX, y + DY] as const);
  const wallPath = `${frontPath} L ${points[points.length - 1][0]},${baselineY} L ${points[0][0]},${baselineY} Z`;

  const anomalyByIndex = new Map(anomalies.map((a) => [a.index, a]));

  const idGlow = `cv-glow-${color.slice(1)}`;
  const idWall = `cv-wall-${color.slice(1)}`;

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        width="100%"
        height="auto"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible" }}
        // Yann 8 juin 2026 : marqueurs lus par le bouton télécharger DÉPLACÉ
        // dans la barre d'onglets (ChartCycleControls). Le bouton récupère le
        // SVG visible via [data-chart-export] et les options d'export ici.
        // Un seul chart est monté à la fois (AnimatePresence mode="wait").
        data-chart-export="true"
        data-export-prefix="curve"
        data-export-title={exportTitle || ""}
        data-export-ticker={exportTicker || ""}
        data-export-cagr={exportCagr || ""}
        data-export-frequency={exportFrequency || ""}
        data-export-interpretation={exportInterpretation || ""}
        data-export-locale={effectiveLocale || ""}
      >
      {/* Header d'unité dans le SVG (au-dessus de l'axe Y) pour qu'il
          apparaisse aussi dans l'export PNG. Demande Yann 5 mai 2026.
          Yann 15 mai 2026 : aligne sur la position de l'axe (gauche/droite).
          Yann 2 juin 2026 : repositionné juste au-dessus du premier tick Y
          (PAD_TOP - 14), légèrement à gauche de l'axe, aligné fin
          (textAnchor=end) pour coller à la zone des tick labels. Cohérent
          web + PNG download. */}
      {header && (
        <text
          x={yOnRight ? PAD_LEFT + innerW + 20 : PAD_LEFT - 20}
          y={PAD_TOP - 24}
          fontSize={13}
          fontWeight={600}
          fill="#e4e4e7"
          fontFamily="ui-monospace, monospace"
          textAnchor={yOnRight ? "start" : "end"}
        >
          {header}
        </text>
      )}
      {/* Yann 16 mai 2026 : TTM cumul affiché comme chip séparé.
          Position OPPOSÉE au mini-logo MettrikAI (qui est top-right par
          défaut, top-left si yOnRight). Évite la superposition observée
          quand TTM-cumul et mini-logo se chevauchaient. */}
      {ttmIsCumul && rawHasTTM && (() => {
        // yOnRight=false → mini-logo top-right → TTM chip top-LEFT
        // yOnRight=true  → mini-logo top-left  → TTM chip top-RIGHT
        const chipX = yOnRight ? W - PAD_RIGHT - 130 : PAD_LEFT + 10;
        return (
          <g>
            <rect
              x={chipX}
              y={8}
              width={120}
              height={24}
              rx={6}
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.12)"
            />
            <text
              x={chipX + 8}
              y={24}
              fontSize={11}
              fontFamily="ui-monospace, monospace"
              fill="#a1a1aa"
            >
              TTM&nbsp;
              <tspan fill="#e4e4e7" fontWeight={600}>
                {(ttm as number).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
              </tspan>
              <tspan fill="#a1a1aa">&nbsp;{formatUnit(unit)}</tspan>
            </text>
          </g>
        );
      })()}
        <defs>
          <filter id={idGlow} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <linearGradient id={idWall} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          {/* Gradient horizontal violet → couleur sté → cyan pour le trait principal */}
          <linearGradient id={`${idGlow}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor={color} />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {/* Y guidelines (gridlines horizontales pointillées).
            data-export-role="gridline" → recolorées dans le PNG selon thème. */}
        {ticks.map(({ y }, i) => (
          <line
            key={`gl-${i}`}
            data-export-role="gridline"
            x1={PAD_LEFT}
            x2={PAD_LEFT + innerW}
            y1={y}
            y2={y}
            stroke="#1a1a1a"
            strokeWidth={1}
            strokeDasharray="3 6"
          />
        ))}

        {/* Y-axis labels — strict Mettrik formatting + taille agrandie.
            Yann 15 mai 2026 : x + textAnchor selon le côté actif. */}
        {ticks.map(({ v, y }, i) => (
          <text
            key={`yn-${i}`}
            x={yOnRight ? PAD_LEFT + innerW + 20 : PAD_LEFT - 20}
            y={y + 5}
            textAnchor={yOnRight ? "start" : "end"}
            fontSize={16}
            fontWeight={500}
            fill="#e4e4e7"
            fontFamily="ui-monospace, monospace"
          >
            {formatYTick(v, unit, tickDecimals)}
          </text>
        ))}

        {/* Zone cliquable invisible sur l'axe Y pour toggler gauche/droite.
            Couvre les ticks labels + le header. Yann 15 mai 2026. */}
        <rect
          x={yOnRight ? PAD_LEFT + innerW : 0}
          y={0}
          width={yOnRight ? W - (PAD_LEFT + innerW) : PAD_LEFT}
          height={H}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onClick={() => setYOnRight((v) => !v)}
        >
          <title>Cliquer pour basculer l&apos;axe Y à {yOnRight ? "gauche" : "droite"}</title>
        </rect>

        {/* Wall under front curve */}
        <motion.path
          d={wallPath}
          fill={`url(#${idWall})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        />

        {/* Back curve (3D depth cue) — masqué dans le PNG export (plat). */}
        <motion.path
          data-export-hide="true"
          d={smoothFrom(backPts)}
          fill="none"
          stroke={color}
          strokeOpacity="0.55"
          strokeWidth={2}
          strokeLinecap="round"
          filter={`url(#${idGlow})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.3 }}
        />

        {/* Front curve — halo coloré large (style ruban holographique, Yann 12 mai 2026) */}
        <motion.path
          d={frontPath}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeOpacity={0.45}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${idGlow})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4 }}
        />
        {/* Front curve — trait principal en gradient violet → couleur → cyan */}
        <motion.path
          d={frontPath}
          fill="none"
          stroke={`url(#${idGlow}-stroke)`}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4 }}
        />
        {/* Front curve — core blanc fin pour effet "light beam" */}
        <motion.path
          d={frontPath}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.85}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4 }}
        />

        {/* Points lumineux glissants le long du trait (Yann 13 mai 2026).
            3 photons décalés qui parcourent la courbe en boucle, effet "flux
            de données vivant". SVG <animateMotion> natif → ultra léger CPU. */}
        <path id={`${idGlow}-motionpath`} d={frontPath} fill="none" stroke="none" />
        {[0, 0.33, 0.66].map((delay, i) => (
          <g key={`photon-${i}`}>
            {/* Halo extérieur du photon */}
            <circle r={6} fill={color} opacity={0.35} filter={`url(#${idGlow})`}>
              <animateMotion dur="4s" repeatCount="indefinite" begin={`${delay * 4}s`}>
                <mpath href={`#${idGlow}-motionpath`} />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;0.4;0.4;0"
                keyTimes="0;0.1;0.9;1"
                dur="4s"
                begin={`${delay * 4}s`}
                repeatCount="indefinite"
              />
            </circle>
            {/* Core blanc brillant */}
            <circle r={2} fill="#ffffff">
              <animateMotion dur="4s" repeatCount="indefinite" begin={`${delay * 4}s`}>
                <mpath href={`#${idGlow}-motionpath`} />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.08;0.92;1"
                dur="4s"
                begin={`${delay * 4}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}

        {/* Depth-tick connectors at each data point — forment le "carré 3D"
            autour de chaque point. Masqués dans le PNG export (plat). */}
        {points.map(([x, y], i) => (
          <line
            key={`c-${i}`}
            data-export-hide="true"
            x1={x}
            y1={y}
            x2={x + DX}
            y2={y + DY}
            stroke={color}
            strokeOpacity="0.4"
            strokeWidth={1}
          />
        ))}

        {/* Segment pointillé entre dernier point calendaire et TTM (si présent) */}
        {hasTTM && points.length >= 2 && (() => {
          const last = points[points.length - 1];
          const prev = points[points.length - 2];
          return (
            <line
              x1={prev[0]}
              y1={prev[1]}
              x2={last[0]}
              y2={last[1]}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeLinecap="round"
              opacity={0.7}
            />
          );
        })()}

        {/* Year nodes (+ TTM dot stylé différemment) */}
        {points.map(([x, y], i) => {
          const isHover = hover === i;
          const isAnomaly = anomalyByIndex.has(i);
          const isTTM = i === ttmIndex;
          return (
            <g
              key={`n-${i}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(i)}
              onClick={() => setHover((prev) => (prev === i ? null : i))}
              style={{ cursor: "pointer", opacity: isTTM ? 0.8 : 1, touchAction: "manipulation" }}
            >
              {isTTM ? (
                /* TTM : cercle creux pointillé (vs cercle plein pour années) */
                <circle cx={x} cy={y} r={isHover ? 9 : 7} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 2" />
              ) : (
                <>
                  <circle cx={x} cy={y} r={isHover ? 11 : 8} fill={color} fillOpacity={0.55} filter={`url(#${idGlow})`} />
                  <circle cx={x} cy={y} r={isHover ? 4 : 2.8} fill="#ffffff" />
                </>
              )}
              {isAnomaly && (
                <circle
                  cx={x}
                  cy={y}
                  r={6}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              )}
              {(() => {
                // Quarter only sur l'axe X (T1/T2/T3/T4). Year est rendu UNE
                // SEULE FOIS via le year-band en bas (cf. yearGroups.map).
                const split = splitQuarterLabel(allLabels[i] ?? "");
                const yQuarter = H - PAD_BOTTOM + 26;
                const fz = xLabelFontSize;
                const fill = isTTM ? "#a1a1aa" : "#e4e4e7";
                const fw = isTTM ? 500 : 600;
                return (
                  <text
                    x={x}
                    y={yQuarter}
                    textAnchor="middle"
                    fontSize={fz}
                    fill={fill}
                    fontFamily="ui-monospace, monospace"
                    fontWeight={fw}
                    fontStyle={isTTM ? "italic" : "normal"}
                    style={isTTM ? { cursor: "help" } : undefined}
                  >
                    {split.top}
                    {isTTM && (
                      <title>TTM = Trailing Twelve Months : les 12 derniers mois publiés (4 derniers trimestres connus). Permet de voir la tendance la plus récente sans attendre la clôture annuelle.</title>
                    )}
                  </text>
                );
              })()}
              {/* Valeur au-dessus de CHAQUE point (toujours visible). En mode
                  crowded on alterne up/down pour éviter chevauchements.
                  Yann 16 mai 2026 : TTM aussi affiche sa valeur (gris italique
                  pour rester visuellement distinct des points FY) — sinon
                  l'investisseur ne sait pas combien vaut le TTM.
                  Yann 21 mai 2026 : valeurs négatives → label SOUS le dot pour
                  éviter chevauchement avec la courbe (la courbe remonte
                  fortement depuis un creux). Si dot trop proche du min de la
                  zone chart (dans les 20% bas), on bascule aussi en dessous. */}
              {(() => {
                const v = Number(allData[i]);
                const isNegative = v < 0;
                // Distance entre le dot et le bas de la zone chart (y=baselineY).
                // Si dot dans les 20 % bas du chart, on évite de mettre le label
                // au-dessus (souvent croisé par la courbe qui remonte).
                const nearBottom = (baselineY - y) < (innerH * 0.2);
                const placeBelow = isNegative || nearBottom;
                // y position : sous le dot mais au-dessus de l'axe X (y=baselineY+10
                // donne ~10px sous le dot, encore 16px de marge avant les labels X
                // à baselineY+26).
                const yLabel = placeBelow
                  ? Math.min(y + 18, baselineY + 12)
                  : (isCrowded ? (i % 2 === 0 ? y - 14 : y - 26) : y - 18);
                return (
                  <text
                    x={x}
                    y={yLabel}
                    textAnchor="middle"
                    fontSize={isCrowded ? 11 : 14}
                    fontWeight={isTTM ? 500 : (isHover ? 800 : 600)}
                    fill={isTTM ? "#a1a1aa" : (isHover ? "#fafafa" : "#d4d4d8")}
                    fontStyle={isTTM ? "italic" : "normal"}
                    fontFamily="ui-monospace, monospace"
                    style={isHover ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
                  >
                    {formatDataPointLabel(v, dataOnlyMax)}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Points de curiosité (événements clefs) sur l'axe X.
            Yann 19 mai 2026 : dotYOffset positif → dot SOUS le label année
            (yText = H - PAD_BOTTOM + 60 dans curve, donc offset 72 met le
            dot ~12 px sous le texte de l'année). Annuel + trimestriel. */}
        <EventDotsSVG
          events={events}
          xLabels={labels}
          padLeft={PAD_LEFT}
          innerW={innerW}
          padTop={PAD_TOP}
          innerH={innerH}
          color={color}
          dotYOffset={72}
        />

        {/* Year band : 1 année = 1 bracket sous l'axe X. L'année apparaît
            UNE seule fois par groupe de quarters consécutifs. */}
        {yearGroups.map((g) => {
          const xStart = points[g.startIdx]?.[0] ?? 0;
          const xEnd = points[g.endIdx]?.[0] ?? 0;
          const yLine = H - PAD_BOTTOM + 46;
          const yText = H - PAD_BOTTOM + 60;
          const tickH = 4;
          const single = g.startIdx === g.endIdx;
          const yearFull = g.year.length === 2 ? `20${g.year}` : g.year;
          return (
            <g key={`yg-${g.startIdx}`}>
              {!single && (
                <>
                  <line data-export-role="structure" x1={xStart} y1={yLine} x2={xEnd} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                  <line data-export-role="structure" x1={xStart} y1={yLine - tickH} x2={xStart} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                  <line data-export-role="structure" x1={xEnd} y1={yLine - tickH} x2={xEnd} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                </>
              )}
              <text
                x={(xStart + xEnd) / 2}
                y={yText}
                textAnchor="middle"
                fontSize={13}
                fill="#a1a1aa"
                fontFamily="ui-monospace, monospace"
                fontWeight={500}
              >
                {yearFull}
              </text>
            </g>
          );
        })}

        {/* Yann (1er juin 06:00) : mini-logo Mettrik retiré de l'affichage web.
            Le logo apparaît uniquement sur la version téléchargée (watermark
            grand format via chart-export.ts → Powered by [logo combiné]). */}
      </svg>

      {/* Yann 8 juin 2026 : bouton télécharger DÉPLACÉ dans la barre d'onglets
          (ChartCycleControls, au-dessus du titre). Il récupère ce SVG via
          [data-chart-export] + les options data-export-* posées ci-dessus. */}
      {/* Overlay HTML pour les popovers d'événements (clic sur point) */}
      <EventDotsOverlay
        events={events}
        xLabels={labels}
        svgW={W}
        svgH={H}
        padLeft={PAD_LEFT}
        innerW={innerW}
        padTop={PAD_TOP}
        innerH={innerH}
        color={color}
        dotYOffset={72}
      />

      {/* Yann 14 mai 2026 : bloc anomalies bottom retiré (les 'i' flottants
          en bas du chart faisaient mauvais effet). Les anomalies restent
          marquées visuellement par le cercle pointillé autour du point
          concerné (cf isAnomaly dans points.map). */}
    </div>
  );
}
