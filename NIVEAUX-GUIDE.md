# NIVEAUX-GUIDE.md — Architecture multi-niveaux Mettrik AI

> Édicté par Yann 18 mai 2026 (bascule architecture niveau 1).
> Maintenu par CONV-SYSTEMS.

## Vue d'ensemble — 4 niveaux

| Niveau | Nom | URL type | Badge UI | Données | Stripe | Resend | Pour quoi |
|---|---|---|---|---|---|---|---|
| **0** | Prod publique | `www.mettrik.ai` | (rien, UI propre) | RÉELLES users | LIVE keys | LIVE | Ce que voient les utilisateurs publics |
| **1** | Shadow prod | `mettrik-niveau1.vercel.app` | NIVEAU 1 (orange) | **séparées** (Supabase distinct) | TEST keys | DRY-RUN (log uniquement) | **Ton terrain de validation** : test tout comme un user, sans rien casser |
| **2** | Preview | `mettrik-preview-*.vercel.app` | NIVEAU 2 (violet) | mêmes que prod | TEST | DRY-RUN | Branches features en cours |
| **3** | Local | `localhost:3000` | NIVEAU 3 (gris) | locales | TEST ou OFF | DRY-RUN | Dev sur ton Mac |

## Comment tu sais où tu es

**Badge permanent en bas-droite** sur 100 % des pages (sauf niveau 0). Couleur explicite :
- Orange + dot orange = NIVEAU 1 SHADOW PROD
- Violet + dot violet = NIVEAU 2 PREVIEW
- Gris + dot gris = NIVEAU 3 LOCAL

Cliquer dessus = collapse en mini badge `N1`/`N2`/`N3` (au cas où il gêne pour screenshot/démo).

URL distincte aussi (cf tableau ci-dessus).

## Ce que tu peux faire à chaque niveau

### Niveau 0 (prod publique)

- Aucune action de test. C'est la vitrine pour les vrais users.
- Yann (toi) **ne déploies jamais directement** ici. Les pushes en prod passent par une promotion explicite depuis le niveau 1.

### Niveau 1 (shadow prod) — ton zone de validation

- ✅ Test signup/login complet (Supabase séparée → pas de pollution prod)
- ✅ Test checkout Stripe (mode test : carte `4242 4242 4242 4242`)
- ✅ Test desk (todos, bugs, image findings, kpi-builder, pricing admin, etc.)
- ✅ Test parcours sandbox V1.7.5 + V1.8 (toutes pages sté)
- ✅ Test changement langue (8 locales)
- ✅ Test changement devise + geo-detection
- ✅ Test KPI builder : ajout nouveau KPI → Groq recherche tickers → worker tick → résultats
- ✅ Test image-findings : visualisation findings existants (le scrape neuf nécessite Chrome MCP @mettrik_ai reconnecté)
- ✅ Test emails : ils sont **loggés** (`[Resend DRY-RUN] from=... to=...`) mais pas envoyés
- ✅ Test fiches société (V1.0 redirige 301 vers V1.7.5)

### Niveau 2 (preview)

- ✅ Pré-visualisation features en cours sur PR/branches non encore mergées
- ⚠️ Ne pas considérer ce qui s'affiche ici comme du fini
- Stripe/Resend identiques au niveau 1 (test mode + dry-run)

### Niveau 3 (local dev)

- Bac à sable. Mes modifs en cours avant push staging.

## Alertes en cas de problème

| Tu vois | Cause probable | Action |
|---|---|---|
| Badge absent en dev local | env var `NEXT_PUBLIC_NIVEAU` non lue ou hostname non reconnu | Set `NEXT_PUBLIC_NIVEAU=3` dans `.env.local` |
| Tu reçois un vrai email en niveau 1 | `EMAIL_DRY_RUN` pas activé sur Vercel niveau 1 | Vérifier env vars Vercel : `EMAIL_DRY_RUN=1` doit être présent |
| Stripe checkout te demande une vraie carte | clé LIVE injectée en niveau 1 | URGENT : `STRIPE_SECRET_KEY` Vercel niveau 1 doit commencer par `sk_test_` |
| Modifs niveau 1 apparaissent en prod | Supabase identique entre 0 et 1 (config cassée) | Vérifier `NEXT_PUBLIC_SUPABASE_URL` différente entre niveau 0 et niveau 1 |
| Badge mauvaise couleur | env var fausse | Set explicitement `NEXT_PUBLIC_NIVEAU=1` (ou 2 ou 3) |

## Pour promouvoir niveau 1 → niveau 0 (vrai déploiement)

1. Tu valides le travail sur niveau 1 (Yann)
2. Tu m'appelles (CONV-SYSTEMS), je :
   - Merge `staging` → `main`
   - Vérifie env vars prod (`NEXT_PUBLIC_NIVEAU=0` ou absent)
   - Push, déclenche le déploiement Vercel prod
   - Vérifie que `www.mettrik.ai` répond OK
   - Te confirme

## Crons (rappel)

Vercel Hobby tier limite 2 crons. Migration faite (18 mai 2026) :

| Cron | Où il tourne maintenant | Schedule |
|---|---|---|
| `kpi-worker-tick` | Vercel (besoin serverless filesystem) | `23 4 * * *` |
| `email-onboarding` | GitHub Actions | `0 9 * * *` |
| `quality-snapshot` | GitHub Actions | `0 21 * * *` |

Pour réactiver un cron sur Vercel (upgrade Pro plan future) : voir `vercel.json._migrated_to_github_actions`.

## Env vars critiques par niveau

| Env var | Niveau 0 (prod) | Niveau 1 (shadow) | Niveau 2 (preview) | Niveau 3 (local) |
|---|---|---|---|---|
| `NEXT_PUBLIC_NIVEAU` | `0` ou unset | `1` | `2` | `3` |
| `NEXT_PUBLIC_SUPABASE_URL` | prod | **différente** | preview ou prod | local ou prod |
| `STRIPE_SECRET_KEY` | `sk_live_*` | `sk_test_*` | `sk_test_*` | `sk_test_*` |
| `EMAIL_DRY_RUN` | unset | `1` | `1` | `1` |
| `MAINTENANCE_MODE` | `off` ou `on` (au choix) | `off` | `off` | `off` |
| `CRON_SECRET` | unique prod | **différent** | partagé | n/a |
| `DESK_OWNER_EMAIL` | `yannricordeau100@gmail.com` | identique | identique | identique |

## Routes redirigées

- V1.0 obsolète `/cat`, `/googl`, `/meta`, `/msci`, `/spgi` → redirect 301 vers `/sandbox/v1-7-5/<ticker>` (cf proxy.ts)

## Points de vigilance niveau 1

- `sec-data/` (30 GB) **n'est pas sur Vercel**. Le worker `kpi-worker-tick` fonctionne uniquement quand Yann ouvre la page kpi-builder (worker côté browser). Migration vers fetch SEC EDGAR online prévue dans 1 semaine.
- Chrome MCP @mettrik_ai (image-findings scraping) à reconnecter si besoin de scraping neuf.
- Stripe webhook URL doit pointer sur `https://mettrik-niveau1.vercel.app/api/billing/webhook` dans le dashboard Stripe (mode test).

## Convention de nommage

- "niveau" en minuscule dans le code (cohérent FR Mettrik).
- Badge en MAJUSCULE en UI pour la lisibilité.

## Historique

| Date | Quoi |
|---|---|
| 18 mai 2026 | Création architecture multi-niveaux + bascule niveau 1 (CONV-SYSTEMS) |
