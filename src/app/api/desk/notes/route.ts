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
    .from("desk_notes")
    .select("*")
    .eq("owner_email", r.email)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = await req.json();
  const { data, error } = await r.supabase
    .from("desk_notes")
    .insert({
      owner_email: r.email,
      title: body.title ?? "Sans titre",
      body: body.body ?? "",
      tags: Array.isArray(body.tags) ? body.tags : [],
      pinned: !!body.pinned,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = await req.json();
  const { id, ...patch } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await r.supabase
    .from("desk_notes")
    .update(patch)
    .eq("id", id)
    .eq("owner_email", r.email)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await r.supabase
    .from("desk_notes")
    .delete()
    .eq("id", id)
    .eq("owner_email", r.email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
