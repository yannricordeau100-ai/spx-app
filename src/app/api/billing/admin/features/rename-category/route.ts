import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { renameCategory } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/admin/features/rename-category
 * Body : { oldName: string, newName: string }
 *
 * Renomme une catégorie globalement (= toutes les features de oldName
 * deviennent newName). newName peut être "" pour passer en "sans catégorie".
 */
export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = await req.json();
  const oldName = typeof body?.oldName === "string" ? body.oldName : null;
  const newName = typeof body?.newName === "string" ? body.newName : null;
  if (oldName === null || newName === null) {
    return NextResponse.json({ error: "oldName + newName requis" }, { status: 400 });
  }
  if (oldName === newName.trim()) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
  try {
    const result = await renameCategory(oldName, newName);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
