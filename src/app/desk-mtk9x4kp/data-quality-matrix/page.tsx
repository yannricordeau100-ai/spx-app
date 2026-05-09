import { requireDeskOwner } from "@/lib/desk/auth";
import { buildMatrix } from "@/lib/desk/data-quality-matrix";
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
  const rows = await buildMatrix({ limit });
  return <MatrixClient initialRows={rows} initialLimit={limit} />;
}
