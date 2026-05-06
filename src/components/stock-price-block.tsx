"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Company } from "@/lib/data";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";

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

// Point LED — couleur très vive avec glow, lisible sur le fond coloré.
const GREEN_LED = "#86ff5c"; // lime vif > #22c55e
const RED_LED = "#ff3355"; // rouge vif > #ef4444

export function StockPriceBlock({ company }: { company: Company }) {
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
  const ledColor = live.loading ? "#a1a1aa" : isUp ? GREEN_LED : RED_LED;
  const placeholder = "—";

  return (
    <div
      className="relative flex w-full items-center overflow-hidden rounded-xl px-5 py-3 sm:w-[520px] sm:shrink-0"
      style={{
        // Dégradé fortement progressif (12 paliers sur la largeur) pour une
        // transition douce et continue de gauche (sombre) à droite (couleur
        // pleine). Plus aucun saut visible : l'œil suit une montée linéaire
        // de la luminosité.
        background: `linear-gradient(90deg, #0a0a0a 0%, ${tone}10 4%, ${tone}22 10%, ${tone}38 18%, ${tone}50 28%, ${tone}68 38%, ${tone}80 48%, ${tone}96 58%, ${tone}ac 68%, ${tone}c2 78%, ${tone}d8 88%, ${tone}ec 95%, ${tone} 100%)`,
      }}
    >
      {/* Glow radial à droite, autour du prix */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{
          background: `radial-gradient(ellipse at right center, ${tone}66 0%, transparent 70%)`,
        }}
      />

      {/* COL 1 — Capitalisation Boursière */}
      <div className="relative flex flex-col items-center justify-center border-r border-white/15 pr-4">
        <span className="text-center font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-100">
          {t("stock.market_cap")}
        </span>
        <span className="mt-1 text-center font-display text-[22px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums sm:text-[24px]">
          {live.loading ? placeholder : fmtMarketCap(s.marketCap, locale)}
        </span>
      </div>

      {/* COL 2 — Variation %, taille réduite, centrée verticalement (items-center
          parent + self-center) et horizontalement (flex-1 + justify-center). */}
      <div className="relative flex flex-1 items-center justify-center self-stretch px-3">
        <span
          className="font-display font-semibold leading-none tabular-nums tracking-tight"
          style={{
            color: toneLight,
            textShadow: "0 1px 6px rgba(0,0,0,0.35)",
            fontSize: "clamp(14px, 1.6vw, 17px)",
          }}
        >
          {live.loading ? placeholder : `${isUp ? "+" : ""}${s.deltaPct.toFixed(2)} %`}
        </span>
      </div>

      {/* COL 3 — Prix avec point LED dans le coin haut-droite */}
      <div className="relative shrink-0">
        {/* Point LED — neon, glow puissant, pulse léger pour signal "live" */}
        <motion.span
          aria-hidden
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-1 -top-1 size-2.5 rounded-full"
          style={{
            background: ledColor,
            boxShadow: `0 0 4px ${ledColor}, 0 0 10px ${ledColor}, 0 0 18px ${ledColor}aa`,
          }}
        />
        <span
          className="block whitespace-nowrap text-[40px] leading-none tracking-[-0.02em] text-white tabular-nums sm:text-[46px]"
          style={{
            fontFamily: "var(--font-sora), ui-sans-serif, sans-serif",
            fontWeight: 200,
            textShadow: "0 2px 12px rgba(0,0,0,0.55)",
          }}
        >
          {live.loading
            ? placeholder
            : s.price.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
          <span
            className="ml-1.5 text-[20px] text-white/85 sm:text-[22px]"
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
  );
}
