import { kpisAccueilPersonnalises } from "@/lib/accueil-kpis";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { HomeView } from "@/components/home-view";
import { HomeTopBar } from "@/components/home-top-bar";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { AuthModal } from "@/components/auth-modal";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";
import { PricingCards } from "@/components/billing/pricing-cards";
import { loadPricingCatalog } from "@/lib/billing/load-pricing";
import { loadAllTaglines } from "@/lib/billing/pricing-taglines";
import { loadPageContent } from "@/lib/desk/page-content";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerFreemiumTier } from "@/lib/freemium/server";
import { comptesGicsPublics } from "@/lib/comptes-gics-public";

export const dynamic = "force-dynamic";
export const revalidate = 60;
export const metadata = {
  title: "Mettrik AI · Les chiffres qui font bouger chaque action",
  alternates: { canonical: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai" },
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5 = hub V1.9.5 = sociétés clean_all (audit a-f publishable +
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

export default async function SandboxV195HubPage() {
  // 8 oct 2026 (audit des fuites publiques, ligne 7) : plus aucune liste de
  // tickers ni total transmis a HomeView (le flux RSC de l accueil contenait
  // 662 + 461 tickers et "total":662). La recherche interroge le serveur.
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

  // Yann (8 juin 2026) : thème clair réservé aux offres payantes (premium + max).
  const freemiumTier = await getServerFreemiumTier();
  // Yann 16 sept 2026 : KPI de l accueil choisis depuis /sandbox/accueil-kpis.
  const accueilKpis = await kpisAccueilPersonnalises().catch(() => ({}));
  const themePaid = freemiumTier === "premium" || freemiumTier === "max";

  return (
    <>
      <HomeTopBar themePaid={themePaid} showPricing={isAuthed} anon={!isAuthed} />
      <HomeView
        showFAQ
        topNavLinks={[
          // Yann 16 sept 2026 : le lien Tarifs n apparait qu aux inscrits.
          ...(isAuthed ? [{ label: pricingLabel, href: "/pricing" }] : []),
          { label: contactLabel, href: "/contact" },
        ]}
        requireSignupGate={freemiumTier === "anon"} // Yann 15 sept 2026 : anonyme = inscription avant toute fiche
        anonLinks={freemiumTier === "anon"}
        gatePath="/"
        contentOverrides={homeOverrides}
        accueilKpis={accueilKpis}
        comptesGics={comptesGicsPublics()}
      />
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>

      {/* Yann 16 sept 2026 : section tarifs et abonnement reservee aux inscrits. */}
      {isAuthed && (
      <>
      {/* Section pricing inline (style V1.8).
          Yann (5 juin 2026) : verrouillage mode anonyme. Tous les CTA de
          cette section (cards pricing + boutons comparatif/contact) sont
          gates derrière le popup signup pour les visiteurs non connectés.
          La page /pricing reste accessible en mode anonyme via direct URL. */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-2 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Yann 07 sept 2026 : badge Premium 0,68 euro/jour retire de l accueil. */}
          <h2 className="mt-4 font-display text-[28px] font-bold tracking-tight text-zinc-50 sm:text-[34px]">
            Toutes les fiches sont ouvertes en gratuit. Débloque les analyses détaillées de plus de 600 sociétés.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
            Le tarif annuel revient à moins d'un café par jour. 30 secondes pour souscrire,
            1 clic pour annuler quand tu veux.
          </p>
        </div>

        <div className="mt-10">
          <SignupGateOverlay enabled={!isAuthed} gatePath="/" initialAuthed={isAuthed}>
            <PricingCards
              ctaTrackingPrefix="v195_home_inline_"
              plans={catalog.plans}
              features={catalog.features}
              carteGratuit={catalog.carte_gratuit}
              taglines={taglines}
            />
          </SignupGateOverlay>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-[12.5px]">
          <SignupGateOverlay enabled={!isAuthed} gatePath="/" initialAuthed={isAuthed}>
            <Link
              href="/pricing#compare"
              data-pricing-cta="v195_home_see_full"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] px-3.5 py-2 font-semibold text-violet-100 hover:bg-violet-500/15"
            >
              Voir le comparatif détaillé (toutes les fonctionnalités)
              <ArrowRight className="size-3.5" />
            </Link>
          </SignupGateOverlay>
          <SignupGateOverlay enabled={!isAuthed} gatePath="/" initialAuthed={isAuthed}>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 font-semibold text-zinc-200 hover:bg-white/[0.07]"
            >
              <Mail className="size-3.5" />
              Une question ? Nous contacter
            </Link>
          </SignupGateOverlay>
        </div>
      </section>
      </>
      )}
      <DisclaimerFooter />
    </>
  );
}
