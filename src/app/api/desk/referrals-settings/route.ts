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
  const { data } = await r.supabase
    .from("desk_referral_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = await req.json();
  // Champs autorisés à modifier (whitelist anti injection)
  const allowed: Record<string, unknown> = {};
  for (const k of [
    "enabled",
    "reward_months",
    "required_plan",
    "max_referees_per_user",
    "code_validity_days",
    "banner_text_fr",
    "banner_text_en",
  ]) {
    if (k in body) allowed[k] = body[k];
  }
  allowed.updated_at = new Date().toISOString();
  allowed.updated_by = r.email;
  // Upsert sur id=1 (1 seule ligne de config globale)
  const { data, error } = await r.supabase
    .from("desk_referral_settings")
    .update(allowed)
    .eq("id", 1)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
