"use client";

import { useRef, useState } from "react";
import type { CompanyEvent } from "@/lib/events";
import { EventDotsSVG, EventDotsOverlay } from "@/components/charts/event-dots";
import { buildYearGroups } from "@/lib/chart-export";
import { ChartMiniLogo } from "@/components/charts/chart-mini-logo";

/**
 * Essais bars 3D / iso (B26-B27) inspirés freepik isométrique.
 * Drop-in : même API que les autres bars charts.
 */

/** Header d'unité (Yann 13 mai 2026 v4 : centralisé dans chart-axis-header). */
import { chartAxisHeader } from "@/lib/chart-axis-header";
import { translateUnitEnToFr, translateUnitFrToEn } from "@/lib/i18n/unit-translations";
import { useT } from "@/lib/i18n/provider";
const axisHeader = chartAxisHeader;

import { formatChartValueLabel } from "@/lib/chart-label-format";
import { calculeEnteteAxe } from "@/lib/entete-axe";

/** Yann 19 juil 2026 : format label barre unifié via helper commun
 *  (compact k/M/Md, % préservé, adaptatif petits nombres). */
const formatBarLabel = (v: number, dataMax: number, unit?: string, locale?: string, serieEntiere?: boolean) =>
  formatChartValueLabel(v, dataMax, unit, locale, serieEntiere);

const W = 920, H = 420;
// PAD_RIGHT = 95 (vs 70 avant) pour garantir aucun clipping du label TTM
// horizontal (sinon coupé par le bord droit du SVG en mode crowded).
// Yann 8 août 2026 : plot élargi gauche+droite (96/95 -> 76/58) pour réduire
// le vide et agrandir les barres/labels. Les ticks Y (ancrés end à
// PAD_LEFT-20) et le label TTM (déport DX/2) restent dans le cadre.
const PAD_LEFT = 54, PAD_RIGHT = 58, PAD_TOP = 40, PAD_BOTTOM = 90;
// Yann 25 aout 2026 : quand l axe Y est bascule a DROITE, l en-tete d unite
// etait ancre "start" a PAD_LEFT + INNER_W + 20. Un libelle long
// ("B Subscriptions") sortait alors du SVG et se retrouvait coupe net. Il est
// desormais ancre "end" sur le bord droit du cadre : quelle que soit sa
// longueur il reste a l interieur, et il est rendu au-dessus du plot donc il
// ne peut chevaucher aucune barre.

/**
 * Split d'un label trimestriel "T1 21" → { top: "T1", bottom: "21" }.
 * - "T1 21" → { top: "T1", bottom: "21" } (rendu sur 2 lignes)
 * - "TTM"   → { top: "TTM", bottom: "" }  (1 ligne, pas de year)
 * - "2024"  → { top: "2024", bottom: "" } (label année simple, pas split)
 * Permet aux charts d'afficher quarter sur ligne 1 + year sur ligne 2 sans
 * rotation -45° (rejetée par Yann le 4 mai 2026 = doit rester horizontal).
 */
function splitQuarterLabel(label: string): { top: string; bottom: string; isQuarter: boolean } {
  if (!label) return { top: "", bottom: "", isQuarter: false };
  // Yann 17 juil 2026 (screen AAPL EN) : accepter aussi le préfixe "Q" (titre
  // du graph basculé EN) : sinon les 20 labels "Q1 21" s'affichent en entier
  // et se chevauchent au lieu d'être scindés trimestre / bande d'année.
  const m = label.match(/^([TQ][1-4]|[SH][12])\s+(\d{2,4})$/);
  if (m) return { top: m[1], bottom: m[2], isQuarter: true };
  return { top: label, bottom: "", isQuarter: false };
}
const INNER_W = W - PAD_LEFT - PAD_RIGHT;
const INNER_H = H - PAD_TOP - PAD_BOTTOM;

function niceTicks(min: number, max: number, count = 5): number[] {
  if (max === min) return [min];
  const range = max - min;
  const roughStep = range / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  let step = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  step *= magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 1000; v += step) {
    out.push(Math.round(v * 1e6) / 1e6);
  }
  return out;
}

