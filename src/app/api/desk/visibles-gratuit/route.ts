/**
 * /api/desk/visibles-gratuit — proprietaire uniquement (Yann 30 sept 2026).
 * GET : liste actuelle. POST {tickers} : remplace la liste.
 */
import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { chargeVisiblesGratuit, enregistreVisiblesGratuit } from "@/lib/desk/visibles-gratuit";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  return NextResponse.json({ tickers: await chargeVisiblesGratuit() });
}

export async function POST(req: Request) {
  await requireDeskOwner();
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.tickers))
    return NextResponse.json({ error: "tickers requis" }, { status: 400 });
  const tickers = await enregistreVisiblesGratuit(body.tickers);
  return NextResponse.json({ ok: true, tickers });
}
