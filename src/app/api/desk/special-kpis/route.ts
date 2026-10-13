import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  listSpecialKpis,
  upsertSpecialKpi,
  deleteSpecialKpi,
} from "@/lib/desk/special-kpis";
import { tableSpecialPublies } from "@/lib/desk/tables-fiche";

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
  // 13 oct 2026 : vide le cache de la table lue par les fiches.
  tableSpecialPublies.invalider();
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await requireDeskOwner();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteSpecialKpi(id);
  tableSpecialPublies.invalider();
  return NextResponse.json({ ok: true });
}
