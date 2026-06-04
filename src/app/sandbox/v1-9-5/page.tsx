import Link from "next/link";
import { Suspense } from "react";
import path from "node:path";
import fs from "node:fs/promises";
import { ArrowRight, Mail } from "lucide-react";
import { HomeView } from "@/components/home-view";
import { AuthNav } from "@/components/auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthModal } from "@/components/auth-modal";
import { PricingCards } from "@/components/billing/pricing-cards";
import { loadPricingCatalog } from "@/lib/billing/load-pricing";
import { loadAllTaglines } from "@/lib/billing/pricing-taglines";
import { loadPageContent } from "@/lib/desk/page-content";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/data";
import V17_PUBLIC from "@/data/v1-7-public.json";

export const dynamic = "force-dynamic";
export const revalidate = 60;
export const metadata = {
  title: "V1.9.5 · Stés validées qualité · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5 = hub V1.9.5 = stés clean_all (audit a-f publishable +
 * g-m extensions, 0 hallucination).
 *
 * Yann (25 mai 2026, 03h30) : refonte complète pour reprendre le DESIGN
 * RICHE de /sandbox/v1-8 (wordmark Mettrik AI gradient, punchlines
 * rotatives "prouver à...", médailles top 3, search wow). L'ancienne
 * version (compteur + filtres + cards basiques) trop éloignée de la home
 * V1.8 → Yann ne reconnaissait plus l'app après le passage par défaut.
 *
 * L'univers V1.9.5 = lecture v1-9-pre-publication-audit.json filtre
 * is_clean_all=true, trié par market_cap décroissant, intersection avec
 * datasets V1.7 public (pour garantir hero KPI + meta complète).
 */

type AuditEntry = {
  ticker: string;
  market_cap_usd: number | null;
  is_clean_all: boolean;
};

type AuditFile = {
  generated_at: string;
  audits: AuditEntry[];
};

async function loadCleanAllTickers(): Promise<string[]> {
  const auditPath = path.join(process.cwd(), "src/data/v1-9-pre-publication-audit.json");
  try {
    const raw = await fs.readFile(auditPath, "utf8");
    const audit = JSON.parse(raw) as AuditFile;
    return audit.audits
      .filter((a) => a.is_clean_all === true)
      .sort((a, b) => (b.market_cap_usd ?? 0) - (a.market_cap_usd ?? 0))
      .map((a) => a.ticker);
  } catch {
    return [];
  }
}

function loadDatasets(): Record<string, Company> {
  return V17_PUBLIC as unknown as Record<string, Company>;
}

// Yann 26 mai 2026 : dédup doublons multi-classes / ADR (ASML/ASMLF, BRK.A/B, etc.).
// Canonical map identique à src/lib/company-core/load-company.ts ALIASES.
const TICKER_DEDUP_ALIASES: Record<string, string> = {
  GOOG: "GOOGL",
  "BRK.A": "BRK-B",
  "BRK-A": "BRK-B",
  "BRK.B": "BRK-B",
  FOX: "FOXA",
  NWSA: "NWS",
  UAA: "UA",
  ASMLF: "ASML",
  ABBNY: "ABBN.SW",
  ABLZF: "ABBN.SW",
  DTEGY: "DTEGF",
  ADTTF: "ATEYY",
  BPAQF: "BP",
  "BP.L": "BP",
  "NDA-DK.CO": "NDA-FI.HE",
  EDPFY: "EDP.LS",
  BCLYF: "BARC.L",
  BBVXF: "BBVA",
};

export default async function SandboxV195HubPage() {
  const datasets = loadDatasets();
  const validKeys = new Set(Object.keys(datasets).map((k) => k.toUpperCase()));
  const allCleanTickers = await loadCleanAllTickers();
  // Garde uniquement les tickers présents aussi dans le dataset Pass 3 strict
  // ET dédup les doublons multi-classes via TICKER_DEDUP_ALIASES.
  const seen = new Set<string>();
  const tickers = allCleanTickers.filter((t) => {
    const up = t.toUpperCase();
    if (!validKeys.has(up)) return false;
    const canonical = TICKER_DEDUP_ALIASES[up] ?? up;
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  });

  const catalog = await loadPricingCatalog();
  const taglines = await loadAllTaglines();
  const locale = await getServerLocale();
  const homeOverrides = await loadPageContent("home", locale);
  const pricingLabel = translate("nav.pricing", locale);
  const contactLabel = translate("nav.contact", locale);
  const popularLabel = translate("nav.popular", locale);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthed = !!user;

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 sm:right-6 sm:top-6">
        <ThemeToggle />
        <AuthNav scope="home" />
      </div>
      <HomeView
        companies={datasets}
        tickers={tickers}
        showFAQ={false}
        routePrefix="/sandbox/v1-9-5"
        searchScope={{ tickers, total: tickers.length }}
        topNavLinks={[
          { label: pricingLabel, href: "/sandbox/v1-8/pricing" },
          { label: contactLabel, href: "/sandbox/v1-8/contact" },
        ]}
        requireSignupGate={!isAuthed}
        gatePath="/sandbox/v1-9-5"
        contentOverrides={homeOverrides}
      />
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>

      {/* Section pricing inline (style V1.8) */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-emerald-200">
            ★ Premium · à partir de 0,68 €/jour
          </span>
          <h2 className="mt-4 font-display text-[28px] font-bold tracking-tight text-zinc-50 sm:text-[34px]">
            Tu utilises déjà 2 sociétés en gratuit. Débloque les {tickers.length > 2 ? tickers.length - 2 : tickers.length} autres.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
            Le tarif annuel revient à moins d'un café par jour. 30 secondes pour souscrire,
            1 clic pour annuler quand tu veux.
          </p>
        </div>

        <div className="mt-10">
          <PricingCards
            ctaTrackingPrefix="v195_home_inline_"
            plans={catalog.plans}
            features={catalog.features}
            taglines={taglines}
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-[12.5px]">
          <Link
            href="/sandbox/v1-8/pricing"
            data-pricing-cta="v195_home_see_full"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] px-3.5 py-2 font-semibold text-violet-100 hover:bg-violet-500/15"
          >
            Voir le comparatif détaillé (toutes les fonctionnalités)
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/sandbox/v1-8/contact"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 font-semibold text-zinc-200 hover:bg-white/[0.07]"
          >
            <Mail className="size-3.5" />
            Une question ? Nous contacter
          </Link>
        </div>
      </section>
    </>
  );
}
