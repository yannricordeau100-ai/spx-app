---
name: project-mettrik-support-client
description: "Support client Mettrik : bulle publique, tickets en base, courriel vers support@mettrik.ai, interface proprietaire et espace client"
metadata:
  node_type: memory
  type: project
---

Construit le 21 septembre 2026 a la demande de Yann, en une passe, avec quatre
agents en parallele.

**Base** : tables Supabase `support_tickets` (numero, email, nom, sujet,
categorie, canal_reponse valant email ou espace, statut ouvert / en_cours /
repondu / clos, priorite, locale, page_origine, vu_par_proprietaire,
lu_par_client) et `support_messages` (ticket_id, auteur client ou support,
corps, email_envoye).

**Code** : `src/lib/support/tickets.ts`, `src/lib/email/support.ts`, routes
`/api/support/tickets`, `/api/support/tickets/[id]`,
`/api/desk-mtk9x4kp/support`. Bulle dans `src/components/support/*`, montee
dans `layout.tsx`, chargee a part derriere une barriere d erreur.
Interface proprietaire `/sandbox/support`, espace client `/account/support`.

**Regles metier decidees avec Yann** :
- la bulle s affiche pour tout le monde, la recherche dans la FAQ locale est
  ouverte a tous, mais ECRIRE un message exige un compte : un visiteur anonyme
  est renvoye vers Se connecter ou Creer un compte, son brouillon conserve ;
- le client choisit de recevoir la reponse par courriel ou dans son espace ;
- le courriel part vers `SUPPORT_EMAIL` (variable Vercel posee en production et
  en preversion, valeur support@mettrik.ai) ;
- si l envoi de courriel echoue, le ticket est enregistre quand meme et l echec
  est trace : aucune question de client ne se perd.

**Piege corrige le 21 septembre** : la detection de session etait booleenne,
donc un clic plus rapide que la reponse du serveur faisait passer un
utilisateur DEJA CONNECTE pour un anonyme. L etat a trois valeurs, dont
« pas encore su », et le clic attend la reponse.

**Reste a faire** : pas de file de reprise pour les courriels en echec, seule
trace est `support_messages.email_envoye` a faux ; la limite de cinq tickets par
heure et par adresse n a pas de verrou, deux requetes simultanees peuvent
passer a six.

Liens : [[project-mettrik-lancement]] [[feedback-mettrik-liens-outils]]
