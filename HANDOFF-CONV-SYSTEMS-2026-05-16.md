# HANDOFF — CONV-SYSTEMS → CONV-SYSTEMS (fork) — 16 mai 2026

> Bloc à coller en première instruction de la conv fork "KPI test et intégration - Système (fork)".
> Contient l'état exact du travail au moment du fork.

---

## 1. Contexte projet Mettrik AI (résumé bref)

- Repo : `~/spx-app` (Next.js 16 Turbopack, React 19, Tailwind v4)
- Branche active : `staging` (alias Vercel `mettrik-staging.vercel.app`)
- Prod : `www.mettrik.ai` (domaine Spaceship, hébergé Vercel, **pas encore en ligne** = objectif handoff)
- Supabase projet : `cnggtyxzqlqqjrynnvdq.supabase.co`
- Service role key (déjà dans `.env.local`) : `sb_secret_L0brB3fAi7UYNTRd7MACnA_DuyQn8VK`
- Lis intégralement `CLAUDE.md`, `RULES-GOLDEN.md`, `AGENTS.md`, `SHARED-STATUS.md` avant tout

## 2. Conversations parallèles actives

5 convs (CONCEPTS, **SYSTEMS** (= moi/cette conv), DATA, BRAND, DIV) + modules
+ CONV-SYSTEMS (fork) = **toi maintenant**

⚠️ Coordination via `SHARED-STATUS.md` obligatoire avant tout gros chantier.

## 3. Travail récent CONV-SYSTEMS (de ce que tu hérites)

### 3a. Bloc "Graphiques et Schémas de sources diverses" (demande #1)

- Sandbox : `/sandbox/image-findings`, request_id BDD = `80d26863-82f8-454b-b6d9-0b7f6aa81348`
- Query demande #1 : "évolution des part de marchés de gemini, open ai, grok, claude sur les 12 derniers mois minimum"
- **6 batches scrapés**, 43 findings totaux :

| Batch | source_platform | Total | Approved | Rejected | Pending |
|---|---|---|---|---|---|
| Web (wave 1) | `web` | 6 | 6 | 0 | 0 |
| X compte EN | `x-authed-en` | 10 | 1 | 1 | 8 |
| Reddit | `reddit` | 7 | 1 | 0 | 6 |
| Substack | `substack` | 7 | 0 | 7 (fab auto) | 0 |
| DDG Images | `bing-images` | 10 | 0 | 0 | 10 |
| HuggingFace | `huggingface` | 3 | 0 | 0 | 3 |
| **TOTAL** | | **43** | **8** | **7** | **27** |

- Substack rejected = l'agent a fabriqué des SVG au lieu de scraper → règle "ne pas inventer" violée → tous rejected automatiquement
- 27 pending attendent review humaine par Yann dans la sandbox

### 3b. Features livrées cette session

1. **Footer source uniforme** sur tous graphs : `"Sources : Mettrik AI Analytics / Données de marché"` (retiré du SVG, ajouté côté UI dans `ImageFindingsBlock`)
2. **i18n FR/EN/DE** : colonnes JSONB `title_i18n` + `summary_i18n` (migration `20260516_image_findings_i18n.sql`), helper `pickI18n()` dans `src/lib/desk/image-findings.ts`. 30/30 findings traduits via Groq Llama 3.3 70B free
3. **Détection doublons KPI** : lib `src/lib/desk/kpi-duplicate-detect.ts` qui compare topics finding vs KPIs déjà publiés des sté ciblées (à brancher côté upsert)
4. **Architecture multi-sources** : `BATCH_META` dans `src/app/sandbox/image-findings/client.tsx` avec 9 sources : web, x-anon, x-authed-en, x-authed-fr, x-authed, reddit, substack, bing-images, huggingface
5. **Fallback JPEG** : si SVG fail (image broken) → image originale .jpg affichée auto (`onError`)
6. **Bouton "+ Toutes" langues** : active les 8 locales d'un clic
7. **Soulignement rouge** : si `reviewer_notes` contient `[FLAG:LOW]` → titre underline rouge ondulé pour attirer attention
8. **Tickers auto-détectés** par finding (mapping brand → ticker : ChatGPT→MSFT, Claude→AMZN+GOOGL, Gemini→GOOGL, Grok→TSLA, etc.) — plus de "TOUS"
9. **Tri par pertinence** : `display_order` par batch, du meilleur au moins bon

### 3c. Architecture dynamique BDD ↔ V1.7.5 + V1.8

Audit fait :
- ✅ Tout ce qui passe par Supabase BDD est **instantanément reflété** sur `/sandbox/v1-7-5/<ticker>` et `/sandbox/v1-8/<ticker>` (même `loadV17Company` + `dynamic = "force-dynamic"`)
- ✅ `desk_image_findings` (sandbox approvals, tickers, langues, i18n) = instantané
- ✅ `desk_special_kpis` (KPI manuels) = instantané
- ⚠️ Data files `src/data/v2-pipeline/*.json` et `src/data/v2-pipeline-enrich/*.json` = nécessitent rebuild Vercel (~2 min)

**Question Yann en attente de clarification** : veut-il que je rende dynamiques aussi les data files JSON (= table `desk_kpi_overrides` Supabase qui patche au SSR) ? Estimé ~2-3 h de refactor si oui.

## 4. Commits récents de cette conv (sur staging)

