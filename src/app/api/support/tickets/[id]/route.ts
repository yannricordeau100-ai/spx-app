/**
 * /api/support/tickets/[id]
 *
 * GET  : detail du ticket et de son fil. Accessible au proprietaire du desk
 *        et a l utilisateur auteur du ticket, personne d autre.
 * POST : ajoute un message de reponse au fil. Le proprietaire repond au nom
 *        du support, l auteur repond au nom du client.
 *
 * Les courriels partent apres l ecriture en base. Un echec est trace dans
 * support_messages.email_envoye et ne fait jamais echouer l appel.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDeskOwner } from "@/lib/desk/auth";
import {
  SUPPORT_LIMITES,
  ajouterMessage,
  estAuteur,
  lireTicket,
  marquerCourrielEnvoye,
  marquerLuParClient,
} from "@/lib/support/tickets";
import {
  SUPPORT_EMAIL,
  envoyerCourrielProprietaire,
  envoyerReponseAuClient,
  type ResultatCourriel,
} from "@/lib/email/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECOURS = {
  erreur: "base_indisponible",
  message: `Le fil n a pas pu etre lu. Ecrivez directement a ${SUPPORT_EMAIL}, nous reprenons la main.`,
  support_email: SUPPORT_EMAIL,
};

async function sessionCourante(): Promise<{ id: string; email: string | null } | null> {
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let detail;
  try {
    detail = await lireTicket(id);
  } catch (err) {
    console.error("[support] lecture de ticket impossible", id, err);
    return NextResponse.json(SECOURS, { status: 503 });
  }
  if (!detail) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

  const proprietaire = await isDeskOwner();
  const utilisateur = await sessionCourante();
  const auteur = !!utilisateur && estAuteur(detail.ticket, utilisateur.id, utilisateur.email);

  if (!proprietaire && !auteur) {
    // Meme reponse qu un ticket inexistant : on ne revele rien.
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }

  if (auteur && !proprietaire && !detail.ticket.lu_par_client) {
    await marquerLuParClient(id);
    detail.ticket.lu_par_client = true;
  }

  return NextResponse.json(detail);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const corps = typeof body.message === "string" ? body.message.trim() : "";

  if (corps.length < SUPPORT_LIMITES.corpsMin || corps.length > SUPPORT_LIMITES.corps) {
    return NextResponse.json({ erreur: "message_invalide" }, { status: 400 });
  }

  let detail;
  try {
    detail = await lireTicket(id);
  } catch (err) {
    console.error("[support] lecture de ticket impossible", id, err);
    return NextResponse.json(SECOURS, { status: 503 });
  }
  if (!detail) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

  const proprietaire = await isDeskOwner();
  const utilisateur = await sessionCourante();
  const auteur = !!utilisateur && estAuteur(detail.ticket, utilisateur.id, utilisateur.email);
  if (!proprietaire && !auteur) {
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }
  if (detail.ticket.statut === "clos" && !proprietaire) {
    return NextResponse.json({ erreur: "ticket_clos" }, { status: 409 });
  }

  const qui = proprietaire ? "support" : "client";

  let message;
  try {
    message = await ajouterMessage({ ticket_id: id, auteur: qui, corps, email_envoye: false });
  } catch (err) {
    console.error("[support] message non enregistre", id, err);
    return NextResponse.json(SECOURS, { status: 503 });
  }

  // Le message est en base : plus rien ne doit faire echouer l appel.
  let courriel: ResultatCourriel = { ok: false };
  try {
    courriel =
      qui === "support"
        ? await envoyerReponseAuClient(detail.ticket, corps)
        : await envoyerCourrielProprietaire(detail.ticket, corps, { nouveau: false });
    await marquerCourrielEnvoye(message.id, courriel.ok);
  } catch (err) {
    console.error("[support] courriel de reponse en echec, message conserve", id, err);
  }

  return NextResponse.json({ ok: true, message, courriel_envoye: courriel.ok }, { status: 201 });
}
