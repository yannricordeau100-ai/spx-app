import { HomeView } from "@/components/home-view";
import { AuthNav } from "@/components/auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Company } from "@/lib/data";
import V17_PUBLIC from "@/data/v1-7-public.json";
// Liste pré-calculée par scripts/build-v18-tickers.ts : top 308 par
// market_cap puis chinoises + doublons retirés. Bundlée au build pour
// éviter les fs reads runtime sur Vercel (qui ne livre pas par défaut
// les fichiers v2-pipeline-enrich/ aux fonctions serverless → en prod
// le filtre échouait avec "150 visibles · 158 stés au total" au lieu
// de ~305).
import V18_TICKERS from "@/data/v1-8-tickers-sorted.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.8 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-8 = hub vitrine "top 308 hors Chine" depuis Yann le 8 mai 2026.
 * V1.7 reste le hub dév général (toutes les sés Pass 3 strict, ~617 sés)
 * pour permettre tester ordre / styles / sub-industries.
 *
 * Filtre V1.8 :
 *  1. Top 308 par market_cap (yfinance)
 *  2. Hors Chine (BABA, NIO, JD, BIDU, PDD, etc retirés)
 *  3. Hors doublons multi-classes (GOOG, NWSA, UAA, etc.)
 *
 * Tri : décroissant par market_cap (top 308). Pré-calculé au build via
 * scripts/build-v18-tickers.ts.
 */
function loadDatasets(): Record<string, Company> {
  return V17_PUBLIC as unknown as Record<string, Company>;
}

export default async function SandboxV18HubPage() {
  const datasets = loadDatasets();
  // Liste pré-triée + filtrée (V18_TICKERS). Garde uniquement les
  // tickers présents aussi dans le dataset Pass 3 strict V1.7.
  const validKeys = new Set(Object.keys(datasets).map((k) => k.toUpperCase()));
  const tickers = (V18_TICKERS as string[]).filter((t) => validKeys.has(t.toUpperCase()));

  return (
    <>
      {/* Top-right : theme toggle + langue + connexion. Même UX que la home /. */}
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 sm:right-6 sm:top-6">
        <ThemeToggle />
        <AuthNav scope="home" />
      </div>
      {/* Bandeau pricing retiré (Yann 9 mai 2026 soir) : encombrait la
          home, /sandbox/v1-8/pricing reste accessible via DisclaimerFooter. */}
      <HomeView
        companies={datasets}
        tickers={tickers}
        showFAQ={false}
        routePrefix="/sandbox/v1-8"
        searchScope={{ tickers, total: tickers.length }}
      />
    </>
  );
}
// rebuild trigger 1778343504
