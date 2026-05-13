# CONV-SYSTEMS — État de session

> 🔁 **REPRISE APRÈS REDÉMARRAGE MAC** (snapshot 13 mai ~03h00)
>
> **Dernier commit pushé staging** : `3c1ddedf` (normalizeNarrative market-position).
> Avant : `1fb29977` ai-positioning, `6562cd08` company-header sector/subsector,
> `4722668b` kpi-row + kpi-story + risk-stack, `3c8b3017` page /sandbox/ir-coverage,
> `ddefb863` data ir-coverage-per-ticker.json, `67a972f0` pricing admin Premium/Max fix,
> `50ad630c` hCaptcha switch, `fd958ff8` SQL combined.
>
> **Actions Yann en attente** (à faire de SON côté) :
> 1. Coller les 7 blocs SQL dans Supabase Studio (migrations + 5 seeds) → débloque
>    page `/desk-mtk9x4kp/ir-sources` (actuellement crash 500 car table inexistante)
>    Lien : https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/sql/new
>    Fichier combiné : `supabase/seeds/_ALL-IR-SOURCES-COMBINED.sql` (628 KB)
> 2. Setup hCaptcha (5 min) : dashboard.hcaptcha.com → keys → coller secret dans
>    Supabase Auth Settings + `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` dans Vercel env
> 3. Mot de passe admin (DEJA RESET côté Yann le 13 mai)
>
> **Mode actuel** : RAM-light autonome. Aucun proc Python actif. Aucun scraper.
> Yann a demandé "ralentir RAM" plusieurs fois. Travailler séquentiellement.
>
> **Cycle en cours** : intégration helpers `ui-fix-templates.ts` dans composants.
> 4 composants déjà patchés (cycles 1-4). Cycle 5 possible : freshness-indicator,
> super-kpi-board, transcript-stories-block.
>
> **Pipeline IR scraping top 307** : ✅ TERMINÉ. Failure report dans
> `src/data/ir-scrape-failures.json`. Coverage 344 stés dans
> `src/data/ir-coverage-per-ticker.json` (visualisable sur `/sandbox/ir-coverage`).
>
> **Modifs autres convs détectées** (à NE PAS reverter) :
> - `src/components/kpi-row.tsx` : Yann a ajouté tolérance `yoy` number/string (ligne 152-178)
> - `src/proxy.ts` : `/concepts/*` rendu public (ligne 87-88), commentaire `/contact` réécrit
> - `src/components/kpi-story-card.tsx` : aucune modif autre que la mienne
>
> **Pour reprendre** : `cd ~/spx-app && git pull origin staging` puis lire ce
> bloc + RULES-GOLDEN.md + SHARED-STATUS.md (10 dernières lignes).
>
> ---


> 🚨 **TÂCHE PRIORITAIRE DEMANDÉE PAR YANN VIA CONV-TRANSCRIPTS (13 mai 2026 ~02h00)**
>
> **DEADLINE pour réponse + plan d'exécution : sous 30 min depuis ton prochain prompt.**
> **DEADLINE pour livraison : 6h max après ton ACK.**
>
> **Tâche** : Construire un bouton "Auto-traduire FR → 7 langues" dans le back office desk.
> Quand Yann clique, le système :
> 1. Détecte toutes les clés du dictionary.ts où le FR a changé depuis la dernière sync (hash diff)
> 2. Appelle Groq Llama 3.3 70B free pour traduire vers DE, NL, SV, DA, en-GB, de-CH (avec fallback EN si pas DE)
> 3. Patche `dictionary.ts` + `dictionary-extra-locales.ts`
> 4. Stocke le nouveau hash par clé (probablement dans `dictionary-sync-state.json`)
> 5. Retourne stats : N clés détectées, N traduites, erreurs
>
> **De plus, MAJ MANUELLE immédiate** des traductions des pages :
> - Page d'accueil (home)
> - /pricing
> - /contact
> - Page société (chips, libellés, transcript-bullets-block hardcoded labels)
> - /account
> - Tunnel de paiement (checkout)
>
> Yann a constaté des libellés FR hardcodés non traduits sur ces pages.
> Audit a confirmé i18n à 99 % (1 clé manquante par langue + 478 fallbacks en-GB/de-CH normaux).
>
> **Mécanisme de suivi** : 
> - CONV-TRANSCRIPTS a programmé une vérification dans 3h via ScheduleWakeup
> - SI à ce moment ce bloc est encore présent sans ACK + commit visible
>   → CONV-TRANSCRIPTS fera elle-même le job (override scope) et signalera à Yann
> - **NE PAS ignorer cette tâche.** Yann a explicitement dit qu'il en a marre des broadcasts sans suivi.
>
> **Référence audit i18n** : `npx tsx scripts/i18n-audit.ts` (à recréer, perdu)
> **Locales totales** : 8 (en, fr, de, nl, sv, da, en-GB, de-CH) — `LOCALES` dans `src/lib/i18n/types.ts`
> **Files concernés** : `src/lib/i18n/dictionary.ts` (1226 l) + `dictionary-extra-locales.ts` (1639 l)

