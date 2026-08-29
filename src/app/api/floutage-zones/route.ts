/**
 * GET /api/floutage-zones — public, lecture seule.
 * Les zones a flouter pour le palier gratuit. Ne contient que des noms de
 * blocs (hero, kpis...), aucune donnee. Lu par company-view au chargement.
 */
import { NextResponse } from "next/server";
import { chargeZonesFloutage } from "@/lib/desk/floutage-zones";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ zones: await chargeZonesFloutage() });
}
