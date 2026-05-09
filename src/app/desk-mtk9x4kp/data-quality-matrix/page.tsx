import { requireDeskOwner } from "@/lib/desk/auth";
import { buildMatrix } from "@/lib/desk/data-quality-matrix";
import { loadHistory } from "@/lib/desk/quality-history";
import { MatrixClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Matrice qualité données · Mettrik (interne)",
  robots: { index: false, follow: false },
};

export default async function DataQualityMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  await requireDeskOwner();
  const params = await searchParams;
  const limit = params.limit ? parseInt(params.limit, 10) : 50;
  const sections = await buildMatrix({ limit });
  // Historique global "all" sur 7 jours (ou plus si snapshots dispos).
  let history: Awaited<ReturnType<typeof loadHistory>>["byColumn"] = {};
  try {
    history = (await loadHistory({ hoursBack: 24 * 14, section: "all" })).byColumn;
  } catch {
    // Table desk_quality_history pas encore migrée : fallback silencieux.
  }
  return <MatrixClient initialSections={sections} initialLimit={limit} history={history} />;
}
