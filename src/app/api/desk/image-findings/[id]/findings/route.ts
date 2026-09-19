import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  listFindings,
  upsertFinding,
  deleteFinding,
  refreshRequestCounters,
  motifRejetSourceDate,
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
  // Regle Yann 19 sept 2026 : jamais de source de plus de 18 mois
  if (!body.id || "source_date" in body) {
    const motif = motifRejetSourceDate(body.source_date);
    if (motif) {
      return NextResponse.json(
        { error: `REJET source de plus de 18 mois : ${motif}` },
        { status: 400 },
      );
    }
  }
  const row = await upsertFinding(body);
  await refreshRequestCounters(id);
  // Yann 17 sept 2026 : la fiche est mise en cache 6 h ; sans ceci, un
  // graphique approuve n apparaissait sur la fiche qu au prochain deploiement
  // ou a l expiration du cache (constate sur GOOG).
  revalidateTag("fiches", "max");
  return NextResponse.json({ row });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await params;
  const { findingId } = await req.json();
  if (!findingId) return NextResponse.json({ error: "findingId required" }, { status: 400 });
  await deleteFinding(findingId);
  await refreshRequestCounters(id);
  revalidateTag("fiches", "max");
  return NextResponse.json({ ok: true });
}
