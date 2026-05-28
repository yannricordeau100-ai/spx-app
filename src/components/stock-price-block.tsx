"use client";

import { useEffect, useState } from "react";
import type { Company } from "@/lib/data";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { BlurredFreeValue } from "@/components/freemium/blurred-free-value";

/**
 * StockPriceBlock — bandeau prix de l'action, design "S6 v2".
 *
 * Live : fetch /api/stock-prices?symbols=TICKER toutes les 30 s pendant
 * les heures de marché US, puis 5 min hors marché. Fallback sur les
 * dernières valeurs connues (ou FAKE seed) si l'API est down.
 */

type LivePrice = {
  price: number;
  deltaPct: number;
  marketCap: number; // en Mds $
  marketState: string | null;
  /** Si true : pas encore de fetch live aboutie → on doit afficher un
   *  skeleton "—" au lieu de chiffres bidon. (6 mai 2026) */
  loading: boolean;
};

type ApiResp = {
  prices: Array<{
    symbol: string;
    price: number | null;
    deltaPct: number | null;
    marketCap: number | null;
    marketState: string | null;
  }>;
  fetchedAt: string;
};

/** Cadence de refresh selon l'état du marché. */
function refreshIntervalMs(marketState: string | null | undefined): number {
  if (!marketState) return 60_000;
  if (marketState === "REGULAR") return 30_000; // ouverture US : 30 s
  if (marketState === "PRE" || marketState === "POST") return 60_000;
  return 5 * 60_000; // CLOSED, etc.
}

