"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, GitCompare } from "lucide-react";
import type { KPI } from "@/lib/data";
import type { findComparable } from "@/lib/data";
import { brand } from "@/lib/brand";
import { useT } from "@/lib/i18n/provider";

type Comparables = ReturnType<typeof findComparable>;

export function CompareControl({
  comparables,
  activeKpi,
  open,
  onToggle,
  onPick,
}: {
  comparables: Comparables;
  activeKpi: KPI;
  open: boolean;
  onToggle: () => void;
  onPick: (t: string) => void;
}) {
  const { t, locale } = useT();
  const kpiName = locale === "en" && activeKpi.name_en ? activeKpi.name_en : activeKpi.name_fr;
  const triggerClass =
    "inline-flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#0a0a0a] px-3.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-[#3a3a3a] hover:text-zinc-50 disabled:opacity-50";

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={comparables.length === 0}
        className={triggerClass}
      >
        <GitCompare className="size-4" />
        <span>{t("company.compare.button")}</span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-[#262626] bg-[#0a0a0a] shadow-2xl"
          >
            <div className="border-b border-[#1a1a1a] px-3 py-2.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                {t("company.compare.on")}
              </div>
              <div className="mt-0.5 text-[12.5px] text-zinc-200">
                <span className="font-medium">{activeKpi.short}</span>
                <span className="text-zinc-400"> · {kpiName}</span>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {comparables.length === 0 ? (
                <div className="px-3 py-4 text-[12px] text-zinc-400">
                  {t("company.compare.empty")}&nbsp;
                  <em>{activeKpi.short}</em>.
                </div>
              ) : (
                comparables.map(({ ticker, company, matchedKpi, score }) => {
                  const accent = brand(ticker).primary;
                  return (
                    <button
                      key={ticker}
                      onClick={() => onPick(ticker)}
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#141414]"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          className="mt-1 size-2 shrink-0 rounded-full"
                          style={{ background: accent }}
                        />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-zinc-100">
                            {company.name}
                          </div>
                          <div className="truncate text-[11px] text-zinc-400">
                            ↳ {matchedKpi.short} · {locale === "en" && matchedKpi.name_en ? matchedKpi.name_en : matchedKpi.name_fr}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${
                          score >= 100
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-zinc-700/30 text-zinc-300"
                        }`}
                      >
                        {score >= 100 ? t("company.compare.direct") : t("company.compare.connex")}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
