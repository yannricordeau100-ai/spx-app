"use client";

import { motion } from "motion/react";
import { Sparkles, ArrowRight, Crown } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { StarButton } from "@/components/star-button";
import type { SuperKpi } from "@/lib/super-kpi";

function CategoryChip({ category, color }: { category: SuperKpi["category"]; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider"
      style={{
        background: `${color}1a`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {category}
    </span>
  );
}

function TierBadge({ tier, label, color }: { tier: SuperKpi["tier"]; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider"
      style={{ background: `${color}1f`, color, border: `1px solid ${color}55` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {tier === "na" ? "N/A" : label}
    </span>
  );
}

/** Jauge horizontale 0-100 avec animation. */
function Gauge({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 1.1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}55, ${color})` }}
      />
    </div>
  );
}

/** Carte standard pour un super-KPI (hors signature). */
function SuperKpiCard({ kpi, accent, ticker }: { kpi: SuperKpi; accent: string; ticker?: string }) {
  void accent;
  const isNA = kpi.tier === "na";
  return (
    <div
      className="relative rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
      style={{
        boxShadow: !isNA ? `inset 0 0 0 1px ${kpi.color}10, 0 0 32px ${kpi.color}08` : undefined,
      }}
    >
      {/* Background halo subtil */}
      {!isNA && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-30 blur-3xl"
          style={{ background: kpi.color }}
        />
      )}

      {/* Étoile : top-right absolu du module */}
      {ticker && (
        <span className="absolute right-2 top-2 z-10">
          <StarButton mode="kpi" ticker={ticker} kpiShort={kpi.id} isSuper size="sm" />
        </span>
      )}

      <div className="relative">
        {/* Header : name (avec "i" collé au texte) + category */}
        <div className="pr-8">
          <div className="flex items-center gap-1.5">
            <div className="text-[14.5px] font-semibold text-zinc-50">{kpi.name}</div>
            <InfoTooltip color={kpi.color}>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: kpi.color }}>
                Méthodologie
              </div>
              <p className="text-[12px] leading-relaxed text-zinc-200">{kpi.interpretation}</p>
              <div className="mt-2.5 rounded-md border border-[#1f1f1f] bg-[#0c0c0c] p-2">
                <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">Formule</div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-100">{kpi.formula}</div>
                <div className="mt-2 font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">Benchmark</div>
                <div className="mt-0.5 text-[11px] text-zinc-200">{kpi.benchmark}</div>
              </div>
            </InfoTooltip>
          </div>
          <div className="mt-1">
            <CategoryChip category={kpi.category} color={kpi.color} />
          </div>
        </div>

        {/* Valeur principale + tier */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div
            className="font-display text-[40px] font-bold leading-none tracking-tight tabular-nums"
            style={{ color: isNA ? "#71717a" : kpi.color }}
          >
            {kpi.display}
          </div>
          <TierBadge tier={kpi.tier} label={kpi.tierLabel} color={kpi.color} />
        </div>

        {/* Jauge */}
        {!isNA && (
          <div className="mt-3.5">
            <Gauge pct={kpi.gaugePct} color={kpi.color} />
          </div>
        )}

        {/* Inputs sources (transparence) */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {kpi.inputs.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-md border border-[#1f1f1f] bg-[#070707] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Carte signature large (Mettrik Profit Power Index) — full width, jauge circulaire. */
function SignatureCard({ kpi }: { kpi: SuperKpi }) {
  const isNA = kpi.tier === "na";
  // Jauge circulaire (SVG)
  const RADIUS = 70;
  const STROKE = 11;
  const CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - kpi.gaugePct / 100);

  return (
    <div
      className="relative rounded-2xl border bg-gradient-to-br from-[#0a0a0a] to-[#070707] p-5 sm:p-6"
      style={{
        borderColor: `${kpi.color}55`,
        boxShadow: !isNA ? `inset 0 0 0 1px ${kpi.color}22, 0 0 60px ${kpi.color}15` : undefined,
      }}
    >
      {/* Halo backdrop */}
      {!isNA && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full opacity-30 blur-3xl"
            style={{ background: kpi.color }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -bottom-20 size-72 rounded-full opacity-20 blur-3xl"
            style={{ background: kpi.color }}
          />
        </>
      )}

      <div className="relative grid items-center gap-6 lg:grid-cols-[auto_1fr]">
        {/* Jauge circulaire à gauche */}
        <div className="flex shrink-0 flex-col items-center">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <defs>
              <linearGradient id="ppi-gauge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={kpi.color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={kpi.color} stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle
              cx="90"
              cy="90"
              r={RADIUS}
              fill="none"
              stroke="#1a1a1a"
              strokeWidth={STROKE}
            />
            {/* Progress */}
            <motion.circle
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              cx="90"
              cy="90"
              r={RADIUS}
              fill="none"
              stroke="url(#ppi-gauge)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              transform="rotate(-90 90 90)"
            />
            {/* Centre : score */}
            <text
              x="90"
              y="93"
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize="42"
              fontWeight="800"
              fill={isNA ? "#71717a" : "#fafafa"}
            >
              {isNA ? "—" : Math.round(kpi.value ?? 0)}
            </text>
            <text
              x="90"
              y="118"
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize="11"
              fontWeight="600"
              fill="#71717a"
              letterSpacing="0.1em"
            >
              / 100
            </text>
          </svg>
          <div className="mt-2">
            <TierBadge tier={kpi.tier} label={kpi.tierLabel} color={kpi.color} />
          </div>
        </div>

        {/* Détails à droite */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Crown className="size-4" style={{ color: kpi.color }} />
            <span
              className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: kpi.color }}
            >
              Composite signature Mettrik
            </span>
            <InfoTooltip color={kpi.color} align="right">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: kpi.color }}>
                Méthodologie
              </div>
              <p className="text-[12px] leading-relaxed text-zinc-200">{kpi.interpretation}</p>
              <div className="mt-2.5 rounded-md border border-[#1f1f1f] bg-[#0c0c0c] p-2">
                <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">Formule normalisée</div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-100">{kpi.formula}</div>
                <div className="mt-2 font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">Échelle</div>
                <div className="mt-0.5 text-[11px] text-zinc-200">{kpi.benchmark}</div>
                <p className="mt-2 text-[11px] italic text-zinc-400">
                  Pondération choisie pour donner le poids maximal à la qualité du couple croissance/marge (Rule of 40), sans négliger la diversification ni la trajectoire de marges.
                </p>
              </div>
            </InfoTooltip>
          </div>
          <h3 className="mt-1 text-[24px] font-bold text-zinc-50">{kpi.name}</h3>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-zinc-300">
            {kpi.interpretation}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {kpi.inputs.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-[#1f1f1f] bg-[#070707] px-2.5 py-1.5"
              >
                <ArrowRight className="size-3" style={{ color: kpi.color }} />
                <span className="font-mono text-[11.5px] text-zinc-200">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SuperKpiBoard({
  kpis,
  sectorKpis = [],
  companyName,
  ticker,
  accent = "#a78bfa",
}: {
  kpis: SuperKpi[];
  sectorKpis?: SuperKpi[];
  companyName?: string;
  ticker?: string;
  accent?: string;
}) {
  if (!kpis || kpis.length === 0) return null;
  const signature = kpis.find((k) => k.id === "ppi");
  const others = kpis.filter((k) => k.id !== "ppi");

  return (
    <section
      id="sec-super"
      className="relative mt-9 scroll-mt-24 rounded-2xl border border-[#1f1f1f] bg-[#070707] p-5 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <Sparkles className="size-5" style={{ color: accent }} />
            Super-KPI Mettrik
          </h2>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            Combinaisons d'au moins 2 indicateurs bruts pour révéler des dimensions
            composites qu'aucun KPI seul ne capture. La majorité sont des standards
            adoptés par les pros de la finance ; le Mettrik Profit Power Index est
            une signature Mettrik propriétaire (clairement marquée).
          </p>
        </div>
      </div>

      {/* Signature en hero */}
      {signature && <SignatureCard kpi={signature} />}

      {/* Grid 2 colonnes pour les autres */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {others.map((k) => (
          <SuperKpiCard key={k.id} kpi={k} accent={accent} ticker={ticker} />
        ))}
      </div>

      {/* Sous-bloc sector-specific — calibré sur le business model de la sté */}
      {sectorKpis.length > 0 && (
        <div className="mt-7 border-t border-[#1f1f1f] pt-5">
          <h3 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-zinc-50">
            <Sparkles className="size-4" style={{ color: accent }} />
            Super-KPI Mettrik · {companyName ?? "spécifiques"}
            <span
              className="font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-400"
            >
              calibrés sur le business model
            </span>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {sectorKpis.map((k) => (
              <SuperKpiCard key={k.id} kpi={k} accent={accent} ticker={ticker} />
            ))}
          </div>
        </div>
      )}

    </section>
  );
}
