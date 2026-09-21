/**
 * /api/desk-mtk9x4kp/support : assistance client, cote proprietaire.
 *
 * GET  ?statut=&categorie=&recherche=&non_vus=1&limite=
 *      → { tickets, compteurs }
 * GET  ?id=<uuid> → { ticket, messages }
 *
 * POST { action: "repondre", id, message }  → ajoute la reponse du support et
 *        l envoie au client si son canal est le courriel.
 * POST { action: "statut", id, statut, priorite? } → change l etat du ticket.
 * POST { action: "vu", id, vu? } → marque le ticket comme ouvert.
 *
 * Acces : requireDeskOwner().
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  SUPPORT_LIMITES,
  SUPPORT_PRIORITES,
  SUPPORT_STATUTS,
  ajouterMessage,
  changerStatut,
  lireTicket,
  listerTicketsProprietaire,
  marquerCourrielEnvoye,
  marquerVu,
  type SupportPriorite,
  type SupportStatut,
} from "@/lib/support/tickets";
import { SUPPORT_EMAIL, envoyerReponseAuClient } from "@/lib/email/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECOURS = {
  erreur: "base_indisponible",
  message: `La base des tickets ne repond pas. Les demandes restent lisibles sur ${SUPPORT_EMAIL}.`,
  support_email: SUPPORT_EMAIL,
};

export async function GET(req: NextRequest) {
  await requireDeskOwner();
  const q = req.nextUrl.searchParams;

  try {
    const id = q.get("id");
    if (id) {
      const detail = await lireTicket(id);
      if (!detail) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
      return NextResponse.json(detail);
    }

    const statutBrut = q.get("statut");
    const statut =
      statutBrut && (SUPPORT_STATUTS as string[]).includes(statutBrut)
        ? (statutBrut as SupportStatut)
        : "tous";

    const resultat = await listerTicketsProprietaire({
      statut,
      categorie: q.get("categorie") ?? undefined,
      recherche: q.get("recherche") ?? undefined,
      nonVus: q.get("non_vus") === "1",
      limite: Number(q.get("limite")) || undefined,
    });
    return NextResponse.json(resultat);
  } catch (err) {
    console.error("[support][desk] lecture impossible", err);
    return NextResponse.json(SECOURS, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const id = typeof body.id === "string" ? body.id : "";

  if (!id) return NextResponse.json({ erreur: "id_requis" }, { status: 400 });

  try {
    if (action === "vu") {
      await marquerVu(id, body.vu !== false);
      return NextResponse.json({ ok: true });
    }

    if (action === "statut") {
      const statut = typeof body.statut === "string" ? body.statut : "";
      if (!(SUPPORT_STATUTS as string[]).includes(statut)) {
        return NextResponse.json({ erreur: "statut_invalide" }, { status: 400 });
      }
      const priorite =
        typeof body.priorite === "string" && (SUPPORT_PRIORITES as string[]).includes(body.priorite)
          ? (body.priorite as SupportPriorite)
          : undefined;
      const ticket = await changerStatut(id, statut as SupportStatut, priorite);
      return NextResponse.json({ ok: true, ticket });
    }

    if (action === "repondre") {
      const corps = typeof body.message === "string" ? body.message.trim() : "";
      if (corps.length < 1 || corps.length > SUPPORT_LIMITES.corps) {
        return NextResponse.json({ erreur: "message_invalide" }, { status: 400 });
      }
      const detail = await lireTicket(id);
      if (!detail) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

      const message = await ajouterMessage({
        ticket_id: id,
        auteur: "support",
        corps,
        email_envoye: false,
      });

      // La reponse est enregistree : un echec d envoi est trace, pas remonte.
      let envoye = false;
      let raison: string | undefined;
      try {
        const r = await envoyerReponseAuClient(detail.ticket, corps);
        envoye = r.ok;
        raison = r.raison;
        await marquerCourrielEnvoye(message.id, r.ok);
      } catch (err) {
        console.error("[support][desk] envoi de la reponse en echec", id, err);
        raison = "envoi_impossible";
      }

      return NextResponse.json({ ok: true, message, courriel_envoye: envoye, raison });
    }

    return NextResponse.json({ erreur: "action_inconnue" }, { status: 400 });
  } catch (err) {
    console.error("[support][desk] action impossible", action, err);
    return NextResponse.json(SECOURS, { status: 503 });
  }
}
