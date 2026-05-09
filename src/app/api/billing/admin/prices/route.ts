import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { listPrices, upsertPrice, deletePrice } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  return NextResponse.json(await listPrices());
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = await req.json();
  if (!body.plan_id || !body.currency || !body.frequency || body.amount_decimal == null) {
    return NextResponse.json({ error: "plan_id + currency + frequency + amount_decimal requis" }, { status: 400 });
  }
  try {
    const data = await upsertPrice(body);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await requireDeskOwner();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await deletePrice(id);
  return NextResponse.json({ ok: true });
}
