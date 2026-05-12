import { requireDeskOwner } from "@/lib/desk/auth";
import { listIrSources } from "@/lib/desk/ir-sources";
import { IrSourcesClient } from "./client";
import V18_TICKERS from "@/data/v1-8-tickers-sorted.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sources IR · Mettrik (interne)",
  robots: { index: false, follow: false },
};

export default async function IrSourcesAdminPage() {
  await requireDeskOwner();
  const rows = await listIrSources();
  // Liste top 307 V1.8 pour pré-seed les stés manquantes côté client
  const top307 = (V18_TICKERS as string[]).slice(0, 307);
  return <IrSourcesClient initialRows={rows} top307Tickers={top307} />;
}
