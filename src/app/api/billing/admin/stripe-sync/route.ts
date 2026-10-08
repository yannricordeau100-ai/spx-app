import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { synchroniseStripeServeur } from "@/lib/billing/stripe-prix-sync";

export const dynamic = "force-dynamic";

/**
 * Bouton « Synchroniser Stripe » du back-office (secours).
 *
 * 8 oct 2026 : le back-office fait foi. Pour chaque plan, periode et devise dont
 * le montant differe du prix Stripe actif, cree un nouveau prix Stripe (meme
 * produit, cle stable), desactive l ancien et met a jour la base. Les abonnes
 * existants gardent leur prix. Detail : src/lib/billing/stripe-prix-sync.ts.
 * `?simulation=1` : liste les ecarts sans rien modifier.
 */
export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const simulation = new URL(req.url).searchParams.get("simulation") === "1";
  try {
    const journal = await synchroniseStripeServeur({ simulation, source: "bouton synchroniser" });
    return NextResponse.json({
      created: journal.filter((l) => l.action === "cree").length,
      updated: journal.filter((l) => l.action === "archive").length,
      erreurs: journal.filter((l) => l.action === "erreur").length,
      journal,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
