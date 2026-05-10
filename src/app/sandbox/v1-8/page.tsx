import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { HomeView } from "@/components/home-view";
import { AuthNav } from "@/components/auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthModal } from "@/components/auth-modal";
import { PricingCards } from "@/components/billing/pricing-cards";
import { loadPricingCatalog } from "@/lib/billing/load-pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const catalog = await loadPricingCatalog();

  // Détecte la session pour ne PAS bloquer un user déjà connecté.
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
        routePrefix="/sandbox/v1-8"
        searchScope={{ tickers, total: tickers.length }}
        topNavLinks={[
          { label: "Pricing", href: "/sandbox/v1-8/pricing" },
          { label: "Contact", href: "/sandbox/v1-8/contact" },
        ]}
        requireSignupGate={!isAuthed}
        gatePath="/sandbox/v1-8"
      />
      {/* AuthModal lu via ?auth=signup, monté ici pour que le redirect du
          SignupGateOverlay l'affiche bien sur la home V1.8. */}
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>

      {/* ─── Section "Plans" inline sur la home V1.8 ───────────────────
          Yann 10 mai 2026 : ajout pricing dans la home pour optimiser la
          conversion. Place strategique = juste apres la grille des stes
          (visible apres scroll naturel, pas intrusif). Headline travaille
          le 'prix par jour' (psychologie achat) plutot que le prix
          mensuel. CTA secondaire vers la page pricing complete pour le
          comparatif detaille des features. */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-emerald-200">
            ★ Premium · à partir de 0,68 €/jour
          </span>
          <h2 className="mt-4 font-display text-[28px] font-bold tracking-tight text-zinc-50 sm:text-[34px]">
            Tu utilises déjà 2 sociétés en gratuit. Débloque les 305 autres.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
            Le tarif annuel revient à moins d'un café par jour. 30 secondes pour souscrire,
            1 clic pour annuler quand tu veux.
          </p>
        </div>

        <div className="mt-10">
          <PricingCards
            ctaTrackingPrefix="v18_home_inline_"
            plans={catalog.plans}
            features={catalog.features}
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-[12.5px]">
          <Link
            href="/sandbox/v1-8/pricing"
            data-pricing-cta="v18_home_see_full"
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
// rebuild trigger 1778343504
