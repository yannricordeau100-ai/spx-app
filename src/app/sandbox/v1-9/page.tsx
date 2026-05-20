import Link from "next/link";
import { Suspense } from "react";
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
// V1.9 = univers étendu (924 sés) : SP500 + Top 307 + indices EU
// (CAC 40, FTSE 100, DAX 40, SMI, BEL 20, FTSE MIB, AEX, ATX).
// Liste compilée par Agent A dans `src/data/v1-9-universe.json`
// (format `[{ ticker, name, country, sources[] }, ...]`).
// 78 tickers sont absents de `_merged.json` (cf v1-9-missing-from-merged.json) :
// pour V1.9 on les laisse tomber de la grille hub mais leurs pages sté
// afficheront "Fiche en préparation" si quelqu'un visite l'URL directe.
import V19_UNIVERSE from "@/data/v1-9-universe.json";

type UniverseEntry = {
  ticker: string;
  name?: string;
  country?: string;
  sources?: string[];
};

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.9 — SP500 + Top 307 + Indices EU · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9 = hub vitrine "univers étendu V1.9" depuis Yann le 18 mai 2026.
 *
 * Univers V1.9 : SP500 + Top 307 + CAC 40 + FTSE 100 + DAX 40 + SMI + BEL 20
 * + FTSE MIB + AEX + ATX (924 stés total). Pour V1.9 on inclut TOUS les
 * tickers de l'univers. Ceux absents de `_merged.json` afficheront
 * "Fiche en préparation" si visités directement (cf page [ticker]).
 *
 * Comportement loader inchangé : `loadV17Company` avec `mode: "v18"` (filtre
 * relâché, placeholders rouges pour blocs missing).
 */
function loadDatasets(): Record<string, Company> {
  return V17_PUBLIC as unknown as Record<string, Company>;
}

export default async function SandboxV19HubPage() {
  const datasets = loadDatasets();
  // Hub : on ne liste que les tickers V1.9 effectivement présents dans
  // le dataset Pass 3 strict (sinon la grille montrerait des cards vides).
  // Les 78 tickers absents (v1-9-missing-from-merged.json) restent
  // accessibles via URL directe → "Fiche en préparation".
  const validKeys = new Set(Object.keys(datasets).map((k) => k.toUpperCase()));
  const tickers = (V19_UNIVERSE as UniverseEntry[])
    .map((e) => e.ticker)
    .filter((t) => validKeys.has(t.toUpperCase()));
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
      {/* Top-right : theme toggle + langue + connexion. Même UX que la home /. */}
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 sm:right-6 sm:top-6">
        <ThemeToggle />
        <AuthNav scope="home" />
      </div>
      <HomeView
        companies={datasets}
        tickers={tickers}
        showFAQ={false}
        routePrefix="/sandbox/v1-9"
        searchScope={{ tickers, total: tickers.length }}
        topNavLinks={[
          { label: popularLabel, href: "/populaire-investisseurs" },
          { label: "Suivi top 307", href: "/sandbox/v1-9-status" },
          { label: pricingLabel, href: "/sandbox/v1-9/pricing" },
          { label: contactLabel, href: "/sandbox/v1-9/contact" },
        ]}
        requireSignupGate={!isAuthed}
        gatePath="/sandbox/v1-9"
        contentOverrides={homeOverrides}
      />
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>

      {/* ─── Section "Plans" inline sur la home V1.9 ─────────────────── */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/[0.08] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-cyan-200">
            ★ Premium · à partir de 0,68 €/jour
          </span>
          <h2 className="mt-4 font-display text-[28px] font-bold tracking-tight text-zinc-50 sm:text-[34px]">
            Tu utilises déjà 2 sociétés en gratuit. Débloque les {Math.max(tickers.length - 2, 0)} autres.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
            Le tarif annuel revient à moins d&apos;un café par jour. 30 secondes pour souscrire,
            1 clic pour annuler quand tu veux.
          </p>
        </div>

        <div className="mt-10">
          <PricingCards
            ctaTrackingPrefix="v19_home_inline_"
            plans={catalog.plans}
            features={catalog.features}
            taglines={taglines}
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-[12.5px]">
          <Link
            href="/sandbox/v1-9/pricing"
            data-pricing-cta="v19_home_see_full"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/[0.08] px-3.5 py-2 font-semibold text-cyan-100 hover:bg-cyan-500/15"
          >
            Voir le comparatif détaillé (toutes les fonctionnalités)
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/sandbox/v1-9/contact"
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
