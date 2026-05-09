import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { updateBugById, deleteBug } from "@/lib/desk/bugs";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await ctx.params;
  const body = await req.json();
  // Si status passe à "fixed" → set resolved_at automatiquement
  if (body.status === "fixed" && !body.resolved_at) {
    body.resolved_at = new Date().toISOString();
  }
  try {
    return NextResponse.json(await updateBugById(id, body));
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await ctx.params;
  await deleteBug(id);
  return NextResponse.json({ ok: true });
}
