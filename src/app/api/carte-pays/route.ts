import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * Carte des pays de l accueil (Yann 07 sept 2026, point 9).
 *
 * Renvoie, par zone (monde, USA, France, UK, Allemagne, Pays-Bas, Suisse),
 * les societes triees par capitalisation DECROISSANTE (source :
 * src/data/market-cap-order.json, regenere chaque jour par
 * scripts/ranks-univers.py), 20 par zone au maximum. Les noms viennent de
 * v2-pipeline/_merged.json comme pour l ancien bloc populaires.
 */

const ZONE_SUFFIX: Record<string, string | null> = {
  world: null,
  en: "",
  fr: ".PA",
  "en-GB": ".L",
  de: ".DE",
  nl: ".AS",
  "de-CH": ".SW",
};

const ZONE_COUNTRY: Record<string, string> = {
  en: "US",
  fr: "FR",
  "en-GB": "GB",
  de: "DE",
  nl: "NL",
  "de-CH": "CH",
};

function zoneOf(ticker: string): string | null {
  const up = ticker.toUpperCase();
  for (const [zone, suf] of Object.entries(ZONE_SUFFIX)) {
    if (suf && up.endsWith(suf)) return zone;
  }
  // Pas de suffixe europeen connu = cotation americaine.
  return up.includes(".") ? null : "en";
}

export async function GET() {
  try {
    const orderPath = path.join(process.cwd(), "src/data/market-cap-order.json");
    const order = JSON.parse(fs.readFileSync(orderPath, "utf-8")) as {
      tickers: string[];
    };
    let names: Record<string, { name?: string }> = {};
    try {
      const mergedPath = path.join(process.cwd(), "src/data/v2-pipeline/_merged.json");
      names = JSON.parse(fs.readFileSync(mergedPath, "utf-8")) as Record<string, { name?: string }>;
    } catch {
      // noms indisponibles : on affichera le ticker
    }
    const zones: Record<string, unknown[]> = {};
    for (const key of Object.keys(ZONE_SUFFIX)) zones[key] = [];
    for (const t of order.tickers) {
      const up = t.toUpperCase();
      const zone = zoneOf(up);
      const name = names[up]?.name || names[t.toLowerCase()]?.name || up;
      const pushTo = (key: string) => {
        if (zones[key]!.length >= 20) return;
        zones[key]!.push({
          ticker: up,
          name,
          rank: zones[key]!.length + 1,
          country: zone ? ZONE_COUNTRY[zone] : undefined,
        });
      };
      pushTo("world");
      if (zone && zone !== "world") pushTo(zone);
    }
    return NextResponse.json(
      { ...zones, _meta: { source: "market-cap-order.json (capitalisation decroissante)" } },
      { headers: { "Cache-Control": "public, max-age=600" } },
    );
  } catch {
    return NextResponse.json({ error: "carte-pays indisponible" }, { status: 500 });
  }
}
