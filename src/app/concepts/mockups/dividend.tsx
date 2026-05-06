"use client";

import { useState } from "react";
import { CONCEPT_COMPANIES, getConceptCompany } from "@/lib/concepts-data";
import { TICKERS } from "@/lib/data";
import { DividendStories } from "@/components/dividend-stories";
import { DividendAristocratCard } from "@/components/dividend-aristocrat-card";
import { DividendCalculatorCard } from "@/components/dividend-calculator-card";
import { DividendSnowballCard } from "@/components/dividend-snowball-card";
import { brand } from "@/lib/brand";

/**
 * Mockup `Dividende` du hub /concepts.
 *
 * Permet d'itérer sur plusieurs versions visuelles du bloc Stories Dividendes
 * sans toucher la V1.7 publique. À chaque variante = un layout distinct,
 * facilement comparable côté à côté pour Yann.
 *
 * Variantes actuelles :
 *  A. Carrousel autoplay 5s (= version actuellement plugée sur company-view.tsx
 *     côté CAT, identique au bloc KPI Stories : phone-frame 9:16, dots, pause hover)
 *  B. Grille 3 colonnes (toutes les cards visibles d'un coup, pas de carrousel,
 *     plus dense, idéale écran desktop large)
 *
 * À ajouter ultérieurement (placeholders prêts dans le code) :
 *  C. Stack vertical (1 colonne pleine largeur, scroll naturel)
 *  D. Tabs (clic pour switcher entre les 3 cards, sans autoplay)
 */

type Variant = "A_carrousel" | "B_grid" | "C_stack" | "D_tabs";

const VARIANT_LABELS: Record<Variant, { title: string; sub: string }> = {
  A_carrousel: {
    title: "A · Carrousel phone",
    sub: "Auto-play 5s, format mobile, comme le bloc KPI Stories.",
  },
  B_grid: {
    title: "B · Grille 3 colonnes",
    sub: "Tout visible d'un coup, dense, idéal desktop.",
  },
  C_stack: {
    title: "C · Stack vertical",
    sub: "1 colonne pleine largeur, scroll naturel.",
  },
  D_tabs: {
    title: "D · Onglets",
    sub: "Clic pour switcher, pas d'auto-play.",
  },
};

