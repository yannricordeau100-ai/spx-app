"use client";

import type { Rating } from "@/lib/brand";
import { Crown, TrendingUp, Trophy } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { translateSubsectorLocale } from "@/lib/ui-fix-templates";

/**
 * Quality + percentile badge (V4) :
 *  - Vertical stack: Quality chip on top, then "Top X % · sub-sector" below.
 *  - Top-tier (Top 1/5/10 %) gets gold/amber color (NOT green) to avoid confusion
 *    with the Excellent green chip.
 */
export function QualityBadge({
  rating,
  size = "md",
  scope,
  layout = "stack",
}: {
  rating: Rating;
  size?: "sm" | "md";
  scope: string;
  /** "stack" = badge then percentile underneath. "inline" = side by side. */
  layout?: "stack" | "inline";
}) {
  const { t, locale } = useT();
  const isSm = size === "sm";
  const isTop1 = rating.percentile.includes("Top 1 ");
  const isTop5 = rating.percentile.includes("Top 5 ");
  const isTop10 = rating.percentile.includes("Top 10 ");
  const isTopTier = isTop1 || isTop5 || isTop10;

  const Icon = isTop1 ? Crown : isTop5 ? Trophy : isTop10 ? TrendingUp : null;
  const topColor = isTop1 ? "#FFD700" : isTop5 ? "#FFC03A" : "#F59E0B";
  // Yann 17 mai 2026 : tier label via i18n (FR par défaut, EN/DE/etc via t()).
  // `rating.label` reste FR-canonical pour back-compat (brand.ts), mais
  // l'affichage UI privilégie systématiquement la version traduite.
  const tierLabel = t(`tier.${rating.tier}`);
  // Yann 18 mai 2026 : scope = subsector traduit locale-aware (Halbleiter sur DE).
  const scopeLocalized = translateSubsectorLocale(scope, locale);

  const QualityChip = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${
        isSm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12.5px]"
      }`}
      style={{ background: `${rating.color}1f`, color: rating.color }}
    >
      <span className="size-1.5 rounded-full" style={{ background: rating.color }} />
      {tierLabel}
    </span>
  );

  const PercentileChip = (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md font-mono font-medium ${
        isSm ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-0.5 text-[11.5px]"
      }`}
      style={{
        background: isTopTier ? `${topColor}18` : "rgba(255,255,255,0.04)",
        color: isTopTier ? topColor : "#a1a1aa",
        border: `1px solid ${isTopTier ? `${topColor}55` : "#262626"}`,
        boxShadow: isTopTier ? `0 0 12px ${topColor}33` : undefined,
      }}
      title={`${rating.percentile} · ${scopeLocalized}`}
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {Icon && <Icon className={isSm ? "size-3" : "size-3.5"} />}
        {rating.percentile}
      </span>
      <span className="font-sans normal-case tracking-normal text-zinc-400 break-words [overflow-wrap:anywhere]">
        · {scopeLocalized}
      </span>
    </span>
  );

  if (layout === "inline") {
    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        {QualityChip}
        {PercentileChip}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      {QualityChip}
      {PercentileChip}
    </div>
  );
}

/** Exported parts so callers can interleave other chips (e.g. CAGR) between them. */
export function QualityChipOnly({ rating, size = "md" }: { rating: Rating; size?: "sm" | "md" }) {
  const { t } = useT();
  const isSm = size === "sm";
  const tierLabel = t(`tier.${rating.tier}`);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${
        isSm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12.5px]"
      }`}
      style={{ background: `${rating.color}1f`, color: rating.color }}
    >
      <span className="size-1.5 rounded-full" style={{ background: rating.color }} />
      {tierLabel}
    </span>
  );
}

export function PercentileChipOnly({
  rating,
  scope,
  size = "md",
}: {
  rating: Rating;
  scope: string;
  size?: "sm" | "md";
}) {
  const { locale } = useT();
  const isSm = size === "sm";
  const isTop1 = rating.percentile.includes("Top 1 ");
  const isTop5 = rating.percentile.includes("Top 5 ");
  const isTop10 = rating.percentile.includes("Top 10 ");
  const isTopTier = isTop1 || isTop5 || isTop10;
  const Icon = isTop1 ? Crown : isTop5 ? Trophy : isTop10 ? TrendingUp : null;
  const topColor = isTop1 ? "#FFD700" : isTop5 ? "#FFC03A" : "#F59E0B";
  // Yann 18 mai 2026 : scope locale-aware (Halbleiter sur DE).
  const scopeLocalized = translateSubsectorLocale(scope, locale);

  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md font-mono font-medium ${
        isSm ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-0.5 text-[11.5px]"
      }`}
      style={{
        background: isTopTier ? `${topColor}18` : "rgba(255,255,255,0.04)",
        color: isTopTier ? topColor : "#a1a1aa",
        border: `1px solid ${isTopTier ? `${topColor}55` : "#262626"}`,
        boxShadow: isTopTier ? `0 0 12px ${topColor}33` : undefined,
      }}
      title={`${rating.percentile} · ${scopeLocalized}`}
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {Icon && <Icon className={isSm ? "size-3" : "size-3.5"} />}
        {rating.percentile}
      </span>
      <span className="font-sans normal-case tracking-normal text-zinc-400 break-words [overflow-wrap:anywhere]">
        · {scopeLocalized}
      </span>
    </span>
  );
}
