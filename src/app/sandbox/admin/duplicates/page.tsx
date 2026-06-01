import { promises as fs } from "node:fs";
import path from "node:path";
import { requireDeskOwner } from "@/lib/desk/auth";
import { DuplicatesClient, type DuplicateEntry } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Doublons tickers · Mettrik (sandbox admin)",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ audit_token?: string }>;

/**
 * /sandbox/admin/duplicates
 *
 * Audit Yann des doublons potentiels détectés par
 * `/tmp/audit-duplicates.py`. Liste tableau avec actions par ligne :
 *   - Identique  (status="same" + canonical_ticker = primary_suggestion)
 *   - Différent  (status="different")
 *   - Ignorer    (status="ignored")
 *
 * Les actions POSTent sur `/api/admin/duplicates/confirm` qui met à
 * jour `src/data/duplicates-audit.json`. Auth-gate Yann uniquement.
 */
export default async function DuplicatesAdminPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const auditToken = sp?.audit_token ?? "";
  const expected = process.env.VISUAL_AUDIT_TOKEN ?? "";
  const isAuditBypass = !!(auditToken && expected && auditToken === expected);
  if (!isAuditBypass) {
    await requireDeskOwner();
  }

  const auditPath = path.join(
    process.cwd(),
    "src/data/duplicates-audit.json",
  );

  let entries: DuplicateEntry[] = [];
  try {
    const raw = await fs.readFile(auditPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      entries = parsed as DuplicateEntry[];
    }
  } catch {
    entries = [];
  }

  return <DuplicatesClient initial={entries} />;
}
