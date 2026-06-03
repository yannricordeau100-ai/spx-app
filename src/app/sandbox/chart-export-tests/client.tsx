"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadSvgAsPngV2,
  svgToPngDataUrlV2,
  type ExportOptionsV2,
} from "@/lib/chart-export-v2";

type ChartType = "curve" | "bars" | "variation";

type TestCase = {
  id: number;
  title: string;
  description: string;
  theme: "dark" | "light";
  ticker: string;
  companyName: string;
  kpiName: string;
  unit: string;
  cagr: string;
  type: ChartType;
  values: number[];
  labels: string[];
  /** Couleur brand sté pour courbe/barre (sinon cyan default) */
  brandColor?: string;
  brandColor2?: string; // pour gradient
};

// ─── 6 TESTS DE RÉFÉRENCE (Yann 3 juin 2026 v2) ────────────────────────
const TESTS: TestCase[] = [
  // === COURBE ×2 (modèle T12 : 20 trims quarterly NVIDIA) ===
  {
    id: 1,
    title: "T01 — Courbe Dark (NVIDIA quarterly 20T)",
    description: "Modèle T12 + couleur brand NVIDIA vert #76B900",
    theme: "dark",
    ticker: "NVDA",
    companyName: "Nvidia",
    kpiName: "Revenus trimestriels",
    unit: "Mds $",
    cagr: "+74.3 %",
    type: "curve",
    brandColor: "#76B900",
    brandColor2: "#06b6d4",
    values: [
      5.0, 5.7, 6.5, 7.6, 8.3, 6.7, 5.9, 6.0, 7.2, 13.5, 18.1, 22.1, 26.0,
      30.0, 35.1, 39.3, 44.1, 46.7, 57.0, 60.0,
    ],
    labels: [
      "T1 21", "T2 21", "T3 21", "T4 21",
      "T1 22", "T2 22", "T3 22", "T4 22",
      "T1 23", "T2 23", "T3 23", "T4 23",
      "T1 24", "T2 24", "T3 24", "T4 24",
      "T1 25", "T2 25", "T3 25", "T4 25",
    ],
  },
  {
    id: 2,
    title: "T02 — Courbe Light (NVIDIA quarterly 20T)",
    description: "Même modèle, thème clair",
    theme: "light",
    ticker: "NVDA",
    companyName: "Nvidia",
    kpiName: "Revenus trimestriels",
    unit: "Mds $",
    cagr: "+74.3 %",
    type: "curve",
    brandColor: "#76B900",
    brandColor2: "#06b6d4",
    values: [
      5.0, 5.7, 6.5, 7.6, 8.3, 6.7, 5.9, 6.0, 7.2, 13.5, 18.1, 22.1, 26.0,
      30.0, 35.1, 39.3, 44.1, 46.7, 57.0, 60.0,
    ],
    labels: [
      "T1 21", "T2 21", "T3 21", "T4 21",
      "T1 22", "T2 22", "T3 22", "T4 22",
      "T1 23", "T2 23", "T3 23", "T4 23",
      "T1 24", "T2 24", "T3 24", "T4 24",
      "T1 25", "T2 25", "T3 25", "T4 25",
    ],
  },
  // === BARRES ×2 (modèle T3 : Microsoft Cloud) ===
  {
    id: 3,
    title: "T03 — Barres Dark (Microsoft Cloud)",
    description: "Modèle T3 + couleur brand Microsoft #00A4EF",
    theme: "dark",
    ticker: "MSFT",
    companyName: "Microsoft",
    kpiName: "Microsoft Cloud Revenue",
    unit: "Mds $",
    cagr: "+22.7 %",
    type: "bars",
    brandColor: "#00A4EF",
    brandColor2: "#0078D4",
    values: [68.0, 91.2, 111.6, 135.0, 165.0],
    labels: ["FY21", "FY22", "FY23", "FY24", "FY25"],
  },
  {
    id: 4,
    title: "T04 — Barres Light (Microsoft Cloud)",
    description: "Même modèle, thème clair",
    theme: "light",
    ticker: "MSFT",
    companyName: "Microsoft",
    kpiName: "Microsoft Cloud Revenue",
    unit: "Mds $",
    cagr: "+22.7 %",
    type: "bars",
    brandColor: "#00A4EF",
    brandColor2: "#0078D4",
    values: [68.0, 91.2, 111.6, 135.0, 165.0],
    labels: ["FY21", "FY22", "FY23", "FY24", "FY25"],
  },
  // === VARIATION ×2 (modèle T10 : TotalEnergies) ===
  {
    id: 5,
    title: "T05 — Variation Dark (TotalEnergies production)",
    description: "Modèle T10 - YoY signed bars vert/rouge",
    theme: "dark",
    ticker: "TTE.PA",
    companyName: "TotalEnergies",
    kpiName: "Production Hydrocarbures",
    unit: "%",
    cagr: "-1.2 %",
    type: "variation",
    values: [-2.1, 3.4, -0.8, 1.5, -2.2],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  {
    id: 6,
    title: "T06 — Variation Light (TotalEnergies production)",
    description: "Même modèle, thème clair",
    theme: "light",
    ticker: "TTE.PA",
    companyName: "TotalEnergies",
    kpiName: "Production Hydrocarbures",
    unit: "%",
    cagr: "-1.2 %",
    type: "variation",
    values: [-2.1, 3.4, -0.8, 1.5, -2.2],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
];

// ─── CHART SVG BUILDERS ────────────────────────────────────────────────
const CHART_W = 1100;
const CHART_H = 460;
const CHART_PAD_L = 70;
const CHART_PAD_R = 30;
const CHART_PAD_T = 50; // augmenté pour Y-axis label centré 50/50 au-dessus
const CHART_PAD_B = 40;

function ChartCurve({
  values,
  labels,
  unit,
  theme,
  brandColor = "#06b6d4",
  brandColor2 = "#a855f7",
}: {
  values: number[];
  labels: string[];
  unit: string;
  theme: "dark" | "light";
  brandColor?: string;
  brandColor2?: string;
}) {
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const yMax = max + range * 0.15;
  const yMin = min;
  const xStep = (CHART_W - CHART_PAD_L - CHART_PAD_R) / Math.max(1, values.length - 1);
  const yRange = yMax - yMin;
  const getX = (i: number) => CHART_PAD_L + i * xStep;
  const getY = (v: number) =>
    CHART_PAD_T + (CHART_H - CHART_PAD_T - CHART_PAD_B) * (1 - (v - yMin) / yRange);

  // Smooth curve avec cubic bezier
  const pts = values.map((v, i) => [getX(i), getY(v)]);
  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const mx = (x1 + x2) / 2;
    path += ` C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
  }
  const areaPath = `${path} L ${pts[pts.length - 1][0]} ${CHART_H - CHART_PAD_B} L ${pts[0][0]} ${CHART_H - CHART_PAD_B} Z`;

  const isLight = theme === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const axisColor = isLight ? "#444" : "#bbb";
  const valueColor = isLight ? "#0a0a0a" : "#fafafa";

  const tickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    yTicks.push(yMin + (yRange * i) / (tickCount - 1));
  }

  return (
    <>
      <defs>
        <linearGradient id={`curveGrad-${brandColor}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={brandColor2} />
          <stop offset="100%" stopColor={brandColor} />
        </linearGradient>
        <linearGradient id={`areaGrad-${brandColor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={brandColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={brandColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y axis label "Mds $" CENTRÉ sur l'axe Y (50% à gauche, 50% à droite) */}
      <text
        x={CHART_PAD_L}
        y={CHART_PAD_T - 18}
        textAnchor="middle"
        fontSize="16"
        fill={axisColor}
        fontWeight="600"
      >
        {unit}
      </text>

      {/* Y ticks + horizontal grid */}
      {yTicks.map((tv, i) => {
        const y = getY(tv);
        return (
          <g key={i}>
            <line
              x1={CHART_PAD_L}
              y1={y}
              x2={CHART_W - CHART_PAD_R}
              y2={y}
              stroke={gridColor}
              strokeDasharray="2 4"
            />
            <text
              x={CHART_PAD_L - 12}
              y={y + 4}
              textAnchor="end"
              fontSize="13"
              fill={axisColor}
            >
              {tv.toFixed(tv < 10 ? 1 : 0)}
            </text>
          </g>
        );
      })}

      {/* Vertical grid + X labels */}
      {labels.map((lbl, i) => {
        const x = getX(i);
        const isFirst = i === 0;
        const isLast = i === labels.length - 1;
        // Pour history dense (20 trims), afficher 1 sur 4
        const skipLabel = labels.length > 12 && !isFirst && !isLast && i % 4 !== 0;
        return (
          <g key={i}>
            <line
              x1={x}
              y1={CHART_PAD_T}
              x2={x}
              y2={CHART_H - CHART_PAD_B}
              stroke={gridColor}
              strokeDasharray="2 4"
            />
            {!skipLabel && (
              <text
                x={x}
                y={CHART_H - CHART_PAD_B + 22}
                textAnchor="middle"
                fontSize="13"
                fill={axisColor}
                fontWeight="600"
              >
                {lbl}
              </text>
            )}
          </g>
        );
      })}

      <path d={areaPath} fill={`url(#areaGrad-${brandColor})`} />
      <path
        d={path}
        stroke={`url(#curveGrad-${brandColor})`}
        strokeWidth="3"
        fill="none"
      />

      {/* Data points + values above (skip si dense pour pas surcharger) */}
      {values.map((v, i) => {
        const x = getX(i);
        const y = getY(v);
        const showLabel = values.length <= 8 || i === 0 || i === values.length - 1 || i % 4 === 0;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="5"
              fill={isLight ? "#fff" : "#050505"}
              stroke={brandColor}
              strokeWidth="2.5"
            />
            {showLabel && (
              <>
                <line
                  x1={x - 4}
                  y1={y - 10}
                  x2={x + 18}
                  y2={y - 10}
                  stroke={brandColor}
                  strokeWidth="1.5"
                  opacity="0.6"
                />
                <text
                  x={x + 7}
                  y={y - 14}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill={valueColor}
                >
                  {v.toFixed(v < 10 ? 1 : 0)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

function ChartBars({
  values,
  labels,
  unit,
  theme,
  brandColor = "#06b6d4",
  brandColor2 = "#a855f7",
}: {
  values: number[];
  labels: string[];
  unit: string;
  theme: "dark" | "light";
  brandColor?: string;
  brandColor2?: string;
}) {
  const min = 0;
  const max = Math.max(...values);
  const yMax = max * 1.15;
  const yRange = yMax - min;
  const xStep = (CHART_W - CHART_PAD_L - CHART_PAD_R) / values.length;
  const barW = xStep * 0.55;
  const getX = (i: number) => CHART_PAD_L + i * xStep + (xStep - barW) / 2;
  const getY = (v: number) =>
    CHART_PAD_T + (CHART_H - CHART_PAD_T - CHART_PAD_B) * (1 - v / yRange);

  const isLight = theme === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const axisColor = isLight ? "#444" : "#bbb";
  const valueColor = isLight ? "#0a0a0a" : "#fafafa";

  const tickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    yTicks.push((yMax * i) / (tickCount - 1));
  }

  return (
    <>
      <defs>
        <linearGradient id={`barGrad-${brandColor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={brandColor} />
          <stop offset="100%" stopColor={brandColor2} />
        </linearGradient>
      </defs>

      <text
        x={CHART_PAD_L}
        y={CHART_PAD_T - 18}
        textAnchor="middle"
        fontSize="16"
        fill={axisColor}
        fontWeight="600"
      >
        {unit}
      </text>

      {yTicks.map((tv, i) => {
        const y = getY(tv);
        return (
          <g key={i}>
            <line
              x1={CHART_PAD_L}
              y1={y}
              x2={CHART_W - CHART_PAD_R}
              y2={y}
              stroke={gridColor}
              strokeDasharray="2 4"
            />
            <text x={CHART_PAD_L - 12} y={y + 4} textAnchor="end" fontSize="13" fill={axisColor}>
              {tv.toFixed(tv < 10 ? 1 : 0)}
            </text>
          </g>
        );
      })}

      {labels.map((lbl, i) => {
        const x = getX(i) + barW / 2;
        return (
          <text
            key={i}
            x={x}
            y={CHART_H - CHART_PAD_B + 22}
            textAnchor="middle"
            fontSize="14"
            fill={axisColor}
            fontWeight="600"
          >
            {lbl}
          </text>
        );
      })}

      {values.map((v, i) => {
        const x = getX(i);
        const y = getY(v);
        const h = CHART_H - CHART_PAD_B - y;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} fill={`url(#barGrad-${brandColor})`} rx="2" />
            <text
              x={x + barW / 2}
              y={y - 8}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill={valueColor}
            >
              {v.toFixed(v < 10 ? 1 : 0)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function ChartVariation({
  values,
  labels,
  unit,
  theme,
}: {
  values: number[];
  labels: string[];
  unit: string;
  theme: "dark" | "light";
}) {
  const max = Math.max(...values.map(Math.abs));
  const yMax = max * 1.2;
  const yMin = -yMax;
  const yRange = yMax - yMin;
  const xStep = (CHART_W - CHART_PAD_L - CHART_PAD_R) / values.length;
  const barW = xStep * 0.55;
  const getX = (i: number) => CHART_PAD_L + i * xStep + (xStep - barW) / 2;
  const getY = (v: number) =>
    CHART_PAD_T + (CHART_H - CHART_PAD_T - CHART_PAD_B) * (1 - (v - yMin) / yRange);
  const zeroY = getY(0);

  const isLight = theme === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const axisColor = isLight ? "#444" : "#bbb";
  const valueColor = isLight ? "#0a0a0a" : "#fafafa";

  return (
    <>
      <text
        x={CHART_PAD_L}
        y={CHART_PAD_T - 18}
        textAnchor="middle"
        fontSize="16"
        fill={axisColor}
        fontWeight="600"
      >
        {unit}
      </text>

      <line
        x1={CHART_PAD_L}
        y1={zeroY}
        x2={CHART_W - CHART_PAD_R}
        y2={zeroY}
        stroke={axisColor}
        strokeWidth="1"
      />

      {labels.map((lbl, i) => {
        const x = getX(i) + barW / 2;
        return (
          <g key={i}>
            <line
              x1={x}
              y1={CHART_PAD_T}
              x2={x}
              y2={CHART_H - CHART_PAD_B}
              stroke={gridColor}
              strokeDasharray="2 4"
            />
            <text
              x={x}
              y={CHART_H - CHART_PAD_B + 22}
              textAnchor="middle"
              fontSize="14"
              fill={axisColor}
              fontWeight="600"
            >
              {lbl}
            </text>
          </g>
        );
      })}

      {values.map((v, i) => {
        const x = getX(i);
        const y0 = getY(0);
        const y = getY(v);
        const isPositive = v >= 0;
        const top = Math.min(y, y0);
        const h = Math.abs(y0 - y);
        return (
          <g key={i}>
            <rect
              x={x}
              y={top}
              width={barW}
              height={h}
              fill={isPositive ? "#10b981" : "#ef4444"}
              opacity="0.85"
              rx="2"
            />
            <text
              x={x + barW / 2}
              y={isPositive ? top - 8 : top + h + 18}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill={valueColor}
            >
              {v >= 0 ? "+" : ""}
              {v.toFixed(1)} %
            </text>
          </g>
        );
      })}
    </>
  );
}

// ─── TEST CARD ─────────────────────────────────────────────────────────
function TestCard({ test }: { test: TestCase }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const exportOptions: ExportOptionsV2 = {
    companyName: test.companyName,
    ticker: test.ticker,
    kpiName: test.kpiName,
    cagr: test.cagr || undefined,
    filename: `${test.ticker}_${test.kpiName.replace(/\W+/g, "_")}_T${test.id}.png`,
    forceTheme: test.theme,
  };

  async function handlePreview() {
    if (!svgRef.current) return;
    setLoading(true);
    try {
      const dataUrl = await svgToPngDataUrlV2(svgRef.current, exportOptions);
      setPreview(dataUrl);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!svgRef.current) return;
    setLoading(true);
    try {
      await downloadSvgAsPngV2(svgRef.current, exportOptions);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    handlePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = test.theme === "light" ? "#ffffff" : "#050505";

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-bold text-white">{test.title}</h3>
          <p className="mt-1 text-xs text-zinc-400">{test.description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="rounded-md bg-cyan-600 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? "…" : "Re-Preview"}
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Télécharger PNG
          </button>
        </div>
      </div>

      <div className="sr-only" aria-hidden>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          width={CHART_W}
          height={CHART_H}
          style={{ background: bg }}
        >
          {test.type === "curve" && (
            <ChartCurve
              values={test.values}
              labels={test.labels}
              unit={test.unit}
              theme={test.theme}
              brandColor={test.brandColor}
              brandColor2={test.brandColor2}
            />
          )}
          {test.type === "bars" && (
            <ChartBars
              values={test.values}
              labels={test.labels}
              unit={test.unit}
              theme={test.theme}
              brandColor={test.brandColor}
              brandColor2={test.brandColor2}
            />
          )}
          {test.type === "variation" && (
            <ChartVariation
              values={test.values}
              labels={test.labels}
              unit={test.unit}
              theme={test.theme}
            />
          )}
        </svg>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/5 bg-black">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={test.title} className="block w-full" />
        ) : (
          <div className="flex h-72 items-center justify-center text-xs text-zinc-500">
            {loading ? "Génération…" : "Cliquer Re-Preview"}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChartExportTestsClient() {
  return (
    <div className="min-h-screen bg-black p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Chart Export — Modèle PDF v2
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            6 tests référence (3 types × 2 thèmes). Modèles T12 (courbe NVIDIA
            quarterly), T3 (barres Microsoft Cloud), T10 (variation
            TotalEnergies). Couleurs brand sté pour courbe/barres.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Le téléchargement live sur la page sté reproduit le graph affiché
            (courbe/barres/variation + thème + axe Y). Cette page sert à
            valider le template overlay (header + footer + signature).
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {TESTS.map((test) => (
            <TestCard key={test.id} test={test} />
          ))}
        </div>

        <footer className="mt-10 border-t border-white/10 pt-6 text-xs text-zinc-500">
          <p>
            Spec v2 (3 juin 2026 22h47): logo sté plus petit, &laquo; Powered
            by &raquo; à la place de &laquo; KPIs &amp; Data :&raquo;, Mettrik AI
            logo agrandi, Y-axis label centré sur l&apos;axe, X handle
            &laquo; @Mettrik_AI &raquo; bottom-center.
          </p>
        </footer>
      </div>
    </div>
  );
}
