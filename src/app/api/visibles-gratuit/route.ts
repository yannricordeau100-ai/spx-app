/**
 * GET /api/visibles-gratuit — public, lecture seule (Yann 30 sept 2026).
 * Societes 100 % visibles sans abonnement : la liste des tickers, rien d autre.
 */
import { NextResponse } from "next/server";
import { chargeVisiblesGratuit } from "@/lib/desk/visibles-gratuit";
import { dansUniversActif, estUniversN1 } from "@/lib/univers-actif";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    // 9 oct 2026 : niveau 1 (UNIVERS=sp5001000) : aucune societe de l univers principal.
    { tickers: (await chargeVisiblesGratuit()).filter((t) => !estUniversN1() || dansUniversActif(t)) },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
