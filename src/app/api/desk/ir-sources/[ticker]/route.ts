import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { upsertIrSource, deleteIrSource } from "@/lib/desk/ir-sources";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ ticker: string }> }) {
  await requireDeskOwner();
  const { ticker } = await ctx.params;
  const body = await req.json();
  try {
    return NextResponse.json(await upsertIrSource({ ...body, ticker }));
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ ticker: string }> }) {
  await requireDeskOwner();
  const { ticker } = await ctx.params;
  await deleteIrSource(ticker);
  return NextResponse.json({ ok: true });
}
