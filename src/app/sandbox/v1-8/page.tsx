import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { HomeView } from "@/components/home-view";
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
      {/* Bandeau V1.8 : pricing + contact. */}
      <div className="border-b border-violet-500/15 bg-gradient-to-r from-violet-500/[0.05] to-cyan-500/[0.03] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 text-[12.5px]">
            <Sparkles className="size-3.5 shrink-0 text-violet-300" />
            <span className="text-zinc-300">
              <strong className="text-zinc-100">Premium 24,90 €/mois</strong>
              <span className="hidden sm:inline"> — débloque les 1 000+ sociétés, alertes email, comparaisons illimitées</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/sandbox/v1-8/contact"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.07]"
            >
              Contact
            </Link>
            <Link
              href="/sandbox/v1-8/pricing"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-bold text-violet-100 transition-colors hover:bg-violet-500/25"
              data-pricing-cta="v18_hub_topbanner"
            >
              Voir les plans
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
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
