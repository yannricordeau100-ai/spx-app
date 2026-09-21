/**
 * /api/support/tickets
 *
 * POST : public. Cree un ticket et son premier message. Accepte un visiteur
 *        non connecte ; si une session existe, le ticket est rattache au
 *        compte. Les courriels partent ensuite, et un echec d envoi ne fait
 *        jamais echouer la demande : il est trace en base.
 *
 * GET  : reserve a l utilisateur connecte, rend ses propres tickets.
 *
 * Garde anti abus du POST : champ piege, longueurs maximales, adresse valide,
 * cinq tickets au plus par heure et par adresse.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SUPPORT_LIMITES,
  compterTicketsRecents,
  creerTicket,
  emailValide,
  listerTicketsUtilisateur,
  marquerCourrielEnvoye,
  normaliserEmail,
} from "@/lib/support/tickets";
import {
  SUPPORT_EMAIL,
  envoyerAccuseReception,
  envoyerCourrielProprietaire,
} from "@/lib/email/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Message unique quand la base ne repond pas : le visiteur garde une voie. */
const SECOURS = {
  erreur: "base_indisponible",
  message: `Votre demande n a pas pu etre enregistree. Ecrivez directement a ${SUPPORT_EMAIL}, nous reprenons la main.`,
  support_email: SUPPORT_EMAIL,
};

/** Session courante, sans jamais faire echouer l appel. */
async function sessionCourante(): Promise<{ id: string; email: string | null } | null> {
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Champ piege : rempli seulement par un robot.
  if (typeof body.site_web === "string" && body.site_web.trim() !== "") {
    return NextResponse.json({ ok: true, ignore: true });
  }

  const utilisateur = await sessionCourante();

  const email = normaliserEmail(body.email ?? utilisateur?.email ?? "");
  const sujet = typeof body.sujet === "string" ? body.sujet.trim() : "";
  const corps = typeof body.message === "string" ? body.message.trim() : "";

  if (!email || !emailValide(email)) {
    return NextResponse.json({ erreur: "adresse_invalide" }, { status: 400 });
  }
  if (sujet.length < SUPPORT_LIMITES.sujetMin || sujet.length > SUPPORT_LIMITES.sujet) {
    return NextResponse.json({ erreur: "sujet_invalide" }, { status: 400 });
  }
  if (corps.length < SUPPORT_LIMITES.corpsMin || corps.length > SUPPORT_LIMITES.corps) {
    return NextResponse.json({ erreur: "message_invalide" }, { status: 400 });
  }
  if (typeof body.nom === "string" && body.nom.length > SUPPORT_LIMITES.nom * 4) {
    return NextResponse.json({ erreur: "nom_trop_long" }, { status: 400 });
  }

  const recents = await compterTicketsRecents(email);
  if (recents >= SUPPORT_LIMITES.ticketsParHeure) {
    return NextResponse.json(
      {
        erreur: "trop_de_demandes",
        message: `Cinq demandes au plus par heure. Reessayez plus tard ou ecrivez a ${SUPPORT_EMAIL}.`,
      },
      { status: 429 },
    );
  }

  let cree;
  try {
    cree = await creerTicket({
      email,
      nom: typeof body.nom === "string" ? body.nom : null,
      sujet,
      categorie: typeof body.categorie === "string" ? body.categorie : null,
      corps,
      canal_reponse: typeof body.canal_reponse === "string" ? body.canal_reponse : "email",
      locale: typeof body.locale === "string" ? body.locale : "fr",
      page_origine: typeof body.page_origine === "string" ? body.page_origine : null,
      user_id: utilisateur?.id ?? null,
    });
  } catch (err) {
    console.error("[support] creation de ticket impossible", err);
    return NextResponse.json(SECOURS, { status: 503 });
  }

  const { ticket, message } = cree;

  // A partir d ici le ticket est en base : plus aucune erreur ne remonte au
  // visiteur. Les envois sont traces dans support_messages.email_envoye.
  let courrielClient = false;
  try {
    const [versProprietaire, versClient] = await Promise.all([
      envoyerCourrielProprietaire(ticket, corps, { nouveau: true }),
      envoyerAccuseReception(ticket, corps),
    ]);
    courrielClient = versClient.ok;
    if (message) await marquerCourrielEnvoye(message.id, versProprietaire.ok && versClient.ok);
  } catch (err) {
    console.error("[support] envoi des courriels en echec, ticket conserve", ticket.numero, err);
  }

  return NextResponse.json(
    {
      ok: true,
      id: ticket.id,
      numero: ticket.numero,
      statut: ticket.statut,
      canal_reponse: ticket.canal_reponse,
      accuse_envoye: courrielClient,
      support_email: SUPPORT_EMAIL,
    },
    { status: 201 },
  );
}

export async function GET() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) {
    return NextResponse.json({ erreur: "connexion_requise" }, { status: 401 });
  }
  try {
    const tickets = await listerTicketsUtilisateur(utilisateur.id, utilisateur.email);
    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("[support] liste utilisateur indisponible", err);
    return NextResponse.json(SECOURS, { status: 503 });
  }
}
