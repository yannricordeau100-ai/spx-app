/**
 * Choix du proprietaire sur les services Max (07 sept 2026).
 *   GET                    -> { choix: { "1": true, "3": false, ... } }
 *   POST { id, retenu }    -> enregistre (true/false, null = efface)
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

export const dynamic = "force-dynamic";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function autorise(req: NextRequest): Promise<boolean> {
  const jeton = req.nextUrl.searchParams.get("audit_token") ?? "";
  if (jeton && process.env.VISUAL_AUDIT_TOKEN && jeton === process.env.VISUAL_AUDIT_TOKEN) return true;
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    return !!user && user.email === DESK_OWNER_EMAIL;
  } catch {
    return false;
  }
}

async function lire(): Promise<Record<string, boolean>> {
  const { data } = await admin()
    .from("desk_page_content")
    .select("content_fr")
    .eq("page_key", "services")
    .eq("section_key", "max-choix")
    .maybeSingle();
  try {
    return data?.content_fr ? (JSON.parse(data.content_fr) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ choix: await lire() });
}

export async function POST(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let corps: { id?: unknown; retenu?: unknown } = {};
  try {
    corps = (await req.json()) as { id?: unknown; retenu?: unknown };
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }
  const id = String(corps.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id invalide" }, { status: 400 });
  const choix = await lire();
  if (corps.retenu === null) delete choix[id];
  else if (typeof corps.retenu === "boolean") choix[id] = corps.retenu;
  else return NextResponse.json({ error: "retenu invalide (true/false/null)" }, { status: 400 });
  const { error } = await admin()
    .from("desk_page_content")
    .upsert({ page_key: "services", section_key: "max-choix", content_fr: JSON.stringify(choix) }, { onConflict: "page_key,section_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, choix });
}