/** Fetch live data for ONE ticker. Returns null on failure. */
async function fetchPrice(ticker: string): Promise<LivePrice | null> {
  try {
    const r = await fetch(`/api/stock-prices?symbols=${ticker}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data: ApiResp = await r.json();
    const item = data.prices?.[0];
    if (!item || item.price == null) return null;
    return {
      price: item.price,
      deltaPct: item.deltaPct ?? 0,
      // marketCap reçu en USD bruts → convertis en Mds $
      marketCap: item.marketCap != null ? item.marketCap / 1_000_000_000 : 0,
      marketState: item.marketState,
      loading: false,
    };
  } catch {
    return null;
  }
}

function useLivePrice(ticker: string): LivePrice {
  // Pas de seed FAKE : Yann ne veut pas voir 1-2 secondes de valeur figée
  // qui change à l'arrivée du fetch live. On démarre en `loading=true` →
  // le block affiche des skeletons (—) jusqu'à la 1re réponse réelle. (6 mai 2026)
  const [data, setData] = useState<LivePrice>({
    price: 0,
    deltaPct: 0,
    marketCap: 0,
    marketState: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      const live = await fetchPrice(ticker);
      if (!mounted) return;
      if (live) setData(live);
      // Replanifie avec la cadence adaptée à l'état du marché
      const interval = refreshIntervalMs(live?.marketState ?? data.marketState);
      timer = setTimeout(tick, interval);
    };

    tick();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  return data;
}

function fmtMarketCap(mc: number, locale: Locale = "fr"): string {
  const tag = locale === "fr" ? "fr-FR" : "en-US";
  const rounded = Math.round(mc).toLocaleString(tag);
  return locale === "fr" ? `${rounded} Mds $` : `$${rounded}B`;
}

const GREEN_PURE = "#22c55e";
const RED_PURE = "#ef4444";
const GREEN_LIGHT = "#bbf7d0";
const RED_LIGHT = "#fecaca";

// Point LED supprimé (Yann 26 mai 2026). Constantes retirées.

export function StockPriceBlock({ company, freeBlocked = false }: { company: Company; freeBlocked?: boolean }) {
  const { t, locale } = useT();
  const live = useLivePrice(company.ticker);
  const s = {
    price: live.price,
    deltaPct: live.deltaPct,
    marketCap: live.marketCap,
  };
  const isUp = s.deltaPct >= 0;
  // Pendant le loading : couleurs neutres (gris) au lieu de vert/rouge
  // calculé sur 0.00 (qui s'afficherait vert par défaut).
  const tone = live.loading ? "#52525b" : isUp ? GREEN_PURE : RED_PURE;
  const toneLight = live.loading ? "#a1a1aa" : isUp ? GREEN_LIGHT : RED_LIGHT;
  // ledColor retiré : LED dot supprimé du haut du prix (Yann 26 mai 2026)
  const placeholder = "—";

  // Yann 25 mai 2026 : split du label sur 2 lignes pour permettre aux
  // 3 colonnes de respirer (FR/DE/NL ~ même longueur). Le 3e élément
  // (montant) tombe naturellement sur une 3e ligne.
  const marketCapLabel = t("stock.market_cap");
  const labelWords = marketCapLabel.trim().split(/\s+/);
  const splitIdx = Math.ceil(labelWords.length / 2);
  const labelLine1 = labelWords.slice(0, splitIdx).join(" ");
  const labelLine2 = labelWords.slice(splitIdx).join(" ");
  const variationLocale = locale === "fr" ? "fr-FR" : locale === "de" || locale === "de-CH" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-US";

  // Yann (26 mai 2026) : refonte complète pour éliminer l'espace vide et
  // ajouter un fondu gauche transparent → couleur. Le bloc :
  //  - n'a PLUS de largeur fixe (520px) → il s'auto-dimensionne au contenu
  //  - utilise `gap-x` au lieu de `flex-1` (= plus d'espace vide entre cols)
  //  - background = gradient `transparent 0%` → `tone 35%` → `tone 100%`,
  //    ce qui crée un FONDU à gauche peu importe la longueur du contenu
  //    (Mds $ courts ou longs, variation % à 1 ou 2 chiffres, prix 4 ou 5+
  //    chiffres). La couleur démarre franchement à 35 % de largeur, donc
  //    le bloc baigne dans la teinte sur les ~2/3 droits.
  //  - 3 colonnes : Market Cap (label 2 lignes + valeur 3e), Variation %
  //    grand format centré vertical, Prix + LED. Toutes alignées par leur
  //    bord droit (le bord gauche varie selon la longueur des valeurs).
  return (
    <div
      className="relative flex w-full items-stretch py-3 pl-8 pr-5 sm:w-auto sm:shrink-0"
      style={{
        // Yann (28 mai 2026) : fondu plus progressif ÉTALÉ sur le fond noir
        // de la page (extension overlay à gauche). La zone coloré pleine du
        // bloc reste inchangée (15→100%), seulement la transition vers le
        // transparent s'étire désormais sur ~280px supplémentaires vers la
        // gauche (= déborde sur le fond de page).
        background: `linear-gradient(90deg, ${tone}00 0%, ${tone}66 4%, ${tone}cc 9%, ${tone} 15%, ${tone} 100%)`,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderTopRightRadius: "0.75rem",
        borderBottomRightRadius: "0.75rem",
      }}
    >
      {/* Extension fondu gauche — déborde sur le fond de page (Yann 28 mai 2026).
          Crée un gradient progressif transparent → tone qui s'étire sur
          ~280px à gauche du bloc, sans toucher à la zone color du bloc. */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-full top-0 h-full w-[280px]"
        style={{
          background: `linear-gradient(90deg, ${tone}00 0%, ${tone}22 30%, ${tone}55 60%, ${tone}99 85%, ${tone} 100%)`,
        }}
      />
      {/* Glow radial à droite, autour du prix */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{
          background: `radial-gradient(ellipse at right center, ${tone}66 0%, transparent 70%)`,
        }}
      />

      {/* Cadre flex auto-largeur, gap-x pour espacement régulier sans flex-1 */}
      <div className="relative flex items-stretch gap-x-4">
        {/* COL 1 — Capitalisation boursière (label 2 lignes + montant 3e ligne). */}
        <div className="flex shrink-0 flex-col items-end justify-center border-r border-white/15 pr-4 text-right">
          <span className="font-mono text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-zinc-100">
            {labelLine1}
          </span>
          {labelLine2 && (
            <span className="font-mono text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-zinc-100">
              {labelLine2}
            </span>
          )}
          <span className="mt-1 font-display text-[18px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums sm:text-[20px]">
            {live.loading
              ? placeholder
              : freeBlocked
                ? <BlurredFreeValue value="0" suffix=" Mds $" ticker={company.ticker} />
                : fmtMarketCap(s.marketCap, locale)}
          </span>
        </div>

        {/* COL 2 — Variation %, taille agrandie, centrée verticalement,
            shrink-0 = pas de flex-1 donc pas d'espace vide à gauche. */}
        <div className="flex shrink-0 items-center self-stretch">
          <span
            className="font-display font-bold leading-none tabular-nums tracking-tight whitespace-nowrap"
            style={{
              color: toneLight,
              textShadow: "0 1px 6px rgba(0,0,0,0.35)",
              fontSize: "clamp(18px, 2.2vw, 24px)",
            }}
          >
            {live.loading
              ? placeholder
              : freeBlocked
                ? <BlurredFreeValue value="0,00" suffix=" %" ticker={company.ticker} />
                : `${isUp ? "+" : ""}${s.deltaPct.toLocaleString(variationLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`}
          </span>
        </div>

        {/* COL 3 — Prix (Yann 26 mai 2026 : LED dot retiré, jugé inutile) */}
        <div className="flex shrink-0 items-center">
          <div className="relative">
            <span
              className="block whitespace-nowrap text-right text-[36px] leading-none tracking-[-0.02em] text-white tabular-nums sm:text-[42px]"
              style={{
                fontFamily: "var(--font-sora), ui-sans-serif, sans-serif",
                fontWeight: 200,
                textShadow: "0 2px 12px rgba(0,0,0,0.55)",
              }}
            >
              {live.loading
                ? placeholder
                : freeBlocked
                  ? <BlurredFreeValue value="0,00" ticker={company.ticker} />
                  : s.price.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              <span
                className="ml-1.5 text-[18px] text-white/85 sm:text-[20px]"
                style={{
                  fontFamily: "var(--font-sora), ui-sans-serif, sans-serif",
                  fontWeight: 300,
                }}
              >
                $
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
