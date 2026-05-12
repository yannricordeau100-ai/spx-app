# CONV-SYSTEMS — État de session

> **Dernière mise à jour** : 2026-05-12 04:30 (top 21-30 + 31-50 fixed, scan top 51-307 = 0 modifs).
>
> **Identité** : CONV-SYSTEMS dans le quartet Mettrik AI (CONCEPTS / SYSTEMS / DATA / BRAND).
>
> **Périmètre** : billing, paiement, desk interne, sandbox, infra Supabase, i18n,
> légal, SEO, analytics, déploiement, captcha, séquences emails, matrice qualité,
> auth / signin / signout, et tout ce qui n'est pas data extraction (CONV-DATA),
> visuels charts (CONV-CONCEPTS) ou copy marketing (CONV-BRAND).
>
> **Branche git** : `staging` · domaine staging : `mettrik-staging.vercel.app`
>
> **Dernière mise à jour** : 2026-05-12

---

## Contexte produit (rappel)

- App **Mettrik AI** (mettrik.ai, Spaceship). Target investisseurs US + Europe.
- V1 = 5 stés handcrafted (GOOGL, META, MSCI, SPGI, CAT).
- V1.7 = SP1500 sandbox dev (~617 stés Pass 3 strict).
- **V1.8 = home staging publique** : top 305 par market_cap **USD réel** (FX
  yfinance, hors Chine, hors doublons multi-classes). Pré-calculé via
  `scripts/build-v18-tickers.ts` → `src/data/v1-8-tickers-sorted.json`.
- V2 / V3 = futurs déploiements publics, ne PAS commencer sans go Yann.

---

## ✅ Livré récemment (5 derniers commits)

| Commit | Sujet |
|---|---|
| `c90e8456` | audit+fix top 11-20 KPIs (13 corrigés) + bloc édition textes home |
| `503c4ff2` | URGENCE désactivation Turnstile (widget freezait Mac, Cloudflare unreachable) |
| `6901b01d` | fix yoy manquant MU + V (audit top 10 = 62/64 OK) |
| `8209ffd1` | clean 2785 KPIs LLM bruts (869 stés touchées) |
| `503c4ff2` | nav home V1.8 : Pricing/Contact + pill date repositionnée |

## ✅ Modules majeurs livrés depuis 8 mai

- Bug tracker desk `/desk-mtk9x4kp/bugs`
- Email onboarding J+1/3/7/14/25 (table `desk_email_sequences`)
- Matrice qualité données `/desk-mtk9x4kp/data-quality-matrix` (18 colonnes
  auto-checkées, snapshot historique toutes les 3 h via cron Vercel)
- Page contact V1.8 + page-content CMS (`desk_page_content`)
- Pricing back-office complet : plans / prix multi-devises / features /
  promos / Stripe sync (`/desk-mtk9x4kp/pricing`)
- Section pricing inline sur home V1.8 (conversion)
- Auto-detection langue OS via Accept-Language (parité avec theme OS)
- SignupGateOverlay : anonyme + clic search/card → AuthModal
- BrandWordmark unifié (gradient violet→cyan→rose) partout

---

## 🔴 Travail en cours

### Audit qualité KPIs page sté V1.8 (top par market cap)

**Critères validation par KPI** (édictés Yann 11 mai 2026) :

1. `name_fr` non vide (≥3 chars)
2. `value` numérique (int / float ou string parseable, non zero)
3. `yoy` non vide et bien formé (`+X%` / `-X%`, pas `stable` / `n/a` / `null`)
4. `signal` ≥10 chars

**État avancement** :

| Plage | KPIs total | KPIs OK | Défauts | Statut |
|---|---|---|---|---|
| Top 1-10 | 64 | 62 | 2 (MU, V) | ✅ 100 % corrigé |
| Top 11-20 | 60 | 47 | 13 (ASML, ORCL, JNJ, CVX, PG) | ✅ 100 % corrigé |
| Top 21-30 | 63 | 54 | 9 (ROG.SW, HD, GE, AZN.ST, NVS, ARM, KLAC) | ✅ 100 % corrigé (KLAC = % strip + placeholder removed) |
| Top 31-50 | 131 | 114 | 17 (9984.T, OR.PA, SIE.DE, TTE.PA, VZ, ABBN.SW, ABBNY, ABLZF, AMGN, TMO, BLK) | ✅ 100 % corrigé |
| Top 51-307 | ? | ? | 0 (déjà clean par autres convs ou fix global précédent) | ✅ 100 % OK (vérifié via fix-yoy-from-history.py --top 307 = 0 modifs) |

**Action standard sur défaut détecté** :
- `yoy = "stable"` ou `null` → recalcul automatique depuis `history` (formule
  `(curr - prev) / prev * 100`)
