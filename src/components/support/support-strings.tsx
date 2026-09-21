/**
 * Libellés de la bulle de support (Yann 21 sept 2026).
 *
 * Deux jeux de textes écrits à la main : français et anglais. Aucune
 * traduction automatique n'est branchée ici. Les locales autres que le
 * français retombent sur l'anglais.
 *
 * Les questions et réponses de la FAQ ne passent jamais par ce fichier :
 * elles sont lues telles quelles dans src/data/faq.json.
 */

export type LangueSupport = "fr" | "en";

export type TextesSupport = {
  bulle_ouvrir: string;
  bulle_fermer: string;
  titre: string;
  sous_titre: string;
  champ_question_label: string;
  champ_question_placeholder: string;
  aide_saisie: string;
  resultats_titre: string;
  aucun_resultat: string;
  bouton_ticket: string;
  bouton_ticket_direct: string;
  retour: string;
  ticket_titre: string;
  ticket_intro: string;
  email_label: string;
  email_placeholder: string;
  nom_label: string;
  nom_placeholder: string;
  facultatif: string;
  sujet_label: string;
  sujet_placeholder: string;
  categorie_label: string;
  categorie_autre: string;
  message_label: string;
  message_placeholder: string;
  canal_label: string;
  canal_email: string;
  canal_email_aide: string;
  canal_espace: string;
  canal_espace_aide: string;
  canal_espace_sans_compte: string;
  envoyer: string;
  envoi_en_cours: string;
  erreur_email: string;
  erreur_message: string;
  erreur_envoi: string;
  erreur_contact: string;
  confirme_titre: string;
  confirme_numero: string;
  confirme_par_email: string;
  confirme_dans_espace: string;
  confirme_lien_espace: string;
  confirme_fermer: string;
  confidentialite: string;
};

export const TEXTES: Record<LangueSupport, TextesSupport> = {
  fr: {
    bulle_ouvrir: "Ouvrir l'aide et le support",
    bulle_fermer: "Fermer l'aide",
    titre: "Aide Mettrik",
    sous_titre: "Posez votre question, la réponse est peut-être déjà écrite.",
    champ_question_label: "Votre question",
    champ_question_placeholder: "Exemple : comment sont calculés les KPI ?",
    aide_saisie: "Recherche instantanée dans notre aide, rien n'est envoyé.",
    resultats_titre: "Réponses possibles",
    aucun_resultat: "Aucune réponse écrite ne correspond. Ouvrez un ticket, une personne vous répondra.",
    bouton_ticket: "Je n'ai pas ma réponse, ouvrir un ticket",
    bouton_ticket_direct: "Écrire à l'équipe",
    retour: "Revenir à la recherche",
    ticket_titre: "Ouvrir un ticket",
    ticket_intro: "Nous répondons du lundi au vendredi, sous un jour ouvré en général.",
    email_label: "Adresse de courriel",
    email_placeholder: "vous@exemple.com",
    nom_label: "Nom",
    nom_placeholder: "Comment vous appeler",
    facultatif: "facultatif",
    sujet_label: "Sujet",
    sujet_placeholder: "En quelques mots",
    categorie_label: "Catégorie",
    categorie_autre: "Autre sujet",
    message_label: "Votre message",
    message_placeholder: "Décrivez votre question ou le problème rencontré.",
    canal_label: "Où souhaitez-vous lire la réponse ?",
    canal_email: "Par courriel",
    canal_email_aide: "La réponse arrive dans votre boîte de réception.",
    canal_espace: "Dans mon espace personnel",
    canal_espace_aide: "La réponse vous attend dans votre compte Mettrik.",
    canal_espace_sans_compte: "Il faut un compte Mettrik créé avec cette adresse pour lire la réponse dans l'espace personnel.",
    envoyer: "Envoyer le ticket",
    envoi_en_cours: "Envoi en cours",
    erreur_email: "Indiquez une adresse de courriel valide.",
    erreur_message: "Écrivez votre message avant d'envoyer.",
    erreur_envoi: "L'envoi n'a pas abouti. Votre texte est conservé ci-dessous.",
    erreur_contact: "Écrivez-nous directement à support@mettrik.ai",
    confirme_titre: "Ticket enregistré",
    confirme_numero: "Numéro du ticket",
    confirme_par_email: "Nous répondons par courriel à",
    confirme_dans_espace: "La réponse vous attendra dans votre espace personnel.",
    confirme_lien_espace: "Ouvrir mon espace",
    confirme_fermer: "Fermer",
    confidentialite: "Votre adresse sert uniquement à vous répondre.",
  },
  en: {
    bulle_ouvrir: "Open help and support",
    bulle_fermer: "Close help",
    titre: "Mettrik help",
    sous_titre: "Ask your question, the answer may already be written.",
    champ_question_label: "Your question",
    champ_question_placeholder: "For example: how are the KPIs computed?",
    aide_saisie: "Instant search in our help, nothing is sent.",
    resultats_titre: "Possible answers",
    aucun_resultat: "No written answer matches. Open a ticket and someone will reply.",
    bouton_ticket: "I did not find my answer, open a ticket",
    bouton_ticket_direct: "Write to the team",
    retour: "Back to search",
    ticket_titre: "Open a ticket",
    ticket_intro: "We reply Monday to Friday, usually within one business day.",
    email_label: "Email address",
    email_placeholder: "you@example.com",
    nom_label: "Name",
    nom_placeholder: "What to call you",
    facultatif: "optional",
    sujet_label: "Subject",
    sujet_placeholder: "In a few words",
    categorie_label: "Category",
    categorie_autre: "Other topic",
    message_label: "Your message",
    message_placeholder: "Describe your question or the problem you ran into.",
    canal_label: "Where would you like to read the answer?",
    canal_email: "By email",
    canal_email_aide: "The answer lands in your inbox.",
    canal_espace: "In my personal space",
    canal_espace_aide: "The answer waits for you in your Mettrik account.",
    canal_espace_sans_compte: "You need a Mettrik account created with this address to read the answer in your personal space.",
    envoyer: "Send the ticket",
    envoi_en_cours: "Sending",
    erreur_email: "Please enter a valid email address.",
    erreur_message: "Write your message before sending.",
    erreur_envoi: "The message could not be sent. Your text is kept below.",
    erreur_contact: "Write to us directly at support@mettrik.ai",
    confirme_titre: "Ticket recorded",
    confirme_numero: "Ticket number",
    confirme_par_email: "We will reply by email to",
    confirme_dans_espace: "The answer will wait for you in your personal space.",
    confirme_lien_espace: "Open my space",
    confirme_fermer: "Close",
    confidentialite: "Your address is only used to reply to you.",
  },
};

/** Français dès que la locale commence par "fr", anglais sinon. */
export function langueDepuisLocale(locale: string | null | undefined): LangueSupport {
  return (locale ?? "").toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** Adresse de repli affichée quand l'API ne répond pas. */
export const ADRESSE_SUPPORT = "support@mettrik.ai";
