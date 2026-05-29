import path from "node:path";
import fs from "node:fs/promises";
import { UniverseToggleClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 60;
export const metadata = {
  title: "Admin · Univers V1.9.5 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5/admin/universe-toggle
 *
 * Page admin (§0septies) qui décompose l'univers V1.9.5 en 3 onglets :
 *  1. SP500 (503 stés US-listed)
 *  2. Top 307 hors SP500 (170 stés)
 *  3. EU dans top 307 (90 stés, groupées par pays)
 *
 * Yann (29 mai 2026) : page de stats admin pure, pas de générique KPI.
 * Lecture build-time des deux JSON via fs.readFile.
 */

const AUDIT_TOKEN = "phYUd19KP3T_apdLQmugGzF0yEEoAwM6C5JVp9-2z0Y";

// Mapping suffixe ticker -> pays (FR strict, ordre tel que donné par Yann)
const SUFFIX_TO_COUNTRY: Record<string, string> = {
  ".PA": "France",
  ".L": "Royaume-Uni",
  ".DE": "Allemagne",
  ".SW": "Suisse",
  ".MI": "Italie",
  ".AS": "Pays-Bas",
  ".CO": "Danemark",
  ".OL": "Norvège",
  ".ST": "Suède",
  ".HE": "Finlande",
  ".MC": "Espagne",
  ".BR": "Belgique",
  ".LS": "Portugal",
  ".VI": "Autriche",
  ".IR": "Irlande",
  ".HK": "Hong Kong",
  ".T": "Japon",
};

function detectCountry(ticker: string): string | null {
  for (const suffix of Object.keys(SUFFIX_TO_COUNTRY)) {
    if (ticker.endsWith(suffix)) {
      return SUFFIX_TO_COUNTRY[suffix];
    }
  }
  return null;
}

async function loadTickers(): Promise<{
  sp500: string[];
  top307HorsSp500: string[];
  euInTop307: { country: string; tickers: string[] }[];
  countryCounts: { country: string; count: number }[];
}> {
  const sp500Path = path.join(process.cwd(), "src/data/sp500-tickers.json");
  const v18Path = path.join(process.cwd(), "src/data/v1-8-tickers-sorted.json");

  const sp500Raw = await fs.readFile(sp500Path, "utf8");
  const v18Raw = await fs.readFile(v18Path, "utf8");

  const sp500 = JSON.parse(sp500Raw) as string[];
  const v18 = JSON.parse(v18Raw) as string[];

  const sp500Set = new Set(sp500);
  const top307 = v18.slice(0, 307);
  const top307HorsSp500 = top307.filter((t) => !sp500Set.has(t));

  // EU dans top 307 : tickers du top 307 dont le suffixe matche un pays
  // européen ou Japon (selon la liste fournie par Yann).
  const euCountryMap = new Map<string, string[]>();
  for (const ticker of top307) {
    const country = detectCountry(ticker);
    if (country === null) continue;
    if (!euCountryMap.has(country)) {
      euCountryMap.set(country, []);
    }
    euCountryMap.get(country)!.push(ticker);
  }

  // Tri par count décroissant
  const countryCounts = Array.from(euCountryMap.entries())
    .map(([country, tickers]) => ({ country, count: tickers.length }))
    .sort((a, b) => b.count - a.count);

  const euInTop307 = countryCounts.map(({ country }) => ({
    country,
    tickers: euCountryMap.get(country)!.slice().sort(),
  }));

  return {
    sp500: sp500.slice().sort(),
    top307HorsSp500: top307HorsSp500.slice().sort(),
    euInTop307,
    countryCounts,
  };
}

export default async function UniverseToggleAdminPage() {
  const data = await loadTickers();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Admin · V1.9.5
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Composition de l'univers V1.9.5
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Décomposition en 3 onglets : SP500, top 307 hors SP500, et stés
            européennes (dans top 307) par pays.
          </p>
        </header>

        <UniverseToggleClient
          sp500={data.sp500}
          top307HorsSp500={data.top307HorsSp500}
          euInTop307={data.euInTop307}
          countryCounts={data.countryCounts}
          auditToken={AUDIT_TOKEN}
        />
      </div>
    </div>
  );
}
