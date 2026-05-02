# RECOVERY-KIT · Mettrik AI

> Que faire si demain TOUT le cloud disparaît (sauf le nom de domaine)
> et qu'il faut tout remonter sur pied le plus vite possible.
>
> Ce document est l'inventaire canonique. À jour au **30 avril 2026**.
> Re-relire / mettre à jour à chaque changement infra (nouveau service,
> nouvelle table SQL, nouvelle clé API, etc.).

---

## 0. Que protege ce kit

Trois niveaux de désastre couverts :

| Scénario | Couverture |
|---|---|
| Perte du Mac ou du dossier `~/spx-app` local | Git remote suffit (clone, npm install, copy `.env.local`) |
| Perte du compte Supabase (BDD desk + abonnements) | `scripts/db-restore.mjs` depuis le dernier dump dans `backups/` |
| Perte totale (Vercel + Supabase + Stripe + Resend + GitHub) | Procédure complète ci-dessous, ETA reconstruction ≈ 4h |

Ce qui n'est PAS couvert (à voir si tu veux qu'on l'ajoute) :
- snapshot du contenu Stripe (Products + Prices) côté code → script
  `scripts/stripe-bootstrap.mjs` à créer quand tu reviendras sur Stripe.
- snapshot des templates email Supabase (HTML) → à exporter manuellement
  via Dashboard avant tout changement.

---

## 1. Inventaire infra

### Domaine
- **mettrik.ai** chez **Spaceship** (registrar). Renouvellement annuel.
- DNS : pointer vers Vercel (A / CNAME standard, voir `WAKEUP-CHECKLIST.md`).

### Hosting
- **Vercel** projet `prj_2fwjkuSPPesO8Xj8gsVfw6KSHiPA`.
  - Branch prod : `main` du repo GitHub.
  - Variables d'env à recopier (cf. § 3).
  - Build cmd : `next build`. Output : standalone Next 16.

### Base de donnees
- **Supabase** project `cnggtyxzqlqqjrynnvdq`.
  - URL : `https://cnggtyxzqlqqjrynnvdq.supabase.co`
  - Schéma de référence : `supabase/migrations/20251127_desk_and_billing.sql`
    + `supabase/migrations/20260430_todo_categories.sql` (gardée mais
    non requise tant que client utilise valeurs legacy).
  - 12 tables : desk_notes, desk_todos, desk_bookmarks, desk_calendar,
    desk_ideas, desk_links, desk_drafts, desk_pitch_notes, desk_inspiration,
    desk_pipeline, subscriptions, billing_events.
  - RLS activé sur toutes les tables desk_* (filtre par `owner_email`).

### Paiement
- **Stripe** (TEST mode) account `acct_18krriD8kXJELIDj`. FR / EUR.
  charges_enabled, details_submitted. `STRIPE_SECRET_KEY=sk_test_...`.
  - Pas encore de Products / Prices en prod.
  - Webhook secret à régénérer au passage en LIVE
    (cf. `scripts/stripe-test.mjs` pour test connectivity).

### Email transactionnel
- **Resend** (compte non encore connecté). Sender addresses prévues :
  `contact@mettrik.ai`, `support@mettrik.ai`, `noreply@mettrik.ai`.
  Création BAL chez Spacemail (déjà fait pour contact + support).

### Analytics
- **Plausible Analytics** (privacy-first, pas encore branché).
  Stub dans `src/components/analytics/plausible-script.tsx`.

### Code source
- **GitHub** : repo privé. Source de vérité = `main`.
- Fichiers à NE JAMAIS perdre (au-delà du remote git) :
  - `.env.local` (variables sensibles, hors git)
  - `backups/<date>/*.json` (dumps Supabase, voir § 4)

---

## 2. Procedure de restore complete (worst case)

ETA approximatif : 3-4h en partant de zéro avec accès email Spaceship.

### 2.1 Restaurer le code
```bash
git clone <repo> ~/spx-app
cd ~/spx-app
npm install
```