```
bd5a15e7  feat(image-findings): batch 2G HuggingFace · 3 charts benchmark IA
9afafd34  feat(image-findings): batch 2F DuckDuckGo Images · 10 quality charts
c8f819f5  feat(image-findings): batch 2E Substack analystes IA · 7 quality charts  (PUIS rejected auto)
927cf19a  feat(image-findings): footer uniforme + i18n FR/EN/DE + lib doublons + multi-sources
aa76ff01  fix(image-findings): SVG XML cassés + UI fallback JPEG + bouton toutes langues
faef2bbd  feat(image-findings): SVG dark+light pour batch 2B (10) + 2D (7)
d44b1206  shared-status: log refonte populaire-investisseurs (CONV-SYSTEMS)
05ded560  script(popular-stocks): yfinance enrichment v2 (dollar volume 3 mois)
062bd270  feat(populaire): refonte page actions populaires (sources investisseur)
```

(L'alias staging a dû être manuellement bumped via `vercel deploy + alias` car le webhook GitHub→Vercel staging n'est pas 100% fiable.)

## 5. Pourquoi le fork (ta mission)

Yann veut un **gros développement** : mettre en place le système de **transfer staging → prod** (= rendre `www.mettrik.ai` accessible au public).

### Ce qui existe déjà côté infra prod

- Domaine `mettrik.ai` acheté chez Spaceship
- Page maintenance temporaire (lib `src/app/maintenance/`)
- ENV `MAINTENANCE_MODE=off` côté Vercel (ou ON selon état)
- Proxy `src/proxy.ts` (mid-route) gère public/private gates + locale + currency
- Auth Supabase (signup/signin + hCaptcha)
- Stripe checkout multi-currency en place
- Page `/legal/*` (CGV/CGU/mentions/confidentialité) en FR-CH
- Email Resend (contact@/support@/noreply@mettrik.ai)
- Sitemap, robots, OG images, Plausible analytics

### Ce qui reste à clarifier pour la prod

À discuter avec Yann en première itération côté fork :
1. **Gate signup** : qui peut s'inscrire ? Email allowlist au début ou ouvert ?
2. **Tiers de pricing** : Free / Premium 29.90 €/mois / Max 59.90 €/mois (BDD `desk_plans` + Stripe products live, pas test)
3. **Univers de sté visible** : top 5 V1 demo, ou V1.7 (305 stés top), ou V1.8 (~2200 stés) ?
4. **Pages publiques vs gated** : home / pricing / contact = publiques. Tout `/[ticker]` = gated derrière signup ?
5. **Domaine** : `mettrik.ai` ou `www.mettrik.ai` ? Vercel doit pointer dessus, alias staging pour preview
6. **DNS Spaceship** : configurer les CNAME / A records vers Vercel
7. **Email SMTP live** : Resend doit valider DKIM/SPF pour les emails depuis mettrik.ai
8. **Stripe live mode** : créer les produits/prices en mode live (actuellement test mode)
9. **Webhooks Stripe** : configurer `payment_intent.succeeded` / `subscription.updated` pour activer/désactiver l'accès
10. **Cookies / GDPR** : banner consent à mettre en place (proxy auto-décline déjà)
11. **Monitoring** : Plausible OK, mais Sentry/error tracking ?
12. **Backups** : `scripts/db-export.mjs` existe, à programmer en cron
13. **MAINTENANCE_MODE** : passe à `off` au go-live

### Documents pré-existants

- `RECOVERY-KIT.md` (racine) : infra + backup/restore + worst-case procédures
- `VERCEL-DEPLOY.md` (racine) : checklist 1er deploy prod
- `WAKEUP-CHECKLIST.md` (racine) : actions à faire au matin par Yann
- `HANDOFF.md` (racine) : kickstart pour nouvelle conv Claude
- `CLAUDE.md` (racine, auto-chargé) : règles tacites projet
- `RULES-GOLDEN.md` (racine, auto-chargé) : 9 règles d'or
- `SHARED-STATUS.md` (racine, auto-chargé) : log coordination 5 convs

## 6. Règles d'or à respecter (rappel)

- **DOB** : Direct, Objectif, Bref. Pas d'intro de courtoisie, pas de récap inutile
- **Pas d'em-dash** dans user-facing text (utiliser `:` ou phrase split)
- **Honnêteté absolue sur les data** : ne jamais inventer un chiffre. Préférer "non extrait" à approximation
- **RAM Mac fragile** : 1 agent à la fois, sleep 2s entre HTTP requests, jamais > 80 % RAM système, surveiller `vm_stat` avant gros run
- **Pas de demande d'autorisation** : toutes auths sont déjà accordées via `bypassPermissions`
- **`yannricordeau100@gmail.com`** = email user
- **5 convs** : CONCEPTS / SYSTEMS / DATA / BRAND / DIV (+ modules + fork)

## 7. État infra technique au moment du handoff

- ✅ Migration `20260516_image_findings_i18n.sql` appliquée (Yann a collé le SQL dans Supabase Studio à 17h45)
- ✅ Alias staging `mettrik-staging.vercel.app` pointe vers le dernier deploy (commit bd5a15e7)
- ✅ 0 process Python tournant
- ✅ 0 agent Claude en background
- ✅ RAM : ~3.7 GB inactive recoverable, OK
- ✅ Branch git `staging` à jour, push aligné avec origin

## 8. Première instruction suggérée pour la conv fork

> "Salut. Je suis la conv 'KPI test et intégration - Système (fork)'. Je reprends de CONV-SYSTEMS (origine) via le handoff `HANDOFF-CONV-SYSTEMS-2026-05-16.md`. Lis-le intégralement puis confirme que tu es OK pour démarrer la mission **mise en place du système de transfer staging → prod (www.mettrik.ai)**. Pose-moi les questions de clarification nécessaires (cf. liste §5) avant d'exécuter quoi que ce soit."

---

Fin du handoff.
