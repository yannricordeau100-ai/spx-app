import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomeView } from "@/components/home-view";
import SandboxV195HubPage from "@/app/sandbox/v1-9-5/page";
import { AuthNav } from "@/components/auth-nav";
import { AuthModal } from "@/components/auth-modal";
import { AuthRequiredBanner } from "@/components/auth-required-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPageContent } from "@/lib/desk/page-content";
import { getServerFreemiumTier } from "@/lib/freemium/server";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Sur staging (`VERCEL_GIT_COMMIT_REF=staging`), la home `/` affiche
 * le hub V1.7 (stés Pass 3 validées) au lieu de la home V1 (5 stés).
 * En prod, comportement V1 inchangé.
 */
const IS_STAGING =
  process.env.VERCEL_GIT_COMMIT_REF === "staging" ||
  process.env.NEXT_PUBLIC_DEPLOY_TARGET === "staging";


function safeNextParam(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export const metadata = {
  title: "Mettrik AI · KPI Intelligence : les indicateurs qui comptent pour 666 sociétés",
  description: "Les KPI opérationnels des 666 sociétés du S&P 500, CAC 40, DAX 40, AEX 25, SMI et SOX : abonnés, volumes, marges par activité, risques, gouvernance et synthèses de résultats, extraits des rapports officiels.",
  alternates: { canonical: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai" },
  robots: { index: true, follow: true },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    auth?: string;
    next?: string;
    error?: string;
    info?: string;
  }>;
}) {
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Cas anti-flash : un user déjà connecté qui atterrit sur la home avec
  // un `?auth=signin&next=/foo` ou `?next=/foo` résiduel (proxy redirect
  // alors que la session venait d'être restaurée, lien partagé, etc.).
  // On ne lui colle pas la modal en pleine face : on l'envoie directement
  // sur la cible.
  const wantsAuth =
    sp.auth === "signin" || sp.auth === "signup" || sp.auth === "reset";
  if (user && (wantsAuth || sp.next)) {
    const next = safeNextParam(sp.next) ?? "/";
    redirect(next);
  }

  // Staging : root '/' redirige vers /sandbox/v1-9-5 (hub V1.9.5 par défaut
  // depuis Yann le 21 mai 2026 ; V1.9.5 = stés validées qualité audit strict,
  // standard désormais. URLs explicites /sandbox/v1-8 et /sandbox/v1-7-5
  // restent accessibles pour rétrocompatibilité.
  //
  // Yann (25 mai 2026) : FIX BOUCLE INFINIE de redirections. Si l'URL
  // contient `?auth=signin` ou `?error=` ou `?info=` (= le proxy nous a
  // envoyé ici pour afficher la modal auth d'un user non connecté qui
  // voulait accéder à /sandbox/v1-9-5), NE PAS rediriger vers /sandbox/v1-9-5.
  // Sinon : proxy gate /sandbox/v1-9-5 → /?auth=signin&next=... → home
  // re-redirect vers /sandbox/v1-9-5?auth=signin → boucle infinie → ERR_TOO_MANY_REDIRECTS
  // (= ce que Yann voit comme un "404" dans Safari).
  // On laisse tomber sur le rendu HomeView + AuthModal ci-dessous.
  // Audit lancement 2 sept 2026 : mettrik.ai est le MEME deploiement que
  // niveau2 (branche staging), donc cette redirection envoyait AUSSI les
  // visiteurs de mettrik.ai vers /sandbox/v1-9-5 (noindex, interdit aux
  // robots, titre interne). On rend le hub ICI, l URL reste "/" et la page
  // est indexable avec les metadonnees publiques ci-dessus.
  if (IS_STAGING && !wantsAuth && !sp.error && !sp.info) {
    return <SandboxV195HubPage />;
  }

  // Yann 14 mai 2026 : home prod lit aussi les overrides desk_page_content
  // pour page_key="home" → tagline + punchlines éditables depuis le back-office.
  const locale = await getServerLocale();
  const homeOverrides = await loadPageContent("home", locale);

  // Yann (8 juin 2026) : thème clair réservé aux offres payantes (premium + max).
  const freemiumTier = await getServerFreemiumTier();
  const themePaid = freemiumTier === "premium" || freemiumTier === "max";

  return (
    <>
      <div className="relative z-50 flex w-full items-center justify-between gap-2 px-4 pt-4 sm:fixed sm:left-auto sm:right-6 sm:top-6 sm:w-auto sm:justify-end sm:gap-3 sm:px-0 sm:pt-0">
        <ThemeToggle paid={themePaid} />
        <AuthNav />
      </div>
      <HomeView contentOverrides={homeOverrides} />
      {!user && (
        <Suspense fallback={null}>
          <AuthRequiredBanner />
          <AuthModal />
        </Suspense>
      )}
      <DisclaimerFooter />
    </>
  );
}
