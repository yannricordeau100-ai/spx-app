"use client";

import { Brain, TrendingUp, Zap, ShieldAlert, MinusCircle } from "lucide-react";
import type { AIPositioning } from "@/lib/data";
import { brand } from "@/lib/brand";

const STANCE_META: Record<
  AIPositioning["stance"],
  { label: string; color: string; Icon: typeof Brain; description: string }
> = {
  leader: {
    label: "Acteur majeur",
    color: "#a78bfa",
    Icon: Brain,
    description: "L'IA est au cœur de la stratégie et des produits.",
  },
  integrator: {
    label: "Intégrateur",
    color: "#06b6d4",
    Icon: Zap,
    description: "L'IA est intégrée de façon significative aux opérations et à l'offre.",
  },
  cautious: {
    label: "Observateur prudent",
    color: "#f59e0b",
    Icon: ShieldAlert,
    description: "L'IA est mentionnée mais l'intégration reste limitée ou émergente.",
  },
  absent: {
    label: "Aucun positionnement",
    color: "#71717a",
    Icon: MinusCircle,
    description: "Aucune mention significative de l'IA dans les communications officielles.",
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
  const accent = brand(ticker).primary;

  // If no positioning data at all, render "absent" card by default
  const effective: AIPositioning =
    positioning ?? {
      stance: "absent",
      summary: `${companyName} n'a pas communiqué de positionnement explicite sur l'IA dans ses dépôts légaux ni ses conférences récentes. À reconsidérer dès qu'une position sera formulée.`,
      evidence: [],
      source: "Non disclosé",
    };

  const meta = STANCE_META[effective.stance];
  const Icon = meta.Icon;

  return (
    <section className="mt-9 animate-fade-up-d1">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
          <Brain className="size-5" style={{ color: accent }} />
          Positionnement de {companyName} sur l'IA
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
            {meta.label}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            {meta.description}
          </span>
        </div>

        <p className="mt-4 text-[15px] leading-relaxed text-zinc-100">
          {effective.summary}
        </p>

        {effective.evidence.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
              Éléments concrets
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
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 font-mono text-[11px] italic text-zinc-400">
          Source : {effective.source}
        </div>
      </div>
    </section>
  );
}
