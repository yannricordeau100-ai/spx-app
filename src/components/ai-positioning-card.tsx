"use client";

import { Brain, TrendingUp, Zap, ShieldAlert, MinusCircle } from "lucide-react";
import { isOfficialSource, type AIPositioning } from "@/lib/data";
import { brand } from "@/lib/brand";
import { useT } from "@/lib/i18n/provider";
import { normalizeNarrative } from "@/lib/ui-fix-templates";

const STANCE_META: Record<
  AIPositioning["stance"],
  { labelKey: string; descKey: string; color: string; Icon: typeof Brain }
> = {
  leader: {
    labelKey: "ai.stance.leader.label",
    descKey: "ai.stance.leader.desc",
    color: "#a78bfa",
    Icon: Brain,
  },
  integrator: {
    labelKey: "ai.stance.integrator.label",
    descKey: "ai.stance.integrator.desc",
    color: "#06b6d4",
    Icon: Zap,
  },
  cautious: {
    labelKey: "ai.stance.cautious.label",
    descKey: "ai.stance.cautious.desc",
    color: "#f59e0b",
    Icon: ShieldAlert,
  },
  absent: {
    labelKey: "ai.stance.absent.label",
    descKey: "ai.stance.absent.desc",
    color: "#71717a",
    Icon: MinusCircle,
  },
};

export function AIPositioningCard({
  positioning,
  companyName,
  ticker,
}: {
  positioning?: AIPositioning;
  companyName: string;
  ticker: string;
}) {
  const { t } = useT();
  const accent = brand(ticker).primary;

  const effective: AIPositioning =
    positioning ?? {
      stance: "absent",
      summary: `${companyName} ${t("ai.absent_summary")}`,
      evidence: [],
      source: t("ai.absent_source"),
    };

  // Garde-fou : nouveaux datasets peuvent avoir des stances hors mapping
  const meta = STANCE_META[effective.stance] ?? STANCE_META.absent;
  const Icon = meta.Icon;

  return (
    <section className="mt-9 animate-fade-up-d1">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
          <Brain className="size-5" style={{ color: accent }} />
          {t("ai.title_prefix")} {companyName} {t("ai.title_suffix")}
        </h2>
      </div>

      <div
        className="overflow-hidden rounded-2xl border p-5 sm:p-6"
        style={{
          borderColor: `${meta.color}33`,
          background: `linear-gradient(180deg, ${meta.color}0a 0%, #070707 60%)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold uppercase tracking-wider"
            style={{
              background: `${meta.color}1f`,
              color: meta.color,
              border: `1px solid ${meta.color}55`,
            }}
          >
            <Icon className="size-3.5" />
            {t(meta.labelKey)}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            {t(meta.descKey)}
          </span>
        </div>

        <p className="mt-4 text-[15px] leading-relaxed text-zinc-100">
          {effective.summary ? normalizeNarrative(effective.summary) : effective.summary}
        </p>

        {Array.isArray(effective.evidence) && effective.evidence.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
              {t("ai.evidence_label")}
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {effective.evidence.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-2.5 text-[13px] leading-snug text-zinc-200"
                >
                  <TrendingUp
                    className="mt-0.5 size-3.5 shrink-0"
                    style={{ color: meta.color }}
                  />
                  {typeof e === "string" ? normalizeNarrative(e) : e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {effective.source && !isOfficialSource(effective.source) && (
          <div className="mt-4 font-mono text-[11px] italic text-zinc-400">
            {t("ai.source")} : {effective.source}
          </div>
        )}
      </div>
    </section>
  );
}
