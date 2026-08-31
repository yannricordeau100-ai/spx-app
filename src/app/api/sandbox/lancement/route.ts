/**
 * Interrupteur de lancement (Yann 1er sept 2026). Réservé à Yann.
 *
 * GET  -> { mode, env, effectif } : état courant du gating de mettrik.ai.
 * POST { mode: "on" | "off" | "env" } :
 *   - "on"  : mettrik.ai en maintenance, quoi que dise la variable Vercel ;
 *   - "off" : mettrik.ai OUVERT au public, quoi que dise la variable Vercel ;
 *   - "env" : comportement historique (variable MAINTENANCE_MODE).
 * Effet en production sous ~20 s (cache du proxy), sans redéploiement.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

export const dynamic = "force-dynamic";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function estProprietaire(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return !!data.user && data.user.email === DESK_OWNER_EMAIL;
  } catch {
    return false;
  }
}

async function litMode(): Promise<"on" | "off" | "env"> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", "maintenance")
      .eq("section_key", "reglages")
      .maybeSingle();
    const mode = data?.content_fr ? JSON.parse(data.content_fr)?.mode : null;
    return mode === "on" || mode === "off" ? mode : "env";
  } catch {
    return "env";
  }
}

export async function GET() {
  if (!(await estProprietaire())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const mode = await litMode();
  const env = (process.env.MAINTENANCE_MODE ?? "").toLowerCase();
  const envOn = env === "on" || env === "true" || env === "1";
  const effectif = mode === "on" ? true : mode === "off" ? false : envOn;
  return NextResponse.json({ mode, variable_env: envOn ? "on" : "off", maintenance_effective: effectif });
}

export async function POST(req: NextRequest) {
  if (!(await estProprietaire())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let corps: { mode?: unknown };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const mode = corps.mode;
  if (mode !== "on" && mode !== "off" && mode !== "env") {
    return NextResponse.json({ error: "mode invalide (on | off | env)" }, { status: 400 });
  }
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      { page_key: "maintenance", section_key: "reglages", content_fr: JSON.stringify({ mode }) },
      { onConflict: "page_key,section_key" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode, delai: "effet sous ~20 secondes" });
}
