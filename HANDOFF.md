# HANDOFF — État du projet Mettrik AI

> Mis à jour le 8 juillet 2026 (reconstruit depuis git log + git status).
> Ce fichier est auto-chargé via CLAUDE.md. Il remplace l'ancien handoff V1 (5 stés), obsolète.
> Attention : certaines sections de CLAUDE.md (§0, §2, §8) datent de la V1 et sont périmées. Ce fichier fait foi sur l'état courant.

## 1. Identité et version active

- App : **Mettrik AI** (KPI Intelligence), SaaS pour investisseurs, repo `~/spx-app`.
- Version active unique : **V1.9.5** (`LATEST_VERSION_SLUG = "v1-9-5"` dans `src/lib/version-routing.ts`). Tout fix/data cible V1.9.5, les anciennes versions sont des snapshots figés.
- Univers : SP500, **liste visible 503 stés** (commit `d409e78593`), scope public strict via `_validation_global` + gating URL (commit `69b6219098`). Liste curatée complète : `v1-9-5-clean-all-tickers.json` (~652 stés). 8 stés bloquées structurellement, ne pas re-tenter.
- Stack : Next.js 16 (webpack en dev), React 19, Tailwind v4, motion, recharts, Supabase, Stripe, Sentry, Playwright (tests golden Top 10 témoin).

## 2. Architecture data

- `data-lake/<TICKER>/{10K,10Q,8K,...}/` : filings SEC compressés .gz (source brute).
- `src/data/companies/` : ~2167 fichiers JSON canoniques (1 par sté).
- `src/data/v2-pipeline/` : ~4716 fichiers pipeline d'extraction.
- `.batches-drafts-safe/` : drafts de batchs (KPI, risks batch067-070, scripts d'audit/fix). Zone de travail, pas canonique.
- LLM d'extraction : Cerebras free tier (3 clés rotation) + Groq. **Zéro API Anthropic payante** (règle d'or). Sub-agents Task tool OK en read-only/audit, écritures data canoniques = validation Yann avant push.
- Crons actifs : daily-doc-watcher (statuts dans `src/data/_daily-doc-watcher-status.json`), cron-cerebras-restart, historique `v1-9-cron-history.json`.

## 3. Avancement récent (4-7 juillet 2026)

Arc des derniers commits, du plus ancien au plus récent :

1. **4 juil** : SP500 complété (48 stés ajoutées, liste visible 503), scope public strict, fix 11 stés bloquées, KPI history complet 452 stés + hero index.
2. **5 juil** : KPI ER + earnings calls intégrés (2249 KPI core business, 490 stés), vérif adversariale complète (97+15 points corrigés sur 59 stés).
3. **6 juil** : KPI calls 5 ans (191) + stories calls/filings (5813) sur 503 stés. Bloc rémunération MAJ depuis derniers DEF14A (375 stés) puis enrichi comp_detail (salaire/bonus/actions/options, médiane, NEO2, critères bonus : 501 stés, 5059 champs). Dédoublonnage stories (398 doublons supprimés).
4. **7 juil** : Rémunération v2 (proxys 2024-2026, 498 stés) + KPI sectoriels banques/REIT/assureurs (75 stés). Cas vérifiés à la main : BK (mega-grant 83.47M), KKR/BX (carried interest), MGM ; PSKY sans proxy post-fusion. **Fix majeur** : le remplacement kpis-haut écrasait ER/calls/stories/sectoriels (réinjectés dédupliqués) + tooltip détail rémunération CEO. Réinjection champ `signal` sur 8568 KPI (stories muettes filtrées par `isStoryKpiUsable`). Dernier commit `2536cd7cca` : fix héros cassés par le dédoublonnage (436 stés repointées vers un KPI existant avec yoy requis) + fit TKO.

En résumé : la V1.9.5 vient de recevoir 4 gros chantiers data (KPI ER/calls, stories, rémunération enrichie, KPI sectoriels) suivis d'une passe de réparation des effets de bord (écrasements, doublons, héros cassés, signaux manquants).

## 4. État du working tree (non commité)

- ~12 600 fichiers modifiés, quasi tout = `data-lake/` en changements de mode (`T`, fichiers devenus symlinks/regular). Pas du contenu, pas urgent.
- Vrais fichiers modifiés : `CLAUDE.md`, `RULES-GOLDEN.md`, `SHARED-STATUS.md` supprimé (conforme à l'abrogation multi-conv), audits top voting/capital, statuts crons.
- Non suivis : `risks-batch067` à `070` (nouveaux batchs risks en cours), scripts d'audit KPI (`check-continuity.py`, `check-corruption.py`, `kpi-fix-gaps.js`, `gaps_*.json`, `corruption_final.json`), `kpis-call-only/`.

## 5. Décisions techniques verrouillées (rappel)

- Dernière version uniquement (V1.9.5), 1 sté citée = fix systémique sur tout l'univers, Top 10 stés témoin freeze (`npm run test:golden`).
- Honnêteté data absolue : jamais inventer un chiffre, TAM uniquement si disclosé par la sté, vérifier toute affirmation numérique (yfinance/EDGAR).
- Chaîne deploy : edit → tsc → commit → push → deploy → alias → curl verify AVANT de dire "fait". Audit visuel complet des blocs page sté avant "OK".
- Vocabulaire : pas d'em-dash, "Mds", "À jour", FR partout sauf taglines EN.

## 6. État final session précédente (7-8 juil, confirmé par Yann via screenshots)

Tout le backlog est TERMINÉ et vérifié en prod sur mettrik.ai :
- Fix écrasement kpis-haut (fusion au lieu d'écrasement), 8 568 signaux réinjectés.
- 436 heros réparés dont 29 stés inaccessibles (MSFT, HD, GS...) : 503/503 éligibles validées au loader réel.
- Stories visibles, testées 10/10 stés. Moyennes : 21,1 stories/sté, 8,3 indicateurs clés/sté.
- Rémunération : 502/503 complètes (PSKY sans proxy post-fusion, légitime). Tooltip CEO salaire/bonus/actions/médiane/n°2 : fait et vérifié en rendu réel.

## 7. Prochaines étapes

1. **Cron de rafraîchissement trimestriel** : seul chantier ouvert, en attente du go Yann.
2. Secondaire : batchs risks-batch067→070 non commités, changements de mode data-lake (12 600 fichiers) à normaliser ou ignorer, CLAUDE.md §0/§2/§8 périmés (V1 à 5 stés).

## Règle permanente (Yann, 1er sept 2026) — conflits de règles
Si un changement ou une nouvelle règle en cours de mise en place entre en
conflit avec une règle précédente : LE SIGNALER IMMÉDIATEMENT, EN LETTRES
CAPITALES, et suspendre provisoirement la modification concernée — sauf si une
solution évidente existe (auquel cas l'appliquer et signaler quand même).
