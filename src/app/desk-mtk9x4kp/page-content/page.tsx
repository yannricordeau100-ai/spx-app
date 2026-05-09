import { requireDeskOwner } from "@/lib/desk/auth";
import { loadPageContentRaw } from "@/lib/desk/page-content";
import { PageContentClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Page content admin · Mettrik (interne)",
  robots: { index: false, follow: false },
};

/**
 * Back-office édition contenu pages éditables.
 *
 * Yann 8 mai 2026 : "système d'édition contenu page (admin via desk)".
 *
 * Pour le MVP : 5 sections de la page contact V1.8 seedées (title,
 * subtitle, recipient_intro, success_intro, privacy_note). Yann peut :
 *  - éditer FR / EN / DE inline
 *  - activer / désactiver une section (fallback au dictionary.ts)
 *  - ajouter une nouvelle section sur n'importe quelle page (extensible)
 */
export default async function PageContentAdminPage() {
  await requireDeskOwner();
  const rows = await loadPageContentRaw();
  return <PageContentClient initialRows={rows} />;
}
