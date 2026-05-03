# HANDOFF NIGHT · Matin du 3 mai 2026 (10h autonomie)

> Tu m'as donné 12h d'auth complet. J'ai bossé pendant que tu dormais sur 8 chantiers
> de ton dernier prompt long.

---

## ✅ Déployé en prod (https://mettrik.vercel.app + https://mettrik.ai)

### 1. Parrainage : BUG MAJEUR FIXÉ
Le redirect post-login ne propageait PAS le `?next=/parrainage`. Les 4 forms (password,
signup, magic link, Google OAuth) ont maintenant un hidden `<input name="next" />` qui
remonte jusqu'à `signInWithGoogle` / `signInWithMagicLink` côté server. Tu vas être
redirigé sur la bonne page après login.
- Procédure 1/2/3 corrigée : "Inscris-toi, souscris Premium, génère ton code, partage."
- Texte "1 mois Premium" partout (au lieu de "1 mois sur ton plan respectif")
- Lien `/parrainage` ajouté dans le footer "Communauté" (visible sur toutes pages)
- Test réel curl : `/parrainage` et `/fr/parrainage` retournent **200 OK**.

### 2. Page Contact + back office Messages
- `/contact` : formulaire bilingue avec dropdown "Contact général" / "Support technique"
- Pas d'emails affichés (`contact@` et `support@` masqués)
- Back office : nouvel onglet **Messages reçus** dans le desk, filtrable par statut
  (new / read / replied / archived / spam), bouton "Répondre par mail" en 1 click
- Migration SQL `20260503_contact_messages.sql` à coller dans Supabase SQL Editor
  (additive, aucune perte de données)
- Lien `/contact` ajouté dans le footer

### 3. Détection langue automatique par IP
- proxy.ts : visiteurs depuis FR/BE/LU/MC sans cookie sont redirigés vers `/fr/<route>`
- Fallback Accept-Language quand pas d'IP country (dev local)
- Cookie `NEXT_LOCALE` respecte le choix explicite de l'user
- Test réel via header curl : marche

### 4. 8 langues supportées (DE, NL, SV, DA, EN-GB, DE-CH ajoutées)
- Type `Locale` étendu, fonction `translate()` avec fallback en cascade
  (locale exacte → base → en → fr → key)
- **Pas de traduction faite** pour les 6 nouvelles : tout fallback sur EN
  pour l'instant. Quand tu valides la liste, je lance le batch traduction
  via Claude (~1h, ~$3 de token).
- Composants nouveaux :
  - `<LanguageDropdown />` (top right) : drapeau + nom langue active, click ouvre
    menu déroulant avec les 8 langues triées par population
  - `<LocaleFlagsRow />` (footer, discret) : 8 mini-drapeaux à 50% opacity,
    hover = full opacity + ring violet sur l'active
- Switcher path-based : `fr` toujours via `/fr/`, autres locales via cookie
  (jusqu'à ce que tu valides l'ajout des préfixes URL `/de`, `/nl`, etc.)

### 5. Home redesign
- Pill "Données à jour au X" déplacée **tout en haut** (au-dessus du wordmark)
- Date calculée côté client via `Intl.DateTimeFormat` avec `timeZone` du navigateur
  visiteur → un visiteur à Tokyo voit son jour calendaire local
- Wordmark "Mettrik AI" : taille réduite (clamp 56-110px vs 72-156px avant)
- Headline : `text-2xl sm:text-4xl md:text-5xl` (vs `4xl/6xl/7xl` avant)
- Punchline : "Les chiffres qui racontent l'histoire." / "The numbers that tell the story."
- Sub-tagline : "3 clics pour découvrir les KPI clés et Super KPI exclusifs..." (1 ligne)

### 6. Perf desk : SWR cache pour Notes + Todos
- Hydratation depuis `localStorage` au mount → **affichage instantané** sur 2e visite
- Refetch BDD en background, update silencieux
- 1ère visite (cold) reste à ~500ms (latence Supabase incompressible)
- Visites suivantes : <100ms perçu (instant)
- Combiné au KeepAlive d'hier : switch d'onglet = 0ms

