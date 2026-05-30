import { requireDeskOwner } from "@/lib/desk/auth";
import { getAllBlockRules } from "@/lib/block-rules";
import { BlockRulesClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Règles par bloc · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ audit_token?: string }>;

/**
 * /sandbox/admin/block-rules
 *
 * Page admin orange (couleur dominante distinctive vs autres sandbox).
 * 1 textarea libre par bloc page sté (12 blocs canoniques) où Yann écrit
 * ses règles fond + forme. Auto-save 1s. Lu ensuite par les sub-agents
 * via `getBlockRules(blockKey)` AVANT chaque extraction / écriture.
 *
 * Version-agnostic : pas de version dans l'URL (sandbox = global).
 * Auth-gate : email Yann (desk owner). Bypass `audit_token` = VISUAL_AUDIT_TOKEN
 * pour permettre le curl HTTP 200 dans le pipeline de deploy (cf proxy.ts).
 * Mutation (PATCH) reste TOUJOURS auth-gated côté API.
 */
export default async function BlockRulesAdminPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const auditToken = sp?.audit_token ?? "";
  const expected = process.env.VISUAL_AUDIT_TOKEN ?? "";
  const isAuditBypass = !!(auditToken && expected && auditToken === expected);
  if (!isAuditBypass) {
    await requireDeskOwner();
  }
  const initial = await getAllBlockRules();
  return <BlockRulesClient initial={initial} />;
}