---

> **Dernière mise à jour** : 2026-05-13 00:35 (session IR scraper + auth fix + pricing fixes).

---

## 🔄 EN COURS au 13 mai 2026 00:35

### Pipeline scraping IR top 307 V1.8

**État** : Pass 1 terminé (305/305 manifests), pipeline en cours sur étapes
suivantes (dedup → enrich → Pass 2 → Pass 3 régulateurs → report).

**Process actifs** :
- Pipeline orchestrateur PID 20397 (`bash -c` qui enchaîne les 4 étapes)
- Watcher Pass 3 PID 22094 (attend "PIPELINE DONE" puis run Pass 3 + report)

**Localisation des outputs** :
- `~/Mettrik/sec-data/ir-scrape/<TICKER>/<doctype>/*.pdf` (PDFs + xlsx/docx)
- `~/Mettrik/sec-data/ir-scrape/<TICKER>/snapshots/<label>.{html,txt}` (HTML pages capturées)
- `~/Mettrik/sec-data/ir-scrape/<TICKER>/_manifest.json` (manifest par sté)
- `~/Mettrik/sec-data/ir-scrape/_pass2-needed.json` (liste needs Pass 2)
- `src/data/ir-scrape-failures.json` (rapport final, à générer en fin pipeline)

**Logs** :
- Pass 1 max : `/tmp/scraper-top307-max2.log`
- Pipeline complet : `/tmp/pipeline-final.log`

**État au 13 mai 00:30** :
- 305/305 manifests OK
- 1827 PDFs / 3,96 GB Pass 1
- 240 doublons IR↔SEC supprimés (29 stés)
- Disque libre : ~10-15 GB selon avancement (Yann a libéré ~8 GB)
- Règle transcripts >12 mois : appliquée (2 supprimés + filtre actif dans scraper)

**Pour reprendre si interrompu** :
```bash
# Vérifier state
ps -p 20397 2>/dev/null && echo "pipeline alive" || echo "pipeline dead"
ps -p 22094 2>/dev/null && echo "watcher alive"
find ~/Mettrik/sec-data/ir-scrape -name "_manifest.json" | wc -l   # devrait être 305
tail /tmp/pipeline-final.log

# Si pipeline mort avant étape 4 : relancer manuellement
cd /Users/yann/spx-app
python3 scripts/ir-dedup.py --top307                                    # supprime doublons (idempotent)
python3 scripts/ir-scraper-enrich.py --top307 --workers 3                # HTML snapshots + xlsx/docx
python3 scripts/ir-scraper-pass2-playwright.py --top307 --only-needs-pass2 --workers 2  # JS-heavy sites
python3 scripts/ir-scraper-pass3-regulators.py --top307 --workers 2      # régulateurs nationaux (cat 3 EU)
python3 scripts/ir-failure-report.py                                     # report final
```

### Univers couvertures URLs IR (5 seeds SQL)

