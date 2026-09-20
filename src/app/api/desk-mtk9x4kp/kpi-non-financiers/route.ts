/**
 * /api/desk-mtk9x4kp/kpi-non-financiers
 *
 * GET  -> { demandes: LigneKpiNonFinancier[] }
 *
 * POST { action: "demander", tickers: string[], criteres, commentaire? }
 *      -> cree une ligne par ticker au statut "a_traiter". Aucune recherche
 *         n est lancee : elle demarrera au feu vert de Yann.
 *
 * POST { action: "enregistrer", id, cles: string[], commentaire? }
 *      -> marque les propositions cochees et passe la ligne a "enregistre".
 *
 * Auth : requireDeskOwner() (Yann uniquement).
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  creerDemande,
  decouperTickers,
  enregistrerPropositionsCochees,
  lireCriteres,
  listerDemandes,
  type CriteresKpiNonFinancier,
} from "@/lib/desk/kpi-non-financiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  try {
    const demandes = await listerDemandes();
    return NextResponse.json({ demandes });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    tickers?: unknown;
    criteres?: Partial<CriteresKpiNonFinancier>;
    commentaire?: string;
    id?: string;
    cles?: unknown;
  };

  if (body.action === "demander") {
    const brut = Array.isArray(body.tickers)
      ? body.tickers.filter((t): t is string => typeof t === "string").join(" ")
      : String(body.tickers ?? "");
    const tickers = decouperTickers(brut);
    if (tickers.length === 0) {
      return NextResponse.json(
        { error: "Aucun ticker exploitable dans la saisie." },
        { status: 400 },
      );
    }
    const criteres = lireCriteres(body.criteres);
    try {
      const creees = [];
      for (const ticker of tickers) {
        creees.push(
          await creerDemande({
            ticker,
            criteres,
            commentaire: body.commentaire?.trim() || null,
          }),
        );
      }
      return NextResponse.json({
        ok: true,
        demandes: creees,
        message:
          "Demande enregistree au statut a traiter. La recherche demarrera au feu vert de Yann.",
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  if (body.action === "enregistrer") {
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "id manquant" }, { status: 400 });
    }
    const cles = Array.isArray(body.cles)
      ? body.cles.filter((c): c is string => typeof c === "string")
      : [];
    try {
      const demande = await enregistrerPropositionsCochees(
        id,
        cles,
        body.commentaire?.trim() || null,
      );
      return NextResponse.json({
        ok: true,
        demande,
        message: `${cles.length} indicateur(s) enregistre(s).`,
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "action inconnue (demander ou enregistrer)" },
    { status: 400 },
  );
}
