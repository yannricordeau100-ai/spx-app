import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isDeskOwner } from "@/lib/desk/auth";
import { LATEST_VERSION_SLUG } from "@/lib/version-routing";
import { VisitorsAnalyticsClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sandbox · Visiteurs · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5/visitors
 *
 * Dashboard visiteurs mettrik.ai (Yann, juin 2026).
 *
 * Objectif : suivre l'audience du site (visites cumulées, par jour, top
 * pages, top referrers, devices, pays, bounce rate) en excluant l'IP de
 * Yann pour des chiffres réalistes.
 *
 * État actuel (juin 2026) : le composant Plausible
 * (`src/components/analytics/plausible.tsx`) est prêt mais la variable
 * d'environnement `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` n'est pas définie. Aucun
 * provider analytics actif. Pas de package `@vercel/analytics` installé.
 *
 * Cette page affiche donc un placeholder avec les instructions exactes
 * pour activer Plausible (recommandé : RGPD-friendly, sans cookie banner,
 * 9 EUR par mois, exclusion IP intégrée dans le dashboard Plausible).
 * Une fois activé, on branchera ici les appels à l'API Plausible Stats
 * (`api.plausible.io/api/v2/query`) en server component (la clé API reste
 * côté serveur, jamais exposée au navigateur).
 *
 * Auth gate strict : Yann uniquement (cf isDeskOwner).
 */
export default async function VisitorsAnalyticsPage() {
  const isOwner = await isDeskOwner();
  if (!isOwner) {
    redirect(`/?auth=signin&next=/sandbox/${LATEST_VERSION_SLUG}/visitors`);
  }

  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "";
  const plausibleApiKey = process.env.PLAUSIBLE_API_KEY ?? "";

  const isPlausibleConfigured =
    plausibleDomain.length > 0 &&
    plausibleDomain !== "TODO" &&
    plausibleApiKey.length > 0;

  return (
    <main className="min-h-screen bg-[#06070b] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-8">
          <Link
            href={`/sandbox/${LATEST_VERSION_SLUG}`}
            className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au sandbox
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Visiteurs mettrik.ai
          </h1>
          <p className="mt-2 text-white/60">
            Suivi de l'audience du site : visites cumulées, top pages,
            référents, devices, pays, taux de rebond. Ton IP est exclue
            pour des chiffres réalistes.
          </p>
        </header>

        <VisitorsAnalyticsClient
          isConfigured={isPlausibleConfigured}
          plausibleDomain={plausibleDomain}
        />
      </div>
    </main>
  );
}
