"use client";

import { BarChart3 } from "lucide-react";
import { DeskCard, HelpTip, Pill } from "./ui";

const METRICS = [
  { label: "Visiteurs uniques (30j)", value: "—", source: "Plausible / Posthog", color: "violet" as const },
  { label: "Inscriptions (30j)", value: "—", source: "Supabase auth", color: "cyan" as const },
  { label: "MRR", value: "—", source: "Stripe", color: "green" as const, hint: "Monthly Recurring Revenue. Somme des abonnements actifs ramenés au mois." },
  { label: "Churn (30j)", value: "—", source: "Stripe", color: "red" as const, hint: "% d'abonnés qui résilient sur la période. Indicateur clé de la satisfaction." },
  { label: "Taux conversion free → premium", value: "—", source: "Supabase + Stripe", color: "amber" as const },
  { label: "ARPU", value: "—", source: "Stripe", color: "violet" as const, hint: "Average Revenue Per User. MRR / nombre d'utilisateurs payants." },
];

export function TabMetrics() {
  return (
    <div>
      <DeskCard className="mb-4 border-amber-500/20 bg-amber-500/[0.04]">
        <div className="text-[12px] text-amber-200">
          ⚠️ <strong>Placeholder</strong>. Câblage à faire après installation de Plausible (visiteurs) ou Posthog (funnels) + connexion API Stripe pour MRR/churn. ETA : 1-2 jours quand tu seras prêt.
        </div>
      </DeskCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((m) => (
          <DeskCard key={m.label}>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">{m.label}</span>
              <Pill color={m.color}>{m.source}</Pill>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-[28px] font-bold tabular-nums text-zinc-700">{m.value}</span>
              {m.hint && <HelpTip>{m.hint}</HelpTip>}
            </div>
          </DeskCard>
        ))}
      </div>

      <DeskCard className="mt-4">
        <div className="mb-2 text-[12px] font-medium text-zinc-200">Stack analytics recommandée</div>
        <ul className="space-y-1.5 text-[12px] text-zinc-400">
          <li>• <strong className="text-zinc-200">Plausible</strong> : visiteurs uniques, sources de trafic, pages populaires. <em>Privacy-first, RGPD-compliant sans cookie banner</em>. ~9 €/mois.</li>
          <li>• <strong className="text-zinc-200">Posthog</strong> : funnels, sessions replay, A/B testing. <em>Free tier généreux</em> (1M events/mois).</li>
          <li>• <strong className="text-zinc-200">Stripe Dashboard</strong> : MRR, churn, ARPU déjà calculés. Lecture API pour syncer ici.</li>
        </ul>
      </DeskCard>
    </div>
  );
}
