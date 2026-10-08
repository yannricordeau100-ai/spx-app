/**
 * GET /api/recherche-societes?q=<saisie>
 *
 * 8 oct 2026 (audit des fuites publiques, lignes 6, 8, 9, 10) : recherche de
 * societes cote serveur. Renvoie au plus 10 resultats deja mis en forme,
 * jamais la liste complete ni un compte. Sans saisie : les 10 plus grandes
 * capitalisations.
 */
import { NextResponse } from "next/server";
import { rechercheSocietes } from "@/lib/recherche-societes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const resultats = await rechercheSocietes(q);
  return NextResponse.json(
    { resultats },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}