- Si `history` < 2 points → flag `is_short_history: true` + `yoy = "n.d."`
  (passe en bloc Stories au lieu du tableau principal)
- Signal court (<10 chars) ou name_fr vide → à compléter manuellement (pas
  fait pour l'instant, peu fréquent)

---

## 🟡 Problèmes ouverts

### 1. Captcha Cloudflare Turnstile désactivé temporairement

- **Bug** : widget freezait le Mac (polling 100ms qui ne s'arrêtait pas
  proprement quand `challenges.cloudflare.com` injoignable).
- **Fix urgent appliqué** : `TurnstileWidget` retourne `null` (no-op),
  `verifyTurnstileToken` retourne `ok: true` si pas de token (mode dégradé).
- **À faire pour réactiver** :
  1. Vérifier dans dashboard Cloudflare → Turnstile que les hostnames
     `mettrik-staging.vercel.app` + `mettrik.ai` + `www.mettrik.ai` sont
     bien dans la liste autorisée.
  2. Confirmer que `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Vercel env) = la
     vraie site key publique (commence par `0x4AAAAAAA`), pas une test key.
  3. `git revert 503c4ff2` pour restaurer le widget + check serveur strict.
  4. Tester sur un navigateur propre (sans adblocker, sans VPN).

### 2. Sections sté V1.8 absentes (à investiguer)

Sur `/sandbox/v1-8/nvda` (et probablement la plupart des stés top), ces
sections ne s'affichent pas :

- TranscriptStories (citations earning call)
- KpiStories (carrousel KPIs short_history)
- CompanyProfileCard (description + employees + HQ)
- SuperKpiBoard (Super KPIs Mettrik dérivés)
- EventTimeline (timeline 12 mois)

Hypothèses : les enrich files contiennent la donnée mais le merge dans
`load-company.ts` la rend optionnelle (champ undefined → composant skippé)
OU les composants ont des conditions d'affichage trop strictes.

À auditer après le pass KPIs (= après top 305 audit fini).

### 3. Bug ranks NVDA "≈ #10" en data v2-pipeline (corrigé par enrich)

`src/data/v2-pipeline/nvda.json` contient encore `ranks.global_world = "≈ #10"`
(héritage extract LLM). C'est écrasé au runtime par
`v2-pipeline-enrich/nvda.ranks.json` (= #1, refresh yfinance). Pas critique
mais à clean si on refait un pass batch sur les datasets de base.

---

## 📋 TODO suivant (priorité)

1. ~~Audit qualité KPIs top 21-30~~ ✅ fait (9 corrigés)
2. ~~Top 31-50~~ ✅ fait (17 corrigés)
3. ~~Top 51-307~~ ✅ vérifié 0 modifs (script fix-yoy-from-history.py --top 307)
4. **Suivant** : audit sections manquantes sur page sté V1.8 :
   - TranscriptStories, KpiStories, CompanyProfileCard,
     SuperKpiBoard, EventTimeline. À identifier pourquoi pas rendues.
5. **Suivant** : pass qualité sur le **signal** des KPIs (pas seulement yoy).
   Certains signals doivent être < 10 chars ou génériques.
6. Réactiver Turnstile dès que Cloudflare config validée.

## ⚙️ Commandes utiles

```bash
# Audit qualité KPIs d'un range
python3 -c "..."   # cf scripts/clean-broken-kpis.py pour template

# Rebuild dataset public après modif v2-pipeline
npx tsx scripts/build-v2-pipeline-merged.ts
npx tsx scripts/build-v17-public.ts

# Deploy preview staging
vercel --prod=false --target=preview --yes

# Alias staging vers le dernier deploy
vercel alias set <hash>-yannricordeau100-7226s-projects.vercel.app mettrik-staging.vercel.app
```

## 🔑 Env vars Vercel (Mettrik project)

- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` : Prod + Preview + Dev
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` : test mode
- `CRON_SECRET` : déjà posée (cron quality-snapshot 23h Paris + email J+N)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` : posées par Yann
  11 mai, à vérifier hostname Cloudflare avant réactivation widget
- `MAINTENANCE_MODE` : Production uniquement = on. Le proxy.ts ne déclenche
  la redirect /maintenance QUE sur le host `mettrik.ai` / `www.mettrik.ai`
  (= staging *.vercel.app intact).

## 📞 Coordination SHARED-STATUS

À chaque gros chantier (data preservation, refonte schema BDD, broadcast
de règle, fix systémique sur tous les datasets) : poster dans
`SHARED-STATUS.md` section "Log d'activité" pour que les 3 autres convs
soient au courant.

Acronymes Yann à connaître : PV (plus-value), stés (sociétés), DOB (Direct
Objectif Bref), V1/V1.7/V1.8/V2/V3, wow / whaou (KPI distinctif).