type Props = {
  data: number[];
  labels: string[];
  unit?: string;
  color?: string;
  events?: CompanyEvent[];
  /** Trailing 12 months : barre supplémentaire à la fin si fourni. */
  ttm?: number | null;
  /** Label sous la barre TTM. Default "TTM". */
  ttmLabel?: string;
  /** Style visuel : iso3d (par défaut, perspective isométrique) ou classique 2D. */
  variant?: "iso3d" | "classic";
  /** Yann 3 sept 2026 : 1 = toutes les valeurs, 2 = une sur deux (la plus recente masquee). */
  labelStep?: 1 | 2;
  onToggleLabels?: () => void;
  /** Titre injecté DANS le PNG exporté (KPI name_fr). */
  exportTitle?: string;
  /** Ticker injecté dans le PNG exporté → logo société à droite du titre. */
  exportTicker?: string;
  /** Yann 10 juin 2026 (Point 3) : CAGR annualisé déjà formaté (ex "CAGR
   *  +47,8 %/an"), affiché sous le titre dans le PNG. */
  exportCagr?: string;
  /** Yann 8 juin 2026 (PRIO 3) : suffixe fréquence "par x" déjà localisé,
   *  fourni quand la fréquence ≠ année. Transmis tel quel à l'export. */
  exportFrequency?: string;
  /** Yann 10 juin 2026 : lead de l'interprétation IA (1 phrase, texte brut
   *  strippé HTML), même langue que le titre exporté. Posé en data-export-*
   *  pour rendu SOUS le graph dans le PNG. */
  exportInterpretation?: string;
  /** Yann 8 juin 2026 (Point 4) : override locale axe Y depuis KpiSwapTitle.
   *  'en' force la traduction des mots d'echelle (Mds -> Bn) ET des unites
   *  textuelles non monetaires (unites -> units, abonnes -> subscribers, etc).
   *  Les unites monetaires ($/EUR/etc) restent inchangees. */
  titleLocale?: "fr" | "en";
};

/* ============================================================ */
/* B26 — ISO 3D BARS (parallépipèdes en isométrique vrai)         */
/* Avec support TTM (barre supplémentaire pointillée) et variant   */
/* "classic" pour basculer en 2D flat.                             */
/* ============================================================ */

/* Yann 21 août 2026 : barre 2D avec SEULS les coins extérieurs
   arrondis (haut pour valeur positive, bas pour négative), rayon
   discret plafonné à la moitié de la hauteur/largeur. La base côté
   ligne zéro reste carrée. */
