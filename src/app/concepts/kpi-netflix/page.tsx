import { KpiNetflixClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Indicateurs Netflix non financiers · Mettrik",
  robots: { index: false, follow: false },
};

export default function KpiNetflixConceptPage() {
  return <KpiNetflixClient />;
}
