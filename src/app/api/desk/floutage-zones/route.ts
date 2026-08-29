/**
 * /api/desk/floutage-zones — proprietaire uniquement.
 * GET ?ticker= : zones effectives + portee. POST {zones, ticker?} : remplace
 * la liste (globale sans ticker, sinon override de la societe ; liste vide
 * autorisee = exemption). DELETE ?ticker= : retire l override, la societe
 * revient au reglage global.
 */
import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  chargeZonesFloutage,
  enregistreZonesFloutage,
  supprimeZonesFloutage,
  listeReglagesPropres,
} from "@/lib/desk/floutage-zones";
import type { Zone } from "@/lib/floutage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireDeskOwner();
  const url = new URL(req.url);
  if (url.searchParams.get("liste")) {
    return NextResponse.json({ tickers: await listeReglagesPropres() });
  }
  const ticker = url.searchParams.get("ticker");
  return NextResponse.json(await chargeZonesFloutage(ticker));
}

export async function POST(req: Request) {
  await requireDeskOwner();
  const body = await req.json();
  const zones = Array.isArray(body?.zones) ? (body.zones as Zone[]) : null;
  if (!zones)
    return NextResponse.json({ error: "zones requis" }, { status: 400 });
  const ticker = typeof body?.ticker === "string" && body.ticker.trim() ? body.ticker : null;
  await enregistreZonesFloutage(zones, ticker);
  return NextResponse.json({ ok: true, total: zones.length, portee: ticker ? "societe" : "globale" });
}

export async function DELETE(req: Request) {
  await requireDeskOwner();
  const ticker = new URL(req.url).searchParams.get("ticker");
  if (!ticker)
    return NextResponse.json({ error: "ticker requis" }, { status: 400 });
  await supprimeZonesFloutage(ticker);
  return NextResponse.json({ ok: true });
}
