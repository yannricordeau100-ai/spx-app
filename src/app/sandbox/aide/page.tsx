import { AideClient } from "./client";
import { URLS, PROBLEMS } from "./help-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aide & dépannage · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * Page d'aide pour Yann (FR uniquement, ton 16-ans-non-tech).
 *
 * Contient :
 *   - Tableau des URLs canoniques (prod, staging, dashboards, etc.)
 *   - FAQ recherchable par alias (problème, contexte)
 *   - Liens directs vers les solutions
 *
 * Accessible via /sandbox/aide. Indexée par mots-clés (cf. aliases dans
 * help-data.ts) pour qu'un mot-clé court (ex "rollback", "404", "lent")
 * trouve la fiche correspondante.
 */
export default function AidePage() {
  return <AideClient urls={URLS} problems={PROBLEMS} />;
}
