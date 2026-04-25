"use client";

import { useState } from "react";
import {
  Briefcase,
  Vote,
  Users,
  Award,
  Building2,
  Scale,
  UserCheck,
  Info,
  Calendar,
  Landmark,
  PieChart,
} from "lucide-react";
import type { Governance, PeerRank, Shareholder } from "@/lib/data";
import { brand } from "@/lib/brand";
import { InfoTooltip } from "@/components/info-tooltip";
import { HolographicPie } from "@/components/holographic-pie";

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const RANK_META: Record<PeerRank, { label: string; color: string }> = {
  bas: { label: "Plus bas que la moyenne", color: "#10b981" },
  moyen: { label: "Dans la moyenne", color: "#a1a1aa" },
  haut: { label: "Plus haut que la moyenne", color: "#f59e0b" },
  "extrême": { label: "Bien au-dessus", color: "#f43f5e" },
};

function PeerChip({ rank, inverse = false }: { rank: PeerRank; inverse?: boolean }) {
  // inverse flag : lower is better. Flips color mapping for visual interpretation.
  const meta = RANK_META[rank];
  const displayColor =
    inverse && rank === "haut"
      ? RANK_META["haut"].color
      : inverse && rank === "bas"
        ? RANK_META["bas"].color
        : meta.color;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
      style={{
        background: `${displayColor}1a`,
        color: displayColor,
        border: `1px solid ${displayColor}40`,
      }}
    >
      {meta.label}
    </span>
  );
}

function MetricCell({
  Icon,
  label,
  value,
  color,
  tooltip,
  peerRank,
  inverse = false,
}: {
  Icon: typeof Briefcase;
  label: string;
  value: string;
  color: string;
  tooltip?: React.ReactNode;
  peerRank?: PeerRank;
  inverse?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-3.5">
      <span
        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: `${color}1a`, color, border: `1px solid ${color}40` }}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-zinc-200">{label}</span>
          {tooltip && (
            <InfoTooltip color={color}>{tooltip}</InfoTooltip>
          )}
        </div>
        <div className="mt-1 font-mono text-xl font-semibold tabular-nums" style={{ color }}>
          {value}
        </div>
        {peerRank && (
          <div className="mt-1.5">
            <PeerChip rank={peerRank} inverse={inverse} />
          </div>
        )}
      </div>
    </div>
  );
}

