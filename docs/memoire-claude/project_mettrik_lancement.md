---
name: project-mettrik-lancement
description: "Etat de pre-lancement Mettrik (30 aout 2026) - audit fait, 4 actions Yann restantes, interrupteur MAINTENANCE_MODE"
metadata: 
  node_type: memory
  type: project
  originSessionId: f9760fc2-7eac-4e41-821a-262ae5427645
  modified: 2026-08-30T19:41:20.832Z
---

Audit de lancement complet fait le 30 aout 2026. Le site public reel est
mettrik.ai, en mode maintenance volontaire (variable Vercel MAINTENANCE_MODE,
gating par domaine dans src/proxy.ts). mettrik-niveau2.vercel.app = meme
deploiement sans maintenance. Lancement = passer MAINTENANCE_MODE a off puis
redeployer et aliaser.

Bloquants restants COTE YANN (liens exacts dans ~/spx-app/.conv-state/LANCEMENT.md) :
Stripe LIVE (les cles en prod sont des sk_test, posees par moi le 30 aout,
elles etaient absentes avant), RESEND_API_KEY (n existe nulle part, emails
morts), SMTP Supabase personnalise + redirect URLs + provider Google, parcours
reel d inscription/paiement (interdit pour moi).

Verifie par moi : 666 pages 200, routes desk/admin 403 sans session, legal
public, floutage gratuit par zones nommees configure en base, home allegee
(2,1 Mo -> fiches retirees du HTML), visuel OpenGraph cree, cron emails
onboarding ajoute a vercel.json (manquait), titres d onglet dedupliques.

Lien : [[project-mettrik-univers-indices-only]] (l univers a ete reduit a 666
le 28-29 aout ; la tache planifiee mettrik-v195-resume qui le regonflait par
capitalisation est DESACTIVEE, ne pas la reactiver).

- 6 sept 2026 : n0 (mettrik.ai) deploye = build niveau2 ; pages legales et /contact servies meme en pre-lancement (proxy.ts) ; domaine mettrik.ai verifie dans la Search Console pour DEUX comptes Google (yannricordeau100 et mettrikai, projet OAuth « My Project Mettrik AI » sous mettrikai@gmail.com), deux TXT google-site-verification chez Spaceship a conserver ; branding OAuth valide et publie. Scripts : go-n0.sh et alias-niveau2-attente.sh utilisent VERCEL_TOKEN de .env.local (jeton CLI mort). Fichiers de donnees non commites des robots : stash pendant go-n0, jamais commites sans OK.
