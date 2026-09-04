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
 * Sociétés cotées récemment : mois d'entrée en bourse (AAAA-MM).
 *
 * Yann 4 sept 2026 : la table portait des délais figés ("prêt dans N mois")
 * écrits le 1er juin 2026 et jamais recalculés : GEHC (janvier 2023), GEV et
 * SOLV (printemps 2024) affichaient encore "IPO < 24 mois" trois ans plus
 * tard, sans graphique, alors que leurs séries existent. Le seuil est
 * désormais calculé à la date du jour : au-delà de 24 mois, la fiche
 * complète s'affiche d'elle-même.
 */
const RECENT_IPO_TABLE: Record<string, { ipo: string }> = {
  CRWV: { ipo: "2025-03" },
  "FLTR.L": { ipo: "2024-01" },
  GEHC: { ipo: "2023-01" },
  GEV: { ipo: "2024-04" },
  Q: { ipo: "2025-06" },
  SNDK: { ipo: "2025-02" },
  SOLV: { ipo: "2024-04" },
};

const SEUIL_MOIS = 24;
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/**
 * Renvoie les méta IPO récente pour un ticker donné si la cotation date de
 * moins de 24 mois à la date du jour, sinon null (fiche complète).
 */
export function getRecentIpoMeta(
  ticker: string,
  maintenant: Date = new Date(),
): { ipoLabel: string; readyInMonths: number } | null {
  if (!ticker) return null;
  const up = ticker.toUpperCase();
  const e = RECENT_IPO_TABLE[up];
  if (!e) return null;
  const [y, m] = e.ipo.split("-").map(Number);
  if (!y || !m) return null;
  const mois = (maintenant.getFullYear() - y) * 12 + (maintenant.getMonth() + 1 - m);
  if (mois >= SEUIL_MOIS) return null;
  return { ipoLabel: `${MOIS_FR[m - 1]} ${y}`, readyInMonths: Math.max(1, SEUIL_MOIS - mois) };
}
