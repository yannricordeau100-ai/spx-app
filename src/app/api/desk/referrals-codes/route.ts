/**
 * Codes de parrainage : liste et date de fin par code (Yann 3 sept 2026).
 * Réservé au propriétaire. La date de fin est modifiable pour TOUT code,
 * y compris les anciens : un code expiré n est plus accepté à l inscription
 * (verifie par /api/referrals, champ expires_at).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

export const dynamic = "force-dynamic";

async function estProprietaire(): Promise<boolean> {
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    return !!user?.email && user.email === DESK_OWNER_EMAIL;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await estProprietaire())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data, error } = await createSupabaseAdminClient()
    .from("desk_referrals")
    .select("id, code, referrer_email, referee_email, status, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!(await estProprietaire())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; expires_at?: string | null };
  if (!body.id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  const date = body.expires_at ? new Date(body.expires_at) : null;
  if (body.expires_at && (!date || Number.isNaN(date.getTime()))) {
    return NextResponse.json({ error: "date invalide" }, { status: 400 });
  }
  // expires_at est NOT NULL en base : "sans fin" = 2099-12-31.
  const valeur = date ? date.toISOString() : "2099-12-31T00:00:00.000Z";
  const { error } = await createSupabaseAdminClient()
    .from("desk_referrals")
    .update({ expires_at: valeur })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, expires_at: valeur });
}
