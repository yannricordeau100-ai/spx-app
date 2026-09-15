import { NextResponse, type NextRequest } from "next/server";
import { estAdminSandbox } from "@/lib/desk/auth";
import { ecrireChoixAccueil, lireChoixAccueil } from "@/lib/accueil-kpis";

export const dynamic = "force-dynamic";

/** GET : choix actuels. POST { ticker, shorts: [3 identifiants] } : enregistre (liste vide = retour aux KPI par défaut). */
export async function GET(req: NextRequest) {
  if (!(await estAdminSandbox(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  return NextResponse.json({ choix: await lireChoixAccueil() });
}

export async function POST(req: NextRequest) {
  if (!(await estAdminSandbox(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  const corps = (await req.json().catch(() => ({}))) as { ticker?: string; shorts?: unknown };
  const ticker = String(corps.ticker ?? "").toUpperCase().trim();
  const shorts = Array.isArray(corps.shorts) ? corps.shorts.map(String) : [];
  if (!ticker) return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  try {
    const choix = await ecrireChoixAccueil(ticker, shorts);
    return NextResponse.json({ ok: true, ticker, shorts: choix[ticker] ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
