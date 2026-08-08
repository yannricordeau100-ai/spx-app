import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import SHARES_OUTSTANDING from "@/data/shares-outstanding.json";

/**
 * GET /api/stock-prices?symbols=META,GOOGL,MSCI,SPGI,CAT
 *
 * Renvoie les cotations live (regular + pre/post-market) via Yahoo Finance.
 * Cache server-side 30 s pendant heures de marché US, 5 min hors marché.
 *
 * Architecture pensée pour scaler à ~3000 actions :
 *   - Yahoo accepte ~50 symboles par requête → batch automatique
 *   - Cache Vercel Edge 30 s pendant l'ouverture
 *   - Si Yahoo throttle (429), on retombe sur la dernière valeur cachée
 *
 * Réponse :
 *   {
 *     "prices": [
 *       { "symbol": "META", "price": 671.34, "deltaPct": -1.07,
 *         "marketCap": 1700000000000, "marketState": "PRE",
 *         "preMarketPrice": 669.39, "postMarketPrice": null,
 *         "deltaAbs": -7.21 },
 *       …
 *     ],
 *     "fetchedAt": "2026-04-29T08:13:42.123Z"
 *   }
 */

// Singleton client (le constructor crée des cookies/crumb que l'on garde)
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const BATCH_SIZE = 50;

type PriceItem = {
  symbol: string;
  price: number | null;
  deltaPct: number | null;
  deltaAbs: number | null;
  marketCap: number | null;
  marketState: string | null;
  preMarketPrice: number | null;
  postMarketPrice: number | null;
  currency: string | null;
  shortName: string | null;
};

async function fetchBatch(symbols: string[]): Promise<PriceItem[]> {
  if (symbols.length === 0) return [];
  const quotes = await yf.quote(symbols);
  const arr = Array.isArray(quotes) ? quotes : [quotes];
  const items = arr.map((q): PriceItem => ({
    symbol: q.symbol,
    price: q.regularMarketPrice ?? null,
    deltaPct: q.regularMarketChangePercent ?? null,
    deltaAbs: q.regularMarketChange ?? null,
    // Yann 8 août 2026 (screen MU "0 Mds $") : Yahoo quote() omet parfois
    // marketCap sur certains symboles alors que prix et titres en circulation
    // sont présents. Fallback : prix x sharesOutstanding, sinon null (jamais 0).
    marketCap:
      q.marketCap ??
      (q.regularMarketPrice != null && q.sharesOutstanding != null
        ? q.regularMarketPrice * q.sharesOutstanding
        : null),
    marketState: q.marketState ?? null,
    preMarketPrice: q.preMarketPrice ?? null,
    postMarketPrice: q.postMarketPrice ?? null,
    currency: q.currency ?? null,
    shortName: q.shortName ?? q.longName ?? null,
  }));
  // Yann 8 août 2026 : 2e filet. Sur certains symboles (cas réel MU) quote()
  // omet marketCap ET sharesOutstanding alors que quoteSummary(price) l'a.
  // Une requête ciblée par symbole manquant uniquement (rare).
  await Promise.all(
    items.filter((it) => it.marketCap == null).map(async (it) => {
      try {
        const qs = await yf.quoteSummary(it.symbol, { modules: ["price"] });
        const mc = qs.price?.marketCap;
        if (typeof mc === "number" && mc > 0) it.marketCap = mc;
      } catch {
        // on laisse null : le filet 3 ci-dessous prend le relais
      }
    }),
  );
  // 3e filet : quoteSummary est bloqué depuis les IP Vercel (vérifié en prod,
  // MU restait null). Titres en circulation snapshotés en local
  // (src/data/shares-outstanding.json, généré via yfinance sur le Mac) :
  // cap = prix live x titres. Précision suffisante pour le bandeau.
  const SO = SHARES_OUTSTANDING as Record<string, { sharesOutstanding: number }>;
  for (const it of items) {
    if (it.marketCap == null && it.price != null) {
      const so = SO[it.symbol]?.sharesOutstanding;
      if (typeof so === "number" && so > 0) it.marketCap = it.price * so;
    }
  }
  return items;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get("symbols") ?? "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "missing symbols param" },
      { status: 400 }
    );
  }

  if (symbols.length > 200) {
    return NextResponse.json(
      { error: "max 200 symbols per request" },
      { status: 400 }
    );
  }

  try {
    // Batch les symboles par paquets de 50 (limite Yahoo)
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      batches.push(symbols.slice(i, i + BATCH_SIZE));
    }
    const results = (await Promise.all(batches.map(fetchBatch))).flat();

    // Sort dans l'ordre de la requête (Yahoo ne garantit pas l'ordre)
    const byKey = new Map(results.map((r) => [r.symbol, r]));
    const ordered = symbols.map(
      (s) => byKey.get(s) ?? {
        symbol: s,
        price: null, deltaPct: null, deltaAbs: null,
        marketCap: null, marketState: null,
        preMarketPrice: null, postMarketPrice: null,
        currency: null, shortName: null,
      }
    );

    return NextResponse.json(
      { prices: ordered, fetchedAt: new Date().toISOString() },
      {
        // Cache 30 s côté Vercel Edge / browser ; revalidate 30 s
        headers: {
          "Cache-Control":
            "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
