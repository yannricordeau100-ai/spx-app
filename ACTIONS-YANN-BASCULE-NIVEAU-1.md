# ACTIONS-YANN-BASCULE-NIVEAU-1.md

> 4 actions externes à exécuter par Yann pour finaliser la bascule niveau 1.
> CONV-SYSTEMS a fait tout le code. Ces 4 actions nécessitent un accès dashboard externe (Supabase, Stripe, Vercel) que je ne peux pas faire moi-même.
>
> **ETA total Yann : 30-45 min.**

---

## 1. Créer un nouveau projet Supabase pour niveau 1 (~15 min)

### 1.a Créer le projet

1. Aller sur https://supabase.com/dashboard/new
2. Nom projet : `mettrik-niveau1`
3. Région : Frankfurt (eu-central-1) ou Paris si dispo (latence Vercel ams1)
4. Mot de passe DB : génère + sauvegarde dans gestionnaire de mots de passe
5. Plan : Free
6. Créer

### 1.b Appliquer les migrations SQL

Une fois le projet créé, dans **SQL Editor** du nouveau projet, exécuter dans l'ordre :

```bash
# Lister les migrations à coller (ordre chrono)
ls ~/spx-app/supabase/migrations/*.sql
```

Coller chaque fichier `.sql` un par un dans le SQL Editor du dashboard Supabase niveau 1 (24 migrations au total, ordre chrono des dates dans le nom de fichier). Si une migration crée des FK vers `auth.users`, c'est OK (Supabase pré-crée ces tables).

### 1.c Récupérer les clés

Settings → API du projet niveau 1 :
- `Project URL` → garder pour env var
- `anon public` key → garder pour env var
- `service_role` key (secret) → garder pour env var

### 1.d Configurer Resend SMTP (optionnel, on est en dry-run mais utile pour test futur)

Settings → Auth → SMTP → on garde le SMTP par défaut Supabase pour les emails d'auth (signup confirm, magic link). Pas besoin de Resend ici (dry-run actif au niveau code).

### 1.e Auth redirect URLs

Settings → Auth → URL Configuration :
- Site URL : `https://mettrik-niveau1.vercel.app`
- Redirect URLs : ajouter `https://mettrik-niveau1.vercel.app/**`

---

## 2. Configurer Stripe en test mode (~10 min)

### 2.a Récupérer les clés test

1. Aller sur https://dashboard.stripe.com/test/apikeys (bien en TEST mode, top-right toggle)
2. Copier `Secret key` (`sk_test_*`)
3. Copier `Publishable key` (`pk_test_*`)

### 2.b Configurer le webhook test

1. Aller sur https://dashboard.stripe.com/test/webhooks
2. Add endpoint
3. URL : `https://mettrik-niveau1.vercel.app/api/billing/webhook`
4. Events : `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.{paid,payment_failed}`
5. Add endpoint
6. Copier le `Signing secret` (`whsec_*`)

---

## 3. Setup Vercel niveau 1 (~10 min)

### 3.a Créer l'alias

Dans le dashboard Vercel du projet `spx-app` :

1. Settings → Domains → Add → `mettrik-niveau1.vercel.app`
2. Lier à la branche `staging` (ou créer une branche dédiée `niveau1` si tu préfères isoler)

### 3.b Set les env vars niveau 1 sur Vercel

Settings → Environment Variables. Créer pour environnement `Preview` (branche `staging` ou `niveau1`) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_NIVEAU` | `1` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet Supabase niveau 1 (de §1.c) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key niveau 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key niveau 1 |
| `STRIPE_SECRET_KEY` | `sk_test_*` (de §2.a) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_*` (de §2.a) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_*` (de §2.b) |
| `EMAIL_DRY_RUN` | `1` |
| `CRON_SECRET` | générer un nouveau (différent prod) |
| `DESK_OWNER_EMAIL` | `yannricordeau100@gmail.com` (identique) |
| `MAINTENANCE_MODE` | `off` |
| `NEXT_PUBLIC_SITE_URL` | `https://mettrik-niveau1.vercel.app` |

Tu peux laisser les autres env vars (Anthropic, Groq, Cerebras, FMP) identiques à la prod : ce sont des appels externes en lecture, pas de pollution prod.

### 3.c Redéployer

Trigger un nouveau déploiement de `staging` (push une modif vide ou clic "Redeploy" dans Vercel).

---

## 4. Setup GitHub Actions secrets (~5 min)

Les 2 workflows GHA créés (cron-email-onboarding + cron-quality-snapshot) ont besoin de pinger l'endpoint avec `CRON_SECRET`.

1. https://github.com/yannricordeau100-ai/spx-app/settings/secrets/actions
2. Add new secret :
   - Name : `CRON_SECRET`
   - Value : le même `CRON_SECRET` que tu as posé en prod sur Vercel (env var prod actuelle, pas la niveau 1)
3. Add new variable (Variables tab, pas Secrets) :
   - Name : `MAIN_BASE_URL`
   - Value : `https://mettrik-staging.vercel.app` (ou prod si tu veux que les crons ciblent prod : `https://www.mettrik.ai`)

---

## Vérification après bascule

Une fois les 4 actions faites :

1. Ouvrir https://mettrik-niveau1.vercel.app/ → tu dois voir le badge **orange NIVEAU 1 SHADOW PROD** bottom-right
2. Cliquer "Se connecter" → l'inscription crée un user dans la BDD Supabase niveau 1 (vérifier dans le dashboard Supabase niveau 1, table `auth.users`)
3. Aller sur `/pricing` → tester checkout → Stripe en test mode (banner Stripe rappelle "TEST")
4. Pas d'email reçu sur ton vrai compte Gmail (les emails sont dry-run, loggés dans les logs Vercel)
5. Aller sur `/sandbox/v1-7-5/cat` → fiche société accessible
6. Aller sur `/cat` (V1.0) → redirige 301 vers `/sandbox/v1-7-5/cat` ✓

Si l'un ne marche pas → me le dire (CONV-SYSTEMS) avec les détails.

---

## Notes

- Le badge **violet NIVEAU 2 PREVIEW** s'affichera automatiquement sur les autres deploiements Vercel non-niveau1 non-prod (= autres branches preview).
- Le badge **gris NIVEAU 3 LOCAL** s'affichera sur `localhost:3000` quand tu lances `npm run dev`.
- Le badge est masqué automatiquement sur `www.mettrik.ai` (niveau 0).

## Promotion niveau 1 → prod (plus tard)

Quand tu valides un changement, dis-moi "promote niveau 1" et je :
- Merge `staging` → `main`
- Push prod
- Vérifie `www.mettrik.ai` répond OK
- Te confirme.
