/**
 * Fiche detaillee d un compte cree (Yann 15 oct 2026).
 * Reserve au proprietaire (isDeskOwner) : email et parcours d un client,
 * jamais exposes publiquement.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isDeskOwner } from "@/lib/desk/auth";
import { ficheCompte } from "@/lib/telemetrie/analytics-site";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isDeskOwner())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const fiche = await ficheCompte(id);
  if (!fiche) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json(fiche, { headers: { "cache-control": "no-store" } });
}
