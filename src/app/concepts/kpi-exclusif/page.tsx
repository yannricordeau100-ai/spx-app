import { KpiExclusifClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bandeau KPI introuvable ailleurs · Mettrik",
  robots: { index: false, follow: false },
};

export default function KpiExclusifConceptPage() {
  return <KpiExclusifClient />;
}
