import { requireDeskOwner } from "@/lib/desk/auth";
import { FloutageSelectorClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sélecteur visuel floutage GOOGL · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ audit_token?: string }>;

/**
 * /sandbox/admin/floutage-selector
 *
 * Page admin VIOLET (couleur distinctive) pour outil étalon free tier.
 *
 * Yann surligne au pixel près sur la page GOOGL V1.9.5 les zones à flouter
 * pour le free tier. Le système :
 *   - Capture (a) bounding box pixels, (b) sélecteur DOM le plus proche,
 *     (c) texte sélectionné
 *   - Stocke en BDD Supabase `desk_floutage_selections`
 *   - Génère `src/data/floutage-rules.json` pour conversion en filtre
 *     réutilisable côté `applyFloutageRules()` (`src/lib/floutage.ts`)
 *
 * Version-agnostic : pas de version dans l'URL (sandbox = global).
 * Auth-gate : email Yann (desk owner). Bypass `audit_token` permis pour
 * permettre curl HTTP 200 dans le pipeline deploy.
 */
export default async function FloutageSelectorPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const auditToken = sp?.audit_token ?? "";
  const expected = process.env.VISUAL_AUDIT_TOKEN ?? "";
  const isAuditBypass = !!(auditToken && expected && auditToken === expected);
  if (!isAuditBypass) {
    await requireDeskOwner();
  }
  return <FloutageSelectorClient ticker="GOOGL" auditToken={auditToken} />;
}
