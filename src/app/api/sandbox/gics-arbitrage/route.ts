/**
 * Arbitrage des sous-industries GICS (5 sept 2026).
 *
 * Pour les societes ou le classement hesite entre deux sous-industries, la
 * page /sandbox/gics propose les deux choix ; le choix retenu est enregistre
 * ici, dans desk_page_content (page_key "gics", section_key "arbitrages"),
 * sous la forme { "<TICKER>": "<code8>" }. Le Cahier (docs/cahier) reprend
 * ensuite ces choix dans societes-gics.json a la prochaine synchronisation.
 *
 *   GET                          -> { choix: { TICKER: code } }
 *   POST { ticker, code }        -> enregistre (proprietaire ou jeton d audit)
 *   POST { ticker, code: null }  -> efface le choix
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { lireArbitragesGics as lireArbitrages } from "@/lib/desk/gics-arbitrage";

export const dynamic = "force-dynamic";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function autorise(req: NextRequest): Promise<boolean> {
  const jeton = req.nextUrl.searchParams.get("audit_token");
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
  return NextResponse.json({ choix: await lireArbitrages() });
}

export async function POST(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let corps: { ticker?: unknown; code?: unknown } = {};
  try {
    corps = (await req.json()) as { ticker?: unknown; code?: unknown };
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }
  const ticker = String(corps.ticker ?? "").toUpperCase().trim();
  const code = corps.code == null ? null : String(corps.code).trim();
  if (!ticker || (code !== null && !/^\d{8}$/.test(code))) {
    return NextResponse.json({ error: "ticker ou code invalide" }, { status: 400 });
  }
  const choix = await lireArbitrages();
  if (code === null) delete choix[ticker];
  else choix[ticker] = code;
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      { page_key: "gics", section_key: "arbitrages", content_fr: JSON.stringify(choix) },
      { onConflict: "page_key,section_key" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, choix });
}
