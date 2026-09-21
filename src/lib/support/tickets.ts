/**
 * Assistance client : types et acces a la base.
 *
 * Deux tables Supabase, deja creees :
 *   support_tickets  : un ticket, numerote par la base (colonne `numero`).
 *   support_messages : les echanges du ticket, dans l ordre chronologique.
 *
 * Toutes les lectures et ecritures passent par le client admin
 * (`createSupabaseAdminClient`), donc uniquement cote serveur. Les routes
 * appelantes sont responsables du controle d acces.
 *
 * Regle de robustesse : aucune donnee n est jamais perdue. Un echec d envoi
 * de courriel ne remet pas en cause l enregistrement du ticket, il est
 * simplement trace dans `support_messages.email_envoye`.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ============================================================ */
/* TYPES                                                         */
/* ============================================================ */

/** Ou le client souhaite recevoir la reponse. */
export type SupportCanal = "email" | "espace";

/** Cycle de vie d un ticket. */
export type SupportStatut = "ouvert" | "en_cours" | "repondu" | "clos";

/** Priorite posee par le proprietaire. */
export type SupportPriorite = "basse" | "normale" | "haute";

/** Auteur d un message. */
export type SupportAuteur = "client" | "support";

/** Les six themes de l aide integree. */
export const SUPPORT_CATEGORIES = [
  "compte",
  "abonnement-paiement",
  "donnees-kpi",
  "fiches-societes",
  "confidentialite",
  "technique",
] as const;
export type SupportCategorie = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUTS: SupportStatut[] = ["ouvert", "en_cours", "repondu", "clos"];
export const SUPPORT_CANAUX: SupportCanal[] = ["email", "espace"];
export const SUPPORT_PRIORITES: SupportPriorite[] = ["basse", "normale", "haute"];

/** Bornes de saisie, partagees avec la route publique et le widget. */
export const SUPPORT_LIMITES = {
  nom: 100,
  email: 254,
  sujet: 160,
  sujetMin: 3,
  corps: 5000,
  corpsMin: 10,
  pageOrigine: 300,
  /** Tickets acceptes par heure et par adresse. */
  ticketsParHeure: 5,
} as const;

export type SupportTicket = {
  id: string;
  numero: number;
  user_id: string | null;
  email: string;
  nom: string | null;
  sujet: string;
  categorie: string | null;
  canal_reponse: SupportCanal;
  statut: SupportStatut;
  priorite: SupportPriorite;
  locale: string;
  page_origine: string | null;
  vu_par_proprietaire: boolean;
  lu_par_client: boolean;
  derniere_reponse_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  auteur: SupportAuteur;
  corps: string;
  /** Faux quand le courriel correspondant n a pas pu partir. */
  email_envoye: boolean;
  created_at: string;
};

export type SupportTicketDetail = {
  ticket: SupportTicket;
  messages: SupportMessage[];
};

/** Compteurs par statut, pour les pastilles du proprietaire. */
export type SupportCompteurs = {
  total: number;
  ouvert: number;
  en_cours: number;
  repondu: number;
  clos: number;
  /** Tickets jamais ouverts par le proprietaire. */
  non_vus: number;
};

export type SupportFiltres = {
  statut?: SupportStatut | "tous";
  categorie?: string;
  /** Recherche libre sur le sujet, l adresse ou le nom. */
  recherche?: string;
  /** Uniquement les tickets pas encore ouverts par le proprietaire. */
  nonVus?: boolean;
  limite?: number;
};

/* ============================================================ */
/* OUTILS                                                        */
/* ============================================================ */

function admin() {
  return createSupabaseAdminClient();
}

/** Coupe une chaine et retire les espaces de bord. Rend null si vide. */
function texte(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/** Adresse normalisee (minuscules, sans espaces). */
export function normaliserEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase().slice(0, SUPPORT_LIMITES.email) : "";
}

/** Controle de forme d une adresse de courriel. */
export function emailValide(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= SUPPORT_LIMITES.email;
}

/** Vrai si la valeur fait partie de la liste, sinon on garde la valeur par defaut. */
function parmi<T extends string>(v: unknown, liste: readonly T[], defaut: T): T {
  return typeof v === "string" && (liste as readonly string[]).includes(v) ? (v as T) : defaut;
}

/* ============================================================ */
/* CREATION                                                      */
/* ============================================================ */

export type CreerTicketEntree = {
  email: string;
  nom?: string | null;
  sujet: string;
  categorie?: string | null;
  corps: string;
  canal_reponse?: string | null;
  locale?: string | null;
  page_origine?: string | null;
  user_id?: string | null;
  priorite?: string | null;
};

