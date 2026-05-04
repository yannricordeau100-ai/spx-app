import { HomeView } from "@/components/home-view";
import type { Company } from "@/lib/data";
// Pré-filtré au build (~12 MB, 1605 stés) : src/data/v1-6-public.json.
// Régénéré par scripts/build-public-files.ts (lancé par cron horaire après
// que CONV-DATA ait reconstruit _merged.json).
import V16_PUBLIC from "@/data/v1-6-public.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.6 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-6 = même structure que la home (`/`) mais avec TOUTES les
 * stés du pipeline (1606), Pass 1/2/3 confondues. C'est le dépôt brut :
 * extraction LLM auto sans distinction de qualité, utile pour browse
 * exhaustif + debug d'extraction CONV-DATA.
 *
 * Décision Yann 4 mai 2026 : V1.6 expose tout, V1.7 expose seulement
 * Pass 3 validées (qualité top-top). Routing identique à V1.7 sinon.
 */
export default async function SandboxV16HubPage() {
  const datasets = V16_PUBLIC as unknown as Record<string, Company>;
  const tickers = Object.keys(datasets).sort();
  return (
    <HomeView
      companies={datasets}
      tickers={tickers}
      showFAQ={false}
      routePrefix="/sandbox/v1-6"
    />
  );
}
