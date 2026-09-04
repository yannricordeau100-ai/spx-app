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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ audit_token?: string }>;
}) {
  // Yann 4 sept 2026 : cette page porte l interrupteur d ouverture du site.
  // Quand la maintenance est active, l acces par compte renvoie vers la
  // connexion, qui vit sur l accueil... lui-meme ferme par la maintenance :
  // impossible de rouvrir le site depuis le site. On accepte donc aussi le
  // jeton d audit, comme la page de structure, ce qui donne une entree
  // directe sans dependre d une page publique.
  const sp = await searchParams;
  const parJeton =
    !!sp.audit_token &&
    !!process.env.VISUAL_AUDIT_TOKEN &&
    sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) await requireDeskOwner();
  return <LancementClient />;
}
