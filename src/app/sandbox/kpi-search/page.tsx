import { KpiSearchClient, type KpiSearchInitialPayload } from "./client";
import kpiIndex from "@/data/_kpis-index.json";

export const dynamic = "force-static";
export const revalidate = 3600; // 1h, l'index est régénéré côté pipeline

export const metadata = {
  title: "Moteur de recherche KPIs · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

type KpiIndex = {
  universe_size: number;
  unique_shorts: number;
  by_short: Record<string, string[]>;
  all_shorts: string[];
};

/**
 * Server Component : charge l'index complet côté serveur, ne transmet
 * que `all_shorts` + `by_short` au client (3.8 MB → ~500 KB payload).
 * `kpi_details` reste serveur-only et sera chargé à la demande via API
 * si besoin (pas exposé en bulk au navigateur).
 */
export default function KpiSearchPage() {
  const idx = kpiIndex as unknown as KpiIndex;
  const payload: KpiSearchInitialPayload = {
    universeSize: idx.universe_size,
    uniqueShorts: idx.unique_shorts,
    allShorts: idx.all_shorts,
    byShort: idx.by_short,
  };
  return <KpiSearchClient initial={payload} />;
}
