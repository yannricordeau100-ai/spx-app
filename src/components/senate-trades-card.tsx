"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Landmark, ArrowUpRight, ArrowDownRight, Clock, ChevronDown } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import type { SenateTrade } from "@/lib/senate-trades";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";

const PARTY_META: Record<SenateTrade["party"], { labelKey: string; color: string; bg: string }> = {
  R: { labelKey: "senate.party.R", color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  D: { labelKey: "senate.party.D", color: "#3b82f6", bg: "rgba(59,130,246,0.10)" },
  I: { labelKey: "senate.party.I", color: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
};

function fmtUSD(n: number, locale: Locale = "fr"): string {
  const sym = locale === "fr" ? "$" : "$";
  if (n >= 1_000_000) return locale === "fr"
    ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} M${sym}`
    : `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return locale === "fr"
    ? `${(n / 1000).toFixed(0)} k${sym}`
    : `$${(n / 1000).toFixed(0)}k`;
  return locale === "fr" ? `${n} ${sym}` : `$${n}`;
}

function relativeDate(iso: string, t: (k: string) => string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return t("senate.relative.today");
  if (days === 1) return t("senate.relative.yesterday");
  if (days < 30) return t("senate.relative.days_ago").replace("{n}", String(days));
  if (days < 60) return t("senate.relative.month_ago");
  if (days < 365) return t("senate.relative.months_ago").replace("{n}", String(Math.floor(days / 30)));
  if (days < 730) return t("senate.relative.year_ago");
  return t("senate.relative.years_ago").replace("{n}", String(Math.floor(days / 365)));
}

function initials(name: string): string {
  const parts = name.replace(/[.,]/g, "").trim().split(/\s+/);
  return parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function SenateTradesCard({
  trades,
  ticker,
  accent = "#a78bfa",
}: {
  trades: SenateTrade[];
  ticker: string;
  accent?: string;
}) {
  const { t, locale } = useT();
  const [showAll, setShowAll] = useState(false);
  if (!trades || trades.length === 0) return null;

  // Filtre 6 mois (Yann 5 mai 2026) : ne montrer que les transactions
  // récentes pour rester actionnable. Les vieilles tx (>6 mois) sont
  // historiques et brouillent le signal court terme.
  const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30.4 * 6;
  const cutoff = Date.now() - SIX_MONTHS_MS;
  const recentTrades = trades.filter((tr) => +new Date(tr.date) >= cutoff);
  // Si aucune tx <6 mois, on n'affiche rien (la card disparaît).
  if (recentTrades.length === 0) return null;

  const buyCount = recentTrades.filter((tr) => tr.type === "Purchase").length;
  const sellCount = recentTrades.filter((tr) => tr.type === "Sale").length;
  const total = buyCount + sellCount;
  const buyShare = total > 0 ? buyCount / total : 0.5;

  const sentiment =
    buyCount > sellCount * 1.5
      ? { label: t("senate.bullish"), color: "#10b981", explainer: t("senate.bullish_explainer") }
      : sellCount > buyCount * 1.5
      ? { label: t("senate.bearish"), color: "#f43f5e", explainer: t("senate.bearish_explainer") }
      : { label: t("senate.neutral"), color: "#a1a1aa", explainer: t("senate.neutral_explainer") };

  const maxMid = Math.max(...recentTrades.map((tr) => (tr.amount_low + tr.amount_high) / 2), 1);
  const sorted = [...recentTrades].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  // Cap visuel : 5 tx par défaut, dropdown pour le reste si >5 (cohérent
  // avec le pattern KPI normaux de la page société).
  const VISIBLE_CAP = 5;
  const hasOverflow = sorted.length > VISIBLE_CAP;
  const visibleTrades = showAll ? sorted : sorted.slice(0, VISIBLE_CAP);
  const hiddenCount = sorted.length - VISIBLE_CAP;

  return (
    <section
      id="sec-senate"
      className="relative mt-9 scroll-mt-24 overflow-hidden rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-5 sm:p-6"
    >
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div
          className="absolute -left-24 top-0 size-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)" }}
        />
        <div
          className="absolute -right-24 bottom-0 size-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(239,68,68,0.18), transparent 70%)" }}
        />
      </div>

      <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <Landmark className="size-5" style={{ color: accent }} />
            {t("senate.title_prefix")} {ticker}
            <InfoTooltip color={accent} align="left">
              <p className="text-[12px] leading-relaxed text-zinc-200">
                {t("senate.tooltip_body")}
              </p>
              <p className="mt-2 text-[11.5px] text-zinc-300">
                {t("senate.tooltip_alpha")}
              </p>
              <p className="mt-2 font-mono text-[10.5px] text-zinc-400">
                {t("senate.source_line")}
              </p>
            </InfoTooltip>
          </h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-300">
            {t("senate.subtitle")}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider"
              style={{
                color: sentiment.color,
                background: `${sentiment.color}1a`,
                borderColor: `${sentiment.color}55`,
              }}
            >
              <span className="size-1.5 rounded-full" style={{ background: sentiment.color }} />
              {t("senate.signal_label")} : {sentiment.label}
            </span>
            <InfoTooltip color={sentiment.color} align="right">
              <p className="text-[12px] leading-relaxed text-zinc-200">{sentiment.explainer}</p>
              <p className="mt-2 text-[11.5px] text-zinc-300">
                {buyCount} {buyCount > 1 ? t("senate.buy_many") : t("senate.buy_one")} / {sellCount} {sellCount > 1 ? t("senate.sell_many") : t("senate.sell_one")} — {trades.length} {t("senate.tx_visible")}
              </p>
            </InfoTooltip>
          </div>
          <div className="relative h-2 w-48 overflow-hidden rounded-full bg-[#1a1a1a]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${buyShare * 100}%` }}
              transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(1 - buyShare) * 100}%` }}
              transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 right-0 rounded-full bg-rose-400"
            />
          </div>
          <div className="flex w-48 justify-between font-mono text-[10px] text-zinc-400">
            <span>{buyCount} {buyCount > 1 ? t("senate.buy_many") : t("senate.buy_one")}</span>
            <span>{sellCount} {sellCount > 1 ? t("senate.sell_many") : t("senate.sell_one")}</span>
          </div>
        </div>
      </div>

      <div className="relative grid gap-2.5">
        {visibleTrades.map((tr, i) => {
          const meta = PARTY_META[tr.party];
          const mid = (tr.amount_low + tr.amount_high) / 2;
          const widthPct = 60 + (mid / maxMid) * 40;
          const isBuy = tr.type === "Purchase";
          const ArrowIcon = isBuy ? ArrowUpRight : ArrowDownRight;
          const tradeColor = isBuy ? "#10b981" : "#f43f5e";
          const isLate = tr.filing_lag_days > 45;

          return (
            <motion.div
              key={`${tr.senator}-${tr.date}`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-xl border bg-[#0a0a0a] transition-all hover:translate-x-1 hover:border-[#3a3a3a]"
              style={{
                width: `${widthPct}%`,
                borderColor: `${meta.color}55`,
                borderLeftWidth: 4,
                borderLeftColor: meta.color,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-40 transition-opacity group-hover:opacity-70"
                style={{
                  background: `linear-gradient(90deg, ${meta.bg} 0%, transparent 60%)`,
                }}
              />

              <div className="relative flex items-center gap-4 p-3.5 sm:gap-5">
                <div
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-bold"
                  style={{
                    background: `${meta.color}22`,
                    color: meta.color,
                    border: `1.5px solid ${meta.color}66`,
                  }}
                >
                  {initials(tr.senator)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[14.5px] font-semibold text-zinc-50">
                      {tr.senator}
                    </span>
                    <span
                      className="font-mono text-[10.5px] font-semibold uppercase tracking-wider"
                      style={{ color: meta.color }}
                    >
                      {tr.party} · {tr.state}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-zinc-400">
                    <Clock className="size-3" />
                    <span>{relativeDate(tr.date, t)}</span>
                    <span>·</span>
                    <span>{t("senate.declared_within").replace("{n}", String(tr.filing_lag_days))}</span>
                    {isLate && (
                      <span className="inline-flex items-center gap-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-amber-300">
                        {t("senate.late_filing")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      color: tradeColor,
                      background: `${tradeColor}1a`,
                      border: `1px solid ${tradeColor}55`,
                    }}
                  >
                    <ArrowIcon className="size-3" />
                    {isBuy ? t("senate.purchase") : t("senate.sale")}
                  </span>
                  <span className="font-mono text-[13px] font-bold tabular-nums text-zinc-100">
                    {fmtUSD(tr.amount_low, locale)} — {fmtUSD(tr.amount_high, locale)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Dropdown chevron : meme pattern UX que les KPI normaux (toggle
          show all). Affiché seulement si >5 tx récentes. */}
      {hasOverflow && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="relative mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
        >
          <ChevronDown className={`size-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
          <span>
            {showAll
              ? t("senate.show_less")
              : `${t("senate.show_more_prefix")} ${hiddenCount} ${hiddenCount > 1 ? t("senate.tx_many") : t("senate.tx_one")}`}
          </span>
        </button>
      )}

      <p className="relative mt-4 text-center font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
        {t("senate.demo_footer")}
      </p>
    </section>
  );
}
