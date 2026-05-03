import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, supabase };
}

export async function GET() {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const { data, error } = await r.supabase
    .from("desk_contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = await req.json();
  const { id, ...patch } = body;
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  // whitelist champs modifiables
  const allowed: Record<string, unknown> = {};
  for (const k of ["status", "notes", "read_at", "replied_at"]) {
    if (k in patch) allowed[k] = patch[k];
  }
  const { data, error } = await r.supabase
    .from("desk_contact_messages")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
