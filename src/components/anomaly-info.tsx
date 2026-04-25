"use client";

import { InfoTooltip } from "@/components/info-tooltip";
import type { Anomaly } from "@/lib/brand";

const CAUSE_BADGE: Record<Anomaly["cause"], { label: string; color: string }> = {
  performance: { label: "Performance", color: "#10b981" },
  perimeter: { label: "Périmètre / M&A", color: "#06b6d4" },
  reporting: { label: "Reporting", color: "#f59e0b" },
  unknown: { label: "À investiguer", color: "#a1a1aa" },
};

export function AnomalyInfo({
  anomaly,
  color = "#a78bfa",
}: {
  anomaly: Anomaly;
  color?: string;
}) {
  const badge = CAUSE_BADGE[anomaly.cause];
  return (
    <InfoTooltip color={color}>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{
            background: `${badge.color}1f`,
            color: badge.color,
            border: `1px solid ${badge.color}55`,
          }}
        >
          {badge.label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          Anomalie
        </span>
      </div>
      <div className="text-[13px] font-semibold text-zinc-100">{anomaly.title}</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-300">
        {anomaly.message}
      </p>
    </InfoTooltip>
  );
}
