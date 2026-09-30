/**
 * GET /api/visibles-gratuit — public, lecture seule (Yann 30 sept 2026).
 * Societes 100 % visibles sans abonnement : la liste des tickers, rien d autre.
 */
import { NextResponse } from "next/server";
import { chargeVisiblesGratuit } from "@/lib/desk/visibles-gratuit";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { tickers: await chargeVisiblesGratuit() },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
