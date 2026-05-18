/**
 * /api/desk/user-preferences
 *
 * Endpoint pour les préférences user (par owner_email) :
 *   - todo_category_labels (JSONB) : labels customs des 5 catégories to-dos
 *   - simulate_tier (text) : memo de "view as" pour admin (optionnel,
 *     cookie reste source de vérité par onglet)
 *
 * Yann 18 mai 2026, bascule niveau 1. Remplace l'ancien stockage localStorage
 * navigateur qui ne survivait pas aux changements de domaine.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, supabase, email: user.email! };
}

export async function GET() {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const { data, error } = await r.supabase
    .from("desk_user_preferences")
    .select("todo_category_labels, simulate_tier")
    .eq("owner_email", r.email)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    data ?? { todo_category_labels: {}, simulate_tier: null },
  );
}

export async function PATCH(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = (await req.json().catch(() => ({}))) as {
    todo_category_labels?: Record<string, string>;
    simulate_tier?: string | null;
  };

  const patch: Record<string, unknown> = { owner_email: r.email };
  if (body.todo_category_labels !== undefined) {
    patch.todo_category_labels = body.todo_category_labels;
  }
  if (body.simulate_tier !== undefined) {
    const t = body.simulate_tier;
    const valid =
      t === null || t === "anonymous" || t === "free" || t === "premium" || t === "max";
    if (!valid) {
      return NextResponse.json({ error: "invalid simulate_tier" }, { status: 400 });
    }
    patch.simulate_tier = t;
  }

  const { error } = await r.supabase
    .from("desk_user_preferences")
    .upsert(patch, { onConflict: "owner_email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
