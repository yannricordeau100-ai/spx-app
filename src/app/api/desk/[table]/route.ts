import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

/**
 * CRUD générique pour les tables desk_* (sauf desk_notes / desk_todos qui ont
 * leurs propres routes optimisées). Utilisé par tous les autres onglets desk
 * pour économiser du code dupliqué.
 *
 * Sécurité : seul le owner_email match passe. RLS Supabase double-protège.
 */

const ALLOWED_TABLES = new Set([
  "desk_bookmarks",
  "desk_calendar",
  "desk_ideas",
  "desk_links",
  "desk_drafts",
  "desk_pitch_notes",
  "desk_inspiration",
]);

async function requireOwner(table: string) {
  if (!ALLOWED_TABLES.has(table)) {
    return { ok: false as const, response: NextResponse.json({ error: "table not allowed" }, { status: 400 }) };
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, supabase, email: user.email! };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  const r = await requireOwner(table);
  if (!r.ok) return r.response;
  const { data, error } = await r.supabase.from(table).select("*").eq("owner_email", r.email).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  const r = await requireOwner(table);
  if (!r.ok) return r.response;
  const body = await req.json();
  const { data, error } = await r.supabase
    .from(table)
    .insert({ ...body, owner_email: r.email })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  const r = await requireOwner(table);
  if (!r.ok) return r.response;
  const body = await req.json();
  const { id, ...patch } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await r.supabase
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("owner_email", r.email)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  const r = await requireOwner(table);
  if (!r.ok) return r.response;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await r.supabase.from(table).delete().eq("id", id).eq("owner_email", r.email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
