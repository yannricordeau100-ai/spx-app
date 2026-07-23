# HANDOFF — Norme KPI v3 "exhaustif trimestriel" SP500

Mission en cours de reprise par un nouveau compte. TOUT ce qui est nécessaire est dans ce dossier `.conv-state/` du repo `~/spx-app`. Ne rien improviser en dehors de ce document.

## Objectif
Refaire les 503 stés du SP500 : publier TOUS les KPI chiffrables (aucune limite de nombre), en TRIMESTRIEL obligatoire quand constructible (T4 dérivé = annuel 10-K moins cumul 9 mois, marqué `_derived`), remplacer chaque indicateur annuel par sa version trimestrielle, stories si <3 ans. Zéro invention : verbatim filings locaux `data-lake/<T>/` uniquement (EDGAR en secours, UA "Mettrik research yannricordeau100@gmail.com", ~1 req/s, sauvegarder au lake).

## État
- Fichier d'état : `.conv-state/kpi-v3-state.json` (`order` = 503 tickers par capi, `done`, `in_progress`).
- Template de mission : `.conv-state/kpi-v3-template.txt` (instancier en remplaçant `__T__` par le ticker et `__t__` par le ticker en minuscules, écrire dans /tmp/prompt-v3-<t>.txt).
- Fichiers cibles : `.batches-drafts-safe/kpis-haut/<T>.json`. Ne JAMAIS supprimer un KPI existant. Ne JAMAIS écrire dans `src/data/v2-pipeline/` (canonique, validation Yann requise).

## Boucle de travail (2 agents Opus en parallèle, PAS plus — Mac 16 Go, déjà 2 crashs)
1. Prendre le prochain ticker de `order` absent de `done` et `in_progress`, l'ajouter à `in_progress`, sauver l'état.
2. Instancier le template, lancer UN sub-agent (modèle Opus) : "Lis le fichier /tmp/prompt-v3-<t>.txt et exécute intégralement la mission qu'il décrit. Format Retour STRICT, check-list 15 points incluse." Ajouter une note sectorielle si utile (banques : capex/stocks/marge brute non applicables → NIM, dépôts, prêts, CET1, RoTCE, provisions ; REIT : FFO/AFFO, NOI, occupancy ; assureurs : primes, combined ratio ; télécom : churn/ARPU).
3. Au retour de l'agent : lire la check-list. Si un point dit "non fait cette passe", "extraction lourde", "hors scope", "différée" alors que la donnée EST dans les 10-Q locaux → relancer le MÊME agent avec une correction courte (la différence de cumuls YTD est la méthode standard : T2 = 6M-T1, T3 = 9M-6M, T4 = FY-9M ; pour les tables segments ambiguës, imposer le contrôle "somme segments = consolidé, publier seulement si ça passe").
4. Marquer done, retirer d'in_progress, sauver l'état, vérifier la RAM (`vm_stat` free + `sysctl vm.swapusage` ; si swap > ~5 Go ou pic, attendre avant de relancer ; tuer les `ugrep` orphelins).
5. Lancer le suivant. Toujours max 2 agents en vol.

## Consignes agents (déjà dans le template, à faire respecter)
- Recherches limitées à `data-lake/<T>/` uniquement (gzip -dc, PAS zcat, pas de grep récursif hors dossier).
- Lint obligatoire : `npx tsx scripts/kpi-lint.ts --tickers=<T>` → 0 rouge exigé ; oranges préexistants tolérés/documentés.
- Dédup par nom FR vs le fichier ET `src/data/v2-pipeline/<t>.json` (le loader kpis-haut écrase v2-pipeline par nom).
- Données corrompues détectées dans l'existant (ex. valeur ≈ année/1000) : LES CORRIGER (verbatim filings), ce n'est pas "hors scope".
- Retour STRICT : "X series ajoutees, Y stories, Z conversions, W MAJ, lint: N rouges M oranges" + check-list 15 points + "RESTE NON PUBLIE".

## Jalons tous les 50 (50, 150, 200...)
1. `git add .batches-drafts-safe/kpis-haut/ .conv-state/ data-lake/*/ER data-lake/*/xbrl` puis `git commit --no-verify -m "feat(norme KPI v3): stes X-Y (exhaustif trimestriel, lint 0 rouge)"` + `git push` (branche staging).
2. Deploy hook : `curl -s -X POST "$VERCEL_DEPLOY_HOOK_STAGING"` (URL dans `.env.local`).
3. Attendre READY (API Vercel, token `VERCEL_TOKEN` dans `.env.local`, projectId `prj_2fwjkuSPPesO8Xj8gsVfw6KSHiPA`).
4. `npx vercel alias set <url-deploy> mettrik-niveau2.vercel.app --token $VERCEL_TOKEN` puis `curl -s -o /dev/null -w "%{http_code}" https://mettrik-niveau2.vercel.app` (307 = OK, site protégé).
5. Rapport court à Yann (format : jalon atteint, lint, commit, deploy vérifié, rythme, ETA). JAMAIS dire "fait" avant le curl de vérification.

## Règles de conduite (Yann)
- Réponses très courtes, pas de blabla, finir par TERMINE. Pas d'em-dash. Français.
- Autonomie totale, ne jamais bloquer sur une question ; notifier au lieu de demander.
- Ne jamais être stoppé par une limite de tokens : surveiller la marge, basculer les agents en Opus (déjà le cas), l'orchestration reste minimale.
- Ne PAS re-traiter les 8 stés bloquées structurellement (voir mémoire "V195 blocked tail") ni re-tenter ALGN PDF corrompus.
- Coupure réseau : relancer l'agent avec note "une tentative précédente a pu commencer à modifier le fichier ; vérifie l'état actuel et complète sans dupliquer".
- Crash Mac : reprendre via le fichier d'état, vérifier les doublons éventuels avant de continuer.

## Reprise type (première commande du nouveau compte)
Ouvrir Claude (app Mac) dans `~/spx-app` et coller :
"Lis .conv-state/kpi-v3-HANDOFF.md et continue la chaîne KPI v3 exactement selon ce document, en totale autonomie."
