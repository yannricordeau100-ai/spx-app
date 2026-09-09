import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { etatSynchro } from "@/lib/synchro/etat";
import { ecrireInterrupteurs, lireInterrupteurs, type Interrupteurs } from "@/lib/synchro/interrupteurs";

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

/** GET : interrupteurs + etat reel. */
export async function GET(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  const [interrupteurs, etat] = await Promise.all([lireInterrupteurs(), etatSynchro()]);
  return NextResponse.json({ interrupteurs, etat });
}

/** POST { transcripts?, kpi_ic?, kpi_stories? } : bascule un ou plusieurs interrupteurs. */
export async function POST(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  const corps = (await req.json().catch(() => ({}))) as Partial<Interrupteurs>;
  const actuel = await lireInterrupteurs();
  const suivant: Interrupteurs = {
    transcripts: typeof corps.transcripts === "boolean" ? corps.transcripts : actuel.transcripts,
    kpi_ic: typeof corps.kpi_ic === "boolean" ? corps.kpi_ic : actuel.kpi_ic,
    kpi_stories: typeof corps.kpi_stories === "boolean" ? corps.kpi_stories : actuel.kpi_stories,
  };
  await ecrireInterrupteurs(suivant);
  return NextResponse.json({ interrupteurs: suivant });
}
