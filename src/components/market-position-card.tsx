"use client";

import { motion } from "motion/react";
import { Target, TrendingUp } from "lucide-react";
import { isOfficialSource, type Company, type MarketPosition } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";
import { brand } from "@/lib/brand";

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
function unitLabel(unit: string) {
  if (unit === "$B") return "Md $";
  if (unit === "$M") return "M $";
  return unit;
}

export function MarketPositionCard({
  company,
  position,
  wide = false,
}: {
  company: Company;
  position: MarketPosition;
  wide?: boolean;
}) {
  const c = brand(company.ticker).primary;
  const share = (position.segment_revenue / position.tam) * 100;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#1a1a1a] bg-gradient-to-b from-[#0a0a0a] to-[#070707] ${
        wide ? "p-6 lg:p-7" : "p-5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Target className="size-4" style={{ color: c }} />
            <span className="font-sans text-[12.5px] font-semibold uppercase tracking-[0.12em] text-zinc-100">
              Position marché
            </span>
            <InfoTooltip color={c}>
              <div
                className="mb-1.5 font-mono text-[10px] uppercase tracking-wider"
                style={{ color: c }}
              >
                {isOfficialSource(position.source) ? "Méthodologie" : "Source & méthodologie"}
              </div>
              {!isOfficialSource(position.source) && (
                <div className="mb-2 text-[12px] font-semibold text-zinc-100">
                  {position.source}
                </div>
              )}
              {position.source_note && (
                <p className="text-[12px] leading-relaxed text-zinc-300">{position.source_note}</p>
              )}
              {position.tam_range && (
                <p className="mt-2 text-[11.5px] italic text-zinc-400">
                  Fourchette du marché total : {fmt(position.tam_range[0])} — {fmt(position.tam_range[1])} {unitLabel(position.tam_unit)}.
                </p>
              )}
            </InfoTooltip>
          </div>
          <div className="mt-1 text-[14px] font-medium text-zinc-100">
            {position.segment_name}
          </div>
        </div>
      </div>

      {/* Hero share — the most important number, big */}
      <div className="mt-5 flex items-end gap-3">
        <div
          className="font-display font-bold leading-none tabular-nums"
          style={{
            color: c,
            fontSize: wide ? "5.5rem" : "4rem",
            textShadow: `0 0 40px ${c}55`,
          }}
        >
          {fmt(share, 1)}
          <span
            className="ml-1 font-sans font-semibold"
            style={{ fontSize: wide ? "2rem" : "1.5rem", color: c }}
          >
            %
          </span>
        </div>
        <div className="mb-2 text-[14px] leading-tight text-zinc-200">
          captés par<br />
          <span className="font-semibold text-zinc-50">{company.name}</span>
        </div>
      </div>

      {/* Full-width animated market share bar */}
      <div className="mt-5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#0e0e12]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0.5, Math.min(100, share))}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-0 left-0"
            style={{
              background: `linear-gradient(90deg, ${c}, ${c}dd 60%, ${c}88)`,
              boxShadow: `0 0 18px ${c}77`,
              borderRadius: "9999px",
            }}
          />
          {/* Tick marks */}
          {[25, 50, 75].map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 w-px bg-[#222]"
              style={{ left: `${t}%` }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] tabular-nums text-zinc-400">
          <span>0 %</span>
          <span>50 %</span>
          <span>100 %</span>
        </div>
      </div>

      {/* Numbers row : segment vs TAM, side by side, with growth */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#1f1f1f] bg-[#0c0c0c] p-3">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
            Revenu du segment ({company.name})
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-50">
            {position.segment_revenue}
            <span className="ml-1 text-sm font-medium text-zinc-300">
              {unitLabel(position.segment_unit)}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-[#1f1f1f] bg-[#0c0c0c] p-3">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
            Taille totale du marché
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-50">
            {position.tam}
            <span className="ml-1 text-sm font-medium text-zinc-300">
              {unitLabel(position.tam_unit)}
            </span>
          </div>
        </div>
      </div>

      {position.market_cagr !== undefined && (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ borderColor: `${c}33`, background: `${c}10` }}
        >
          <TrendingUp className="size-4" style={{ color: c }} />
          <span className="text-[12.5px] text-zinc-200">
            Le marché grandit d'environ
          </span>
          <span className="font-mono text-[14px] font-bold tabular-nums" style={{ color: c }}>
            +{position.market_cagr} %
          </span>
          <span className="text-[12.5px] text-zinc-300">par an.</span>
        </div>
      )}

      {position.source && !isOfficialSource(position.source) && (
        <div className="mt-3 text-[11px] italic text-zinc-400">
          Source : {position.source}. Estimation indicative.
        </div>
      )}
    </div>
  );
}
