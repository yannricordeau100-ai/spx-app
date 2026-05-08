"use client";

import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { getFreshness, type FreshnessTier } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";

const META: Record<
  FreshnessTier,
  { color: string; Icon: typeof Clock; labelKey: string; explainerKey: string }
> = {
  fresh: {
    color: "#10b981",
    Icon: CheckCircle2,
    labelKey: "company.up_to_date",
    explainerKey: "company.fresh_explainer",
  },
  recent: {
    // Avant gris (#a1a1aa) — Yann demande couleur plus vive pour montrer
    // que la donnée est récente et utilisable, pas un signal négatif.
    color: "#06b6d4",
    Icon: Clock,
    labelKey: "company.recent",
    explainerKey: "company.recent_explainer",
  },
  stale: {
    color: "#f59e0b",
    Icon: AlertTriangle,
    labelKey: "company.stale",
    explainerKey: "company.stale_explainer",
  },
  unknown: {
    color: "#a1a1aa",
    Icon: HelpCircle,
    labelKey: "company.unknown_date",
    explainerKey: "company.unknown_explainer",
  },
};

/** Format approximatif d'une date ISO selon la locale ("~ 29 avril 2026" ou "April 29, 2026"). */
function formatApproxDate(iso?: string, locale: string = "fr"): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Convertit une date ISO en label trimestre ("Q4 2025"). */
function quarterFromIso(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `Q${q} ${d.getFullYear()}`;
  } catch {
    return null;
  }
}

/**
 * Compact freshness pill. Shows nothing when fresh by default (clean UI),
 * appears as a warning when stale.
 */
export function FreshnessIndicator({
  lastDate,
  nextEarningsDate,
  alwaysShow = false,
  size = "sm",
  tooltipAlign = "left",
}: {
  lastDate?: string;
  /** Date approximative des prochains résultats / prochaine donnée. */
  nextEarningsDate?: string;
  alwaysShow?: boolean;
  size?: "sm" | "md";
  /** Alignement du tooltip "i" — utiliser "right" quand l'indicateur est
   *  placé en bord-droit d'un petit conteneur (ex : cartes home), sinon
   *  le tooltip déborde à droite. */
  tooltipAlign?: "left" | "right" | "center";
}) {
  const { t, locale } = useT();
  const tier = getFreshness(lastDate);
  if (tier === "fresh" && !alwaysShow) return null;

  const meta = META[tier];
  const Icon = meta.Icon;
  const isSm = size === "sm";
  const lastFormatted = formatApproxDate(lastDate, locale);
  const lastQuarter = quarterFromIso(lastDate);
  const nextFormatted = formatApproxDate(nextEarningsDate, locale);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${
        isSm ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-1 text-[11.5px]"
      }`}
      style={{
        background: `${meta.color}1a`,
        color: meta.color,
        border: `1px solid ${meta.color}40`,
      }}
    >
      <Icon className={isSm ? "size-3" : "size-3.5"} />
      {t(meta.labelKey)}
      <InfoTooltip color={meta.color} size="sm" align={tooltipAlign}>
        <p className="text-[12px] leading-relaxed text-zinc-200">{t(meta.explainerKey)}</p>
        {lastQuarter && (
          <p className="mt-2 font-mono text-[10.5px] text-zinc-300">
            {t("company.last_quarter")} <span className="font-bold text-zinc-100">{lastQuarter}</span>
          </p>
        )}
        {lastFormatted && (
          <p className="mt-1 font-mono text-[10.5px] text-zinc-400">
            {t("company.last_data")} {lastFormatted}
          </p>
        )}
        {nextFormatted && (
          <p
            className="mt-1 font-mono text-[10.5px] font-semibold"
            style={{ color: "#facc15" }}
          >
            {t("company.next_results")} {nextFormatted}
          </p>
        )}
      </InfoTooltip>
    </span>
  );
}
