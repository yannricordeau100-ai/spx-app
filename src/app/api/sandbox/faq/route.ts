/**
 * Édition de la FAQ (Yann 2 sept 2026). Réservé à Yann.
 *
 * GET    -> { contenu, source } : contenu servi (base ou dépôt) + contenu du dépôt.
 * POST   { contenu } : enregistre en base, effet immédiat sur /faq.
 * DELETE -> efface la base, /faq repart du contenu du dépôt.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { FAQ_DEPOT, chargeFaq, enregistreFaq, nettoieFaq, reinitialiseFaq } from "@/lib/faq";

export const dynamic = "force-dynamic";

async function estProprietaire(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return !!data.user && data.user.email === DESK_OWNER_EMAIL;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await estProprietaire())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { contenu, source } = await chargeFaq();
  return NextResponse.json({ contenu, source, depot: FAQ_DEPOT }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await estProprietaire())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: { contenu?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const propre = nettoieFaq(body.contenu);
  if (!propre) return NextResponse.json({ error: "contenu_invalide" }, { status: 400 });
  try {
    await enregistreFaq(propre);
  } catch (err) {
    return NextResponse.json({ error: "echec_ecriture", detail: err instanceof Error ? err.message : "echec" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, contenu: propre });
}

export async function DELETE() {
  if (!(await estProprietaire())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    await reinitialiseFaq();
  } catch (err) {
    return NextResponse.json({ error: "echec_ecriture", detail: err instanceof Error ? err.message : "echec" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, contenu: FAQ_DEPOT });
}
