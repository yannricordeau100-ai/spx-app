import { requireDeskOwner } from "@/lib/desk/auth";
import { listSpecialKpis } from "@/lib/desk/special-kpis";
import { SpecialKpisClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "KPIs spéciaux · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

export default async function SpecialKpisPage() {
  await requireDeskOwner();
  const rows = await listSpecialKpis();
  return <SpecialKpisClient initialRows={rows} />;
}