function roundedBarPath(x: number, y: number, w: number, h: number, isNeg: boolean, radius = 4): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (isNeg) {
    // Coins arrondis en BAS (côté extérieur), haut carré (ligne zéro).
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} Z`;
  }
  // Coins arrondis en HAUT, bas carré.
  return `M ${x} ${y + h} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h} Z`;
}
export function BarsIso3DStack({ data, labels, unit = "", color = "#a78bfa", events = [], ttm = null, ttmLabel = "TTM", variant = "iso3d", labelStep = 1, onToggleLabels, exportTitle, exportTicker, exportCagr, exportFrequency, exportInterpretation, titleLocale }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Yann 15 mai 2026 : axis header locale-aware.
  const { locale } = useT();
  // Yann 8 juin 2026 (Point 4) : si KpiSwapTitle a bascule le titre en EN,
  // l'axe Y suit. Sinon on garde la locale globale.
  const effectiveLocale = titleLocale === "en" ? "en" : locale;
  // Yann 15 mai 2026 : click sur la zone axe Y → toggle gauche / droite.
  const [yOnRight, setYOnRight] = useState(false);
  // Yann 11 juin 2026 : en 2D, un clic sur le graphe bascule entre 2 styles.
  // Yann 12 juin 2026 : barre couleur pleine classique (défaut) <-> Néon Tube creux.
  const [flat2d, setFlat2d] = useState(true);

  // Étend data + labels avec TTM si fourni. Dernière barre stylée distinctement.
  // Yann 15 mai 2026 : si TTM est un OUTLIER (cumul 4Q >> max périodes),
  // on ne le render PAS comme barre, mais comme chip séparé en haut.
  const rawHasTTM = ttm != null && Number.isFinite(ttm);
  const dataOnlyMaxRaw = data.length > 0 ? Math.max(...data) : 0;
  const ttmIsCumul = rawHasTTM && (ttm as number) > dataOnlyMaxRaw * 2;
  const hasTTM = rawHasTTM && !ttmIsCumul;
  const allData = hasTTM ? [...data, ttm as number] : data;
  const allLabels = hasTTM ? [...labels, ttmLabel] : labels;
  // Year groups (visualisation type "bracket" sous l'axe X) : chaque groupe
  // de quarters consécutifs même année est rendu via une barre + année une
  // seule fois, au lieu de répéter le chiffre 4 fois.
  const yearGroups = buildYearGroups(allLabels);
  const ttmIndex = hasTTM ? allData.length - 1 : -1;
  const isClassic = variant === "classic";

  // Y-axis adaptive (Yann 13 mai 2026 v3) : heuristique sur `data` SEUL
  // (sans TTM qui peut être un cumul faussant la range). Zoom si range
  // < 40 % de dataMax. Si TTM outlier (> 2x dataMax), exclu de la max.
  const dataOnlyMax = Math.max(...data);
  const dataOnlyMin = Math.min(...data);
  // Yann 11 juin 2026 : un graphe BARRES doit TOUJOURS partir de 0 (baseline
  // zéro). Sinon les hauteurs de barres sont trompeuses (ex Tesla energy
  // storage tronqué à la base 12 sur un axe 12-17). Zoom d'axe Y désactivé
  // pour les barres ; le mode courbe garde sa propre échelle.
  const ttmIsOutlier = hasTTM && (ttm as number) > dataOnlyMax * 2;
  const dataMaxRaw = ttmIsOutlier ? dataOnlyMax : Math.max(...allData);
  // Yann 11 juin 2026 : baseline TOUJOURS 0, mais l'axe DOIT englober les
  // valeurs negatives (ex Prix par pub -16 %). Sinon les barres negatives
  // tombent hors de l'axe et se rendent cassees. min = min(0, dataMin).
  const lowBound = Math.min(0, dataOnlyMin);
  const ticks = niceTicks(lowBound, dataMaxRaw, 5);
  const max = Math.max(...ticks, ...allData);
  const min = Math.min(...ticks, lowBound);
  const range = (max - min) || 1;
  const slot = INNER_W / allData.length;
  const barW = Math.min(slot * 0.42, 56);
  const baseY = PAD_TOP + INNER_H;
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  // Ligne du zero = base de toutes les barres (positives montent, negatives
  // descendent depuis cette ligne).
  const zeroY = yFor(0);
  // Densité crowded : > 12 colonnes. En quarters on bascule en mode
  // "quarter only" (T1/T2/T3/T4) avec un year-band en-dessous (groupage
  // visuel 1 année = 4 quarters = 1 seul libellé d'année).
  const isCrowded = allData.length > 12;
  const labelFontSize = isCrowded ? 13 : 17;
  // Valeurs TOUJOURS affichées au-dessus de chaque barre (demande Yann
  // 5 mai 2026), font-size adapté à la densité pour éviter les chevauchements.
  // Yann 28 juillet 2026 : labels horizontaux => la taille decroit avec le
  // nombre de barres pour garantir zero chevauchement sans rotation.
  // Yann 8 août 2026 : +1 à +1.5pt à chaque densité (plot élargi de ~57px),
  // les chiffres au-dessus des barres étaient trop petits en mode Max.
  const valueFontSize =
    allData.length <= 8 ? 16
    : allData.length <= 12 ? 14
    : allData.length <= 16 ? 12.5
    : allData.length <= 22 ? 11
    : allData.length <= 30 ? 10
    : 9;
  // Yann 28 aout 2026 : sur une serie dense, les valeurs au dessus des barres
  // se chevauchaient et devenaient illisibles (cas VMRK, 20 trimestres :
  // "80 95881 96881 803"). On estime la largeur du libelle le plus long et,
  // s il ne tient pas dans l espace d une barre, on n en affiche qu un sur k,
  // en gardant toujours le dernier. La valeur complete reste lisible au survol.
  const largeurLibelleMax =
    Math.max(
      ...allData.map((d) =>
        String(formatBarLabel(Number(d), dataOnlyMax, unit, effectiveLocale)).length,
      ),
      1,
    ) *
    valueFontSize *
    0.62;
  // Yann 1er sept 2026 : toute la serie est-elle entiere ? -> pas de ",0".
  const serieEntiere = allData.every((d) => Number.isInteger(Number(d)));
  const espaceParBarre = INNER_W / Math.max(allData.length, 1);
  // Yann 1er sept 2026 : decimation abandonnee, toutes les barres portent
  // leur valeur (le survol gere la lisibilite). Calcul conserve si besoin.
  const pasLibelles = Math.max(
    1,
    Math.ceil(largeurLibelleMax / Math.max(espaceParBarre - 4, 1)),
  );
  void pasLibelles;
  const DX = isClassic ? 0 : 26;
  const DY = isClassic ? 0 : -16;
  // Yann 8 juin 2026 (Point 4) : si KpiSwapTitle force EN, l'axe Y traduit
  // les mots d'echelle via la locale 'en' (Mds -> Bn) et les unites
  // textuelles non monetaires via translateUnitFrToEn (unites -> units, etc).
  // Les symboles monetaires ($/EUR/etc) restent inchanges.
  // Yann 30 aout 2026 : traduction dans LES DEUX sens. 126 stes stockent leur
  // unite en anglais (B unit cases, vehicles...) : en mode FR l axe restait
  // anglais et la bascule du titre ne changeait rien.
  const headerUnit = titleLocale === "en"
    ? translateUnitFrToEn(unit)
    : translateUnitEnToFr(unit);
  const header = axisHeader(headerUnit, effectiveLocale);
  // Yann 15 mai 2026 : précision adaptative Y axis pour éviter doublons.
  const intRounded = ticks.map((v) => Math.round(v));
  const needsDecimal = new Set(intRounded).size < ticks.length;
  const tickLoc = effectiveLocale === "en" ? "en-US" : "fr-FR";
  const formatTick = (v: number): string =>
    needsDecimal
      ? (Math.round(v * 10) / 10).toLocaleString(tickLoc, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : (Math.round(v * 10) / 10).toLocaleString(tickLoc);

  return (
    <div
      className="relative w-full"
      style={isClassic ? { cursor: "pointer" } : undefined}
      onClick={isClassic ? () => setFlat2d((v) => !v) : undefined}
      title={isClassic ? "Cliquer pour changer le style des barres" : undefined}
    >
    <svg
      onClick={onToggleLabels}
      ref={svgRef}
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible", cursor: onToggleLabels ? "pointer" : undefined }}
      data-chart-export="true"
      data-export-prefix="bars"
      data-export-title={exportTitle || ""}
      data-export-ticker={exportTicker || ""}
      data-export-cagr={exportCagr || ""}
      data-export-frequency={exportFrequency || ""}
      data-export-interpretation={exportInterpretation || ""}
      data-export-locale={effectiveLocale || ""}
    >
      {/* Header d'unité dans le SVG (au-dessus de l'axe Y) pour qu'il
          apparaisse aussi dans l'export PNG. Demande Yann 5 mai 2026.
          Yann 17 mai 2026 : label décalé vers le haut (y=22 → y=10) pour
          aérer la zone entre le label et le tick Y le plus haut. */}
      {/* Yann 2 juin 2026 : repositionné juste au-dessus du premier tick Y
          (PAD_TOP - 14), aligné fin sur l'axe Y, cohérent web + PNG. */}
      {header && (() => {
        /* Yann 30 aout 2026 : en-tete AU-DESSUS des nombres de l axe. A gauche
           il peut deborder vers le graphique ; a droite il deborde hors du
           graphique et n est coupe qu en necessite absolue (tiret + 2e ligne). */
        const e = calculeEnteteAxe(header, yOnRight, { W, PAD_LEFT, INNER_W });
        const yBase = e.lignes.length > 1 ? PAD_TOP - 36 : PAD_TOP - 24;
        return (
          <text
            x={e.x}
            y={yBase}
            fontSize={13}
            fontWeight={600}
            fill="#e4e4e7"
            fontFamily="ui-monospace, monospace"
            textAnchor={e.anchor}
          >
            {e.lignes.map((l, i) => (
              <tspan key={i} x={e.x} dy={i === 0 ? 0 : 14}>{l}</tspan>
            ))}
          </text>
        );
      })()}
      {/* Yann 15 mai 2026 : TTM cumul = chip en haut, pas comme barre.
          Yann 9 août 2026 : unité formatée locale-aware (même source que
          l'en-tête d'axe, fini le "$B" brut) + largeur adaptée au texte. */}
      {ttmIsCumul && rawHasTTM && (() => {
        const ttmValueStr = (ttm as number).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
        const chipText = `TTM ${ttmValueStr}${header ? ` ${header}` : ""}`;
        const chipW = Math.max(90, Math.round(chipText.length * 6.8) + 16);
        const chipX = yOnRight ? PAD_LEFT + 180 : W - PAD_RIGHT - chipW - 10;
        return (
          <g>
            <rect
              x={chipX}
              y={8}
              width={chipW}
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
                {ttmValueStr}
              </tspan>
              {header ? <tspan fill="#a1a1aa">&nbsp;{header}</tspan> : null}
            </text>
          </g>
        );
      })()}
      <defs>
        <linearGradient id="b26-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.95} />
          <stop offset="100%" stopColor={color} stopOpacity={0.6} />
        </linearGradient>
        <linearGradient id="b26-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} stopOpacity={0.45} />
        </linearGradient>
        <linearGradient id="b26-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.85} />
          <stop offset="100%" stopColor={color} stopOpacity={0.85} />
        </linearGradient>
        {/* Filtre néon "whaou" : halo lumineux puissant + souflé secondaire
            pour effet tube néon style enseigne. stdDeviation 8 (vs 5 avant)
            pour un glow plus présent. (5 mai 2026) */}
        <filter id={`b26-neon-${color.slice(1)}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={`b26-neon-soft-${color.slice(1)}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        {/* Glow tube néon (style 2) : blur + merge sur la source pour halo
            doux qui suit le tracé sans noyer l'intérieur. */}
        <filter id={`b26-glow-${color.slice(1)}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {ticks.map((v, i) => (
        <line key={i} x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={yFor(v)} y2={yFor(v)}
          stroke="#1a1a1a" strokeDasharray="3 6" strokeWidth={1} />
      ))}
      {ticks.map((v, i) => (
        <text
          key={i}
          // Yann 1er sept 2026 (screen Effectifs "30 00" coupe) : en mode axe
          // a droite, le libelle est ancre sur le bord DROIT du viewBox et
          // s etend vers la gauche : plus aucun chiffre coupe, quel que soit
          // le style de barres.
          x={yOnRight ? W - 6 : PAD_LEFT - 12}
          y={yFor(v) + 5}
          textAnchor="end"
          fontSize={16}
          fontWeight={500}
          fill="#e4e4e7"
          fontFamily="ui-monospace, monospace"
        >
          {formatTick(v)}
        </text>
      ))}
      {/* Zone cliquable invisible sur l'axe Y. Yann 15 mai 2026. */}
      <rect
        x={yOnRight ? PAD_LEFT + INNER_W : 0}
        y={0}
        width={yOnRight ? W - (PAD_LEFT + INNER_W) : PAD_LEFT}
        height={H}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onClick={(e) => { e.stopPropagation(); setYOnRight((v) => !v); }}
      >
        <title>Cliquer pour basculer l&apos;axe Y à {yOnRight ? "gauche" : "droite"}</title>
      </rect>
      {allData.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yV = yFor(v);
        // Base = ligne du zero ; barre positive monte, negative descend.
        const yT = Math.min(yV, zeroY);      // haut de la barre
        const barBot = Math.max(yV, zeroY);  // bas de la barre
        const h = barBot - yT;
        const isNeg = v < 0;
        const isH = hover === i;
        const isTTM = i === ttmIndex;
        // TTM : opacité réduite + pointillé sur stroke pour signaler "12 derniers mois".
        const ttmDash = isTTM ? "5 4" : undefined;
        const ttmOpacity = isTTM ? 0.6 : 1;
        const top = `M ${x} ${yT} L ${x + barW} ${yT} L ${x + barW + DX} ${yT + DY} L ${x + DX} ${yT + DY} Z`;
        const side = `M ${x + barW} ${yT} L ${x + barW + DX} ${yT + DY} L ${x + barW + DX} ${barBot + DY} L ${x + barW} ${barBot} Z`;
        const front = `M ${x} ${yT} L ${x + barW} ${yT} L ${x + barW} ${barBot} L ${x} ${barBot} Z`;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
            style={{ opacity: (hover === null || isH ? 1 : 0.5) * ttmOpacity, cursor: "pointer", transition: "opacity 200ms", touchAction: "manipulation" }}>
            {/* shadow under bar (skip in classic / TTM) */}
            {!isClassic && !isTTM && (
              <ellipse cx={x + barW / 2 + DX / 2} cy={barBot + 6} rx={barW * 0.7} ry={6} fill="#000" fillOpacity={0.4} />
            )}
            {isClassic ? (
              flat2d ? (
                /* 2D — barre COULEUR PLEINE classique. 2e style accessible en
                   cliquant sur le graphe (Yann 11 juin 2026). */
                <path
                  d={roundedBarPath(x, yT, barW, h, isNeg)}
                  fill={color}
                  fillOpacity={isTTM ? 0.5 : 1}
                  stroke={isTTM ? color : "none"}
                  strokeWidth={isTTM ? 1.4 : 0}
                  strokeDasharray={ttmDash}
                />
              ) : (
                /* 2D — NÉON TUBE CREUX (style 2) : capsule arrondie, intérieur
                   sombre, contour néon + lueur interne, glow doux. */
                (() => {
                  const cap = Math.min(barW / 2, 8);
                  return (
                    <g filter={`url(#b26-glow-${color.slice(1)})`}>
                      <rect
                        x={x}
                        y={yT}
                        width={barW}
                        height={h}
                        rx={cap}
                        fill={color}
                        fillOpacity={isTTM ? 0.04 : 0.06}
                        stroke={color}
                        strokeWidth={isTTM ? 1.2 : 1.6}
                        strokeDasharray={ttmDash}
                      />
                      {!isTTM && h > 7 && (
                        <rect
                          x={x + 2.5}
                          y={yT + 2.5}
                          width={Math.max(barW - 5, 0)}
                          height={Math.max(h - 5, 0)}
                          rx={Math.max(cap - 2, 0)}
                          fill="none"
                          stroke={color}
                          strokeOpacity={0.45}
                          strokeWidth={1}
                        />
                      )}
                    </g>
                  );
                })()
              )
            ) : (
              /* 3D — dérivé du tube néon (style 2 extrudé) : faces sombres
                 creuses + arêtes néon lumineuses + reflet gauche. */
              <g filter={isTTM ? undefined : `url(#b26-glow-${color.slice(1)})`}>
                <path d={side} fill={color} fillOpacity={isTTM ? 0.25 : 0.55} stroke={color} strokeOpacity={0.6} strokeWidth={1} strokeDasharray={ttmDash} />
                <path d={top} fill={color} fillOpacity={isTTM ? 0.3 : 0.7} stroke={color} strokeOpacity={0.9} strokeWidth={1.3} strokeDasharray={ttmDash} />
                <path d={front} fill={color} fillOpacity={isTTM ? 0.35 : 0.88} stroke={color} strokeWidth={isTTM ? 1.2 : 1.7} strokeDasharray={ttmDash} />
                {!isTTM && h > 6 && (
                  <line x1={x + 1.5} y1={yT + 3} x2={x + 1.5} y2={barBot - 2} stroke="#ffffff" strokeWidth={0.9} strokeOpacity={0.5} strokeLinecap="round" />
                )}
              </g>
            )}
            {/* Valeur au-dessus de chaque barre. Format compact + rotation
                automatique (-30°) quand la série est dense (>12 points) pour
                éviter tout chevauchement quelle que soit la disposition
                (Yann 19 juil 2026). */}
            {(() => {
              // Yann 1er sept 2026 : la valeur s affiche sur TOUTES les barres
              // (plus de decimation pasLibelles). Le chevauchement des series
              // denses est resolu par le survol : la barre visee et SON chiffre
              // restent pleinement contrastes (halo), les autres s estompent.
              // Yann 3 sept 2026 : clic sur le graph = une valeur sur deux, en
              // commencant par masquer la plus recente (le TTM garde la sienne).
              const nReel = ttm != null ? allLabels.length - 1 : allLabels.length;
              if (labelStep === 2 && !isTTM && (nReel - 1 - i) % 2 === 0) return null;
              const cxLabel = x + barW / 2 + (isClassic ? 0 : DX / 2);
              const cyLabel = isNeg ? barBot + 18 : yT + (isClassic ? -10 : DY - 12);
              const labelOpacity = hover === null ? 1 : isH ? 1 : 0.3;
              return (
                <text
                  x={cxLabel}
                  y={cyLabel}
                  textAnchor="middle"
                  fontSize={isH ? valueFontSize + 1 : valueFontSize}
                  fontWeight={700}
                  fill="#fafafa"
                  fontFamily="ui-monospace, monospace"
                  opacity={labelOpacity}
                  style={isH ? { filter: `drop-shadow(0 0 5px ${color})`, transition: "opacity 200ms" } : { transition: "opacity 200ms" }}
                >
                  {formatBarLabel(Number(v), dataOnlyMax, unit, effectiveLocale, serieEntiere)}
                </text>
              );
            })()}
            {/* x label : quarter uniquement (T1/T2/T3/T4) sur ligne 1. Le
                year apparaît UNE SEULE FOIS par groupe via le year-band
                rendu après la boucle (cf. bloc yearGroups.map plus bas).
                Labels non-trimestriels ("2024", "TTM") rendus tel quel. */}
            {(() => {
              const cx = x + barW / 2 + (isClassic ? 0 : DX / 2);
              const yQuarter = H - PAD_BOTTOM + 26;
              const split = splitQuarterLabel(allLabels[i]);
              const fz = labelFontSize;
              const fill = isTTM ? "#a1a1aa" : "#e4e4e7";
              const fw = isTTM ? 500 : 600;
              return (
                <text
                  x={cx}
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
          </g>
        );
      })}
      <EventDotsSVG
        events={events}
        xLabels={allLabels}
        padLeft={PAD_LEFT}
        innerW={INNER_W}
        padTop={PAD_TOP}
        innerH={INNER_H}
        color={color}
        xMode="slot"
        slotOffsetX={isClassic ? 0 : DX / 2}
      />

      {/* Year band : 1 année = 1 bracket horizontal sous l'axe X. Au lieu de
          répéter "21 / 21 / 21 / 21" sous T1/T2/T3/T4, on dessine un trait
          subtil reliant le centre de T1 au centre de T4 + l'année écrite UNE
          fois au milieu. Solution créative pour gagner de la lisibilité sur
          les graphes trimestriels longs. */}
      {yearGroups.map((g) => {
        const slot2 = INNER_W / allData.length;
        const cxStart = PAD_LEFT + slot2 * g.startIdx + (slot2 - barW) / 2 + barW / 2 + (isClassic ? 0 : DX / 2);
        const cxEnd = PAD_LEFT + slot2 * g.endIdx + (slot2 - barW) / 2 + barW / 2 + (isClassic ? 0 : DX / 2);
        const yLine = H - PAD_BOTTOM + 46;
        const yText = H - PAD_BOTTOM + 60;
        const tickH = 4;
        const single = g.startIdx === g.endIdx;
        const yearFull = g.year.length === 2 ? `20${g.year}` : g.year;
        return (
          <g key={`yg-${g.startIdx}`}>
            {!single && (
              <>
                <line x1={cxStart} y1={yLine} x2={cxEnd} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                <line x1={cxStart} y1={yLine - tickH} x2={cxStart} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
                <line x1={cxEnd} y1={yLine - tickH} x2={cxEnd} y2={yLine} stroke="#3f3f46" strokeWidth={1} />
              </>
            )}
            <text
              x={(cxStart + cxEnd) / 2}
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

      {/* Yann (1er juin 06:00) : mini-logo retiré web, gardé seulement sur
          download via chart-export.ts (Powered by + logo combiné). */}
    </svg>

    {/* Yann 8 juin 2026 : bouton télécharger DÉPLACÉ dans la barre d'onglets
        (ChartCycleControls). Récupère ce SVG via [data-chart-export]. */}
    <EventDotsOverlay
      events={events}
      xLabels={allLabels}
      svgW={W}
      svgH={H}
      padLeft={PAD_LEFT}
      innerW={INNER_W}
      padTop={PAD_TOP}
      innerH={INNER_H}
      color={color}
      xMode="slot"
      slotOffsetX={isClassic ? 0 : DX / 2}
    />
    </div>
  );
}

/* ============================================================ */
/* B27 — RIBBON STAIRS 3D                                         */
/* Marches d'escalier en perspective, chaque marche = une année.  */
/* Inspiration freepik : 3D bar with ribbon top freepik image 4.   */
/* ============================================================ */
export function BarsRibbonStairs3D({ data, labels, color = "#22d3ee" }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(0, Math.max(...data, 0), 5);
  const max = Math.max(...ticks, ...data);
  const range = max || 1;
  const slot = INNER_W / data.length;
  const barW = Math.min(slot * 0.5, 64);
  const baseY = PAD_TOP + INNER_H;
  const yFor = (v: number) => PAD_TOP + ((max - v) / range) * INNER_H;
  const DX = 32, DY = -20;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="b27-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <line key={i} x1={PAD_LEFT} x2={PAD_LEFT + INNER_W} y1={yFor(v)} y2={yFor(v)}
          stroke="#1a1a1a" strokeDasharray="3 6" strokeWidth={1} />
      ))}
      {ticks.map((v, i) => (
        <text key={i} x={PAD_LEFT - 9} y={yFor(v) + 5} textAnchor="end" fontSize={16}
          fontWeight={500} fill="#e4e4e7" fontFamily="ui-monospace, monospace">
          {(Math.round(v * 10) / 10).toLocaleString("fr-FR")}
        </text>
      ))}
      {data.map((v, i) => {
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const yT = yFor(v);
        const h = baseY - yT;
        const isH = hover === i;
        // ribbon-top : top face avec arrondi avant
        const top = `M ${x} ${yT} L ${x + barW} ${yT} Q ${x + barW + DX / 2} ${yT + DY / 2} ${x + barW + DX} ${yT + DY} L ${x + DX} ${yT + DY} Q ${x + DX / 2} ${yT + DY / 2} ${x} ${yT} Z`;
        const side = `M ${x + barW} ${yT} L ${x + barW + DX} ${yT + DY} L ${x + barW + DX} ${baseY + DY} L ${x + barW} ${baseY} Z`;
        const front = `M ${x} ${yT} L ${x + barW} ${yT} L ${x + barW} ${baseY} L ${x} ${baseY} Z`;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} onClick={() => setHover((prev) => (prev === i ? null : i))}
            style={{ opacity: hover === null || isH ? 1 : 0.5, cursor: "pointer", transition: "opacity 200ms", touchAction: "manipulation" }}>
            <ellipse cx={x + barW / 2 + DX / 2} cy={baseY + 6} rx={barW * 0.75} ry={6} fill="#000" fillOpacity={0.4} />
            <path d={front} fill="url(#b27-front)" stroke="#050505" strokeWidth={0.6} />
            <path d={side} fill={color} fillOpacity={0.55} stroke="#050505" strokeWidth={0.6} />
            <path d={top} fill="#ffffff" fillOpacity={0.9} stroke="#050505" strokeWidth={0.6} />
            <text x={x + barW / 2 + DX / 2} y={yT + DY - 12} textAnchor="middle" fontSize={15} fontWeight={700}
              fill="#fafafa" fontFamily="ui-monospace, monospace">
              {v}
            </text>
            <text x={x + barW / 2 + DX / 2} y={H - PAD_BOTTOM + 26} textAnchor="middle" fontSize={17}
              fill="#e4e4e7" fontFamily="ui-monospace, monospace" fontWeight={600}>
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
