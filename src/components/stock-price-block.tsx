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

  // Yann 25 mai 2026 : split du label sur 2 lignes pour permettre aux
  // 3 colonnes de respirer (FR/DE/NL ~ même longueur). Le 3e élément
  // (montant) tombe naturellement sur une 3e ligne.
  const marketCapLabel = t("stock.market_cap");
  const labelWords = marketCapLabel.trim().split(/\s+/);
  const splitIdx = Math.ceil(labelWords.length / 2);
  const labelLine1 = labelWords.slice(0, splitIdx).join(" ");
  const labelLine2 = labelWords.slice(splitIdx).join(" ");
  const variationLocale = locale === "fr" ? "fr-FR" : locale === "de" || locale === "de-CH" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-US";

  return (
    <div
      className="relative flex w-full items-stretch overflow-hidden rounded-xl px-5 py-3 sm:w-[520px] sm:shrink-0"
      style={{
        // Bande colorée beaucoup plus large : la couleur démarre dès 25 %
        // (au lieu de garder #0a0a0a noir jusqu'à ~10 %). Tout ce qui est
        // affiché baigne désormais dans la teinte signalétique (vert/rouge).
        background: `linear-gradient(90deg, ${tone}30 0%, ${tone}50 18%, ${tone}68 32%, ${tone}82 46%, ${tone}96 58%, ${tone}ac 68%, ${tone}c2 78%, ${tone}d8 88%, ${tone}ec 95%, ${tone} 100%)`,
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

      {/* COL 1 — Capitalisation boursière (label 2 lignes + montant 3e ligne).
          shrink-0 + alignement droite pour préserver l'espace. */}
      <div className="relative flex shrink-0 flex-col items-end justify-center border-r border-white/15 pr-4 text-right">
        <span className="font-mono text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-zinc-100">
          {labelLine1}
        </span>
        {labelLine2 && (
          <span className="font-mono text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-zinc-100">
            {labelLine2}
          </span>
        )}
        <span className="mt-1 font-display text-[18px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums sm:text-[20px]">
          {live.loading ? placeholder : fmtMarketCap(s.marketCap, locale)}
        </span>
      </div>

      {/* COL 2 — Variation %, taille agrandie (Yann 25 mai 2026), alignée à
          droite, centrée verticalement, peut respirer car le label cap est
          sur 2 lignes côté gauche. */}
      <div className="relative flex flex-1 items-center justify-end self-stretch px-3">
        <span
          className="font-display font-bold leading-none tabular-nums tracking-tight text-right whitespace-nowrap"
          style={{
            color: toneLight,
            textShadow: "0 1px 6px rgba(0,0,0,0.35)",
            fontSize: "clamp(18px, 2.2vw, 24px)",
          }}
        >
          {live.loading ? placeholder : `${isUp ? "+" : ""}${s.deltaPct.toLocaleString(variationLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`}
        </span>
      </div>

      {/* COL 3 — Prix avec point LED dans le coin haut-droite */}
      <div className="relative flex shrink-0 items-center">
        <div className="relative">
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
            className="block whitespace-nowrap text-right text-[36px] leading-none tracking-[-0.02em] text-white tabular-nums sm:text-[42px]"
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
  );
}
