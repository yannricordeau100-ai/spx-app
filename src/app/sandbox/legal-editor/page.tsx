import { requireDeskOwner } from "@/lib/desk/auth";
import { loadLegalMarkdownRaw } from "@/lib/legal-md";
import { LegalEditorClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Legal editor · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

/**
 * Legal editor : édition du contenu des Conditions générales (FR + EN)
 * sans passer par le code. Lit / écrit `src/data/legal/conditions-{fr,en}.md`.
 *
 * En prod (Vercel) le filesystem est read-only : l'API renvoie 503 et Yann
 * commit le fichier manuellement. En dev / preview branch le write fonctionne
 * et un commit suit pour propager.
 *
 * Auth-gate : email Yann uniquement (requireDeskOwner).
 */
export default async function LegalEditorPage() {
  await requireDeskOwner();
  const [fr, en] = await Promise.all([
    loadLegalMarkdownRaw("conditions", "fr"),
    loadLegalMarkdownRaw("conditions", "en"),
  ]);
  return <LegalEditorClient initialFr={fr} initialEn={en} />;
}