### 2.2 Restaurer les services tiers
1. **Spaceship** : récupérer DNS du domaine (compte Spaceship reste,
   même si Vercel/Supabase tombent).
2. **GitHub** : si perte du remote, push depuis le clone local le plus
   à jour (`git remote add origin <new-url> && git push -u origin main`).
3. **Supabase** :
   - Créer un nouveau projet.
   - Lancer la migration SQL `supabase/migrations/20251127_desk_and_billing.sql`
     dans Dashboard -> SQL Editor.
   - Re-créer les redirect URLs auth (cf. `SUPABASE-EMAIL-SETUP.md`).
   - Récupérer URL + anon key + service role key dans Dashboard -> Settings -> API.
4. **Vercel** :
   - Importer le repo GitHub.
   - Coller toutes les variables d'env de `.env.local` (cf. § 3).
   - Trigger un deploy. Connecter le domaine `mettrik.ai`.
5. **Stripe** : recréer le compte si perdu, récupérer les clés TEST/LIVE.
   Recréer Products + Prices via Dashboard ou (à venir) via
   `scripts/stripe-bootstrap.mjs`.
6. **Resend** : signup, vérifier domaine `mettrik.ai`, créer 3 sender
   addresses (contact, support, noreply). Mettre `RESEND_API_KEY` dans env.
7. **Plausible** : signup, ajouter `mettrik.ai`, mettre `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.

### 2.3 Restaurer les donnees user
Voir § 4. Lance `node scripts/db-restore.mjs backups/<dernier-dump>`.

---

## 3. Variables d'environnement (.env.local)

Liste canonique. Tout ce qui est dans `.env.local` doit être backed-up
ailleurs (1Password, Bitwarden, ou fichier crypté hors-cloud).

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service>

# Stripe
STRIPE_SECRET_KEY=sk_test_... ou sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... ou pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (à brancher)
RESEND_API_KEY=re_...

# Plausible (à brancher)
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=mettrik.ai

# Desk (auth-gate du desk interne)
DESK_OWNER_EMAIL=yannricordeau100@gmail.com
```

---

## 4. Backup / restore donnees Supabase

### Faire un dump
```bash
cd ~/spx-app
npm run backup        # ou : node scripts/db-export.mjs
```
Crée `backups/<ISO-date>/<table>.json` pour les 12 tables + `_manifest.json`.

> **Round-trip validé** (1er mai 2026, 05:00) : INSERT row test -> DELETE (simulation perte) ->
> RESTORE depuis snapshot via `merge-duplicates` -> row reconstituée à l'identique (même id,
> mêmes timestamps). Le kit fonctionne bout en bout.

### Frequence recommandee
- À la main : avant toute migration SQL non triviale.
- Auto (à mettre en place) : cron quotidien si tu commences à saisir
  beaucoup de notes / todos / drafts.

### Restore depuis un dump
```bash
npm run restore -- backups/2026-05-01T02-27-13
# ou table par table :
npm run restore -- backups/2026-05-01T02-27-13 --table desk_todos
```
Comportement : INSERT avec `merge-duplicates`. Ne supprime jamais une
row existante. Si même `id` → update. Aligne avec règle 7 PERSISTANCE.

### Verification post-restore
1. Dashboard Supabase -> Database -> Tables -> chaque desk_* doit montrer
   les rows attendues.
2. Lancer `npm run dev`, ouvrir `/desk-mtk9x4kp`, vérifier que les onglets
   (notes, todos, etc.) montrent bien le contenu.

---

## 5. Mettre a jour ce kit

À chaque ajout de service tiers, nouvelle table SQL, ou changement de
clé d'env :
1. Mettre à jour ce fichier (sections 1, 3, 4).
2. Mettre à jour la liste `TABLES` dans `scripts/db-export.mjs`.
3. Faire un commit `docs: recovery kit updated` au moins.

> Ce kit est inutile s'il n'est pas à jour. Re-vérifier toutes les
> 4-6 semaines, ou avant chaque release majeure.
