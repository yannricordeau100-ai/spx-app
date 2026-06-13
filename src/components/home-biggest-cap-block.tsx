"use client";

/**
 * Bloc "Plus grandes capitalisations boursières mondiales disponibles"
 * (Yann 13 juin 2026).
 *
 * Même style visuel que HomePopularBlock (podium top 3 + lignes classées avec
 * barre de rang), mais ordonné par CAPITALISATION BOURSIÈRE DÉCROISSANTE.
 *
 * Source de l'ordre : `rows` est construit côté home-view à partir de `results`
 * (= univers déjà trié par market cap dans la page), lui-même régénéré chaque
 * semaine par le pipeline ranks / market-cap (cron). Donc le classement
 * s'actualise AUTOMATIQUEMENT chaque semaine, sans intervention.
 */
import { Fragment, type ReactNode } from "react";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";
import { PodiumCard, StockRow, type PopularRow } from "@/components/home-popular-block";

export function HomeBiggestCapBlock({
  rows,
  locale,
  routePrefix,
  requireSignupGate = false,
  gatePath = "/",
}: {
  rows: PopularRow[];
  locale: string;
  routePrefix?: string;
  requireSignupGate?: boolean;
  gatePath?: string;
}) {
  if (!rows || rows.length === 0) return null;
  const isFr = locale === "fr";

  const buildCompanyHref = (ticker: string): string =>
    routePrefix ? `${routePrefix}/${ticker.toLowerCase()}` : `/${ticker.toLowerCase()}`;

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const totalShown = rows.length;

  const wrapGate = (key: string, child: ReactNode) =>
    requireSignupGate ? (
      <SignupGateOverlay key={key} enabled={requireSignupGate} gatePath={gatePath} initialAuthed={!requireSignupGate}>
        {child}
      </SignupGateOverlay>
    ) : (
      <Fragment key={key}>{child}</Fragment>
    );

  return (
    <section className="mx-auto mt-16 max-w-3xl sm:mt-20">
      <div className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">
        {isFr
          ? "Plus grandes capitalisations boursières mondiales disponibles"
          : "Largest market caps available worldwide"}
      </div>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-zinc-400">
        {isFr
          ? "Les sociétés disponibles sur Mettrik, classées par capitalisation boursière décroissante. Classement actualisé automatiquement chaque semaine."
          : "Companies available on Mettrik, ranked by descending market capitalization. Ranking updated automatically every week."}
      </p>

      {podium.length === 3 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {podium.map((r, i) =>
            wrapGate(
              r.ticker,
              <PodiumCard row={r} rank={i + 1} totalShown={totalShown} buildHref={buildCompanyHref} />,
            ),
          )}
        </div>
      )}

      <div className="space-y-2">
        {rest.map((r, i) =>
          wrapGate(
            r.ticker,
            <StockRow row={r} rank={i + 4} totalShown={totalShown} buildHref={buildCompanyHref} />,
          ),
        )}
      </div>
    </section>
  );
}