export function MockupDividend() {
  const [ticker, setTicker] = useState<string>("CAT");
  // Default = grid 3 colonnes côte à côte (Yann 7 mai 2026).
  const [variant, setVariant] = useState<Variant>("B_grid");

  // Toutes les sociétés versant un dividende (DPS présent OU is CAT pour
  // bénéficier du fallback hard-codé). À mesure que CONV-DATA enrichit les
  // datasets, la liste grossit automatiquement.
  const dividendStocks: string[] = TICKERS.filter((t) => {
    const c = CONCEPT_COMPANIES[t];
    return c?.kpis.some((k) => k.short === "DPS") || t === "CAT";
  });
  const availableTickers = dividendStocks.length > 0 ? dividendStocks : ["CAT"];

  const company = getConceptCompany(ticker);
  if (!company) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-zinc-300">
        <p>
          Société {ticker} introuvable côté concepts. Re-vérifier
          <code className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px]">
            src/data/concepts/
          </code>
          .
        </p>
      </div>
    );
  }

  const accent = brand(company.ticker).primary;
  const glow = brand(company.ticker).glow;

  // KPIs dividendes + fallback CAT statique (cohérent avec dividend-stories.tsx)
  const dpsKpi = company.kpis.find((k) => k.short === "DPS");
  const capRetKpi = company.kpis.find((k) => k.short === "Cap Return");
  const payoutKpi = company.kpis.find((k) => k.short === "Payout Ratio");
  const isCAT = company.ticker === "CAT";
  const dpsAnnual = Number(dpsKpi?.value) || (isCAT ? 5.4 : 0);
  const dpsYoy = dpsKpi?.yoy || (isCAT ? "+7.1%" : "");
  const dpsHistory =
    (dpsKpi?.history as number[]) || (isCAT ? [4.32, 4.5, 4.78, 5.04, 5.4] : []);
  const capReturn = Number(capRetKpi?.value) || (isCAT ? 7.9 : 0);
  const capReturnUnit = capRetKpi?.unit || (isCAT ? "$B" : "");
  const payoutRatio = Number(payoutKpi?.value) || (isCAT ? 32 : 0);
  const defaultPrice = 390;
  const yieldPct = (dpsAnnual / defaultPrice) * 100;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Sticky bar : ticker + variante */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        {/* Sélection sté */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
            Société
          </span>
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {availableTickers.map((t) => (
              <button
                key={t}
                onClick={() => setTicker(t)}
                className={`rounded-full px-2.5 py-1 font-mono text-[11px] tabular-nums transition-colors ${
                  ticker === t
                    ? "bg-violet-500/25 text-violet-100"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <span className="text-zinc-600">·</span>

        {/* Sélection variante */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
            Variante
          </span>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(Object.keys(VARIANT_LABELS) as Variant[]).map((v) => {
              const isActive = variant === v;
              const isAvailable = v === "A_carrousel" || v === "B_grid";
              return (
                <button
                  key={v}
                  onClick={() => isAvailable && setVariant(v)}
                  disabled={!isAvailable}
                  title={
                    isAvailable
                      ? VARIANT_LABELS[v].sub
                      : "Variante à venir (placeholder)"
                  }
                  className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
                    isActive
                      ? "bg-violet-500/25 text-violet-100 shadow-[0_0_8px_rgba(167,139,250,0.35)]"
                      : isAvailable
                      ? "text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100"
                      : "cursor-not-allowed text-zinc-600"
                  }`}
                >
                  {VARIANT_LABELS[v].title.split(" · ")[0]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Titre + sous-titre de la variante */}
      <header className="mb-6">
        <h2 className="font-display text-[24px] font-bold tracking-tight text-zinc-50">
          {VARIANT_LABELS[variant].title}
        </h2>
        <p className="mt-1 text-[13.5px] text-zinc-400">
          {VARIANT_LABELS[variant].sub}
        </p>
      </header>

      {/* Rendu de la variante */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a0a0e] to-[#050507] p-6 sm:p-8">
        {variant === "A_carrousel" && <DividendStories company={company} />}

        {variant === "B_grid" && (
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h3 className="text-[20px] font-semibold text-zinc-50">
                  Politique de dividende
                </h3>
                <p className="mt-0.5 max-w-2xl text-[13px] text-zinc-300">
                  Les 3 angles côte à côte, sans carrousel.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {/* Chaque card est ratio 9:16 mais bornée pour ne pas exploser */}
              <div
                className="mx-auto w-full overflow-hidden rounded-[36px] border border-white/10"
                style={{
                  aspectRatio: "9 / 16",
                  maxWidth: 360,
                  boxShadow: `0 0 0 8px #0a0a0a, 0 0 0 9px #1f1f1f, 0 30px 80px -20px ${accent}55`,
                }}
              >
                <DividendAristocratCard
                  accent={accent}
                  glow={glow}
                  dps={dpsAnnual}
                  dpsYoy={dpsYoy}
                  dpsHistory={dpsHistory}
                  capReturn={capReturn}
                  capReturnUnit={capReturnUnit}
                  payoutRatio={payoutRatio}
                  yearsStreak={31}
                />
              </div>
              <div
                className="mx-auto w-full overflow-hidden rounded-[36px] border border-white/10"
                style={{
                  aspectRatio: "9 / 16",
                  maxWidth: 360,
                  boxShadow: `0 0 0 8px #0a0a0a, 0 0 0 9px #1f1f1f, 0 30px 80px -20px ${accent}55`,
                }}
              >
                <DividendCalculatorCard
                  accent={accent}
                  glow={glow}
                  dpsAnnual={dpsAnnual}
                  defaultPrice={defaultPrice}
                  ticker={company.ticker}
                />
              </div>
              <div
                className="mx-auto w-full overflow-hidden rounded-[36px] border border-white/10"
                style={{
                  aspectRatio: "9 / 16",
                  maxWidth: 360,
                  boxShadow: `0 0 0 8px #0a0a0a, 0 0 0 9px #1f1f1f, 0 30px 80px -20px ${accent}55`,
                }}
              >
                <DividendSnowballCard
                  accent={accent}
                  glow={glow}
                  yieldPct={yieldPct}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-amber-300/80">
          Note prototype
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-amber-100/90">
          Cette page est isolée du reste de l&apos;app. Les modifs ici ne
          touchent pas la V1.7 publique. Pour comparer plusieurs styles,
          utilise le sélecteur de variante en haut. Pour ajouter une variante
          C ou D, demande directement.
        </p>
      </div>
    </div>
  );
}
