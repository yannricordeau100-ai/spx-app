"use client";

import { Sparkles, ArrowUpRight, AlertTriangle, Coins, Telescope } from "lucide-react";
import type { InterpretBlock, InterpretTone } from "@/lib/data";
import { normalizeNarrative } from "@/lib/ui-fix-templates";
import { useT } from "@/lib/i18n/provider";
import { AutoTooltipText } from "@/components/auto-tooltip-text";

const TONE: Record<
  InterpretTone,
  { color: string; bg: string; icon: typeof ArrowUpRight }
> = {
  pos: { color: "#10b981", bg: "rgba(16,185,129,0.06)", icon: ArrowUpRight },
  neg: { color: "#f43f5e", bg: "rgba(244,63,94,0.06)", icon: AlertTriangle },
  neutral: { color: "#a78bfa", bg: "rgba(167,139,250,0.06)", icon: Coins },
  future: { color: "#06b6d4", bg: "rgba(6,182,212,0.08)", icon: Telescope },
};

export function InterpretationBlock({
  block,
  accent = "#a78bfa",
}: {
  block: InterpretBlock;
  accent?: string;
}) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Sparkles className="size-4" style={{ color: accent }} />
        <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-200">
          {t("interpretation.header")}
        </span>
      </div>

      {/* Yann 27 mai 2026 : restore HTML rendering pour <strong>/<em>.
          AutoTooltipText escape le HTML → tags rendus comme texte brut.
          Fix : dangerouslySetInnerHTML directement (sécurisé car le texte
          vient de notre pipeline contrôlé, pas user input). */}
      <p
        className="text-[15.5px] leading-relaxed text-zinc-100 [&_em]:italic [&_em]:text-zinc-200 [&_strong]:font-semibold [&_strong]:text-zinc-50"
        dangerouslySetInnerHTML={{ __html: normalizeNarrative(block.lead) }}
      />

      <ul className="mt-5 grid gap-3">
        {block.bullets.map((b, i) => {
          const t = TONE[b.tone];
          const Icon = t.icon;
          const isFuture = b.tone === "future";
          return (
            <li
              key={i}
              className={`flex items-start gap-3.5 rounded-xl border p-4 ${
                isFuture ? "border-cyan-500/25" : "border-[#1a1a1a]"
              }`}
              style={{
                background: isFuture ? t.bg : "#070707",
                boxShadow: isFuture ? `0 0 32px ${t.color}1a inset` : undefined,
              }}
            >
              <span
                className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: `${t.color}1a`,
                  color: t.color,
                  border: `1px solid ${t.color}40`,
                }}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[12.5px] font-semibold uppercase tracking-wider"
                  style={{ color: t.color }}
                >
                  {b.label}
                </div>
                <p
                  className="mt-1.5 text-[14.5px] leading-relaxed text-zinc-200 [&_em]:italic [&_em]:text-zinc-100 [&_strong]:font-semibold [&_strong]:text-zinc-50"
                  dangerouslySetInnerHTML={{ __html: normalizeNarrative(b.body) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
