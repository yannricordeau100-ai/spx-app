import { HomeView } from "@/components/home-view";
import type { Company } from "@/lib/data";
// Pré-filtré au build (300KB) : src/data/v1-7-public.json. Régénéré
// par scripts/build-v17-public.ts.
import V17_PUBLIC from "@/data/v1-7-public.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.7 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-7 = même structure que la home (`/`) mais avec les 421 stés
 * Pass 3 validées par CONV-DATA. HomeView accepte un dataset custom + un
 * builder de href via props (ajouté le 4 mai 2026 sur demande Yann pour
 * uniformiser visuel V1 / V1.5 / V1.6 / V1.7).
 *
 * Filtre : ne garde que les stés avec _validation OU _validation_global
 * (champs ajoutés par CONV-DATA quand Sonnet a vérifié l'extraction).
 */
function loadValidatedDatasets(): Record<string, Company> {
  return V17_PUBLIC as unknown as Record<string, Company>;
}

export default async function SandboxV17HubPage() {
  const datasets = loadValidatedDatasets();
  // Tri alphabétique par ticker pour un browse prévisible. Yann pourra
  // changer le tri (par secteur, par cap boursière, etc.) plus tard.
  const tickers = Object.keys(datasets).sort();

  return (
    <HomeView
      companies={datasets}
      tickers={tickers}
      showFAQ={false}
      hrefBuilder={(t) => `/sandbox/v1-7/${t.toLowerCase()}`}
    />
  );
}
