/**
 * /sandbox/faq : édition de la FAQ publique (Yann 2 sept 2026). Réservé à Yann.
 * Chaque enregistrement est visible immédiatement sur /faq, sans redéploiement,
 * et met à jour les données structurées (Google, moteurs de réponse IA).
 */
import { requireDeskOwner } from "@/lib/desk/auth";
import { FaqEditeur } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "FAQ · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireDeskOwner();
  return <FaqEditeur />;
}
