"use client";

import { Clock, Sparkles } from "lucide-react";

/**
 * Bloc affiché à la place du contenu analytique sur les sociétés cotées
 * depuis moins de 24 mois (IPO récente). Préserve le top de la page sté
 * (stock-price-block, logo, nom, ticker, variation %, prix) puis remplace
 * tous les blocs en dessous par ce message à plus-value.
 *
 * Yann (1er juin 2026) : V1.9.5, 7 sociétés concernées (CRWV, FLTR.L, GEV,
 * Q, RDDT, SNDK, SOLV) faute d'historique fiable sur 5 ans + tendances.
 */
export function RecentIpoPlaceholder({
  ticker,
  ipoLabel,
  monthsUntilReady,
}: {
  ticker: string;
  ipoLabel: string;
  monthsUntilReady: number;
}) {
  return (
    <section
      id="sec-recent-ipo"
      className="conic-border relative mt-8 overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#070707] p-8 animate-fade-up sm:p-12"
    >
      <div
        className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full blur-3xl"
        style={{ background: "rgba(245, 158, 11, 0.18)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 size-96 rounded-full blur-3xl"
        style={{ background: "rgba(251, 146, 60, 0.12)" }}
      />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 p-4 backdrop-blur-sm">
          <Sparkles className="size-7 text-amber-400" strokeWidth={1.5} />
        </div>

        <h2 className="font-display text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Société récemment cotée
        </h2>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/[0.07] px-3 py-1">
          <Clock className="size-3.5 text-amber-400" />
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-amber-300">
            IPO &lt; 24 mois
          </span>
        </div>

        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-zinc-300">
          {ticker} est en bourse depuis moins de 24 mois ({ipoLabel}). L&apos;historique
          disponible reste insuffisant pour produire une analyse fiable sur 5 ans
          et dégager des tendances solides. Reviens dans environ {monthsUntilReady} mois
          pour une fiche complète.
        </p>

        <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-3 text-left">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Historique
            </div>
            <div className="mt-1 text-sm font-medium text-zinc-200">
              &lt; 24 mois
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Indicateurs
            </div>
            <div className="mt-1 text-sm font-medium text-zinc-200">
              5 ans requis
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Tendances
            </div>
            <div className="mt-1 text-sm font-medium text-zinc-200">
              Non fiables
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Table des 7 sociétés V1.9.5 avec IPO < 24 mois.
 * Clé = ticker tel qu'utilisé côté URL/dataset (insensible à la casse côté
 * lookup mais on garde la forme canonique d'écriture).
 */
const RECENT_IPO_TABLE: Record<string, { ipoLabel: string; readyInMonths: number }> = {
  CRWV: { ipoLabel: "mars 2026", readyInMonths: 22 },
  "FLTR.L": { ipoLabel: "2024", readyInMonths: 6 },
  GEHC: { ipoLabel: "janvier 2023", readyInMonths: 20 },
  GEV: { ipoLabel: "mars 2024", readyInMonths: 4 },
  Q: { ipoLabel: "juin 2025", readyInMonths: 13 },
  // RDDT retiré le 18 août 2026 : 2,4 ans de cotation, 14 trimestres de
  // séries publiées, entré au SP500 : la page complète est prête.
  SNDK: { ipoLabel: "février 2025", readyInMonths: 9 },
  SOLV: { ipoLabel: "avril 2024", readyInMonths: 5 },
};

/**
 * Renvoie les méta IPO récente pour un ticker donné si concerné, sinon null.
 * Matching insensible à la casse pour absorber l'écart URL/dataset.
 */
export function getRecentIpoMeta(
  ticker: string,
): { ipoLabel: string; readyInMonths: number } | null {
  if (!ticker) return null;
  const up = ticker.toUpperCase();
  return RECENT_IPO_TABLE[up] ?? null;
}
