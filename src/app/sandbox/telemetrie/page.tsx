/**
 * /sandbox/telemetrie — tableau de bord de la télémétrie première partie
 * (Yann 31 août 2026). Réservé à Yann.
 */
import { requireDeskOwner } from "@/lib/desk/auth";
import { TelemetrieClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Télémétrie · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireDeskOwner();
  return <TelemetrieClient />;
}
