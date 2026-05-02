# Carnet de bord Mettrik — pour les nuls

> Tout ce qu'il faut savoir pour gérer les comptes, les emails, les forfaits
> et les paiements de Mettrik **sans avoir à coder**.
> Garde ce fichier ouvert quand tu fais de l'admin.

---

## 0) Avant de commencer : 3 outils, 3 niveaux

Tu vas jongler entre 3 endroits selon ce que tu veux faire.
Va toujours du plus simple vers le plus complet.

| Outil                          | URL                                                                                  | Quand l'utiliser                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **1. Console admin Mettrik**   | https://mettrik.ai/admin (ou http://localhost:3000/admin en dev)                     | 90 % du quotidien : voir les users, supprimer un compte, renvoyer un reset.  |
| **2. Supabase Dashboard**      | https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq                          | Quand tu veux voir la BD brute, exporter en CSV, regarder les logs.          |
| **3. Stripe Dashboard** (V1.5) | https://dashboard.stripe.com (à venir)                                               | Plus tard, pour les paiements, abonnements, codes promo, factures.           |

Tu accèdes à `/admin` uniquement si ton email est dans `ADMIN_EMAILS`
(fichier `.env.local` à la racine du projet). Toute autre adresse voit un
404 muet — l'existence du panneau n'est même pas révélée.

---

## 1) Console admin Mettrik — `/admin`

C'est ta vitrine quotidienne. Va sur https://mettrik.ai/admin (en prod) ou
http://localhost:3000/admin (en local).

### Ce que tu vois en haut

