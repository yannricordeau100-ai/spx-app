/**
 * /sandbox/lancement — interrupteur maintenance / site ouvert pour mettrik.ai
 * (Yann 1er sept 2026). Réservé à Yann.
 */
import { requireDeskOwner } from "@/lib/desk/auth";
import { LancementClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lancement · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireDeskOwner();
  return <LancementClient />;
}
