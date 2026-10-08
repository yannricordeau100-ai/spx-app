import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { chargeCarteGratuit, enregistreCarteGratuit } from "@/lib/billing/carte-gratuit-serveur";

export const dynamic = "force-dynamic";

/** Propriétaire du back-office, ou jeton d audit dans l adresse de la page appelante (comme requireDeskOwner). */
async function autorise(req: NextRequest): Promise<void> {
  const attendu = process.env.VISUAL_AUDIT_TOKEN;
  const ref = req.headers.get("referer") ?? "";
  if (attendu && ref) {
    try {
      if (new URL(ref, "https://mettrik.ai").searchParams.get("audit_token") === attendu) return;
    } catch { /* adresse illisible */ }
  }
  await requireDeskOwner();
}

/** GET : réglage de la carte Gratuit (null = affichage par défaut). */
export async function GET(req: NextRequest) {
  await autorise(req);
  return NextResponse.json({ reglage: await chargeCarteGratuit() });
}

/** POST { inclus: string[], barres: string[] } ou { reinitialiser: true }. */
export async function POST(req: NextRequest) {
  await autorise(req);
  const body = (await req.json().catch(() => ({}))) as { inclus?: unknown; barres?: unknown; reinitialiser?: boolean };
  try {
    if (body.reinitialiser) {
      await enregistreCarteGratuit(null);
      return NextResponse.json({ reglage: null });
    }
    const liste = (x: unknown) => (Array.isArray(x) ? x.filter((c): c is string => typeof c === "string" && c.length > 0) : []);
    const inclus = liste(body.inclus);
    const barres = liste(body.barres).filter((c) => !inclus.includes(c));
    if (inclus.length + barres.length === 0) {
      return NextResponse.json({ error: "Aucune ligne choisie" }, { status: 400 });
    }
    await enregistreCarteGratuit({ inclus, barres });
    return NextResponse.json({ reglage: { inclus, barres } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
