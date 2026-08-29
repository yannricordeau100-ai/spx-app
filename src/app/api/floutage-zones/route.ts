/**
 * GET /api/floutage-zones?ticker=AAPL — public, lecture seule.
 * Zones a flouter pour le palier gratuit : override de la societe s il
 * existe (meme vide = exemption), sinon reglage global. Aucune donnee.
 */
import { NextResponse } from "next/server";
import { chargeZonesFloutage } from "@/lib/desk/floutage-zones";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get("ticker");
  const { zones, portee } = await chargeZonesFloutage(ticker);
  return NextResponse.json({ zones, portee });
}
