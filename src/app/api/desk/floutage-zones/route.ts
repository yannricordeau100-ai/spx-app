/**
 * /api/desk/floutage-zones — proprietaire uniquement.
 * GET : zones enregistrees. POST {zones: Zone[]} : remplace la liste.
 */
import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  chargeZonesFloutage,
  enregistreZonesFloutage,
} from "@/lib/desk/floutage-zones";
import type { Zone } from "@/lib/floutage";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  return NextResponse.json({ zones: await chargeZonesFloutage() });
}

export async function POST(req: Request) {
  await requireDeskOwner();
  const body = await req.json();
  const zones = Array.isArray(body?.zones) ? (body.zones as Zone[]) : null;
  if (!zones)
    return NextResponse.json({ error: "zones requis" }, { status: 400 });
  await enregistreZonesFloutage(zones);
  return NextResponse.json({ ok: true, total: zones.length });
}