- 4 cartes de stats : **Comptes** (total), **Confirmés** (ont validé leur
  email), **Bannis** (bloqués manuellement par toi), **MRR** (placeholder
  vide jusqu'à Stripe en V1.5).

### La liste des utilisateurs

Chaque ligne montre :

- L'email du user
- Son ID raccourci (8 premiers caractères) + son provider (`email` ou `google`)
- Date d'**inscription** au format JJ/MM/AA HH:MM
- Date de **dernière connexion** (si jamais connecté = `—`)
- Des badges : `toi` (c'est ton compte), `banni`, `non confirmé`

### Les boutons par ligne

| Bouton          | Ce qu'il fait                                                                 |
| --------------- | ----------------------------------------------------------------------------- |
| **Reset**       | Envoie un email de réinitialisation de mot de passe à l'utilisateur.          |
| **Bannir**      | Bloque sa connexion (mais garde le compte). Ré-clique pour débannir.          |
| **Supprimer**   | Efface le compte entièrement. L'email pourra s'inscrire à nouveau après.      |

### Cas d'usage typiques

#### 🟢 « Ce client a perdu son mdp »

1. Va sur `/admin`
2. Trouve sa ligne (Cmd+F dans le navigateur sur son email)
3. Clique **Reset** → bandeau vert « Email de réinitialisation envoyé à … »
4. Dis-lui de checker sa boîte mail (et les spams)

#### 🟢 « Ce client veut effacer son inscription »

1. `/admin` → trouve sa ligne
2. Clique **Supprimer** → bandeau vert « Utilisateur supprimé. Il peut
   désormais se ré-inscrire avec le même email. »
3. Tu peux le confirmer par email s'il a demandé une preuve.

#### 🟢 « Ce client a fait quelque chose de louche, je veux gagner du temps »

1. `/admin` → **Bannir** (pas Supprimer : tu gardes ses données pour audit)
2. Si tu confirmes plus tard que c'était abusif → **Supprimer**
3. Si tu confirmes que c'était OK → **Débannir**

---

## 2) Supabase Dashboard — la base de données brute

Tu en auras besoin pour : exporter des CSV, regarder les logs de
connexion, voir les emails que Supabase n'a pas pu livrer, lire les
favoris d'un user, modifier une ligne à la main.

### Connexion

1. https://supabase.com/dashboard/
2. Login avec ton compte Google (le même que celui qui a créé le projet)
3. Clique sur le projet **« KPI Pulse 2 »** (oui, l'ancien nom — Supabase
   ne renomme pas tout seul, on s'en fiche, c'est juste interne)

### Où trouver quoi

| Tu veux…                                   | Menu de gauche                                          |
| ------------------------------------------ | ------------------------------------------------------- |
| La liste de tous les users, leurs emails   | **Authentication → Users**                              |
| Voir les favoris (sociétés / KPIs)         | **Table Editor → favorite_companies** (ou _kpis)        |
| Voir tous les abonnements (V1.5)           | **Table Editor → subscriptions** (à créer plus tard)    |
| Exporter en CSV                            | Sur n'importe quelle table : bouton « Export → CSV »    |
| Voir si un email est bien parti            | **Logs → Auth Logs** puis filtre `event = email_send`   |
| Voir les erreurs (un user n'arrive pas…)   | **Logs → Auth Logs** filtre `level = error`             |
| Modifier le template d'email               | **Authentication → Email Templates**                    |
| Brancher Resend (sortir des spams)         | **Project Settings → Authentication → SMTP Settings**   |

### Authentication → Users : ce que tu y vois

C'est la même info que `/admin` mais en plus brut. Colonnes utiles :

- `Email` : l'adresse
- `Provider` : `email` ou `google`
- `Created at` : inscription
- `Last sign in at` : dernière connexion
- `Email confirmed at` : a-t-il cliqué sur le mail de validation ? (vide
  si non)

Tu peux filtrer par état (« Unconfirmed », « Banned », « All »), trier
par date, exporter.

### Table Editor → ce que c'est

C'est Excel sur ta base. Tu cliques sur une table → tu vois les lignes →
tu peux ajouter / modifier / supprimer. **Attention** : modifier à la
main fonctionne mais bypass toute la logique métier. Réserve ça aux cas
exceptionnels (fix d'un bug, demande légale).

---

## 3) Stripe Dashboard — paiements (V1.5)

Pas encore branché. Quand on intégrera Stripe (V1.5), tu auras :

- https://dashboard.stripe.com
- Login avec ton compte Stripe
- 3 sections clés :
  - **Customers** : 1 customer par user qui a payé au moins une fois.
    Tu vois son email, ses factures, ses cartes enregistrées (4 derniers
    chiffres seulement, **jamais** la carte complète).
  - **Subscriptions** : qui paie quoi, quand a commencé, quand finit, à
    combien.
  - **Coupons** / **Promotion codes** : codes de réduction, leur taux,
    combien de fois utilisés, validité.

Mettrik garde **aussi** un miroir local dans la table `subscriptions`
(via webhook Stripe → Supabase) pour pouvoir afficher les forfaits dans
`/admin` sans dépendre de Stripe à chaque page chargée.

Schéma prévu de la table `subscriptions` :

```
user_id            uuid   → qui paie
plan               text   → 'free' | 'pro' | 'premium'
started_at         date   → date de début
ended_at           date   → date de fin (null si actif)
amount_cents       int    → 990 = 9,90 €
currency           text   → 'EUR' / 'USD' / 'GBP'
promo_code         text   → 'BLACKFRIDAY24', null si pas de promo
stripe_sub_id      text   → ID Stripe pour debug
```

---

## 4) La règle d'or : les mots de passe ne sont PAS visibles

**Tu ne pourras jamais voir le mot de passe d'un user.** Ni dans
Mettrik, ni dans Supabase, ni dans Stripe, nulle part.

Pourquoi : Supabase stocke un **hash bcrypt** du mot de passe. Bcrypt
est un algo à sens unique : c'est comme passer le mdp dans un broyeur,
le résultat ne peut pas être recollé pour retrouver l'original. Même
avec accès root à la base, tu vois `$2a$10$N9qo8uLO…` au lieu de
`monchat123`.

C'est exactement pour ça que tu peux dire à un user « tes données sont
en sécurité chez Mettrik » : si demain quelqu'un nous pirate, il
récupère uniquement des hashs inutilisables.

### Donc, qu'est-ce que tu peux faire ?

| Demande de l'user                    | Ce que tu fais                                           |
| ------------------------------------ | -------------------------------------------------------- |
| « J'ai oublié mon mdp »              | `/admin` → Reset → email de réinitialisation             |
| « Mon mdp marche plus »              | Pareil. C'est probablement un typo, le reset règle 100 % |
| « Quel est mon mdp actuel ? »        | Tu lui dis : impossible techniquement. Reset uniquement. |
| « Quelqu'un d'autre a mon mdp »      | Reset + tu lui conseilles d'activer un 2FA (V1.5)        |

---

## 5) Cheatsheet — situations express

### « Combien de personnes inscrites ? »

`/admin` → carte **Comptes** en haut.

### « Combien ont confirmé leur email ? »

`/admin` → carte **Confirmés**.

### « Qui s'est inscrit aujourd'hui ? »

Supabase → Authentication → Users → trier par « Created at » descendant.

### « J'ai besoin de la liste de tous les emails (ex : envoyer une newsletter) »

Supabase → Authentication → Users → bouton **Export users** (CSV).
Tu peux ensuite importer dans Resend, Brevo, ou ton CRM.

### « Un user dit qu'il n'a pas reçu son email »

Supabase → **Logs → Auth Logs** → filtre par son adresse → tu vois si
Supabase a envoyé. Si oui mais pas reçu : c'est l'anti-spam Gmail /
Outlook (cf. `email-templates/SETUP.md` pour brancher Resend).

### « J'ai besoin de tester un compte »

Crée-toi un compte avec un alias `+test` :
`yannricordeau100+test1@gmail.com` arrive bien chez toi mais Supabase
le considère comme une adresse différente.

### « Je veux temporairement bloquer toutes les inscriptions »

Supabase Dashboard → **Authentication → Sign In / Up** →
décocher « Allow new users to sign up ».

---

## 6) Liens directs (bookmark-les)

- Console admin Mettrik (prod) : https://mettrik.ai/admin
- Console admin Mettrik (local) : http://localhost:3000/admin
- Supabase project : https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq
- Supabase users : https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/auth/users
- Supabase email templates : https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/auth/templates
- Supabase SMTP : https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/settings/auth
- Resend (à brancher) : https://resend.com/domains
- Spaceship DNS (mettrik.ai) : https://spaceship.com (login → My Domains → mettrik.ai → Advanced DNS)

---

## 7) En cas de panique

1. **Si l'app est cassée** : `cd ~/spx-app && npm run dev` (relance le serveur dev).
2. **Si plus personne ne peut se connecter** : Supabase Dashboard → Status
   en haut → vérifie qu'il n'y a pas une panne Supabase. Si oui, tu attends.
3. **Si tu as supprimé quelqu'un par erreur** : impossible à restaurer
   automatiquement. Tu lui demandes de se ré-inscrire ; ses favoris sont
   perdus. (Backup auto Supabase free tier = 7 jours rolling, restore
   = ticket support → ça prend 24-48 h, donc en pratique : préviens-le.)
4. **Si tu vois quelque chose de bizarre dans la base** : NE TOUCHE PAS,
   prends une capture d'écran, et reviens m'en parler. Mieux vaut
   investiguer 10 min que tout péter en 10 secondes.

---

Dernière mise à jour : 2026-04-27.
Mets à jour ce fichier à chaque évolution majeure (Stripe brancké,
nouveau panneau admin, nouvelle table, etc.).
