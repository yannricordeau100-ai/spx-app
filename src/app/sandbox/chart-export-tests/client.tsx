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
};

const TESTS: TestCase[] = [
  // ─── Tests de base (dark/light × 3 types × 2 stés ───
  {
    id: 1,
    title: "T01 — NVIDIA Data Center Rev (Courbe, Dark)",
    description: "Modèle PDF de référence. Nom court, KPI court.",
    theme: "dark",
    ticker: "NVDA",
    companyName: "Nvidia",
    kpiName: "Revenus Data Center",
    unit: "Mds $",
    cagr: "+148.5 %",
    type: "curve",
    values: [10.6, 15.0, 47.5, 115.2, 178.0],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  {
    id: 2,
    title: "T02 — Apple iPhone Revenue (Courbe, Light)",
    description: "Light theme. Nom moyen, KPI moyen.",
    theme: "light",
    ticker: "AAPL",
    companyName: "Apple",
    kpiName: "Revenus iPhone",
    unit: "Mds $",
    cagr: "+2.1 %",
    type: "curve",
    values: [191.9, 205.5, 200.6, 201.2, 209.6],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  {
    id: 3,
    title: "T03 — Microsoft Cloud (Barres, Dark)",
    description: "Type barres. Nom moyen, KPI long.",
    theme: "dark",
    ticker: "MSFT",
    companyName: "Microsoft",
    kpiName: "Microsoft Cloud Revenue (Azure + 365)",
    unit: "Mds $",
    cagr: "+22.7 %",
    type: "bars",
    values: [68.0, 91.2, 111.6, 135.0, 165.0],
    labels: ["FY21", "FY22", "FY23", "FY24", "FY25"],
  },
  {
    id: 4,
    title: "T04 — Alphabet Cloud (Variation, Light)",
    description: "Type variation (% YoY). Nom moyen + parenthèses.",
    theme: "light",
    ticker: "GOOGL",
    companyName: "Alphabet (Google)",
    kpiName: "Google Cloud Revenue",
    unit: "%",
    cagr: "+30.4 %",
    type: "variation",
    values: [47.1, 36.8, 23.9, 35.6, 31.0],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  // ─── Cas longs nom de sté ───
  {
    id: 5,
    title: "T05 — Nom sté TRÈS long (Courbe, Dark)",
    description: "Test ellipsize nom sté long.",
    theme: "dark",
    ticker: "BRK-B",
    companyName: "Berkshire Hathaway Inc Class B Common Stock",
    kpiName: "Insurance Float",
    unit: "Mds $",
    cagr: "+5.8 %",
    type: "curve",
    values: [142.1, 147.2, 162.0, 168.0, 178.0],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  // ─── Cas longs nom KPI ───
  {
    id: 6,
    title: "T06 — KPI TRÈS long (Courbe, Dark)",
    description: "Test ellipsize KPI long.",
    theme: "dark",
    ticker: "META",
    companyName: "Meta",
    kpiName: "Average Revenue per Person across Family of Apps World",
    unit: "$",
    cagr: "+11.2 %",
    type: "curve",
    values: [38.4, 40.2, 44.6, 51.4, 60.0],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  // ─── Cas extrêmes ───
  {
    id: 7,
    title: "T07 — Sté + KPI ULTRA longs (Courbe, Light)",
    description: "Both ellipsized.",
    theme: "light",
    ticker: "JPM",
    companyName: "JPMorgan Chase & Company NA",
    kpiName: "Tier 1 Common Equity Capital Ratio (CET1 standardisé)",
    unit: "%",
    cagr: "+0.3 %",
    type: "curve",
    values: [13.1, 13.2, 15.0, 15.3, 15.7],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  {
    id: 8,
    title: "T08 — Ticker sans logo (Courbe, Dark)",
    description: "Sté sans logo PNG dispo, pas de cercle.",
    theme: "dark",
    ticker: "ZZZ_NO_LOGO",
    companyName: "Société Test",
    kpiName: "Métrique exemple",
    unit: "M €",
    cagr: "+8.0 %",
    type: "curve",
    values: [100, 110, 121, 133, 145],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  {
    id: 9,
    title: "T09 — Caterpillar Backlog (Barres, Light)",
    description: "Barres light theme.",
    theme: "light",
    ticker: "CAT",
    companyName: "Caterpillar",
    kpiName: "Backlog",
    unit: "Mds $",
    cagr: "+12.4 %",
    type: "bars",
    values: [21.0, 28.0, 30.4, 31.0, 38.7],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  {
    id: 10,
    title: "T10 — TotalEnergies (Variation, Dark)",
    description: "Variation dark, exercice européen.",
    theme: "dark",
    ticker: "TTE.PA",
    companyName: "TotalEnergies",
    kpiName: "Production Hydrocarbures",
    unit: "kbep/j",
    cagr: "-1.2 %",
    type: "variation",
    values: [-2.1, 3.4, -0.8, 1.5, -2.2],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  {
    id: 11,
    title: "T11 — Sans CAGR (Courbe, Dark)",
    description: "Test absence CAGR.",
    theme: "dark",
    ticker: "TSLA",
    companyName: "Tesla",
    kpiName: "Vehicle Deliveries",
    unit: "M véhicules",
    cagr: "",
    type: "curve",
    values: [0.94, 1.31, 1.81, 1.79, 1.85],
    labels: ["2021", "2022", "2023", "2024", "2025"],
  },
  {
    id: 12,
    title: "T12 — 20 trimestres (Courbe, Dark)",
    description: "Beaucoup de points X axis.",
    theme: "dark",
    ticker: "NVDA",
    companyName: "Nvidia",
    kpiName: "Revenus trimestriels",
    unit: "Mds $",
    cagr: "+74.3 %",
    type: "curve",
    values: [
      5.0, 5.7, 6.5, 7.6, 8.3, 6.7, 5.9, 6.0, 7.2, 13.5, 18.1, 22.1, 26.0, 30.0,
      35.1, 39.3, 44.1, 46.7, 57.0, 60.0,
    ],
    labels: [
      "T1 21", "T2 21", "T3 21", "T4 21",
      "T1 22", "T2 22", "T3 22", "T4 22",
      "T1 23", "T2 23", "T3 23", "T4 23",
      "T1 24", "T2 24", "T3 24", "T4 24",
      "T1 25", "T2 25", "T3 25", "T4 25",
    ],
  },
];

// ────────────────────────────────────────────────────────
// Chart SVG builders (simples, suffisants pour modèle export)
// ────────────────────────────────────────────────────────

const CHART_W = 1100;
const CHART_H = 460;
const CHART_PAD_L = 70;
const CHART_PAD_R = 30;
const CHART_PAD_T = 30;
const CHART_PAD_B = 40;

function ChartCurve({
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

  // Area sous courbe
  const areaPath = `${path} L ${pts[pts.length - 1][0]} ${CHART_H - CHART_PAD_B} L ${pts[0][0]} ${CHART_H - CHART_PAD_B} Z`;

  const isLight = theme === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const axisColor = isLight ? "#444" : "#bbb";
  const valueColor = isLight ? "#0a0a0a" : "#fafafa";

  // Y ticks
  const tickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    yTicks.push(yMin + (yRange * i) / (tickCount - 1));
  }

  return (
    <>
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y axis label "Mds $" top-left */}
      <text
        x={CHART_PAD_L}
        y={CHART_PAD_T - 8}
        textAnchor="end"
        fontSize="13"
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

      {/* Area + Curve */}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={path} stroke="url(#curveGrad)" strokeWidth="3" fill="none" />

      {/* Data points + values above with whisker line (PDF model) */}
      {values.map((v, i) => {
        const x = getX(i);
        const y = getY(v);
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="5"
              fill={isLight ? "#fff" : "#050505"}
              stroke="#06b6d4"
              strokeWidth="2.5"
            />
            {/* Whisker line: petit trait sous la valeur vers le point */}
            <line
              x1={x - 4}
              y1={y - 10}
              x2={x + 18}
              y2={y - 10}
              stroke="#06b6d4"
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
}: {
  values: number[];
  labels: string[];
  unit: string;
  theme: "dark" | "light";
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
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      <text
        x={CHART_PAD_L}
        y={CHART_PAD_T - 8}
        textAnchor="end"
        fontSize="13"
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
            <rect x={x} y={y} width={barW} height={h} fill="url(#barGrad)" rx="2" />
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
        y={CHART_PAD_T - 8}
        textAnchor="end"
        fontSize="13"
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

// ────────────────────────────────────────────────────────
// Test card component
// ────────────────────────────────────────────────────────
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

  // Auto preview au mount
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

      {/* SVG source (caché mais utilisé pour export) */}
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
            />
          )}
          {test.type === "bars" && (
            <ChartBars
              values={test.values}
              labels={test.labels}
              unit={test.unit}
              theme={test.theme}
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

      {/* Preview du PNG résultat */}
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
            Chart Export — Tests modèle PDF
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Modèle basé sur{" "}
            <span className="font-mono text-cyan-400">
              modèle graph export MAI.pdf
            </span>
            . Header avec logo sté circulaire + nom sté | titre KPI sur une
            ligne. CAGR en sous-titre centré. Signature{" "}
            <span className="font-mono">KPIs &amp; Data : [logo Mettrik]</span>{" "}
            bottom-right.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            12 tests numérotés. Chaque vignette affiche le PNG résultat (auto
            généré au chargement). Bouton{" "}
            <span className="font-mono">Télécharger PNG</span> pour download.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {TESTS.map((test) => (
            <TestCard key={test.id} test={test} />
          ))}
        </div>

        <footer className="mt-10 border-t border-white/10 pt-6 text-xs text-zinc-500">
          <p>
            Si un PNG n&apos;a pas le rendu attendu (chevauchement, ellipsize
            trop court, signature mal placée), reporter le numéro de test.
          </p>
        </footer>
      </div>
    </div>
  );
}
