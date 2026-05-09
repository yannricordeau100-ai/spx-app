import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { upsertFeature, deleteFeature } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await ctx.params;
  const body = await req.json();
  try {
    const data = await upsertFeature({ id, ...body });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await ctx.params;
  try {
    await deleteFeature(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