/**
 * Cree un ticket et son premier message.
 *
 * Si l insertion du message echoue alors que le ticket est enregistre, le
 * ticket est conserve et l appelant recoit `message: null` : rien n est
 * efface, le proprietaire verra le ticket et pourra relancer le client.
 */
export async function creerTicket(
  e: CreerTicketEntree,
): Promise<{ ticket: SupportTicket; message: SupportMessage | null }> {
  const supa = admin();

  const ligne = {
    user_id: e.user_id ?? null,
    email: normaliserEmail(e.email),
    nom: texte(e.nom, SUPPORT_LIMITES.nom),
    sujet: texte(e.sujet, SUPPORT_LIMITES.sujet) ?? "(sans sujet)",
    categorie: texte(e.categorie, 60),
    canal_reponse: parmi<SupportCanal>(e.canal_reponse, SUPPORT_CANAUX, "email"),
    statut: "ouvert" as SupportStatut,
    priorite: parmi<SupportPriorite>(e.priorite, SUPPORT_PRIORITES, "normale"),
    locale: texte(e.locale, 10) ?? "fr",
    page_origine: texte(e.page_origine, SUPPORT_LIMITES.pageOrigine),
    vu_par_proprietaire: false,
    lu_par_client: true,
  };

  const { data, error } = await supa.from("support_tickets").insert(ligne).select().single();
  if (error) throw error;
  const ticket = data as SupportTicket;

  let message: SupportMessage | null = null;
  try {
    message = await ajouterMessage({
      ticket_id: ticket.id,
      auteur: "client",
      corps: e.corps,
      // Le courriel part apres, la route mettra le drapeau a jour.
      email_envoye: false,
      toucherTicket: false,
    });
  } catch (err) {
    console.error("[support] premier message non enregistre, ticket conserve", ticket.numero, err);
  }

  return { ticket, message };
}

/* ============================================================ */
/* MESSAGES                                                      */
/* ============================================================ */

export type AjouterMessageEntree = {
  ticket_id: string;
  auteur: SupportAuteur;
  corps: string;
  email_envoye?: boolean;
  /** Faux pour le tout premier message, deja couvert par la creation. */
  toucherTicket?: boolean;
};

/**
 * Ajoute un message au fil et remet le ticket dans l etat qui convient :
 * une reponse du support passe le ticket en `repondu` et le marque non lu
 * cote client, un message du client le remet en `ouvert` et non vu cote
 * proprietaire.
 */
export async function ajouterMessage(e: AjouterMessageEntree): Promise<SupportMessage> {
  const supa = admin();
  const corps = typeof e.corps === "string" ? e.corps.trim().slice(0, SUPPORT_LIMITES.corps) : "";

  const { data, error } = await supa
    .from("support_messages")
    .insert({
      ticket_id: e.ticket_id,
      auteur: e.auteur,
      corps,
      email_envoye: e.email_envoye ?? false,
    })
    .select()
    .single();
  if (error) throw error;

  if (e.toucherTicket !== false) {
    const maintenant = new Date().toISOString();
    const maj =
      e.auteur === "support"
        ? {
            statut: "repondu" as SupportStatut,
            derniere_reponse_at: maintenant,
            lu_par_client: false,
            vu_par_proprietaire: true,
            updated_at: maintenant,
          }
        : {
            statut: "ouvert" as SupportStatut,
            vu_par_proprietaire: false,
            lu_par_client: true,
            updated_at: maintenant,
          };
    const { error: e2 } = await supa.from("support_tickets").update(maj).eq("id", e.ticket_id);
    // Le message est deja en base : un echec ici ne doit rien annuler.
    if (e2) console.error("[support] ticket non rafraichi apres message", e.ticket_id, e2.message);
  }

  return data as SupportMessage;
}

/** Trace le resultat de l envoi de courriel lie a un message. */
export async function marquerCourrielEnvoye(messageId: string, envoye: boolean): Promise<void> {
  try {
    const supa = admin();
    await supa.from("support_messages").update({ email_envoye: envoye }).eq("id", messageId);
  } catch (err) {
    console.error("[support] trace d envoi non ecrite", messageId, err);
  }
}

/* ============================================================ */
/* LECTURE                                                       */
/* ============================================================ */

