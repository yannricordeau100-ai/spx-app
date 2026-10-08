"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Maximize2 } from "lucide-react";
import { formatHeroValue, type Company, type KPI } from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { buildChartSpec } from "@/lib/chart-template";
import { getFiscalAudit } from "@/lib/fiscal-calendar";
import { aggregateQuarterlyToAnnual, getKpiAggregationKind } from "@/lib/kpi-aggregation";
import { ChartCycle, ChartCycleControls, useChartMode, computeChartDisplay, type GraphPeriod } from "@/components/chart-cycle";
import { ChartFullscreen } from "@/components/charts/chart-mobile-controls";
import { KpiRow } from "@/components/kpi-row";
import { UnitesMateriaux } from "@/components/unites-materiaux";
import { kpisAffiches } from "./contenu";

/** Hauteur de l en-tete collant, lue sur la page (variable posee par le client v2). */
function hauteurEnTete(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--entete-v2");
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Defile jusqu a l element en tenant compte de l en-tete collant. */
export function defileVers(el: HTMLElement | null) {
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - hauteurEnTete() - 12;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function periodeParDefaut(k: KPI): GraphPeriod {
  const n = Array.isArray(k.history) ? k.history.length : 0;
  if (k.period_type === "quarter" && n >= 4) return "quarter";
  if (k.period_type === "semester") return "semester";
  return "year";
}

/**
 * Bloc unique « Indicateurs clés » : graphique du KPI actif en haut (le KPI
 * principal au chargement), liste des indicateurs dessous. Un clic sur une
 * ligne ouvre son graphique en grand, comme sur la fiche actuelle
 * (company-view.tsx, handleKpiClick) : le KPI passe dans le graphique, la
 * frequence se recale sur la sienne et la page remonte au graphique.
 */
export function BlocIndicateurs({ c, accent, actif, onActif }: { c: Company; accent: string; actif: string; onActif: (short: string) => void }) {
  const liste = useMemo(() => kpisAffiches(c), [c]);
  const k = liste.find((x) => x.short === actif) ?? liste[0];
  const [periode, setPeriode] = useState<GraphPeriod>(() => (k ? periodeParDefaut(k) : "year"));
  const [mode, setMode] = useChartMode("bars");
  const [tout, setTout] = useState(false);
  const [grand, setGrand] = useState(false);
  const [eclat, setEclat] = useState(0);
  const zone = useRef<HTMLDivElement>(null);

  const spec = useMemo(() => (k ? buildChartSpec(k, c.ticker, periode) : null), [k, c.ticker, periode]);
  // Annee reelle des series annuelles (meme regle que la fiche : « FY2021 » -> 2021).
  const labels = useMemo(() => {
    if (!k || !spec) return undefined;
    const hp = (k as { history_periods?: unknown[] }).history_periods;
    const n = spec.values.length;
    if (k.period_type !== "quarter" && k.period_type !== "semester" && Array.isArray(hp) && hp.length === n && n > 0
      && hp.every((x) => typeof x === "string" && /^(?:FY)?\s*\d{4}$/i.test(x.trim()))) {
      return (hp as string[]).map((x) => x.trim().replace(/^FY\s*/i, ""));
    }
    return spec.labels.length === n ? spec.labels : undefined;
  }, [k, spec]);

  useEffect(() => {
    if (eclat === 0) return;
    const t = window.setTimeout(() => setEclat(0), 900);
    return () => window.clearTimeout(t);
  }, [eclat]);

  if (!k || !spec) return null;

  const donnees = spec.values.map((v) => v * spec.scaleFactor);
  const ttm = spec.ttm == null ? null : spec.ttm * spec.scaleFactor;
  const aff = computeChartDisplay(donnees, spec.unit, ttm, 1);
  const grandChiffre = aff.lastValue != null ? formatHeroValue(aff.lastValue, aff.displayUnit) : formatHeroValue(k.value ?? null, k.unit ?? "");
  const yoy = k.yoy && String(k.yoy).toLowerCase() !== "n/a" ? String(k.yoy) : null;
  const ton = yoy ? yoyTone(yoy, k.type) : "neutral";
  const couleurYoy = ton === "pos" ? "#10b981" : ton === "neg" ? "#f43f5e" : "#a1a1aa";
  const axePourcent = String(spec.unit ?? "").trim().startsWith("%");
  const dispo = {
    year: (() => {
      if (k.period_type !== "quarter" && k.period_type !== "semester") return true;
      const fyEnd = getFiscalAudit(c.ticker)?.fiscalYearEndMonth ?? 12;
      return aggregateQuarterlyToAnnual(k.history ?? [], k.last_data_date, getKpiAggregationKind(k), fyEnd, (k as { history_periods?: string[] }).history_periods).values.length > 0;
    })(),
    quarter: k.period_type === "quarter",
    semester: k.period_type === "semester",
  };

  const choisir = (short: string) => {
    const x = liste.find((y) => y.short === short);
    if (!x) return;
    onActif(short);
    setPeriode(periodeParDefaut(x));
    setEclat((n) => n + 1);
    defileVers(zone.current);
  };

  const graphique = (
    <ChartCycle
      mode={mode}
      data={donnees}
      labels={labels}
      unit={spec.unit}
      color={accent}
      company={c}
      activeShort={k.short}
      onPickKpi={choisir}
      ttm={ttm}
      periodType={periode}
      exportTitle={k.name_fr || k.short}
    />
  );
  const vus = tout ? liste : liste.slice(0, 8);

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold text-zinc-100">Indicateurs clés</h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-400">Touchez un indicateur de la liste pour afficher son graphique en grand.</p>
        </div>
      </div>

      <div ref={zone} data-zone-graphique
        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-4 transition-[border-color,box-shadow] duration-500 sm:p-6 ${eclat ? "" : "border-[#1f1f1f]"}`}
        style={eclat ? { borderColor: `${accent}aa`, boxShadow: `0 0 0 3px ${accent}22, 0 0 40px ${accent}22` } : undefined}>
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl" style={{ background: `${accent}26` }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">{k.short === c.hero_kpi ? "KPI principal" : "Indicateur affiché"}</div>
            <div className="mt-1 text-[17px] font-semibold leading-snug text-zinc-100">{k.name_fr || k.short}</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-[40px] font-bold leading-none tabular-nums sm:text-[46px]" style={{ color: accent }}>{grandChiffre.value}</span>
              <span className="text-[15px] text-zinc-400">{grandChiffre.unit}</span>
              {yoy && <span className="rounded-full border px-2 py-0.5 text-[12.5px] font-semibold" style={{ color: couleurYoy, borderColor: `${couleurYoy}55`, background: `${couleurYoy}14` }}>{yoy} sur un an</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ChartCycleControls mode={mode} onChange={setMode} color={accent} graphPeriod={periode} onGraphPeriodChange={setPeriode} graphPeriodAvailable={dispo} sansVariation={axePourcent} />
            <button type="button" onClick={() => setGrand(true)} aria-label="Ouvrir le graphique en plein écran"
              className="inline-flex size-8 items-center justify-center rounded-full border border-[#262626] bg-[#0a0a0a] text-zinc-400 transition-colors hover:border-[#3a3a3a] hover:text-zinc-100">
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="relative mt-4 cursor-zoom-in sm:cursor-auto" onClick={() => { if (window.innerWidth < 640) setGrand(true); }}>
          {graphique}
        </div>
        <ChartFullscreen open={grand} onClose={() => setGrand(false)} titre={`${k.name_fr || k.short} · ${c.name}`}>
          {graphique}
        </ChartFullscreen>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#080808]">
        {vus.map((x) => (
          <KpiRow key={x.short} kpi={x} active={x.short === k.short} subsector={c.subsector} ticker={c.ticker} onClick={() => choisir(x.short)} />
        ))}
        {liste.length > 8 && (
          <button type="button" onClick={() => setTout((t) => !t)} className="flex w-full items-center justify-center gap-2 border-t border-[#1a1a1a] bg-[#0a0a0a] px-6 py-4 text-sm text-zinc-400 hover:text-zinc-100">
            <ChevronDown className={`size-4 transition-transform ${tout ? "rotate-180" : ""}`} />
            {tout ? "Réduire" : `Voir ${liste.length - 8} indicateurs de plus`}
          </button>
        )}
      </div>
      <div className="mt-4"><UnitesMateriaux gicsCode={c.gics_code} secteurLabel={c.sector} unites={c.kpis.map((x) => x.unit)} /></div>
    </section>
  );
}