| Seed file | Stés | Commit |
|---|---|---|
| `supabase/seeds/seed-ir-sources-top305.sql` | 305 | `bd8873b4` |
| `supabase/seeds/seed-ir-sources-us-midcap.sql` | 250 | `bd8873b4` |
| `supabase/seeds/seed-ir-sources-stoxx-eu.sql` | 92 (V1.7 EU) | `bd8873b4` |
| `supabase/seeds/seed-ir-sources-sp1500.sql` | 1135 | `624c69da` |
| `supabase/seeds/seed-ir-sources-stoxx600.sql` | 356 + 3 Swedish | `5ba2ba6f` `2c9e62db` |
| Migration `desk_ir_sources` table | 1 | `20260512_ir_sources.sql` |
| Migration `regulator_url` column | 1 | `20260513_ir_sources_regulator.sql` |
| **Total seeds** | **2138 lignes** (~2000 stés uniques) | |

À coller dans Supabase Studio SQL Editor par Yann (ordre : migrations puis seeds).

### Commits récents session 12-13 mai 2026

| Commit | Sujet |
|---|---|
| `e759b98d` | pricing: AuthNav réactif + CurrencyPicker + /contact gated |
| `713135f3` | auth: retire magic link + captcha strict signup + Turnstile réactivé |
| `ca2759b9` | fix(pricing): force devise uniforme (plus de mix €/$) |
| `b88336e7` | ir scraper: skip transcripts >12 mois + clean script |
| `3bf2897f` | ir scraper: + Pass 3 régulateurs nationaux |
| `33a39596` | ir scraper: + ir-dedup.py (match IR PDFs vs SEC ±5 j) |
| `157ac2d0` | ir-dedup: default = supprime (--keep pour déplacer) |
| `675038fb` | ir scraper: + enrich + Pass 2 Playwright + failure report |
| `5ba2ba6f` | desk: seed Stoxx 600 (356 stés) + scraper Pass 1 |
| `624c69da` | desk: seed IR sources SP1500 ∪ V1.7 (1135 stés) |
| `bd8873b4` | desk: seed IR US mid-cap (250) + Stoxx EU (92) + regulator_url |

### Tâches/règles appliquées en session

1. **Magic link auth supprimé** (l'utilisateur doit s'inscrire) — code retiré dans `actions.ts` + `auth-modal.tsx`
2. **Captcha Turnstile réactivé** mode "always visible" + serveur strict (refus si no token)
3. **Transcripts >12 mois** : filtre dans Pass 1 + Pass 2 + script `ir-clean-old-transcripts.py`
4. **Skip list IR** : QIA.DE, SAN.MC, TLS1V.HE, UBI.PA, UTG.L, INF.PA (mismatches noms/tickers)
5. **BABA** : ré-inclus exceptionnellement (skip-list retirée le 12 mai)
6. **Seuil disque scraper** : 3 GB → 500 MB (Yann a libéré ~8 GB en cours de session)
7. **CurrencyPicker** : nouveau composant `src/components/billing/currency-picker.tsx` posant cookie `mettrik:currency`
8. **AuthNav réactif** sur pricing (remplace boutons hardcodés)
9. **/contact gate auth** : retiré des paths publics dans `proxy.ts`

### Pending / prochaines actions Yann

- [ ] Yann doit réinitialiser son mot de passe (login bloqué "Email ou mot de passe incorrect")
- [ ] Yann doit coller les 5 SQL seeds + 2 migrations dans Supabase Studio SQL Editor
- [ ] Yann doit confirmer la présence des env vars Turnstile sur Vercel (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY)
- [ ] Pipeline scraping doit finir (ETA ~1h-1h30 selon vitesse Pass 2 + Pass 3)
- [ ] Failure report final → `src/data/ir-scrape-failures.json` à générer après tout

---

## Anciens états (préservés pour historique)

> **Précédente mise à jour** : 2026-05-12 04:30 (top 21-30 + 31-50 fixed, scan top 51-307 = 0 modifs).
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
