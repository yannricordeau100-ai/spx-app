"use client";

import { Sparkles, TrendingUp, Building2 } from "lucide-react";
import type { KPI, MarketPosition } from "@/lib/data";
import { brand } from "@/lib/brand";
import type { StorySlide } from "@/lib/kpi-stories-ordering";
import { formatUnit } from "@/lib/data";

/**
 * Une carte du bloc Stories : soit un KPI short-history, soit une
 * MarketPosition. Format vertical façon Instagram story.
 */
export function KpiStoryCard({ slide, ticker }: { slide: StorySlide; ticker: string }) {
  const accent = brand(ticker).primary;
  const glow = brand(ticker).glow;

  if (slide.kind === "kpi") {
    return <KpiCard kpi={slide.data} accent={accent} glow={glow} />;
  }
  return <MarketPositionStoryCard mp={slide.data} accent={accent} glow={glow} />;
}

/* -------- KPI card (short-history) — format portrait mobile 9:16 -------- */
function KpiCard({ kpi, accent, glow }: { kpi: KPI; accent: string; glow: string }) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-5 pt-12"
      style={{
        boxShadow: `inset 0 0 120px ${glow}`,
      }}
    >
      {/* Halos pour ambiance mobile premium */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}55` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}33` }}
      />

      <div className="relative flex h-full flex-col">
        <div
          className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{
            background: `${accent}1a`,
            color: accent,
            borderColor: `${accent}55`,
          }}
        >
          <Sparkles className="size-3" />
          {kpi.story_category || "Story"}
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider"
            style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}
          >
            {kpi.short}
          </span>
        </div>
        <div className="mt-1.5 text-[15px] font-semibold leading-tight text-zinc-50">
          {kpi.name_fr}
        </div>
        {kpi.name_en && kpi.name_en !== kpi.name_fr && (
          <div className="text-[11.5px] italic text-zinc-400">{kpi.name_en}</div>
        )}

        {/* Chiffre principal — gros, centré au milieu de la card */}
        <div className="my-auto py-6 text-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text"
            style={{ fontSize: "clamp(38px, 14vw, 60px)" }}
          >
            {kpi.value}
          </div>
          {formatUnit(kpi.unit) && (
            <div className="mt-1 text-[15px] font-medium text-zinc-300">
              {formatUnit(kpi.unit)}
            </div>
          )}

          {kpi.yoy && kpi.yoy.toLowerCase() !== "n/a" && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[13px] font-medium text-emerald-200">
              <TrendingUp className="size-3.5" />
              <span className="font-mono tabular-nums">{kpi.yoy}</span>
              <span className="text-[10.5px] italic text-zinc-400">(YoY)</span>
            </div>
          )}
        </div>

        {/* Signal en bas de la card (clé du business) */}
        {kpi.signal && (
          <div className="mt-auto rounded-xl border border-white/8 bg-black/40 p-3.5 backdrop-blur">
            <div className="text-[13px] font-semibold leading-snug text-zinc-50">
              {kpi.signal}
            </div>
            {kpi.description && (
              <div className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-zinc-300">
                {kpi.description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------- MarketPosition story card -------- */
function MarketPositionStoryCard({
  mp,
  accent,
  glow,
}: {
  mp: MarketPosition;
  accent: string;
  glow: string;
}) {
  const sharePct = (mp.segment_revenue / mp.tam) * 100;
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-5 pt-12"
      style={{ boxShadow: `inset 0 0 120px ${glow}` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}55` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}33` }}
      />

      <div className="relative flex h-full flex-col">
        <div
          className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ background: `${accent}1a`, color: accent, borderColor: `${accent}55` }}
        >
          <Building2 className="size-3" />
          Marché · TAM
        </div>

        <div className="text-[15px] font-semibold leading-tight text-zinc-50">
          {mp.segment_name}
        </div>

        <div className="my-auto py-6 text-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text"
            style={{ fontSize: "clamp(46px, 16vw, 72px)" }}
          >
            {sharePct.toFixed(1)}&nbsp;%
          </div>
          <div className="mt-1 text-[13px] text-zinc-300">part de marché</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/8 bg-black/30 p-2.5 backdrop-blur">
            <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
              Revenu segment
            </div>
            <div className="mt-1 font-mono text-[13.5px] font-bold tabular-nums text-zinc-50">
              {mp.segment_revenue}
              <span className="ml-1 text-[10px] font-normal text-zinc-400">
                {formatUnit(mp.segment_unit)}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-white/8 bg-black/30 p-2.5 backdrop-blur">
            <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
              TAM
            </div>
            <div className="mt-1 font-mono text-[13.5px] font-bold tabular-nums text-zinc-50">
              {mp.tam}
              <span className="ml-1 text-[10px] font-normal text-zinc-400">
                {formatUnit(mp.tam_unit)}
              </span>
            </div>
          </div>
        </div>

        {mp.market_cagr != null && (
          <div className="mt-2 text-[11.5px] text-zinc-300">
            CAGR marché attendu :{" "}
            <span className="font-mono font-semibold text-zinc-50">
              +{mp.market_cagr.toFixed(1)} % / an
            </span>
          </div>
        )}

        <div className="mt-3 text-[10.5px] italic leading-snug text-zinc-400">
          Source : {mp.source}
          {mp.source_note && <> · {mp.source_note}</>}
        </div>
      </div>
    </div>
  );
}
