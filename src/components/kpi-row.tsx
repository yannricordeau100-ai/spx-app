"use client";

import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react";
import { type KPI, formatCAGR, formatUnit } from "@/lib/data";
import { cn, yoyTone } from "@/lib/utils";
import { rate } from "@/lib/brand";
import { Sparkline } from "@/components/effects/sparkline";
import { QualityBadge } from "@/components/quality-badge";
import { InfoTooltip } from "@/components/info-tooltip";
import { StarButton } from "@/components/star-button";
import { AcronymHover } from "@/components/acronym-hover";
import { useT } from "@/lib/i18n/provider";
import { normalizeNarrative } from "@/lib/ui-fix-templates";

const TYPE_COLOR: Record<string, string> = {
  Revenue: "#a78bfa",
  Margin: "#06b6d4",
  Cash: "#10b981",
  Volume: "#f59e0b",
  Pricing: "#f43f5e",
  Cost: "#fb7185",
  Investment: "#a78bfa",
  User: "#06b6d4",
  Demand: "#10b981",
};

export function KpiRow({
  kpi,
  active = false,
  onClick,
  subsector,
  ticker,
}: {
  kpi: KPI;
  active?: boolean;
  onClick?: () => void;
  subsector: string;
  ticker: string;
}) {
  const { t, locale } = useT();
  const primaryName = locale === "en" && kpi.name_en ? kpi.name_en : kpi.name_fr;
  const secondaryName = locale === "en" ? kpi.name_fr : kpi.name_en;
  const tone = yoyTone(kpi.yoy, kpi.type);
  const yoyColor =
    tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";
  const accent = TYPE_COLOR[kpi.type] ?? "#a78bfa";
  const r = rate(kpi);
  const formattedUnit = formatUnit(kpi.unit);
  const cagrLabel = formatCAGR(kpi.history, kpi.unit);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={cn(
        "group relative grid w-full cursor-pointer grid-cols-12 items-center gap-3 border-b border-[#1a1a1a] px-5 py-4 text-left transition-colors hover:bg-[#0c0c0c] focus:outline-none focus-visible:bg-[#0c0c0c] sm:px-6 sm:py-5",
        active && "bg-[#0d0d0d]"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0 h-full w-[3px] origin-bottom transition-transform duration-300",
          active ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"
        )}
        style={{ background: accent }}
      />

      {active && (
        <span
          className="absolute right-12 top-3 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Check className="size-3" />
          {t("kpi.active")}
        </span>
      )}

      {/* Étoile favori : toujours top-right absolu du module */}
      <span className="absolute right-2 top-2 z-10">
        <StarButton
          mode="kpi"
          ticker={ticker}
          kpiShort={kpi.short}
          size="sm"
          stopPropagation
        />
      </span>

      {/* COL 1 — Indicateur (4 cols). Acronym + name centered vertically together. */}
      <div className="col-span-12 sm:col-span-4">
        <div className="flex items-center gap-2.5">
          <AcronymHover
            align="left"
            label={`${kpi.name_fr}${
              kpi.name_en && kpi.name_en !== kpi.name_fr ? ` (${kpi.name_en})` : ""
            }`}
          >
            <span
              className="cursor-help rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: `${accent}1a`,
                color: accent,
                border: `1px solid ${accent}33`,
              }}
            >
              {kpi.short}
            </span>
          </AcronymHover>
          <div className="min-w-0 leading-tight">
            <div className="text-[15.5px] font-medium text-zinc-100">{primaryName}</div>
            {secondaryName && secondaryName !== primaryName && (
              <div className="text-[11.5px] text-zinc-400">{secondaryName}</div>
            )}
          </div>
          <InfoTooltip color={accent}>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
              {t("kpi.definition")}
            </div>
            <div className="text-zinc-200">{kpi.explanation}</div>
          </InfoTooltip>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{
              borderColor: `${accent}33`,
              color: accent,
              background: `${accent}10`,
            }}
          >
            {kpi.type}
          </span>
          <span className="inline-flex items-center rounded-md border border-[#262626] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            {kpi.nature}
          </span>
        </div>
      </div>

      {/* COL 2 — Valeur · YoY (2 cols) */}
      <div className="col-span-6 sm:col-span-2">
        <div className="font-mono text-[26px] font-semibold tabular-nums leading-none text-zinc-50">
          {kpi.value}
          {formattedUnit && (
            <span className="ml-1 text-sm font-normal text-zinc-400">{formattedUnit}</span>
          )}
        </div>
        {/* Yann 13 mai 2026 : tolère yoy nombre brut (ex GWW yoy=4.5, DINO yoy=-6
           sortis du pipeline LLM sans formatting) en plus de la string standard
           ("+4.5%"). Pour les nombres : ajoute le signe + et le %. */}
        {(() => {
          // Yann 14 mai 2026 : fallback calculé depuis history quand kpi.yoy
          // est vide (1 049 KPIs concernés dans le SP1500). Évite pill vide.
          let yoyStr: string | null = null;
          if (typeof kpi.yoy === "number" && Number.isFinite(kpi.yoy)) {
            const sign = kpi.yoy > 0 ? "+" : "";
            yoyStr = `${sign}${kpi.yoy}%`;
          } else if (typeof kpi.yoy === "string" && kpi.yoy.trim()) {
            if (kpi.yoy.toLowerCase() === "n/a") return null;
            yoyStr = kpi.yoy;
          } else if (Array.isArray(kpi.history) && kpi.history.length >= 2) {
            const last = kpi.history[kpi.history.length - 1];
            const prev = kpi.history[kpi.history.length - 2];
            if (typeof last === "number" && typeof prev === "number" && prev !== 0) {
              const pct = ((last - prev) / Math.abs(prev)) * 100;
              const sign = pct > 0 ? "+" : "";
              yoyStr = `${sign}${pct.toFixed(1).replace(".", ",")} %`;
            }
          }
          if (!yoyStr) return null;
          return (
            <div
              className="mt-2 inline-flex items-center gap-1 font-mono text-[13px] tabular-nums"
              style={{ color: yoyColor }}
            >
              {tone === "pos" && <ArrowUpRight className="size-3.5" />}
              {tone === "neg" && <ArrowDownRight className="size-3.5" />}
              {yoyStr}
              <span className="text-[10.5px] italic text-zinc-400">{t("hero.yoy")}</span>
            </div>
          );
        })()}
        {cagrLabel && (
          <div className="mt-1 font-mono text-[11.5px] tabular-nums text-zinc-400">
            {cagrLabel}
            <span className="ml-1 text-[10px] italic text-zinc-500">{t("hero.cagr_5y")}</span>
          </div>
        )}
      </div>

      {/* COL 3 — Tendance (2 cols) */}
      <div className="col-span-6 sm:col-span-2">
        <Sparkline data={kpi.history} height={42} color={accent} />
      </div>

      {/* COL 4 — Qualité (stacked) + Signal */}
      <div className="col-span-12 sm:col-span-4">
        <QualityBadge rating={r} size="sm" scope={subsector} layout="stack" />
        <div className="mt-2 line-clamp-2 text-[13px] leading-snug text-zinc-200">
          {(() => {
            // Yann 14 mai 2026 : fallback dynamique si signal vide
            // (1 068 KPIs concernés). Génère depuis trend history.
            if (kpi.signal && kpi.signal.trim()) return normalizeNarrative(kpi.signal);
            const h = Array.isArray(kpi.history) ? kpi.history : [];
            if (h.length < 2) return "";
            const last = h[h.length - 1];
            const first = h[0];
            const prev = h[h.length - 2];
            if (typeof last !== "number" || typeof first !== "number" || typeof prev !== "number") return "";
            const totalPct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
            const lastPct = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : 0;
            if (totalPct > 30 && lastPct > 0) return "Tendance haussière soutenue sur la période.";
            if (totalPct > 10 && lastPct > 0) return "Croissance modérée mais constante.";
            if (totalPct > 0 && lastPct < -5) return "Ralentissement récent malgré une tendance positive.";
            if (totalPct < -10 && lastPct < 0) return "Trajectoire baissière à surveiller.";
            if (Math.abs(totalPct) < 10) return "Stabilité sur la période, peu de mouvement.";
            return "Évolution mixte selon la période observée.";
          })()}
        </div>
      </div>
    </div>
  );
}
