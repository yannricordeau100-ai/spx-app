import { HomeView } from "@/components/home-view";
import { V2_COMPANIES, V2_TICKERS } from "@/lib/v2-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.5 (FPI DRAFT) · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v2 (= alias historique pour V1.5) : même structure que la home
 * (`/`) avec les 50 stés FPI étrangères du dataset DRAFT seed.
 *
 * Décision Yann 4 mai 2026 : V1.5 = 50 DRAFT seed, V1.6 = toutes stés
 * pipeline (1606), V1.7 = Pass 3 validées (421). Tous trois utilisent
 * HomeView avec dataset custom + showFAQ=false.
 */
export default function SandboxV15HubPage() {
  return (
    <HomeView
      companies={V2_COMPANIES}
      tickers={V2_TICKERS}
      showFAQ={false}
      hrefBuilder={(t) => `/sandbox/v2/${t.toLowerCase()}`}
    />
  );
}