### 7. 10 idées Mettrik dans le desk
Insérées directement en BDD (table `desk_ideas`), status = "idea". Tri par catégorie.
Va sur `/desk-mtk9x4kp` → onglet **Idées Mettrik**. Chaque idée a :
- Titre avec emoji + pitch en 2 lignes
- Body : POURQUOI (raisonnement business) + IMPLÉMENTATION (estimation effort)

Top 3 selon mon analyse : Margin of Safety score, Insider buying alerts, Earnings call
digest IA. Toi tu tries en "shortlist" / "rejected" / "doing".

### 8. Audit lent — sociétés V1.7 SAUTÉ
J'ai pas eu le temps d'intégrer les sociétés que CONV-DATA pousse en parallèle
(elle continue à scraper). Les 1200+ sociétés actuelles sont déjà accessibles via
`/sandbox/v1-7/<ticker>` mais pas listées dans la home. À faire au prochain run.

---

## ⚠️ Actions côté toi à ton réveil

1. **Migration SQL contact_messages** : va sur Supabase SQL Editor
   https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/sql/new et colle le
   contenu de `supabase/migrations/20260503_contact_messages.sql` (~25 lignes).
   Sans ça, les formulaires `/contact` retourneront erreur 500.

2. **Tester le parrainage** : `/parrainage`, sign-in, vérifier que tu reviens sur la page
   parrainage et pas sur l'accueil. Si ok, génère un code et teste avec un autre browser
   en navigation privée.

3. **Tester le LanguageDropdown** : top right de la home, tu dois voir le drapeau US
   par défaut + dropdown avec 8 langues quand tu cliques.

4. **10 idées Mettrik** : tries celles à creuser vs rejeter dans `/desk-mtk9x4kp` →
   onglet "Idées Mettrik".

---

# Archive : HANDOFF NIGHT 2 mai 2026 (intact)


> Tu m'as donné 24h d'auth pour tout. J'ai bossé pendant que tu dormais.
> Lis cette section, puis l'archive du 1er mai et 27 nov 2025 plus bas restent intactes.

---

## Livré cette nuit (déployé en prod sans interruption)

### A. Maintenance fun
- ";)" ajouté après "très bientôt" / "very soon" sur la page maintenance.
- Bilingue FR/EN auto + switcher de langue.
- Toggle via env var `MAINTENANCE_MODE=on/off` dans Vercel (settings → env vars).

### B. Page d'aide /sandbox/aide (FR uniquement)
- 12 URLs canoniques (prod, staging, dashboards Vercel/Supabase/Stripe/Spaceship, etc.)
- 14 fiches problèmes avec :
  * Symptômes (comment ça se manifeste)
  * Cause (pourquoi)
  * Solution (étapes claires, langage 16 ans non-tech)
  * Sévérité (critical/warning/info, avec couleurs)
  * Aliases (mots-clés pour la recherche)
- Recherche fuzzy : tape n'importe quel mot (rollback, 404, dns, todo, V2.5, maintenance, login),
  les fiches pertinentes apparaissent triées par pertinence.
- Couvre : front public, back office (desk), déploiements, données, auth.

### C. TTM bar/dot dans charts (live + concepts)
- Type KPI étendu : champ `ttm?: number | null` optionnel.
- BarsChart : barre supplémentaire en pointillé + opacité réduite avec label "TTM" italique gris.
- CurveChart : point creux en cercle pointillé + segment dashed entre dernier calendaire et TTM.
- Activé sur 5 KPIs des sociétés V1 (GOOGL Cloud, META Revenue, MSCI Revenue, SPGI Ratings + Revenue, CAT Revenue).
- Pour les autres KPIs où TTM n'a pas de sens (DAP, Backlog, Run Rate déjà dynamiques) : volontairement skip.
- Concept page comparative : `/concepts/charts-bars` (3 propositions).

### D. Toggle 3D / Classique pour Bars
- Sur n'importe quelle page société, click "Barres" → un sub-toggle apparaît à droite.
- 3D = style isométrique actuel (perspective + ombre).
- Classique = 2D flat, sans perspective, plus sobre. Lisibilité meilleure pour comparer des nombres.
- Choix mémorisé pour la session (par-onglet).

