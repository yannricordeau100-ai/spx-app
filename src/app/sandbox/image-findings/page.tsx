import { requireDeskOwner } from "@/lib/desk/auth";
import { listRequests, listFindings } from "@/lib/desk/image-findings";
import { ImageFindingsClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Graphiques et Schémas · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

export default async function ImageFindingsPage() {
  await requireDeskOwner();
  const requests = await listRequests();
  // Précharger les findings de chaque demande pour éviter N+1 côté client
  const findingsByReq: Record<string, Awaited<ReturnType<typeof listFindings>>> = {};
  for (const r of requests) {
    findingsByReq[r.id] = await listFindings(r.id);
  }
  return <ImageFindingsClient initialRequests={requests} initialFindings={findingsByReq} />;
}
