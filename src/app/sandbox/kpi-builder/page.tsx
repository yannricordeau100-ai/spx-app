import { requireDeskOwner } from "@/lib/desk/auth";
import { headers } from "next/headers";
import { KpiBuilderClient, type KpiRequestRow } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ajouter un KPI multi-stés · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

/**
 * SSR : charge la liste des demandes existantes via API
 * /api/desk-mtk9x4kp/kpi-requests (créée par Agent F2). Si l'endpoint
 * n'est pas encore disponible, on tombe sur une liste vide (ne bloque
 * pas l'UI : le formulaire de création reste utilisable).
 */
async function loadInitialRequests(): Promise<KpiRequestRow[]> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const cookie = h.get("cookie") ?? "";
    const res = await fetch(`${proto}://${host}/api/desk-mtk9x4kp/kpi-requests`, {
      cache: "no-store",
      headers: { cookie },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { rows?: KpiRequestRow[] };
    return Array.isArray(json.rows) ? json.rows : [];
  } catch {
    return [];
  }
}

export default async function KpiBuilderPage() {
  await requireDeskOwner();
  const initialRequests = await loadInitialRequests();
  return <KpiBuilderClient initialRequests={initialRequests} />;
}
