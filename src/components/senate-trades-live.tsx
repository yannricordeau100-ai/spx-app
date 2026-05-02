"use client";

import { useEffect, useState } from "react";
import { SenateTradesCard } from "@/components/senate-trades-card";
import type { SenateTrade } from "@/lib/senate-trades";

/**
 * SenateTradesLive — wrapper qui fetch /api/senate-trades pour ce ticker
 * et alimente SenateTradesCard avec des données live FMP.
 *
 * Cache 12h server-side (cf. route handler), donc 1-2 fetchs côté client
 * par jour suffisent. Refresh à chaque mount, pas de polling.
 */
type ApiResp = {
  trades?: SenateTrade[];
  source?: string;
  legal_delay_note?: string;
  fetchedAt?: string;
  cached?: boolean;
  stale?: boolean;
  error?: string;
};

export function SenateTradesLive({
  ticker,
  accent,
}: {
  ticker: string;
  accent?: string;
}) {
  const [trades, setTrades] = useState<SenateTrade[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/senate-trades?ticker=${ticker}`, {
          cache: "no-store",
        });
        const data: ApiResp = await r.json();
        if (cancelled) return;
        setTrades(data.trades ?? []);
      } catch {
        if (cancelled) return;
        setTrades([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Pendant le 1er fetch on n'affiche rien (la card retourne null si vide
  // de toute façon), évite un flash de "DEMO" obsolète.
  if (loading) return null;
  if (!trades || trades.length === 0) return null;

  return <SenateTradesCard trades={trades} ticker={ticker} accent={accent} />;
}
