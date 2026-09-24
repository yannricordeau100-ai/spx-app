// Yann 25 sept 2026 : tous les emails que Mettrik envoie, par ordre d importance.
// Module sans directive (partage serveur / client).
export type EntreeCatalogue = {
  type: string;
  titre: string;
  quoi: string;
  declencheur: string;
  destinataire: string;
  frequence: string;
  source: string;
  statut: "actif" | "bloque" | "hors journal";
};

export const ALERTES: EntreeCatalogue[] = [
  { type: "alerte-securite", titre: "Sécurité : tentative de triche", quoi: "Un compte tiers présente le cookie de simulation d abonnement, ou un jeton d audit invalide est utilisé.", declencheur: "À chaque tentative détectée par le proxy du site.", destinataire: "Propriétaire", frequence: "1 alerte au plus par heure et par signal", source: "src/lib/security/alerte.ts", statut: "actif" },
  { type: "alerte-rafale-contact", titre: "Rafale de messages de contact", quoi: "Plus de 2 messages envoyés par le formulaire de contact en 5 minutes (robot probable).", declencheur: "À chaque message accepté par le formulaire.", destinataire: "Propriétaire", frequence: "1 alerte au plus par fenêtre de 5 min", source: "src/lib/journal-emails.ts", statut: "actif" },
  { type: "alerte-rafale-inscription", titre: "Rafale de créations de compte", quoi: "Plus de 2 comptes créés en 5 minutes.", declencheur: "À chaque inscription (email ou Google).", destinataire: "Propriétaire", frequence: "1 alerte au plus par fenêtre de 5 min", source: "src/lib/journal-emails.ts", statut: "actif" },
  { type: "alerte-jour-contact", titre: "Volume de contact sur 24 h", quoi: "Plus de 10 messages de contact sur les dernières 24 heures.", declencheur: "À chaque message accepté.", destinataire: "Propriétaire", frequence: "1 alerte au plus par 24 h", source: "src/lib/journal-emails.ts", statut: "actif" },
  { type: "alerte-jour-inscription", titre: "Volume d inscriptions sur 24 h", quoi: "Plus de 10 comptes créés sur les dernières 24 heures.", declencheur: "À chaque inscription.", destinataire: "Propriétaire", frequence: "1 alerte au plus par 24 h", source: "src/lib/journal-emails.ts", statut: "actif" },
  { type: "alerte-maj", titre: "Alerte rouge : fiches en retard", quoi: "Des blocs de fiche ne sont pas à jour 3 jours après une publication de résultats.", declencheur: "Tâche quotidienne /api/cron/alertes-maj.", destinataire: "Propriétaire", frequence: "Quotidienne, seulement si la liste change", source: "src/app/api/cron/alertes-maj/route.ts", statut: "actif" },
  { type: "robot-extraction", titre: "Robot de mise à jour : rien extrait", quoi: "La tâche de nuit des sociétés n a extrait aucune donnée.", declencheur: "Tâche de nuit sur le Mac (earnings-refresh).", destinataire: "Propriétaire", frequence: "Au plus une par nuit", source: "scripts/earnings-refresh.sh", statut: "hors journal" },
];

export const NOTIFICATIONS: EntreeCatalogue[] = [
  { type: "support-proprietaire", titre: "Nouveau message de contact ou de support", quoi: "Copie de chaque message reçu (ticket numéroté).", declencheur: "À chaque message du formulaire ou de la bulle d aide.", destinataire: "Propriétaire", frequence: "À chaque message", source: "src/lib/email/support.ts", statut: "actif" },
  { type: "notif-contact-seuil", titre: "Cap des 5 messages de contact", quoi: "Le formulaire de contact atteint 5 messages envoyés au total.", declencheur: "Au 5e message (seuil réglable).", destinataire: "Propriétaire", frequence: "Une fois", source: "src/lib/journal-emails.ts", statut: "actif" },
  { type: "veille-indices", titre: "Veille des indices", quoi: "Entrées et sorties du S&P 500 et du Nasdaq 100.", declencheur: "Tâche quotidienne /api/cron/veille-indices.", destinataire: "Propriétaire", frequence: "Seulement si la composition change", source: "src/app/api/cron/veille-indices/route.ts", statut: "actif" },
  { type: "support-accuse", titre: "Accusé de réception au client", quoi: "Confirme au client que son message est reçu, avec son numéro de ticket.", declencheur: "À chaque message de contact.", destinataire: "Client", frequence: "À chaque message", source: "src/lib/email/support.ts", statut: "actif" },
  { type: "support-reponse", titre: "Réponse au client", quoi: "Réponse envoyée depuis l espace de support.", declencheur: "Quand une réponse est envoyée.", destinataire: "Client", frequence: "À chaque réponse", source: "src/lib/email/support.ts", statut: "actif" },
  { type: "billing-failed", titre: "Échec de paiement", quoi: "Prévient l abonné que son paiement a échoué.", declencheur: "Webhook Stripe.", destinataire: "Client", frequence: "À chaque échec", source: "src/lib/email/resend.ts", statut: "actif" },
  { type: "welcome", titre: "Bienvenue et accompagnement", quoi: "Emails d information aux nouveaux inscrits.", declencheur: "Inscription.", destinataire: "Client", frequence: "Bloqué depuis le 13 sept 2026 (seuls les emails nécessaires partent)", source: "src/lib/email/onboarding.ts", statut: "bloque" },
];