/** Liste complete pour le proprietaire, avec filtres et compteurs. */
export async function listerTicketsProprietaire(
  f: SupportFiltres = {},
): Promise<{ tickets: SupportTicket[]; compteurs: SupportCompteurs }> {
  const supa = admin();
  let q = supa
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(f.limite ?? 200, 1), 500));

  if (f.statut && f.statut !== "tous") q = q.eq("statut", f.statut);
  if (f.categorie) q = q.eq("categorie", f.categorie);
  if (f.nonVus) q = q.eq("vu_par_proprietaire", false);
  if (f.recherche) {
    const r = f.recherche.replace(/[%,()]/g, " ").trim().slice(0, 80);
    if (r) q = q.or(`sujet.ilike.%${r}%,email.ilike.%${r}%,nom.ilike.%${r}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  const tickets = (data ?? []) as SupportTicket[];

  return { tickets, compteurs: await compterTickets() };
}

/** Compteurs par statut sur l ensemble des tickets, filtres non appliques. */
export async function compterTickets(): Promise<SupportCompteurs> {
  const supa = admin();
  const vide: SupportCompteurs = { total: 0, ouvert: 0, en_cours: 0, repondu: 0, clos: 0, non_vus: 0 };
  const { data, error } = await supa.from("support_tickets").select("statut,vu_par_proprietaire");
  if (error) throw error;
  for (const l of (data ?? []) as { statut: SupportStatut; vu_par_proprietaire: boolean }[]) {
    vide.total += 1;
    if (l.statut in vide) vide[l.statut] += 1;
    if (!l.vu_par_proprietaire) vide.non_vus += 1;
  }
  return vide;
}

/**
 * Tickets d un utilisateur connecte. On retient ses tickets rattaches a son
 * compte et ceux ouverts en visiteur avec la meme adresse.
 */
export async function listerTicketsUtilisateur(
  userId: string,
  email?: string | null,
): Promise<SupportTicket[]> {
  const supa = admin();
  const adresse = normaliserEmail(email ?? "");
  const filtre = adresse ? `user_id.eq.${userId},email.eq.${adresse}` : `user_id.eq.${userId}`;
  const { data, error } = await supa
    .from("support_tickets")
    .select("*")
    .or(filtre)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

/** Ticket et fil de messages, ou null si l identifiant ne correspond a rien. */
export async function lireTicket(id: string): Promise<SupportTicketDetail | null> {
  const supa = admin();
  const { data, error } = await supa.from("support_tickets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: msgs, error: e2 } = await supa
    .from("support_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  if (e2) throw e2;

  return { ticket: data as SupportTicket, messages: (msgs ?? []) as SupportMessage[] };
}

/** Ticket seul, sans le fil. */
export async function lireTicketSeul(id: string): Promise<SupportTicket | null> {
  const supa = admin();
  const { data, error } = await supa.from("support_tickets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as SupportTicket | null;
}

/** Vrai si l utilisateur est bien l auteur du ticket. */
export function estAuteur(t: SupportTicket, userId: string | null, email: string | null): boolean {
  if (userId && t.user_id === userId) return true;
  if (email && normaliserEmail(email) === t.email) return true;
  return false;
}

/* ============================================================ */
/* ETATS                                                         */
/* ============================================================ */

/** Change le statut. Le passage a `clos` ne supprime jamais le fil. */
export async function changerStatut(
  id: string,
  statut: SupportStatut,
  priorite?: SupportPriorite,
): Promise<SupportTicket> {
  const supa = admin();
  const maj: Record<string, unknown> = { statut, updated_at: new Date().toISOString() };
  if (priorite) maj.priorite = priorite;
  const { data, error } = await supa
    .from("support_tickets")
    .update(maj)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as SupportTicket;
}

/** Marque le ticket comme ouvert par le proprietaire. */
export async function marquerVu(id: string, vu = true): Promise<void> {
  const supa = admin();
  const { error } = await supa
    .from("support_tickets")
    .update({ vu_par_proprietaire: vu, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Marque le fil comme lu par le client (ouverture depuis son espace). */
export async function marquerLuParClient(id: string): Promise<void> {
  try {
    const supa = admin();
    await supa.from("support_tickets").update({ lu_par_client: true }).eq("id", id);
  } catch (err) {
    console.error("[support] lecture client non enregistree", id, err);
  }
}

/* ============================================================ */
/* GARDE ANTI ABUS                                               */
/* ============================================================ */

/**
 * Nombre de tickets ouverts par cette adresse depuis une heure.
 * En cas de base injoignable, on renvoie 0 : on prefere accepter un ticket
 * de trop plutot que de perdre une demande legitime.
 */
export async function compterTicketsRecents(email: string): Promise<number> {
  try {
    const supa = admin();
    const depuis = new Date(Date.now() - 3600_000).toISOString();
    const { count, error } = await supa
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("email", normaliserEmail(email))
      .gte("created_at", depuis);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error("[support] comptage horaire indisponible", err);
    return 0;
  }
}

/** Supprime un ticket et son fil. Reserve aux tests et au proprietaire. */
export async function supprimerTicket(id: string): Promise<void> {
  const supa = admin();
  await supa.from("support_messages").delete().eq("ticket_id", id);
  await supa.from("support_tickets").delete().eq("id", id);
}
