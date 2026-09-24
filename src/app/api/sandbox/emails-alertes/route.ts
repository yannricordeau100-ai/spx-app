import { NextResponse } from "next/server";
import { estAdminSandbox } from "@/lib/desk/auth";
import { ecrireReglages, type Reglages } from "@/lib/journal-emails";

export const dynamic = "force-dynamic";

/** Reglages des alertes de volume (Yann 25 sept 2026). */
export async function POST(req: Request) {
  if (!(await estAdminSandbox(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Partial<Reglages>;
  const propre: Partial<Reglages> = {};
  for (const k of ["notifContactSeuil", "rafaleNb", "rafaleMinutes", "jourNb"] as const) {
    const v = Number(b[k]);
    if (Number.isFinite(v) && v >= 1 && v <= 10000) propre[k] = Math.round(v);
  }
  if (typeof b.actif === "boolean") propre.actif = b.actif;
  return NextResponse.json(await ecrireReglages(propre));
}
