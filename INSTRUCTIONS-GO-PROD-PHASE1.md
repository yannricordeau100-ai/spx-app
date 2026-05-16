# INSTRUCTIONS GO-PROD PHASE 1 — Setup à faire par Yann

> Mise en place architecture 3 niveaux (Yann 16-17 mai 2026).
> Code prêt côté repo (commit `3afe292f`). À toi de cliquer dans les UIs des prestataires.

## Architecture cible (3 niveaux × 4 versions)

| Niveau | URL | Auth |
|---|---|---|
| 0 LIVE | `www.mettrik.ai` | Public (visiteur + 3 plans inscrits) |
| 1 PRE-LIVE | `pre.mettrik.ai` | Compte admin uniquement (404 silencieux sinon) |
| 2 DEV | `staging.mettrik.ai` | Compte admin uniquement (404 silencieux sinon) |

**Niveau 0 LIVE expose 4 versions utilisateur** :
- **Visiteur** (non inscrit) : voit homepage + pricing + legal + maintenance + /sandbox utilitaires publics (cf `isPublicPath` dans proxy.ts)
- **Free** (inscrit, plan gratuit)
- **Premium** (inscrit, plan 29.90 €/mois)
- **Max** (inscrit, plan 59.90 €/mois)

Chaque version × 3 langues officielles (FR/EN/DE) × variantes pays (CH/FR/UE/US, prix locaux, juridiction, etc.).

---

## 1. Coller le SQL Supabase (2 min)

Va sur https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/sql/new

Copie-colle le contenu de :  
**`supabase/migrations/20260517_desk_releases.sql`**

Clique **Run**. Vérifie en bas : "Success. No rows returned" + "1 row added" pour le seed.

✓ Confirme-moi quand fait.

---

## 2. Configurer DNS Spaceship (5 min)

Va sur https://www.spaceship.com → My Account → Domains → `mettrik.ai` → DNS

Ajoute les 3 CNAME records suivants :

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` | 3600 |
| CNAME | `pre` | `cname.vercel-dns.com` | 3600 |
| CNAME | `staging` | `cname.vercel-dns.com` | 3600 |

Pour le **domaine racine** `mettrik.ai` (sans `www`) : utilise un A record si Spaceship le permet, sinon laisse vide (on redirigera `mettrik.ai` → `www.mettrik.ai` côté Vercel).

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` | 3600 |

(C'est l'IP Vercel pour les apex domains. Si Spaceship préfère ANAME/ALIAS, utilise `cname.vercel-dns.com` à la place.)

✓ Confirme-moi quand fait. La propagation DNS prend 5-60 min selon ton FAI.

---

## 3. Configurer Vercel projets / aliases (10 min)

Va sur https://vercel.com/yannricordeau100-7226s-projects/mettrik/settings/domains

### a) Ajouter les 3 domaines

Clique "Add Domain", ajoute un à un :

1. `www.mettrik.ai` → branch `production`
2. `mettrik.ai` → redirect to `www.mettrik.ai` (Vercel propose automatiquement)
3. `pre.mettrik.ai` → branch `pre-prod`
4. `staging.mettrik.ai` → branch `staging` (la branche actuelle)

Vercel va vérifier les CNAME pour chaque domaine. Tant que la propagation DNS n'est pas faite, ça reste en "Pending". Une fois OK, l'icône passe au vert.

### b) ENV vars par environnement

Va sur https://vercel.com/yannricordeau100-7226s-projects/mettrik/settings/environment-variables

Pour chaque ENV var existante, vérifie qu'elle est bien définie pour les 3 environnements (Production, Preview, Development). Spécifiquement pour la nouvelle :

- **`NEXT_PUBLIC_BUILD_VERSION`** :
  - Production : `1.0.0` (au premier vrai push live)
  - Preview : laisse vide (sera ignoré)
  - Development : `dev`

✓ Confirme-moi quand les 3 domaines sont en "Active" sur Vercel.

---

## 4. Tester l'architecture (5 min)

Une fois DNS propagé et Vercel actif :

```bash
# Test live (gating ne s'applique pas encore : pas encore promu en prod)
curl -sI https://www.mettrik.ai/ | grep -i mettrik
# Attendu : x-mettrik-version: live/1.0.0
#           x-mettrik-level: live

# Test pre-live (doit rediriger vers signin si pas loggué)
curl -sI https://pre.mettrik.ai/ -L | head -5
# Attendu : 307 Temporary Redirect → /?auth=signin&next=...

# Test dev (idem)
curl -sI https://staging.mettrik.ai/ -L | head -5
# Attendu : 307 ou 200 si /api/version

# Test endpoint version
curl -s https://www.mettrik.ai/api/version
# Attendu : {"level":"live","version":"1.0.0"}
curl -s https://pre.mettrik.ai/api/version
# Attendu : {"level":"pre-live","version":"...","git_sha":"...","vercel_url":"..."}
```

✓ Confirme-moi les résultats. Si redirect 307 sur pre/staging → la gate admin fonctionne.

---

## 5. Vérifier la page back-office (1 min)

Une fois connecté avec ton compte admin, va sur :

`https://staging.mettrik.ai/desk-mtk9x4kp/releases`

Tu verras :
- 3 sections (LIVE / PRE-LIVE / DEV)
- LIVE vide pour l'instant (pas encore de release pushée)
- DEV avec la release seed `v0.1.0` insérée par la migration
- PRE-LIVE vide
- Block "comment vérifier" avec les commandes curl

✓ Confirme-moi que la page charge OK.

---

## Récap des actions de ton côté

| Action | Lieu | Temps |
|---|---|---|
| Coller SQL Supabase | Supabase Studio | 2 min |
| Ajouter 3 CNAME + 1 A record | Spaceship DNS | 5 min |
| Ajouter 3 domaines Vercel | Vercel dashboard | 5 min |
| Ajouter ENV `NEXT_PUBLIC_BUILD_VERSION` | Vercel ENV | 1 min |
| Tester curl | Terminal | 2 min |
| **TOTAL** | | **~15 min** |

Une fois ces 5 étapes faites, on aura :
- ✅ 3 environnements isolés (live / pre / dev)
- ✅ Auth gate admin sur pre + dev (compte Yann uniquement, 404 silencieux sinon)
- ✅ Versioning invisible côté HTML public (header HTTP + endpoint /api/version)
- ✅ Back-office releases pour suivre l'historique
- ✅ Toutes les routes back-office (sandbox, desk-mtk9x4kp) accessibles uniquement par toi sur les 3 niveaux

Phase 2 (à venir, après validation Phase 1) :
- CI/CD GitHub Actions pour promotion contrôlée pre-prod → production
- Bouton "Push to live" dans le back-office releases
- Vraie séparation DB Supabase (rappel programmé 19 mai)
- Feature flags variants (3 plans × langues × pays)
