/**
 * Arbitrage des TAM par le proprietaire (7 sept 2026).
 *   GET                              -> { choix: { TICKER: ["c1","c2"] } }
 *   POST { ticker, ids: string[] }   -> enregistre (2 candidats au plus ; [] = bloc masque)
 *   POST { ticker, ids: null }       -> efface le choix (retour a « non arbitre »)
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { lireArbitragesTam } from "@/lib/desk/tam-arbitrage";

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

export async function GET(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ choix: await lireArbitragesTam() });
}

export async function POST(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let corps: { ticker?: unknown; ids?: unknown } = {};
  try {
    corps = (await req.json()) as { ticker?: unknown; ids?: unknown };
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }
  const ticker = String(corps.ticker ?? "").toUpperCase().trim();
  if (!ticker) return NextResponse.json({ error: "ticker invalide" }, { status: 400 });
  const choix = await lireArbitragesTam();
  if (corps.ids === null) delete choix[ticker];
  else {
    if (!Array.isArray(corps.ids) || corps.ids.length > 2 || !corps.ids.every((x) => typeof x === "string" && /^[a-z0-9_-]{1,20}$/i.test(x))) {
      return NextResponse.json({ error: "ids invalides (2 identifiants au plus)" }, { status: 400 });
    }
    choix[ticker] = corps.ids as string[];
  }
  const { error } = await admin()
    .from("desk_page_content")
    .upsert({ page_key: "tam", section_key: "arbitrages", content_fr: JSON.stringify(choix) }, { onConflict: "page_key,section_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, choix });
}
