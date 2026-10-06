import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { setCategoryOrder } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/admin/features/reorder-categories
 * Body : { order: string[] }  (noms de categories, du premier au dernier)
 */
export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = await req.json();
  const order = Array.isArray(body?.order) ? body.order.filter((x: unknown): x is string => typeof x === "string" && x.trim() !== "") : null;
  if (!order || order.length === 0) {
    return NextResponse.json({ error: "order requis" }, { status: 400 });
  }
  try {
    const result = await setCategoryOrder(order);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
