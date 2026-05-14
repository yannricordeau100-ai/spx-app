import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  listFindings,
  upsertFinding,
  deleteFinding,
  refreshRequestCounters,
} from "@/lib/desk/image-findings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await params;
  const rows = await listFindings(id);
  return NextResponse.json({ rows });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await params;
  const body = await req.json();
  const row = await upsertFinding(body);
  await refreshRequestCounters(id);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await params;
  const { findingId } = await req.json();
  if (!findingId) return NextResponse.json({ error: "findingId required" }, { status: 400 });
  await deleteFinding(findingId);
  await refreshRequestCounters(id);
  return NextResponse.json({ ok: true });
}
