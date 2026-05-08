import { HomeView } from "@/components/home-view";
import type { Company } from "@/lib/data";
// Pré-filtré au build (300KB) : src/data/v1-7-public.json. Régénéré
// par scripts/build-v17-public.ts.
import V17_PUBLIC from "@/data/v1-7-public.json";
// Liste de tri pré-calculée : market_cap décroissant pour les sés avec
// MC connu, puis alphabétique pour celles sans. Évite les fs reads
// runtime sur Vercel (cf v1-8/page.tsx pour le détail du bug).
import V17_SORTED from "@/data/v1-7-tickers-sorted.json";

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

export default async function SandboxV17HubPage() {
  const datasets = loadValidatedDatasets();
  // Yann 8 mai 2026 : V1.7 garde TOUTES les stés Pass 3 strict (dév général).
  // Tri d'affichage pré-calculé (cf scripts/build-v18-tickers.ts) :
  //  1. Top 308 par market_cap décroissant
  //  2. Reste sans market_cap (cat 3 EU principalement) en alphabétique
  // Filtre runtime : doublons multi-classes (GOOG/NWSA/UAA/...).
  const validKeys = new Set(Object.keys(datasets).map((k) => k.toUpperCase()));
  const tickers = (V17_SORTED as string[]).filter(
    (t) => validKeys.has(t.toUpperCase()) && !HIDDEN_DUPLICATES.has(t.toUpperCase()),
  );

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
