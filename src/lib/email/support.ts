/**
 * Courriels de l assistance client.
 *
 * Deux destinataires :
 *   1. le proprietaire, sur SUPPORT_EMAIL (support@mettrik.ai par defaut), a
 *      chaque nouveau ticket et a chaque nouvelle reponse d un client ;
 *   2. le client, pour l accuse de reception puis pour la reponse du support
 *      lorsque le canal choisi est le courriel.
 *
 * Aucune traduction automatique : chaque langue reprend des formulations deja
 * presentes dans le depot (src/lib/i18n/dictionary.ts, resend.ts). Une locale
 * inconnue retombe sur le francais.
 *
 * Robustesse : aucune de ces fonctions ne leve. Elles rendent toujours un
 * resultat, que l appelant trace dans support_messages.email_envoye. Sans
 * RESEND_API_KEY (cas du poste local), le courriel est journalise, pas envoye.
 */

import { renderEmailLayout, emailParagraph as p, emailStrong as b, emailPanel } from "./layout";
import { sendEmail } from "./resend";
import type { SupportTicket } from "@/lib/support/tickets";

/** Adresse de reception des tickets. */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@mettrik.ai";

/** Les quatre langues des gabarits de courriel Mettrik. */
export type LangueCourriel = "fr" | "en" | "de" | "nl";

export type ResultatCourriel = { ok: boolean; raison?: string; id?: string };

/* ============================================================ */
/* OUTILS                                                        */
/* ============================================================ */

