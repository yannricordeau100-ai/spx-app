import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { appliquerChoixPhare, exceptionsPhare, lireChoixPhare, type ChoixPhare } from "@/lib/produit-phare";

export const dynamic = "force-dynamic";

async function autorise(req: NextRequest): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user && data.user.email === DESK_OWNER_EMAIL) return true;
  } catch {
    /* pas de session */
  }
  const jeton = req.nextUrl.searchParams.get("audit_token") ?? "";
  return !!jeton && !!process.env.VISUAL_AUDIT_TOKEN && jeton === process.env.VISUAL_AUDIT_TOKEN;
}

/** GET : exceptions du registre + choix déjà faits. */
export async function GET(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  return NextResponse.json({ exceptions: exceptionsPhare(), choix: await lireChoixPhare() });
}

/** POST { ticker, choix: "A" | "B" | "aucun" } : enregistre et applique le hero. */
export async function POST(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  const corps = (await req.json().catch(() => ({}))) as { ticker?: string; choix?: string };
  const ticker = String(corps.ticker ?? "").toUpperCase().trim();
  const choix = corps.choix as ChoixPhare;
  if (!ticker || !["A", "B", "aucun"].includes(choix)) return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  try {
    const r = await appliquerChoixPhare(ticker, choix);
    return NextResponse.json({ ok: true, ticker, choix, hero: r.hero });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
