import { Suspense } from "react";
import { ChartExportTestsClient } from "./client";

export const dynamic = "force-static";

export default function ChartExportTestsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Chargement…</div>}>
      <ChartExportTestsClient />
    </Suspense>
  );
}
