"use client";

/**
 * 3 propositions de "Tableau de bord" (D1-D3) — vue panoramique multi-KPI
 * pour le 4e onglet de ChartCycle.
 *
 * API minimale :
 *   <DashboardCardGrid kpis={[{label, value, unit, delta?, history?}, ...]} />
 *
 * Drop-in : un même tableau de KPIs nourrit les 3 designs.
 */

export type DashKPI = {
  label: string;
  value: number | string;
  unit?: string;
  delta?: number; // % YoY
  history?: number[];
};

export type DashProps = {
  kpis: DashKPI[];
  accent?: string;
};

const POS = "#10b981";
const NEG = "#f43f5e";

function fmtNum(v: number | string): string {
  if (typeof v === "string") return v;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function MiniSpark({ data, color, w = 120, h = 30 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${h - ((v - min) / range) * h * 0.85 - h * 0.075}`)
    .join(" ");
  const fillPath = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <defs>
        <linearGradient id={`mspark-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#mspark-${color.slice(1)})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

/* ============================================================ */
/* D1 — CARD GRID (grille de mini-cartes KPI avec sparkline)      */
/* Layout 3-4 colonnes selon largeur, mini-spark + delta YoY.     */
/* ============================================================ */
export function DashboardCardGrid({ kpis, accent = "#a78bfa" }: DashProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((k, i) => {
        const tone = k.delta == null ? accent : k.delta >= 0 ? POS : NEG;
        return (
          <div key={i} className="relative overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#3a3a3a]">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">
              {k.label}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-[26px] font-bold leading-none tabular-nums text-zinc-50">
                {fmtNum(k.value)}
              </span>
              {k.unit && <span className="text-[12px] font-medium text-zinc-400">{k.unit}</span>}
            </div>
            {k.delta != null && (
              <div className="mt-1 inline-flex items-center gap-1 font-mono text-[11.5px] font-bold tabular-nums" style={{ color: tone }}>
                {k.delta >= 0 ? "▲" : "▼"} {k.delta >= 0 ? "+" : ""}{k.delta.toFixed(1)} %
                <span className="text-[10px] font-normal text-zinc-500" title="Year-on-Year">vs N-1</span>
              </div>
            )}
            {k.history && (
              <div className="mt-3">
                <MiniSpark data={k.history} color={tone} w={200} h={32} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/* D2 — HERO + SECONDARIES                                        */
/* Une carte hero (grande) + 4 stats secondaires en colonne.      */
/* ============================================================ */
export function DashboardHeroSecondaries({ kpis, accent = "#a78bfa" }: DashProps) {
  if (kpis.length === 0) return null;
  const hero = kpis[0];
  const others = kpis.slice(1, 5);
  const heroTone = hero.delta == null ? accent : hero.delta >= 0 ? POS : NEG;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-[#1f1f1f] bg-gradient-to-br from-[#0d0d0d] to-[#070707] p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          {hero.label}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-[56px] font-bold leading-none tracking-tight tabular-nums text-zinc-50">
            {fmtNum(hero.value)}
          </span>
          {hero.unit && <span className="text-[20px] font-medium text-zinc-400">{hero.unit}</span>}
        </div>
        {hero.delta != null && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[14px] font-bold tabular-nums"
            style={{ color: heroTone, background: `${heroTone}1a`, border: `1px solid ${heroTone}55` }}>
            {hero.delta >= 0 ? "▲" : "▼"} {hero.delta >= 0 ? "+" : ""}{hero.delta.toFixed(2)} % YoY
          </div>
        )}
        {hero.history && (
          <div className="mt-5">
            <MiniSpark data={hero.history} color={heroTone} w={400} h={64} />
          </div>
        )}
      </div>
      {/* Secondary KPIs */}
      <div className="grid gap-2.5">
        {others.map((k, i) => {
          const tone = k.delta == null ? accent : k.delta >= 0 ? POS : NEG;
          return (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 truncate">
                  {k.label}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="font-display text-[20px] font-bold leading-none tabular-nums text-zinc-50">
                    {fmtNum(k.value)}
                  </span>
                  {k.unit && <span className="text-[10.5px] text-zinc-400">{k.unit}</span>}
                </div>
              </div>
              {k.delta != null && (
                <span className="font-mono text-[12px] font-bold tabular-nums" style={{ color: tone }}>
                  {k.delta >= 0 ? "+" : ""}{k.delta.toFixed(1)} %
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* D3 — RANKED LIST (classement vertical avec barres horizontales) */
/* Chaque KPI = une rangée avec barre horizontale + delta + valeur. */
/* ============================================================ */
export function DashboardRankedList({ kpis, accent = "#a78bfa" }: DashProps) {
  // Pour la barre horizontale : normaliser sur la valeur max numérique
  const numericValues = kpis
    .map((k) => (typeof k.value === "number" ? k.value : Number(String(k.value).replace(/[^\d.-]/g, "")) || 0))
    .map(Math.abs);
  const vMax = Math.max(...numericValues, 1);

  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4">
      <div className="space-y-3">
        {kpis.map((k, i) => {
          const v = numericValues[i];
          const w = (v / vMax) * 100;
          const tone = k.delta == null ? accent : k.delta >= 0 ? POS : NEG;
          return (
            <div key={i} className="group">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 w-5 shrink-0">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="text-[13px] font-medium text-zinc-200 truncate">{k.label}</span>
                </div>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="font-mono text-[15px] font-bold tabular-nums text-zinc-50">
                    {fmtNum(k.value)}
                    {k.unit && <span className="ml-1 text-[10.5px] font-normal text-zinc-400">{k.unit}</span>}
                  </span>
                  {k.delta != null && (
                    <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: tone }}>
                      {k.delta >= 0 ? "+" : ""}{k.delta.toFixed(1)} %
                    </span>
                  )}
                </div>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-[#161616]">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${w}%`,
                    background: `linear-gradient(90deg, ${accent}cc, ${tone}ee)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
