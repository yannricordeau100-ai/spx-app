import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  listRequests,
  upsertRequest,
  deleteRequest,
  markClaudePending,
} from "@/lib/desk/image-findings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  const rows = await listRequests();
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await requireDeskOwner();
  const body = await req.json();
  if (body.action === "mark_claude_pending" && body.id) {
    await markClaudePending(body.id);
    return NextResponse.json({ ok: true });
  }
  const row = await upsertRequest(body);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await requireDeskOwner();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteRequest(id);
  return NextResponse.json({ ok: true });
}
