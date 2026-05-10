import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { swapFeatureOrders } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/admin/features/swap-order
 * Body: { idA: string, idB: string }
 * Swap les feature_order entre 2 features (utilisé par les flèches haut/bas).
 */
export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = (await req.json()) as { idA?: string; idB?: string };
  if (!body.idA || !body.idB) {
    return NextResponse.json({ error: "idA + idB requis" }, { status: 400 });
  }
  try {
    await swapFeatureOrders(body.idA, body.idB);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
