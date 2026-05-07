import { readFileSync, existsSync } from "fs";
import path from "path";
import { HomeView } from "@/components/home-view";
import type { Company } from "@/lib/data";
// Pré-filtré au build (300KB) : src/data/v1-7-public.json. Régénéré
// par scripts/build-v17-public.ts.
import V17_PUBLIC from "@/data/v1-7-public.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.7 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-7 = même structure que la home (`/`) mais avec les 421 stés
 * Pass 3 validées par CONV-DATA. HomeView accepte un dataset custom + un
 * builder de href via props (ajouté le 4 mai 2026 sur demande Yann pour
 * uniformiser visuel V1 / V1.5 / V1.6 / V1.7).
 *
 * Filtre : ne garde que les stés avec _validation OU _validation_global
 * (champs ajoutés par CONV-DATA quand Sonnet a vérifié l'extraction).
 */
function loadValidatedDatasets(): Record<string, Company> {
  return V17_PUBLIC as unknown as Record<string, Company>;
}

// Doublons multi-classes : on cache la classe NON-canonique du hub pour
// ne pas afficher 2 fois la même société. Liste = tickers à RETIRER.
// Le ticker canonique (côté droit dans TICKER_ALIASES) reste affiché.
const HIDDEN_DUPLICATES = new Set(["GOOG", "BRK-A", "BRK.A", "BRK.B", "FOX", "NWSA", "UAA"]);

/**
 * Lit le market_cap depuis l'enrich file (yfinance). Renvoie 0 si absent.
 * Sert au tri décroissant top 308 demandé par Yann le 8 mai 2026.
 */
function getMarketCap(ticker: string): number {
  const enrPath = path.join(process.cwd(), "src/data/v2-pipeline-enrich", `${ticker.toLowerCase()}.json`);
  if (!existsSync(enrPath)) return 0;
  try {
    const data = JSON.parse(readFileSync(enrPath, "utf-8"));
    const mc = data?.financial_snapshot?.market_cap_usd;
    return typeof mc === "number" ? mc : 0;
  } catch {
    return 0;
  }
}

export default async function SandboxV17HubPage() {
  const datasets = loadValidatedDatasets();
  // Yann 8 mai 2026 : V1.7 garde TOUTES les stés Pass 3 strict (dév général).
  // Tri d'affichage : market_cap décroissant (top 308 d'abord), puis le reste
  // alphabétique. Les sés sans market_cap connu (cat 3 EU principalement)
  // s'affichent après les top 308.
  const filtered = Object.keys(datasets).filter((t) => !HIDDEN_DUPLICATES.has(t.toUpperCase()));
  const ranked = filtered.map((t) => ({ ticker: t, mc: getMarketCap(t) }));
  const withMc = ranked.filter((x) => x.mc > 0).sort((a, b) => b.mc - a.mc);
  const withoutMc = ranked.filter((x) => x.mc === 0).sort((a, b) => a.ticker.localeCompare(b.ticker));
  const tickers = [...withMc, ...withoutMc].map((x) => x.ticker);

  return (
    <HomeView
      companies={datasets}
      tickers={tickers}
      showFAQ={false}
      routePrefix="/sandbox/v1-7"
      searchScope={{ tickers, total: tickers.length }}
    />
  );
}