function HolderRow({ h, index }: { h: Shareholder; index: number }) {
  const typeMeta: Record<Shareholder["type"], { label: string; color: string }> = {
    institutionnel: { label: "Institutionnel", color: "#06b6d4" },
    particulier: { label: "Particulier", color: "#a78bfa" },
    insider: { label: "Insider", color: "#f59e0b" },
    fondateur: { label: "Fondateur", color: "#fbbf24" },
    "fonds souverain": { label: "Fonds souverain", color: "#10b981" },
  };
  const meta = typeMeta[h.type];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-3">
      <span
        className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500"
      >
        #{index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-zinc-100">{h.name}</span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{
              background: `${meta.color}1a`,
              color: meta.color,
              border: `1px solid ${meta.color}40`,
            }}
          >
            {meta.label}
          </span>
        </div>
        {h.role && (
          <div className="mt-0.5 text-[11.5px] text-zinc-400">{h.role}</div>
        )}
      </div>
      <div className="font-mono text-lg font-bold tabular-nums text-zinc-50">
        {fmt(h.stake_pct, 1)}
        <span className="ml-0.5 text-xs text-zinc-400"> %</span>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  // "2025-06-10" → "10 juin 2025"
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function GovernanceCard({
  governance,
  ticker,
}: {
  governance: Governance;
  ticker: string;
}) {
  const accent = brand(ticker).primary;
  const g = governance;
  const [pieOpen, setPieOpen] = useState<"voting" | "capital" | null>(null);

  // Color seeds for each metric (independent of peer rank — peer rank shown separately)
  const metrics = [
    {
      Icon: Briefcase,
      label: `Rémunération totale du CEO (${g.ceo_name})`,
      value: `${fmt(g.ceo_total_comp_m, 1)} M $`,
      color: "#a78bfa",
      tooltip: (
        <>
          <p className="text-[12px] leading-relaxed text-zinc-200">
            Total comp = salaire + bonus annuel + stock awards + options + avantages, sur l'exercice {g.fiscal_year}.
          </p>
        </>
      ),
      peerRank: g.ceo_comp_rank,
      inverse: true,
    },
    {
      Icon: Award,
      label: "Ratio rém. CEO / employé médian",
      value: `${fmt(g.ceo_pay_ratio)}×`,
      color: "#f59e0b",
      tooltip: (
        <p className="text-[12px] leading-relaxed text-zinc-200">
          Multiple entre la rémunération du CEO et celle de l'employé médian. Médiane S&P 500 ≈ 200×.
        </p>
      ),
      peerRank: g.ceo_pay_ratio_rank,
      inverse: true,
    },
    {
      Icon: Vote,
      label: "Approbation de la rémunération",
      value: `${fmt(g.exec_comp_approval_pct, 1)} %`,
      color: "#06b6d4",
      tooltip: (
        <p className="text-[12px] leading-relaxed text-zinc-200">
          Vote consultatif annuel des actionnaires sur la rémunération des dirigeants (équivalent anglophone : say-on-pay). Sous 80 % = mécontentement notable.
        </p>
      ),
      peerRank: g.exec_comp_approval_rank,
    },
    {
      Icon: UserCheck,
      label: "Indépendance du board",
      value: `${fmt(g.board_independence_pct)} %`,
      color: "#10b981",
      tooltip: (
        <p className="text-[12px] leading-relaxed text-zinc-200">
          Part des administrateurs indépendants (sans lien dirigeant, familial ou commercial). Les bourses NYSE / Nasdaq exigent une majorité.
        </p>
      ),
      peerRank: g.board_independence_rank,
    },
    {
      Icon: Users,
      label: "Taille du board",
      value: `${g.board_size} membres`,
      color: "#a78bfa",
      tooltip: g.directors && g.directors.length > 0 ? (
        <>
          <p className="mb-2 text-[12px] font-semibold text-zinc-100">
            Membres du conseil
          </p>
          <ul className="space-y-1 text-[11.5px] text-zinc-300">
            {g.directors.map((d, i) => (
              <li key={i}>
                <span className="font-medium text-zinc-100">{d.name}</span>
                <span className="text-zinc-400"> — {d.role}</span>
              </li>
            ))}
          </ul>
        </>
      ) : undefined,
    },
    {
      Icon: Calendar,
      label: "Ancienneté moyenne",
      value: `${fmt(g.avg_tenure_years, 1)} ans`,
      color: "#06b6d4",
      tooltip: (
        <p className="text-[12px] leading-relaxed text-zinc-200">
          Ancienneté moyenne des administrateurs. Trop court = manque d'expérience ; trop long (&gt;10 ans) = renouvellement insuffisant.
        </p>
      ),
    },
    // New metrics
    ...(g.board_women_pct !== undefined
      ? [
          {
            Icon: Users,
            label: "Diversité — femmes au board",
            value: `${fmt(g.board_women_pct)} %`,
            color: "#f43f5e",
            tooltip: (
              <p className="text-[12px] leading-relaxed text-zinc-200">
                % de femmes au conseil. Médiane S&P 500 ≈ 32 %. Certains investisseurs institutionnels votent contre les boards sous 30 %.
              </p>
            ),
          },
        ]
      : []),
    ...(g.avg_board_age !== undefined
      ? [
          {
            Icon: Calendar,
            label: "Âge moyen du board",
            value: `${fmt(g.avg_board_age)} ans`,
            color: "#a1a1aa",
          },
        ]
      : []),
    ...(g.insider_ownership_pct !== undefined
      ? [
          {
            Icon: Scale,
            label: "Détention insiders (dirigeants + board)",
            value: `${fmt(g.insider_ownership_pct, 2)} %`,
            color: "#fbbf24",
            tooltip: (
              <p className="text-[12px] leading-relaxed text-zinc-200">
                Part du capital détenue par les dirigeants et le board. Élevé = alignement fort avec actionnaires.
              </p>
            ),
          },
        ]
      : []),
  ];

  const metricsCount = metrics.length;
  // Centering logic: if we have an exact multiple of 3, grid fills naturally.
  // If metricsCount % 3 === 1 → center the last row (1 cell centered over 3 cols)
  // If metricsCount % 3 === 2 → center the last row (2 cells centered over 3 cols)
  const rem = metricsCount % 3;
  const fullRows = Math.floor(metricsCount / 3);
  const lastRowOffset = rem === 0 ? 0 : rem === 1 ? 1 : 0;
  const fullRowMetrics = metrics.slice(0, fullRows * 3);
  const lastRowMetrics = metrics.slice(fullRows * 3);

  return (
    <section className="mt-9 animate-fade-up-d2">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <Building2 className="size-5" style={{ color: accent }} />
            Gouvernance & rémunération
          </h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-300">
            À jour de l'assemblée générale du {formatDate(g.agm_date)}. Chiffres relatifs à l'exercice {g.fiscal_year}.
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {fullRowMetrics.map((m, i) => (
          <MetricCell key={i} {...m} />
        ))}
      </div>
      {lastRowMetrics.length > 0 && (
        <div
          className={`mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${
            rem === 1 ? "lg:grid-cols-3" : rem === 2 ? "lg:grid-cols-2 lg:mx-auto lg:max-w-[66%]" : "lg:grid-cols-3"
          }`}
        >
          {rem === 1 && <div className="hidden lg:block" />}
          {lastRowMetrics.map((m, i) => (
            <MetricCell key={i} {...m} />
          ))}
          {rem === 1 && <div className="hidden lg:block" />}
        </div>
      )}
      {/* unused but silence lint */}
      {false && <span>{lastRowOffset}</span>}

      {/* Voting structure note */}
      {g.voting_structure && (
        <div className="mt-4 rounded-lg border border-[#2a2a2a] bg-[#0c0c0c] p-3.5">
          <div className="flex items-start gap-2.5">
            <Scale className="mt-0.5 size-4 shrink-0 text-zinc-300" />
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
                Structure de vote
              </div>
              <div className="mt-0.5 text-[13px] text-zinc-200">{g.voting_structure}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top shareholders : voting rights + capital */}
      {(g.top_voting || g.top_capital) && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {g.top_voting && g.top_voting.length > 0 && (
            <button
              onClick={() => setPieOpen("voting")}
              className="group relative overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#080808] p-4 text-left transition-all hover:border-amber-400/40 hover:bg-[#0c0c0c]"
              style={{ boxShadow: "0 0 0 0 rgba(245,158,11,0.0)" }}
            >
              <div className="mb-2.5 flex items-center gap-2">
                <Vote className="size-4 text-amber-300" />
                <span className="font-sans text-[13px] font-semibold uppercase tracking-wider text-zinc-100">
                  Top 3 — Droits de vote
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-amber-200 opacity-0 transition-opacity group-hover:opacity-100">
                  <PieChart className="size-3" />
                  Vue 3D
                </span>
              </div>
              <div className="space-y-2">
                {g.top_voting.map((h, i) => (
                  <HolderRow key={h.name} h={h} index={i} />
                ))}
              </div>
            </button>
          )}
          {g.top_capital && g.top_capital.length > 0 && (
            <button
              onClick={() => setPieOpen("capital")}
              className="group relative overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#080808] p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-[#0c0c0c]"
            >
              <div className="mb-2.5 flex items-center gap-2">
                <Landmark className="size-4 text-cyan-300" />
                <span className="font-sans text-[13px] font-semibold uppercase tracking-wider text-zinc-100">
                  Top 3 — Capital détenu
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-cyan-200 opacity-0 transition-opacity group-hover:opacity-100">
                  <PieChart className="size-3" />
                  Vue 3D
                </span>
              </div>
              <div className="space-y-2">
                {g.top_capital.map((h, i) => (
                  <HolderRow key={h.name} h={h} index={i} />
                ))}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Holographic 3D Pie modal */}
      <HolographicPie
        shareholders={pieOpen === "voting" ? g.top_voting ?? [] : g.top_capital ?? []}
        title={pieOpen === "voting" ? "Top 3 — Droits de vote" : "Top 3 — Capital détenu"}
        open={pieOpen !== null}
        onClose={() => setPieOpen(null)}
        accent={pieOpen === "voting" ? "#f59e0b" : "#06b6d4"}
      />

      {g.notes && g.notes.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3.5">
          <div className="mb-2 flex items-center gap-1.5">
            <Info className="size-3.5 text-amber-200" />
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-amber-200">
              À noter
            </span>
          </div>
          <ul className="space-y-1 text-[13px] text-amber-100/95">
            {g.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-amber-400">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
