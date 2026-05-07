import { HomeView } from "@/components/home-view";
import type { Company } from "@/lib/data";
import V17_PUBLIC from "@/data/v1-7-public.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.8 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-8 = hub similaire à V1.7 mais utilisant le filtre relaxé
 * (Pass 3 Sonnet + hero usable suffisent). Permet à Yann de naviguer
 * sur les stés à 1 critère manquant et de voir les blocs à compléter
 * (rendus en placeholder rouge dans la fiche détail via `v18Mode`).
 *
 * Yann 7 mai 2026 : "je ne veux que les sociétés qui sont tout OK
 * (j'accepte qu'il manque le logo)" → V1.8 montre les "presque OK"
 * pour qu'il décide quoi prioriser, V1.7 reste le strict.
 */
function loadDatasets(): Record<string, Company> {
  // V1.8 utilise le même fichier source que V1.7 pour l'instant. Le
  // filtre relaxé s'applique côté page détail (`/sandbox/v1-8/[ticker]`).
  // Quand on aura un build dédié V1.8 (plus permissif), on switchera ici.
  return V17_PUBLIC as unknown as Record<string, Company>;
}

export default async function SandboxV18HubPage() {
  const datasets = loadDatasets();
  const tickers = Object.keys(datasets).sort();

  return (
    <HomeView
      companies={datasets}
      tickers={tickers}
      showFAQ={false}
      routePrefix="/sandbox/v1-8"
    />
  );
}
