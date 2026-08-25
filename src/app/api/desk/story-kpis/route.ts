import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  listStoryKpis,
  upsertStoryKpi,
  deleteStoryKpi,
  detectSourceKind,
} from "@/lib/desk/story-kpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireDeskOwner();
  const ticker = new URL(req.url).searchParams.get("ticker") ?? undefined;
  return NextResponse.json({ items: await listStoryKpis(ticker ?? undefined) });
}

export async function POST(req: Request) {
  await requireDeskOwner();
  const body = await req.json();
  if (!body?.ticker || !body?.source_url) {
    return NextResponse.json({ error: "ticker et source_url requis" }, { status: 400 });
  }
  const saved = await upsertStoryKpi({
    ...body,
    source_kind: body.source_kind ?? detectSourceKind(String(body.source_url)),
    status: body.status ?? "draft",
  });
  return NextResponse.json({ item: saved });
}

export async function DELETE(req: Request) {
  await requireDeskOwner();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await deleteStoryKpi(id);
  return NextResponse.json({ ok: true });
}
