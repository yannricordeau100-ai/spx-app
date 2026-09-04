/**
 * Toutes les donnees de paiement, pour la page Statistiques (Yann 4 sept 2026).
 *
 * Jusqu ici ces informations n existaient que dans le tableau de bord Stripe,
 * y compris les MOTIFS DE DESABONNEMENT que le portail collecte deja mais que
 * rien ne remontait cote Mettrik.
 *
 * La reponse est en deux etages, pour repondre a la demande : un resume lisible
 * en deux secondes, et le detail derriere, pour qui veut creuser.
 *
 * Reserve au proprietaire, ou au jeton d audit quand la maintenance ferme la
 * page de connexion.
 */
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { requireDeskOwner } from "@/lib/desk/auth";

export const dynamic = "force-dynamic";

const MOTIFS: Record<string, string> = {
  too_expensive: "Trop cher",
  missing_features: "Fonctionnalités manquantes",
  unused: "Pas assez utilisé",
  switched_service: "Parti chez un concurrent",
  low_quality: "Qualité insuffisante",
  too_complex: "Trop compliqué",
  customer_service: "Service client",
  other: "Autre",
};

function autorise(req: NextRequest): boolean {
  const t = req.nextUrl.searchParams.get("audit_token") ?? "";
  return !!t && !!process.env.VISUAL_AUDIT_TOKEN && t === process.env.VISUAL_AUDIT_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!autorise(req)) await requireDeskOwner();
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) return NextResponse.json({ error: "Stripe non configuré" }, { status: 500 });
  const stripe = new Stripe(cle);

  const debutMois = new Date();
  debutMois.setUTCDate(1);
  debutMois.setUTCHours(0, 0, 0, 0);

  try {
    const [abos, factures, remboursements, codes] = await Promise.all([
      stripe.subscriptions.list({ limit: 100, status: "all" }),
      stripe.invoices.list({ limit: 100 }),
      stripe.refunds.list({ limit: 50 }),
      stripe.promotionCodes.list({ limit: 50 }),
    ]);

    const payees = factures.data.filter((f) => f.status === "paid");
    const encaisse = (liste: Stripe.Invoice[]) =>
      liste.reduce((s, f) => s + (f.amount_paid ?? 0), 0) / 100;

    const actifs = abos.data.filter((s) => s.status === "active" || s.status === "trialing");
    const resilies = abos.data.filter((s) => s.status === "canceled");

    // Motifs de desabonnement, classes par frequence.
    const motifs = new Map<string, number>();
    const commentaires: Array<{ date: string; motif: string; commentaire: string }> = [];
    for (const s of abos.data) {
      const d = s.cancellation_details;
      if (!d?.feedback && !d?.comment) continue;
      const libelle = MOTIFS[d.feedback ?? ""] ?? d.feedback ?? "Non précisé";
      motifs.set(libelle, (motifs.get(libelle) ?? 0) + 1);
      if (d.comment) {
        commentaires.push({
          date: new Date((s.canceled_at ?? s.created) * 1000).toISOString(),
          motif: libelle,
          commentaire: d.comment,
        });
      }
    }

    // Repartition par offre, lue sur le libelle du prix.
    const parOffre = new Map<string, number>();
    for (const s of actifs) {
      const item = s.items.data[0];
      const nom = (item?.price?.nickname || item?.price?.id || "offre inconnue") as string;
      parOffre.set(nom, (parOffre.get(nom) ?? 0) + 1);
    }

    const encaisseTotal = encaisse(payees);
    const encaisseMois = encaisse(payees.filter((f) => (f.created ?? 0) * 1000 >= debutMois.getTime()));
    const totalAbos = actifs.length + resilies.length;

    return NextResponse.json({
      genere_le: new Date().toISOString(),
      resume: {
        encaisse_total: encaisseTotal,
        encaisse_mois: encaisseMois,
        abonnes_actifs: actifs.length,
        resiliations: resilies.length,
        taux_resiliation: totalAbos > 0 ? Math.round((resilies.length / totalAbos) * 1000) / 10 : 0,
        panier_moyen: payees.length > 0 ? Math.round((encaisseTotal / payees.length) * 100) / 100 : 0,
        factures_impayees: factures.data.filter((f) => f.status === "open").length,
        remboursements: remboursements.data.length,
        montant_rembourse: remboursements.data.reduce((s, r) => s + (r.amount ?? 0), 0) / 100,
      },
      motifs_resiliation: [...motifs.entries()]
        .map(([motif, nombre]) => ({ motif, nombre }))
        .sort((a, b) => b.nombre - a.nombre),
      commentaires_resiliation: commentaires.slice(0, 30),
      par_offre: [...parOffre.entries()].map(([offre, nombre]) => ({ offre, nombre })),
      paiements: payees.slice(0, 40).map((f) => ({
        date: new Date((f.created ?? 0) * 1000).toISOString(),
        numero: f.number,
        montant: (f.amount_paid ?? 0) / 100,
        devise: (f.currency ?? "").toUpperCase(),
        client: f.customer_email,
        // La version recente de l API expose `discounts` (une liste) et non
        // plus `discount`. On lit le premier, sans presumer de sa forme.
        remise: (() => {
          const d = (f as unknown as { discounts?: unknown[] }).discounts?.[0] as
            | { coupon?: { name?: string } }
            | string
            | undefined;
          return d && typeof d === "object" ? (d.coupon?.name ?? null) : null;
        })(),
        lien: f.hosted_invoice_url ?? null,
      })),
      remboursements_detail: remboursements.data.map((r) => ({
        date: new Date((r.created ?? 0) * 1000).toISOString(),
        montant: (r.amount ?? 0) / 100,
        devise: (r.currency ?? "").toUpperCase(),
        motif: r.reason ?? "non précisé",
      })),
      codes_promo: codes.data.map((p) => ({
        code: p.code,
        actif: p.active,
        utilisations: p.times_redeemed,
        maximum: p.max_redemptions,
        remise: (p as unknown as { coupon?: { percent_off?: number } }).coupon?.percent_off ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
