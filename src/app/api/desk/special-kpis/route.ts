import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  listSpecialKpis,
  upsertSpecialKpi,
  deleteSpecialKpi,
} from "@/lib/desk/special-kpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  const rows = await listSpecialKpis();
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await requireDeskOwner();
  const body = await req.json();
  const row = await upsertSpecialKpi(body);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await requireDeskOwner();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteSpecialKpi(id);
  return NextResponse.json({ ok: true });
}
