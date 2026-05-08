"use client";

import { useEffect, useState } from "react";

/**
 * Hook réutilisable : récupère le cours en direct d'un ticker via
 * `/api/stock-prices`. Refresh selon l'état du marché (30 s en REGULAR,
 * 60 s PRE/POST, 5 min CLOSED).
 *
 * Utilisé par stock-price-block (page société) et par les blocs Stories
 * Dividendes (calculateur de revenu, snowball DRIP).
 */

export type LivePrice = {
  price: number | null;
  deltaPct: number | null;
  marketCap: number | null;
  marketState: string | null;
  fetchedAt: string | null;
  loading: boolean;
};

function refreshIntervalMs(marketState: string | null | undefined): number {
  if (!marketState) return 60_000;
  if (marketState === "REGULAR") return 30_000;
  if (marketState === "PRE" || marketState === "POST") return 60_000;
  return 5 * 60_000;
}

async function fetchOnce(ticker: string): Promise<Partial<LivePrice> | null> {
  try {
    const r = await fetch(`/api/stock-prices?symbols=${ticker}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data = await r.json();
    const item = data.prices?.[0];
    if (!item) return null;
    return {
      price: item.price ?? null,
      deltaPct: item.deltaPct ?? null,
      marketCap: item.marketCap ?? null,
      marketState: item.marketState ?? null,
      fetchedAt: data.fetchedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function useLivePrice(ticker: string): LivePrice {
  const [data, setData] = useState<LivePrice>({
    price: null,
    deltaPct: null,
    marketCap: null,
    marketState: null,
    fetchedAt: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      const result = await fetchOnce(ticker);
      if (cancelled) return;
      if (result) {
        setData((d) => ({ ...d, ...result, loading: false }));
        timer = setTimeout(tick, refreshIntervalMs(result.marketState));
      } else {
        // Échec : retry dans 60 s
        setData((d) => ({ ...d, loading: false }));
        timer = setTimeout(tick, 60_000);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ticker]);

  return data;
}
