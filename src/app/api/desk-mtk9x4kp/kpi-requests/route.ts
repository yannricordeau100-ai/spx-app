/**
 * /api/desk-mtk9x4kp/kpi-requests
 *
 * GET    → liste des demandes (200 max), du plus récent au plus ancien.
 * PATCH  { id, action: "cancel" | "retry" } → met à jour le statut.
 * DELETE ?id=X → supprime (uniquement si error / canceled / done >7j).
 *
 * Auth : requireDeskOwner().
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  deleteKpiRequest,
  loadKpiRequest,
  loadKpiRequests,
  updateKpiRequest,
} from "@/lib/desk/kpi-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  const items = await loadKpiRequests(200);
  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  await requireDeskOwner();
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: string;
  };
  const id = (body.id ?? "").trim();
  const action = (body.action ?? "").trim();
  if (!id || !action) {
    return NextResponse.json(
      { error: "id et action requis" },
      { status: 400 },
    );
  }

  const row = await loadKpiRequest(id);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (action === "cancel") {
    if (row.status === "done" || row.status === "canceled") {
      return NextResponse.json(
        { error: `cancel impossible depuis status ${row.status}` },
        { status: 400 },
      );
    }
    const updated = await updateKpiRequest(id, {
      status: "canceled",
      error_message: "Annulé manuellement via desk",
    });
    return NextResponse.json({ ok: true, item: updated });
  }

  if (action === "retry") {
    if (row.status !== "error" && row.status !== "canceled") {
      return NextResponse.json(
        { error: `retry impossible depuis status ${row.status}` },
        { status: 400 },
      );
    }
    const updated = await updateKpiRequest(id, {
      status: "pending",
      error_message: null,
    });
    return NextResponse.json({ ok: true, item: updated });
  }

  return NextResponse.json(
    { error: `action inconnue : ${action}` },
    { status: 400 },
  );
}

export async function DELETE(req: NextRequest) {
  await requireDeskOwner();
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }
  const result = await deleteKpiRequest(id);
  if (!result.deleted) {
    return NextResponse.json(
      { error: result.reason ?? "delete failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
