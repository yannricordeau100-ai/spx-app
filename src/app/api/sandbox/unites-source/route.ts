import { NextResponse, type NextRequest } from "next/server";
import { estAdminSandbox } from "@/lib/desk/auth";
import { ecrireDecision, lireDecisions, type Decision } from "@/lib/unites-source";

export const dynamic = "force-dynamic";

async function autorise(req: NextRequest): Promise<boolean> {
  return estAdminSandbox(req);
}

export async function GET(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  return NextResponse.json({ decisions: await lireDecisions() });
}

/** POST { id, decision: Decision | null } (null = annuler). */
export async function POST(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  const c = (await req.json().catch(() => ({}))) as { id?: string; decision?: Decision | null };
  const id = String(c.id ?? "").slice(0, 200);
  const d = c.decision ?? null;
  if (!id || (d && !["corriger", "bloque", "non_resolvable"].includes(d.statut))) return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  if (d) d.explication = String(d.explication ?? "").slice(0, 2000);
  try {
    await ecrireDecision(id, d);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
