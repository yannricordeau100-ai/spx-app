/**
 * GET  /api/logotheque  -> réglages publics { emplacement: varianteId }
 * POST /api/logotheque  -> enregistre (Yann uniquement)
 *
 * Le GET est public et non authentifié : chaque page a besoin de savoir
 * quel logo afficher, y compris la page de maintenance servie à un visiteur
 * anonyme. Il ne fuite rien d'autre que des identifiants de variantes.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import {
  chargeReglagesLogotheque,
  enregistreReglagesLogotheque,
} from "@/lib/desk/logotheque-store";
import { IDS_EMPLACEMENTS, nettoieReglages } from "@/lib/logotheque";
import { WORDMARK_VARIANTS } from "@/components/wordmark-variants";

export const dynamic = "force-dynamic";

export async function GET() {
  const reglages = await chargeReglagesLogotheque();
  return NextResponse.json(
    { reglages },
    { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" } },
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { reglages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const propres = nettoieReglages(body.reglages);
  for (const [emplacement, variante] of Object.entries(propres)) {
    if (!IDS_EMPLACEMENTS.includes(emplacement)) {
      return NextResponse.json({ error: "emplacement_inconnu", emplacement }, { status: 400 });
    }
    if (!WORDMARK_VARIANTS[variante]) {
      return NextResponse.json({ error: "variante_inconnue", variante }, { status: 400 });
    }
  }

  try {
    await enregistreReglagesLogotheque(propres);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "echec";
    return NextResponse.json({ error: "echec_ecriture", detail }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reglages: propres });
}
