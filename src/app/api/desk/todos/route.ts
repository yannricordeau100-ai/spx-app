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

// Catégories "dossiers" stockées dans le champ `priority` legacy.
// Mapping par défaut affiché -> DB (label customisable côté UI) :
//   urgent -> urgent (rose) · V2 -> high (ambre) · V3 -> normal (cyan)
//   Idée à creuser -> low (zinc) · Bonus -> extra (emerald)
// Ordre de tri descendant : urgent (5) en haut, extra (1) en bas.
// NOTE 'extra' requiert la migration SQL 20260502_todo_5th_category.sql.
const PRIORITY_ORDER = { urgent: 5, high: 4, normal: 3, low: 2, extra: 1 } as const;

export async function GET() {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const { data, error } = await r.supabase
    .from("desk_todos")
    .select("*")
    .eq("owner_email", r.email)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // sort by priority client-side (Supabase doesn't sort by enum natively)
  const sorted = (data ?? []).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pa = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 2;
    const pb = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 2;
    return pb - pa;
  });
  return NextResponse.json(sorted);
}

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = await req.json();
  const { data, error } = await r.supabase
    .from("desk_todos")
    .insert({
      owner_email: r.email,
      title: body.title ?? "Sans titre",
      done: false,
      priority: body.priority ?? "normal",
      project: body.project ?? null,
      due_at: body.due_at ?? null,
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
    .from("desk_todos")
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
    .from("desk_todos")
    .delete()
    .eq("id", id)
    .eq("owner_email", r.email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
