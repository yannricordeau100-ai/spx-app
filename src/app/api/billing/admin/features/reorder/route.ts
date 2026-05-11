import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { reorderFeatures } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/admin/features/reorder
 * Body: { orderedIds: string[] }
 * Reorder N features en une fois (drag-and-drop + sélection multiple).
 */
export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = (await req.json()) as { orderedIds?: string[] };
  if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds (string[]) requis" }, { status: 400 });
  }
  try {
    await reorderFeatures(body.orderedIds);
    return NextResponse.json({ ok: true, count: body.orderedIds.length });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
