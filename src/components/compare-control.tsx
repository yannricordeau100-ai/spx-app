"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, GitCompare } from "lucide-react";
import { useEffect, useState } from "react";
import type { KPI } from "@/lib/data";
import { brand } from "@/lib/brand";
import { useT } from "@/lib/i18n/provider";

type Item = { ticker: string; name: string; short: string };

/** Suffixe ?audit_token=... repris de l adresse de la page (controle interne). */
export function suffixeJeton(prefixe: "?" | "&"): string {
  if (typeof window === "undefined") return "";
  const j = new URLSearchParams(window.location.search).get("audit_token");
  return j ? `${prefixe}audit_token=${encodeURIComponent(j)}` : "";
}

export function CompareControl({
  ticker,
  activeKpi,
  open,
  onToggle,
  onPick,
}: {
  ticker: string;
  activeKpi: KPI;
  open: boolean;
  onToggle: () => void;
  onPick: (t: string) => void;
}) {
  const { t, locale } = useT();
  // Yann 11 sept 2026 : liste servie par /api/compare sur les 666 fiches
  // (cle de comparabilite = libelle normalise + famille d unite).
  const [comparables, setComparables] = useState<Item[] | null>(null);
  const [refus, setRefus] = useState(false);
  useEffect(() => {
    if (!open) return;
    let vivant = true;
    setComparables(null);
    fetch(`/api/compare?t=${encodeURIComponent(ticker)}&k=${encodeURIComponent(activeKpi.short)}${suffixeJeton("&")}`)
      .then(async (r) => {
        if (!vivant) return;
        if (r.status === 403) { setRefus(true); setComparables([]); return; }
        const j = (await r.json()) as { items?: Item[] };
        setComparables(j.items ?? []);
      })
      .catch(() => vivant && setComparables([]));
    return () => { vivant = false; };
  }, [open, ticker, activeKpi.short]);
  const kpiName = locale === "en" && activeKpi.name_en ? activeKpi.name_en : activeKpi.name_fr;
  const triggerClass =
    "inline-flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#0a0a0a] px-2.5 py-2 sm:px-3.5 text-sm font-medium text-zinc-200 transition-colors hover:border-[#3a3a3a] hover:text-zinc-50 disabled:opacity-50";

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={triggerClass}
      >
        <GitCompare className="size-4" />
        {/* Mobile (1er sept 2026) : icone seule, le libelle depassait du 375px */}
        <span className="hidden sm:inline">{t("company.compare.button")}</span>
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
              {comparables === null ? (
                <div className="px-3 py-4 text-[12px] text-zinc-400">Recherche des sociétés comparables…</div>
              ) : refus ? (
                <div className="px-3 py-4 text-[12px] text-zinc-300">La comparaison entre sociétés est réservée aux abonnés.</div>
              ) : comparables.length === 0 ? (
                <div className="px-3 py-4 text-[12px] text-zinc-400">
                  {t("company.compare.empty")}&nbsp;
                  <em>{kpiName}</em>.
                </div>
              ) : (
                comparables.map(({ ticker: tk, name, short }) => {
                  const accent = brand(tk).primary;
                  return (
                    <button
                      key={tk}
                      onClick={() => onPick(tk)}
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#141414]"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: accent }} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-zinc-100">{name}</div>
                          <div className="truncate text-[11px] text-zinc-400">{short}</div>
                        </div>
                      </div>
                      <span className="mt-0.5 shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-emerald-300">
                        {t("company.compare.direct")}
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
