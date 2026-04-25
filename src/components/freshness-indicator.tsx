"use client";

import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { getFreshness, type FreshnessTier } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";

const META: Record<
  FreshnessTier,
  { color: string; Icon: typeof Clock; label: string; explainer: string }
> = {
  fresh: {
    color: "#10b981",
    Icon: CheckCircle2,
    label: "À jour",
    explainer: "Le dernier point de donnée a moins de 4 mois — exercice fiscal le plus récent.",
  },
  recent: {
    color: "#a1a1aa",
    Icon: Clock,
    label: "Récent",
    explainer:
      "Le dernier point de donnée a entre 4 et 12 mois. Toujours valide mais le prochain exercice approche.",
  },
  stale: {
    color: "#f59e0b",
    Icon: AlertTriangle,
    label: "Données vieillissantes",
    explainer:
      "Le dernier point de donnée a plus de 12 mois. La société a probablement publié un exercice plus récent — la donnée affichée n'est plus à jour.",
  },
  unknown: {
    color: "#a1a1aa",
    Icon: HelpCircle,
    label: "Date inconnue",
    explainer: "Pas de date associée à ce point de donnée.",
  },
};

/**
 * Compact freshness pill. Shows nothing when fresh by default (clean UI),
 * appears as a warning when stale.
 */
export function FreshnessIndicator({
  lastDate,
  alwaysShow = false,
  size = "sm",
}: {
  lastDate?: string;
  alwaysShow?: boolean;
  size?: "sm" | "md";
}) {
  const tier = getFreshness(lastDate);
  if (tier === "fresh" && !alwaysShow) return null;

  const meta = META[tier];
  const Icon = meta.Icon;
  const isSm = size === "sm";

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
      {meta.label}
      <InfoTooltip color={meta.color} size="sm">
        <p className="text-[12px] leading-relaxed text-zinc-200">{meta.explainer}</p>
        {lastDate && (
          <p className="mt-1 font-mono text-[10.5px] text-zinc-400">
            Dernière donnée : {lastDate}
          </p>
        )}
      </InfoTooltip>
    </span>
  );
}