/** Echappe tout contenu saisi par un visiteur avant insertion dans le HTML. */
export function echapper(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Echappe puis conserve les retours a la ligne du message. */
function corpsEnHtml(v: string): string {
  return echapper(v).replace(/\r?\n/g, "<br>");
}

/** en-GB retombe sur en, de-CH sur de, tout le reste sur fr. */
export function langueDuTicket(locale: string | null | undefined): LangueCourriel {
  const l = (locale ?? "").toLowerCase();
  if (l === "en" || l === "en-gb") return "en";
  if (l === "de" || l === "de-ch") return "de";
  if (l === "nl") return "nl";
  return "fr";
}

/** Envoi tolerant : ne leve jamais, distingue la cle absente d un vrai echec. */
async function envoyer(params: Parameters<typeof sendEmail>[0]): Promise<ResultatCourriel> {
  const cle = process.env.RESEND_API_KEY;
  if (!cle || cle === "re_TODO") {
    const dest = Array.isArray(params.to) ? params.to.join(", ") : params.to;
    console.log(
      `[support][courriel non envoye, RESEND_API_KEY absente] to=${dest} sujet="${params.subject}"`,
    );
    return { ok: false, raison: "cle_absente" };
  }
  try {
    const r = await sendEmail(params);
    if (!r.ok) console.error("[support][courriel en echec]", params.subject, r.error);
    return { ok: r.ok, id: r.id, raison: r.error };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erreur inconnue";
    console.error("[support][courriel en echec]", params.subject, msg);
    return { ok: false, raison: msg };
  }
}

function dateLisible(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

/* ============================================================ */
/* 1. COURRIEL VERS LE PROPRIETAIRE                              */
/* ============================================================ */

const LIBELLE_CANAL: Record<string, string> = {
  email: "par courriel",
  espace: "dans son espace client",
};

/**
 * Previens le support d un nouveau ticket ou d une nouvelle reponse client.
 * Toujours en francais : ce courriel est interne.
 */
export async function envoyerCourrielProprietaire(
  ticket: SupportTicket,
  corps: string,
  opts?: { nouveau?: boolean },
): Promise<ResultatCourriel> {
  const nouveau = opts?.nouveau !== false;
  const titre = nouveau
    ? `Nouveau ticket n° ${ticket.numero}`
    : `Nouvelle reponse sur le ticket n° ${ticket.numero}`;

  const fiche = emailPanel(
    "Ticket",
    [
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#b9b9c3;">Numero : ${b(String(ticket.numero))}</p>`,
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#b9b9c3;">Sujet : ${b(echapper(ticket.sujet))}</p>`,
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#b9b9c3;">Categorie : ${echapper(ticket.categorie ?? "non precisee")}</p>`,
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#b9b9c3;">Identite : ${echapper(ticket.nom ?? "non renseignee")}${ticket.user_id ? " (compte connecte)" : " (visiteur)"}</p>`,
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#b9b9c3;">Adresse : ${b(echapper(ticket.email))}</p>`,
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#b9b9c3;">Reponse attendue : ${LIBELLE_CANAL[ticket.canal_reponse] ?? echapper(ticket.canal_reponse)}</p>`,
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#b9b9c3;">Page d origine : ${echapper(ticket.page_origine ?? "inconnue")}</p>`,
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#b9b9c3;">Langue : ${echapper(ticket.locale)} · Recu le ${dateLisible(ticket.created_at)}</p>`,
    ].join(""),
  );

  const html = renderEmailLayout({
    locale: "fr",
    preheader: `Ticket n° ${ticket.numero} : ${ticket.sujet}`.slice(0, 90),
    title: titre,
    bodyHtml:
      fiche +
      p(b("Message du client :")) +
      p(corpsEnHtml(corps)) +
      p("Repondre depuis le bureau, ou directement a cette adresse : la reponse arrive chez le client."),
    note: `Identifiant interne : ${echapper(ticket.id)}`,
  });

  return envoyer({
    to: SUPPORT_EMAIL,
    from: "support",
    subject: `[Support ${ticket.numero}] ${ticket.sujet}`,
    replyTo: ticket.email,
    tag: "support-proprietaire",
    html,
  });
}

/* ============================================================ */
/* 2. COURRIELS VERS LE CLIENT                                   */
/* ============================================================ */

type CopieAccuse = {
  objet: (n: number) => string;
  preheader: (n: number) => string;
  titre: string;
  intro: (nom: string) => string;
  recu: (n: number) => string;
  delai: string;
  canalEmail: string;
  canalEspace: string;
  rappelSujet: string;
  votreMessage: string;
  note: string;
};

/** Textes repris du depot : dictionary.ts (contact.*) et resend.ts. */
const ACCUSE: Record<LangueCourriel, CopieAccuse> = {
  fr: {
    objet: (n) => `Votre demande n° ${n} · Mettrik AI`,
    preheader: (n) => `Demande n° ${n} bien recue. On vous repond dans les 48h.`,
    titre: "Message recu",
    intro: (nom) => `Bonjour${nom ? " " + nom : ""},`,
    recu: (n) => `Votre demande est enregistree sous le numero ${n}.`,
    delai: "On vous repond dans les 48h. Vous parlez a des humains, pas a un robot.",
    canalEmail: "La reponse arrivera a cette adresse.",
    canalEspace: "La reponse sera disponible dans votre espace client.",
    rappelSujet: "Sujet",
    votreMessage: "Votre message",
    note: "On garde votre email uniquement pour vous repondre. Aucune revente.",
  },
  en: {
    objet: (n) => `Your request no. ${n} · Mettrik AI`,
    preheader: (n) => `Request no. ${n} received. We will get back within 48h.`,
    titre: "Message received",
    intro: (nom) => `Hi${nom ? " " + nom : ""},`,
    recu: (n) => `Your request is registered under number ${n}.`,
    delai: "We will get back within 48h. You are talking to humans, not bots.",
    canalEmail: "The reply will arrive at this address.",
    canalEspace: "The reply will be available in your account area.",
    rappelSujet: "Subject",
    votreMessage: "Your message",
    note: "We keep your email only to reply. No resale.",
  },
  de: {
    objet: (n) => `Ihre Anfrage Nr. ${n} · Mettrik AI`,
    preheader: (n) => `Anfrage Nr. ${n} erhalten. Wir antworten innerhalb von 48 Stunden.`,
    titre: "Nachricht erhalten",
    intro: (nom) => `Hallo${nom ? " " + nom : ""},`,
    recu: (n) => `Ihre Anfrage ist unter der Nummer ${n} registriert.`,
    delai:
      "Wir antworten innerhalb von 48 Stunden. Sie sprechen mit Menschen, nicht mit Bots.",
    canalEmail: "Die Antwort geht an diese Adresse.",
    canalEspace: "Die Antwort finden Sie in Ihrem Konto.",
    rappelSujet: "Betreff",
    votreMessage: "Ihre Nachricht",
    note: "Wir speichern Ihre E-Mail nur, um zu antworten. Kein Marketing, kein Verkauf.",
  },
  nl: {
    objet: (n) => `Uw aanvraag nr. ${n} · Mettrik AI`,
    preheader: (n) => `Aanvraag nr. ${n} ontvangen. We reageren binnen 48u.`,
    titre: "Bericht ontvangen",
    intro: (nom) => `Hallo${nom ? " " + nom : ""},`,
    recu: (n) => `Uw aanvraag is geregistreerd onder nummer ${n}.`,
    delai: "We reageren binnen 48u. U spreekt met mensen, geen bots.",
    canalEmail: "Het antwoord komt op dit adres aan.",
    canalEspace: "Het antwoord staat in uw account.",
    rappelSujet: "Onderwerp",
    votreMessage: "Uw bericht",
    note: "We bewaren uw e-mail alleen om te antwoorden. Geen marketing, geen doorverkoop.",
  },
};

/** Accuse de reception envoye au client des la creation du ticket. */
export async function envoyerAccuseReception(
  ticket: SupportTicket,
  corps: string,
): Promise<ResultatCourriel> {
  const lg = langueDuTicket(ticket.locale);
  const c = ACCUSE[lg];
  const canal = ticket.canal_reponse === "espace" ? c.canalEspace : c.canalEmail;

  const html = renderEmailLayout({
    locale: lg,
    preheader: c.preheader(ticket.numero).slice(0, 90),
    title: c.titre,
    bodyHtml:
      p(c.intro(echapper(ticket.nom ?? ""))) +
      p(b(c.recu(ticket.numero))) +
      p(`${c.delai} ${canal}`) +
      emailPanel(
        c.rappelSujet,
        `<p style="margin:0;font-size:14px;line-height:1.6;color:#b9b9c3;">${echapper(ticket.sujet)}</p>`,
      ) +
      emailPanel(
        c.votreMessage,
        `<p style="margin:0;font-size:14px;line-height:1.6;color:#b9b9c3;">${corpsEnHtml(corps)}</p>`,
      ),
    note: c.note,
  });

  return envoyer({
    to: ticket.email,
    from: "support",
    subject: c.objet(ticket.numero),
    replyTo: SUPPORT_EMAIL,
    tag: "support-accuse",
    html,
  });
}

type CopieReponse = {
  objet: (n: number, sujet: string) => string;
  preheader: (n: number) => string;
  titre: string;
  intro: (nom: string) => string;
  entete: string;
  relance: string;
  note: string;
};

const REPONSE: Record<LangueCourriel, CopieReponse> = {
  fr: {
    objet: (n, s) => `Re : votre demande n° ${n} · ${s}`,
    preheader: (n) => `Notre reponse a votre demande n° ${n}.`,
    titre: "Notre reponse",
    intro: (nom) => `Bonjour${nom ? " " + nom : ""},`,
    entete: "Reponse de l assistance Mettrik AI",
    relance: "Une question ? Repondez simplement a cet email.",
    note: "On garde votre email uniquement pour vous repondre. Aucune revente.",
  },
  en: {
    objet: (n, s) => `Re: your request no. ${n} · ${s}`,
    preheader: (n) => `Our reply to your request no. ${n}.`,
    titre: "Our reply",
    intro: (nom) => `Hi${nom ? " " + nom : ""},`,
    entete: "Reply from Mettrik AI support",
    relance: "Any question? Just reply to this email.",
    note: "We keep your email only to reply. No resale.",
  },
  de: {
    objet: (n, s) => `Re: Ihre Anfrage Nr. ${n} · ${s}`,
    preheader: (n) => `Unsere Antwort auf Ihre Anfrage Nr. ${n}.`,
    titre: "Unsere Antwort",
    intro: (nom) => `Hallo${nom ? " " + nom : ""},`,
    entete: "Antwort vom Mettrik AI Support",
    relance: "Eine Frage? Antworten Sie einfach auf diese E-Mail.",
    note: "Wir speichern Ihre E-Mail nur, um zu antworten. Kein Marketing, kein Verkauf.",
  },
  nl: {
    objet: (n, s) => `Re: uw aanvraag nr. ${n} · ${s}`,
    preheader: (n) => `Ons antwoord op uw aanvraag nr. ${n}.`,
    titre: "Ons antwoord",
    intro: (nom) => `Hallo${nom ? " " + nom : ""},`,
    entete: "Antwoord van Mettrik AI ondersteuning",
    relance: "Een vraag? Antwoord gewoon op deze e-mail.",
    note: "We bewaren uw e-mail alleen om te antwoorden. Geen marketing, geen doorverkoop.",
  },
};

/**
 * Reponse du support au client. N envoie rien si le client a choisi de lire
 * la reponse dans son espace : le resultat le dit explicitement.
 */
export async function envoyerReponseAuClient(
  ticket: SupportTicket,
  reponse: string,
): Promise<ResultatCourriel> {
  if (ticket.canal_reponse !== "email") {
    return { ok: false, raison: "canal_espace" };
  }
  const lg = langueDuTicket(ticket.locale);
  const c = REPONSE[lg];

  const html = renderEmailLayout({
    locale: lg,
    preheader: c.preheader(ticket.numero).slice(0, 90),
    title: c.titre,
    bodyHtml:
      p(c.intro(echapper(ticket.nom ?? ""))) +
      emailPanel(
        c.entete,
        `<p style="margin:0;font-size:14px;line-height:1.6;color:#b9b9c3;">${corpsEnHtml(reponse)}</p>`,
      ) +
      p(c.relance),
    note: c.note,
  });

  return envoyer({
    to: ticket.email,
    from: "support",
    subject: c.objet(ticket.numero, ticket.sujet).slice(0, 180),
    replyTo: SUPPORT_EMAIL,
    tag: "support-reponse",
    html,
  });
}
