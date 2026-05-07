import Link from "next/link";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { ArrowRight, Sparkles } from "lucide-react";
import { HomeView } from "@/components/home-view";
import type { Company } from "@/lib/data";
import V17_PUBLIC from "@/data/v1-7-public.json";

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
 *  1. Top 308 par market_cap (yfinance via enrich/<t>.json snapshot)
 *  2. Hors Chine (BABA, NIO, JD, BIDU, PDD, etc retirés)
 *  3. Hors doublons multi-classes (cf HIDDEN_DUPLICATES)
 *
 * Tri d'affichage : décroissant par market_cap (top 308).
 */
function loadDatasets(): Record<string, Company> {
  return V17_PUBLIC as unknown as Record<string, Company>;
}

const HIDDEN_DUPLICATES = new Set(["GOOG", "BRK-A", "BRK.A", "BRK.B", "FOX", "NWSA", "UAA"]);

const CHINESE_TICKERS = new Set([
  "BABA", "JD", "BIDU", "NIO", "PDD", "BEKE", "TME", "LI", "XPEV", "TCOM",
  "VIPS", "YMM", "BILI", "HUYA", "DOYU", "EDU", "TAL", "GOTU", "LU", "RLX",
  "DIDIY", "TCEHY", "005930.KS",
]);

/**
 * Lit le market_cap depuis l'enrich file (yfinance). Renvoie 0 si absent.
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

export default async function SandboxV18HubPage() {
  const datasets = loadDatasets();
  // 1. Filtre doublons + Chine
  // 2. Tri par market_cap décroissant
  // 3. Top 308 max (= 306 stés réelles puisque BABA + NIO retirées)
  const ranked = Object.keys(datasets)
    .filter((t) => !HIDDEN_DUPLICATES.has(t.toUpperCase()))
    .filter((t) => !CHINESE_TICKERS.has(t.toUpperCase()))
    .map((t) => ({ ticker: t, mc: getMarketCap(t) }))
    .filter((x) => x.mc > 0)
    .sort((a, b) => b.mc - a.mc)
    .slice(0, 308);
  const tickers = ranked.map((x) => x.ticker);

  return (
    <>
      {/* Bandeau pricing en tête du hub V1.8 (Yann 7 mai 2026 : onglet
          price intégré). Clique → page tarifs sales-optimized 3 plans. */}
      <div className="border-b border-violet-500/15 bg-gradient-to-r from-violet-500/[0.05] to-cyan-500/[0.03] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 text-[12.5px]">
            <Sparkles className="size-3.5 shrink-0 text-violet-300" />
            <span className="text-zinc-300">
              <strong className="text-zinc-100">Premium 24,90 €/mois</strong>
              <span className="hidden sm:inline"> — débloque les 1 000+ sociétés, alertes email, comparaisons illimitées</span>
            </span>
          </div>
          <Link
            href="/sandbox/v1-8/pricing"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-bold text-violet-100 transition-colors hover:bg-violet-500/25"
            data-pricing-cta="v18_hub_topbanner"
          >
            Voir les plans
            <ArrowRight className="size-3.5" />
          </Link>
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