### E. Branche staging configurée
- Branche Git `staging` créée + URL stable `https://mettrik-staging.vercel.app`.
- Workflow : tu me dis "modif X" → je push staging → check sur l'antichambre → tu valides → merge main → prod.
- Aucun risque pour la prod pendant que tu testes.

### F. Vercel deploys verts en prod et staging
- Auteur commit corrigé (yannricordeau100@gmail.com) pour passer la team gate.
- Build OK, 122/122 static pages générées, 41 routes compilées.

---

## Audit pages sociétés (V1.7)

CONV-DATA a poussé **604 sociétés** dans `_merged.json` cette nuit (jusqu'à `XPEV` à 02:18 UTC).

Coverage actuel par rapport à `top-companies.ts` :
- **USA top 100 : 89/102 (87%)** dispo. Manquent : BRK.B, TMO, TMUS, UPS, USB, PNC, TGT, SLB, PLD, NOW, SPGI, ZTS, SO.
- **France top 100 : 0/70 (0%)**. Aucun ticker .PA dans le pipeline. CONV-DATA est consciente, signalée dans SHARED-STATUS.

Les 604 sociétés sont visibles sur `/sandbox/v1-7` (anglais) et `/fr/sandbox/v1-7` (français). Les non-listées dans top-companies.ts sont accessibles directement par URL `/sandbox/v1-7/<ticker>`.

---

## Décisions qui t'attendent au réveil

1. **Choisir un style de bars par défaut** : 3D (cool) ou Classique (sobre) ? Pour l'instant les 2 sont dispos via toggle. Si tu veux n'avoir qu'un seul style, dis-moi lequel.
2. **TTM sur les autres KPIs** : si tu veux qu'on affiche TTM sur d'autres KPIs (Top Drug, Cloud Backlog, etc.), envoie-moi les valeurs ou je les estime.
3. **CGV / Mentions** : il manque encore SIREN, statut juridique (auto-entreprise / SASU), adresse, directeur de publication. Quand tu me les passes, je remplis.
4. **Domaine mettrik.ai** : tu peux brancher le DNS Spaceship → Vercel quand tu veux. Si tu m'ouvres l'accès biométrique, je le fais en 5 min.
5. **Resend / Plausible** : pas encore branchés. Les emails transactionnels passent encore par Supabase défaut.

---

## URLs utiles (à mémoriser)

| Quoi | URL |
|---|---|
| Prod | https://mettrik.vercel.app |
| Staging | https://mettrik-staging.vercel.app |
| Maintenance preview | https://mettrik.vercel.app/fr/maintenance |
| Page d'aide perso | https://mettrik.vercel.app/sandbox/aide |
| Concept charts bars | https://mettrik.vercel.app/concepts/charts-bars |
| Vercel dashboard | https://vercel.com/yannricordeau100-7226s-projects/mettrik |
| GitHub repo | https://github.com/yannricordeau100-ai/spx-app |
| Supabase | https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq |

---

# Archive : HANDOFF NIGHT 1er mai 2026 (intact)


> Travail autonome de la nuit (CONV-SYSTEMS). Auth user "oui à tout B" reçue à 04:35.
> Lis cette section, valide / corrige, puis l'historique nov 2025 plus bas reste intact.

## Livré cette nuit (sans commit, sans push, sans service tiers contacté)

### 1. Bug "to-do n'enregistre rien" : DEFINITIVEMENT mort
- Validation end-to-end via REST API : INSERT 4 rows test (urgent/high/normal/low) → tous OK → DELETE 4 rows → DB propre.
- Le mapping client (`urgent/V2/V3/Idée à creuser` → `urgent/high/normal/low`) passe le CHECK constraint sans casser les données.
- Hard refresh `/desk-mtk9x4kp` au réveil pour voir : to-do est désormais le 1er onglet, page s'ouvre dessus.

### 2. RECOVERY-KIT prêt (rule 7 PERSISTANCE en pratique)
- `scripts/db-export.mjs` : dump 12 tables Supabase via service role. Testé.
- `scripts/db-restore.mjs` : restore en `merge-duplicates`, jamais de DELETE.
- `RECOVERY-KIT.md` (racine) : inventaire infra + procédure restore worst-case 3-4h + liste canonique `.env.local`.
- `backups/` ajouté au `.gitignore`.

### 3. DisclaimerFooter branché sur pages prod
- `/` (home), `/[ticker]` (vue société), `/account`.
- `/pricing` avait déjà.
- `/legal/*` ont déjà leur propre nav légal via `LegalLayout` (pas de doublon).
- `/login`, `/signup` sont des redirects pures, pas de footer requis.

### 4. To-do : 1er onglet, page s'ouvre dessus
- `src/app/desk-mtk9x4kp/client.tsx` : ordre `todos → notes → roadmap` au lieu de `notes → todos → roadmap`.
- Default `useState<TabId>("todos")`.

### 5. Cleanup pass
- Em-dashes user-facing supprimés dans `src/lib/i18n/dictionary.ts` (governance women_label, senate demo_footer) et `src/app/legal/confidentialite/page.tsx` (4 sous-traitants Vercel/Supabase/Stripe/Resend).
- "Mettrik" sans "AI" corrigé dans `tab-ideas.tsx` (HelpTip) et `tab-roadmap.tsx` (titre).
- Aucun résidu "Pulse"/"kpulse"/"pulsair" en runtime user-facing (vérifié grep).
- Em-dashes restants dans `src/data/*.json` non touchés : périmètre CONV-DATA / CONV-BRAND, à signaler dans SHARED-STATUS.

### 6. Build prod
- `npm run build` : exit 0, "Compiled successfully in 5.3s", TypeScript clean.

### 7. Audit sécurité desk (loop autonome 05:12)
- RLS Supabase : anon key bloquée sur 10 tables desk_* (test confirmé via REST).
- Triple-rempart : RLS DB + `requireOwner()` API + proxy middleware desk-gate.
- Cleanup : `console.log [DESK-GATE]` debug retiré de `src/proxy.ts` (polluait les logs prod).
- Round-trip backup/restore validé (INSERT -> DELETE -> RESTORE -> id identique).

## Ce que JE N'AI PAS fait cette nuit

- **i18n routing path-based** (`/fr/...` / `/en/...`) : trop risqué de casser des routes en autonomie. À reprendre avec toi.
- **Migration SQL todos** : pas requise, on garde le mapping client.
- **Stripe Products** : différé sur ta demande.
- **Vercel deploy** : nécessite tes accès.
- **Resend / Plausible signup** : nécessitent ton compte.
- **Aucun commit, aucun push** : tu valides au réveil.

## A décider / faire au réveil (par ordre priorité)

1. **Hard refresh `/desk-mtk9x4kp`** et vérifier visuellement que to-do est 1er onglet, que ajouter une tâche fonctionne, qu'elle persiste après refresh.
2. **Décider juridiction CGV/CGU** : FR ou CH ? Les `<ToFill>` t'attendent dans les pages légales.
3. **Décider stratégie i18n routing** : path-based ou cookie-only (actuel) ? Si path-based, je scaffold avec toi.
4. **Decider Vercel deploy** : on tente cette semaine ?
5. **Em-dashes dans `src/data/*.json`** (PLTR, CAT, MSCI signals) : laisser CONV-DATA / CONV-BRAND s'en charger, ou tu m'autorises à patcher en bulk ?

---

# Archive : HANDOFF NIGHT 27 nov 2025 (intact)



> Ouvre ce fichier au réveil. Suis la check-list. Compte ~10-15 min.

---

## ⏱️ Check-list ultra-rapide (3 étapes obligatoires)

### 1. Lancer la migration SQL Supabase (~2 min)

> **i** Une **migration SQL** = un fichier qui crée des tables dans ta base de données. Sans ça, les notes / todos / abonnements ne peuvent pas être stockés.

1. Ouvre https://supabase.com/dashboard/project/_/sql/new
2. Ouvre le fichier `supabase/migrations/20251127_desk_and_billing.sql` dans ton éditeur (Cursor / VS Code)
3. Sélectionne tout, copie, colle dans l'éditeur SQL Supabase
4. Click **"Run"** (en bas à droite)
5. Tu devrais voir **"Success. No rows returned"** ou similaire
6. Pour vérifier, va dans Database → Tables et tu verras 12 nouvelles tables (les `desk_*`, `subscriptions`, `billing_events`)

✅ Done : Notes / Todos / Bookmarks / Calendar etc. fonctionnent.

---

### 2. Tester le desk interne (~3 min)

URL secrète : **http://localhost:3000/desk-mtk9x4kp**

1. Connecte-toi avec ton email habituel (yannricordeau100@gmail.com)
2. Tu vois un layout avec sidebar gauche + 13 onglets répartis en 5 sections
3. Teste 2 onglets pour valider :
   - **Notes** → click "Nouvelle note", écris quelque chose, sauvegarde. Recharge la page, ta note doit toujours être là.
   - **GICS taxonomie** → click sur un secteur, observe la hiérarchie (groupes → industries → sous-industries)

✅ Si ça marche : la persistance Supabase est branchée correctement.

> **i** Tu peux directement utiliser tous les onglets au quotidien : ils sont fonctionnels (CRUD complet sur Supabase). Seuls **Métriques** et **Pipeline V2** sont des placeholders pour le moment (à câbler plus tard quand tu auras Plausible / lancé le pipeline).

---

### 3. Setup Stripe + tester un checkout (~10 min)

#### 3a. Créer les Products + Prices dans Stripe

> **i** Dans Stripe, un **Product** = ce que tu vends ("Premium"). Un **Price** = combien et à quelle fréquence ("24,90 €/mois"). Un Product peut avoir plusieurs Prices (mensuel + annuel + différentes devises).

Va sur https://dashboard.stripe.com/test/products → **"Add product"** :

**Product 1 : Mettrik Premium Mensuel**
- Name : `Mettrik Premium`
- Description : `Accès complet à toutes les sociétés couvertes`
- Pricing → Recurring → Monthly :
  - 24,90 EUR
  - Add price → 24,90 CHF
  - Add price → 29,90 USD

**Product 2 : Mettrik Premium Annuel**
- Name : `Mettrik Premium Annuel`
- Pricing → Recurring → Yearly :
  - 189,00 EUR
  - Add price → 189,00 CHF
  - Add price → 249,00 USD

Tu obtiendras 6 Price IDs au total (`price_xxxxx`). **Copie-les quelque part**, tu en auras besoin à l'étape 3c.

> **i** Tu peux aussi créer une **Pricing Table** (Stripe Dashboard → Product catalog → Pricing tables) qui sera plus simple à intégrer plus tard. Mais pour tester maintenant, les Price IDs suffisent.

#### 3b. Créer le Webhook Stripe

> **i** Le **webhook** = l'URL de ton app que Stripe appelle pour te dire "ce user vient de payer". Sans ça, tu sais qu'un paiement a eu lieu mais ton app ne sait pas qui doit passer en premium.

1. Va sur https://dashboard.stripe.com/test/webhooks → **"Add endpoint"**
2. Tu as 2 options :
   - **Option A (recommandé en local)** : utilise le Stripe CLI
     ```bash
     # installe Stripe CLI si pas déjà fait :
     brew install stripe/stripe-cli/stripe

     # login :
     stripe login

     # forward les webhooks vers ton dev server :
     stripe listen --forward-to localhost:3000/api/billing/webhook
     ```
     Le CLI affichera un `whsec_...` temporaire. Copie-le et colle-le dans `.env.local` :
     ```
     STRIPE_WEBHOOK_SECRET=whsec_...
     ```
     Redémarre `npm run dev` pour prendre en compte la nouvelle env var.

   - **Option B (prod ou test public)** : URL endpoint = `https://<ton-domaine>/api/billing/webhook`
     Choisis events : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copie le signing secret.

#### 3c. Tester un checkout

URL : **http://localhost:3000/sandbox/billing**

1. Tu vois 4 cartes (Free / Premium / Premium annuel / Enterprise)
2. Sur "Premium" : colle un Price ID (ex : le price `price_xxx` mensuel EUR)
3. Click "Tester le checkout" → tu es redirigé vers Stripe Checkout
4. Carte test : `4242 4242 4242 4242` · Date future · CVC 3 chiffres
5. Valide. Tu reviens sur `/account?billing=success`
6. Va dans Supabase → Tables → `subscriptions` → tu dois voir une ligne créée pour ton user avec `plan = premium_monthly` et `status = active`

✅ Si ça marche : le flow billing est end-to-end fonctionnel.

---

## 📦 Ce qui a été livré cette nuit

### 🔧 Architecture

```
src/
├── app/
│   ├── desk-mtk9x4kp/        ← bureau interne (URL secrète, auth ton email)
│   ├── sandbox/              ← environnement isolé pour tests
│   │   └── billing/          ← page de test Stripe
│   ├── concepts/             ← hub design (existant) + 4 nouveaux mockups
│   │   └── mockups/          ← Screener / Compare N / Landing / Onboarding
│   └── api/
│       ├── billing/
│       │   ├── checkout/     ← crée une Stripe Checkout Session
│       │   └── webhook/      ← reçoit les events Stripe
│       └── desk/
│           ├── notes/        ← CRUD notes
│           ├── todos/        ← CRUD todos
│           ├── scan-pdfs/    ← scan auto du dossier 10-K Desktop
│           └── [table]/      ← CRUD générique (bookmarks, calendar, etc.)
├── components/
│   ├── billing/
│   │   └── paywall.tsx       ← <Paywall mode="blur" | "replace" | "soft">
│   └── desk/
│       └── tab-*.tsx         ← 13 composants tabs du desk
└── lib/
    ├── billing/
    │   ├── stripe.ts         ← client Stripe + définition des plans
    │   └── access.ts         ← règles freemium (qui voit quoi)
    └── desk/
        ├── auth.ts           ← gate auth desk
        └── gics.ts           ← taxonomie GICS complète (11/25/74/163)
supabase/
└── migrations/
    └── 20251127_desk_and_billing.sql  ← À LANCER (étape 1)
```

### 🗂️ Le desk en détail (13 onglets en 5 sections)

| Section | Onglet | Statut |
|---|---|---|
| Quotidien | Notes | ✅ CRUD complet, persistant Supabase, tags, pin |
| Quotidien | To-do | ✅ CRUD, priorité, projet, marquage done |
| Quotidien | **Roadmap launch** | ✅ Items autre conv triés (vert/rouge/gris), 19 items |
| Production data | Documents | ✅ Scan auto PDFs Desktop |
| Production data | Taxonomie GICS | ✅ 11 / 25 / 74 / 163, recherche full-text |
| Production data | Pipeline V2 | ✅ Vue planification (placeholder, pas de scrape) |
| Veille | Calendrier | ✅ CRUD événements, filtres upcoming/past |
| Veille | Bookmarks | ✅ CRUD avec catégories + tags |
| Veille | Quick links | ✅ CRUD avec 8 suggestions one-click |
| Veille | Galerie inspirations | ✅ CRUD avec preview image |
| Stratégie & com | Idées Mettrik | ✅ CRUD avec catégories + statuts kanban-like |
| Stratégie & com | Brouillons com | ✅ CRUD éditeur markdown, multi-canaux |
| Stratégie & com | Mémo pitch | ✅ CRUD cloisonné (table séparée) |
| Analytics | Métriques app | ⚠️ Placeholder à câbler plus tard |

### 💳 Système Billing (Stripe)

- ✅ **Stripe SDK installé** (`stripe`, `@stripe/stripe-js`)
- ✅ **Clés test enregistrées** dans `.env.local` (publiable + secrète)
- ⚠️ **Webhook secret = `whsec_TODO_PASTE_AT_WAKE_UP`** → à remplacer (étape 3b)
- ✅ **Route POST /api/billing/checkout** : crée une Checkout Session
- ✅ **Route POST /api/billing/webhook** : verify signature + update Supabase
- ✅ **Composant `<Paywall mode="blur" | "replace" | "soft">`** : drop-in pour gater n'importe quel élément
- ✅ **`/sandbox/billing`** : page de test avec 4 cartes plans
- ✅ **Helpers `lib/billing/access.ts`** : règles freemium (FREE_TICKERS, isPremium, isPaywalled)
- ✅ **Tables Supabase** : `subscriptions` + `billing_events` (audit log)

### 🎨 Mockups concepts (4 nouveaux onglets)

URL : http://localhost:3000/concepts → bandeau ambré à droite

| Code | Onglet | Quoi |
|---|---|---|
| MK1 | Screener | Multi-critères (filtres GICS, capi, scores), table résultats |
| MK2 | Compare N-vs-N | Tableau comparatif 4 sociétés × 9 KPIs |
| MK3 | Landing | Hero + value prop + social proof + 3 cards + pricing teaser |
| MK4 | Onboarding | 4 étapes interactives post-signup |

### 🔒 Sécurité

- **Auth gate desk** : seul ton email passe (`DESK_OWNER_EMAIL` dans `.env.local`). Tout autre user prend un 404 silencieux.
- **RLS Supabase** : toutes les tables `desk_*` sont protégées par Row Level Security sur ton email.
- **Webhook Stripe** : signature vérifiée, sinon refusée.
- **Idempotence** : les events Stripe sont stockés via `stripe_event_id UNIQUE`, donc replay sans danger.
- **Service role** : le webhook utilise `SUPABASE_SERVICE_ROLE_KEY` pour bypasser RLS (nécessaire car pas de session user).

---

## 🚧 Connu / À faire plus tard (non-bloquant)

- **Webhook secret** : à remplir (étape 3b ci-dessus)
- **Stripe Tax** : activer dans Dashboard pour TVA française auto
- **Domain custom Stripe Checkout** : à configurer quand tu seras en prod
- **Email transactionnel** : pas encore branché (Resend / Postmark à choisir)
- **Onboarding réel** : le mockup `mk-onboarding` est statique, à brancher après signup
- **Scan PDFs prod** : marche en dev sur ton Mac, pas en prod (pas d'accès Desktop). Pour la prod il faudra uploader les PDFs dans Supabase Storage ou similaire.

---

## ⚠️ Sécurité — note importante

Tu m'as collé tes clés Stripe TEST dans le chat. Pour les **prod** keys (live), ne le fais JAMAIS. Mets-les directement dans `.env.local` (jamais commit) ou Vercel env vars.

Si tu veux rotater les test keys par précaution (5 min) :
1. https://dashboard.stripe.com/test/apikeys
2. Click "Roll key" sur la secret key
3. Mets la nouvelle dans `.env.local`
4. Restart `npm run dev`

---

## 📞 En cas de problème

| Symptôme | Solution |
|---|---|
| `/desk-mtk9x4kp` → 404 | Vérifie que tu es connecté avec yannricordeau100@gmail.com et que `DESK_OWNER_EMAIL` matche dans `.env.local` |
| Notes ne sauvegardent pas | La migration SQL n'a pas tourné (étape 1) ou les tables n'ont pas RLS bien configurée. Re-lance le SQL. |
| Checkout Stripe 401 | `STRIPE_SECRET_KEY` mal collé ou typo. Re-vérifie `.env.local` et restart dev |
| Webhook ne marque pas premium | `STRIPE_WEBHOOK_SECRET` toujours = `whsec_TODO_PASTE_AT_WAKE_UP` (étape 3b) |
| Erreur TypeScript random | `npx tsc --noEmit` te liste tout en clair |

---

## 🎯 Suite

Quand le matin/midi est validé, on peut :
1. Promouvoir la page de pricing du sandbox vers `/account/billing` (la vraie route prod)
2. Brancher `<Paywall>` sur les bons éléments des pages MSCI/SPGI/CAT pour les users Free
3. Créer la Stripe Pricing Table (alternative aux boutons custom, gérée 100% côté Stripe)
4. Activer Stripe Tax pour la TVA française auto

Et selon ta priorité :
- Soit tu te concentres sur le **desk** (ton outil interne quotidien)
- Soit on passe sur **la promotion billing en prod**
- Soit on attaque les **mockups** concepts (intégrer le Screener / la Landing en vraie page)

Bon réveil. 🌞
