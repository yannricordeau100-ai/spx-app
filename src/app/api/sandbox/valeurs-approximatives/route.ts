import { NextResponse, type NextRequest } from "next/server";
import { estAdminSandbox } from "@/lib/desk/auth";
import { ecrireDecisionApprox, lireDecisionsApprox, type DecisionApprox } from "@/lib/valeurs-approx";

export const dynamic = "force-dynamic";

async function autorise(req: NextRequest): Promise<boolean> {
  return estAdminSandbox(req);
}

export async function GET(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  return NextResponse.json({ decisions: await lireDecisionsApprox() });
}

/** POST { id, decision: DecisionApprox | null } (null = annuler). */
export async function POST(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  const c = (await req.json().catch(() => ({}))) as { id?: string; decision?: DecisionApprox | null };
  const id = String(c.id ?? "").slice(0, 200);
  const d = c.decision ?? null;
  if (!id || (d && !["accepter", "rien", "annuler", "autre"].includes(d.statut))) return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  if (d) d.explication = String(d.explication ?? "").slice(0, 2000);
  try {
    await ecrireDecisionApprox(id, d);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
