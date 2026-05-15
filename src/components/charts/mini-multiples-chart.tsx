"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { type Company, formatUnit } from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { brand } from "@/lib/brand";

/**
 * Dashboard "instrument panel" view — 6 most important KPIs as mini sparklines.
 * Built specifically for V1 (chart mode within the hero panel, not stand-alone page).
 */
export function MiniMultiplesChart({
  company,
  activeShort,
  onPick,
}: {
  company: Company;
  activeShort: string;
  onPick: (short: string) => void;
}) {
  const accent = brand(company.ticker).primary;
  const top6 = useMemo(() => company.kpis.slice(0, 6), [company.kpis]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {top6.map((k) => {
        const tone = yoyTone(k.yoy, k.type);
        const yoyColor =
          tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";
        const isActive = k.short === activeShort;
        return (
          <button
            key={k.short}
            onClick={() => onPick(k.short)}
            className={`group relative overflow-hidden rounded-lg border p-3 text-left transition-colors ${
              isActive
                ? "border-[#3a3a3a] bg-[#0e0e0e]"
                : "border-[#1f1f1f] bg-[#0a0a0a] hover:border-[#2a2a2a] hover:bg-[#0c0c0c]"
            }`}
          >
            {isActive && (
              <span
                className="absolute left-0 top-0 h-full w-[2px]"
                style={{ background: accent }}
              />
            )}
            <div className="flex items-center justify-between gap-2">
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: `${accent}1a`,
                  color: accent,
                  border: `1px solid ${accent}33`,
                }}
              >
                {k.short}
              </span>
              <span
                className="inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums"
                style={{ color: yoyColor }}
              >
                {tone === "pos" && <ArrowUpRight className="size-3" />}
                {tone === "neg" && <ArrowDownRight className="size-3" />}
                {(() => {
                  // Yann 15 mai 2026 : guard anti-"null" en plein texte.
                  if (k.yoy == null) return null;
                  if (typeof k.yoy === "number" && Number.isFinite(k.yoy)) {
                    const sign = k.yoy > 0 ? "+" : "";
                    return `${sign}${k.yoy}%`;
                  }
                  if (typeof k.yoy === "string" && k.yoy.trim() && k.yoy.trim().toLowerCase() !== "null") {
                    return k.yoy;
                  }
                  return null;
                })()}
              </span>
            </div>
            <div className="mt-2 truncate text-[12px] text-zinc-200">{k.name_fr}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-lg font-semibold tabular-nums text-zinc-50">
                {k.value}
              </span>
              {formatUnit(k.unit) && (
                <span className="text-[10px] text-zinc-400">{formatUnit(k.unit)}</span>
              )}
            </div>
            <MiniSpark data={k.history} color={accent} />
          </button>
        );
      })}
    </div>
  );
}

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const w = 140;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * h * 0.85 - h * 0.075;
    return `${x},${y}`;
  });
  const path = `M ${pts.join(" L ")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-9 w-full">
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
      />
    </svg>
  );
}
