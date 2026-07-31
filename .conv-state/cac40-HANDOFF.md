# HANDOFF — Chaîne CAC 40 "exhaustif KPI" (France)

Mission à exécuter par un autre compte Claude (ou reprise plus tard par le compte d'origine).
TOUT ce qui est nécessaire est dans `.conv-state/` du repo `~/spx-app`. Ne RIEN improviser en
dehors de ce document. Si un cas n'est pas couvert ici : NE PAS inventer une règle, noter le cas
dans `cac40-state.json` clé `questions_yann` et continuer sur les autres stés.

## Objectif global (dans l'ordre, aucune étape sautée)
1. **Phase 0 — Inventaire documentaire** : vérifier que l'on possède TOUS les documents IR
   dans lesquels des KPI peuvent être présents, pour les 40 stés du CAC 40. Télécharger ce
   qui manque. Aucune extraction avant que la sté soit documentairement complète.
2. **Phase 1 — Page blanche** : purger les anciennes données des stés CAC 40 dans l'app
   (après backup, voir §Purge). On repart de zéro sté par sté.
3. **Phase 2 — Extraction exhaustive** : même norme que la chaîne KPI v3 SP500 : publier TOUS
   les KPI chiffrables, aucun oublié, à la fréquence réellement publiée par la sté
   (trimestriel quand publié, sinon semestriel). Historique 5 ans. Stories si <3 ans.
4. **Phase 3 — Blocs** : chaque bloc de page sté n'apparaît QUE s'il peut être rempli
   suffisamment depuis les sources françaises. Sinon il est désactivé pour cette sté.
5. **Phase 4 — Mise à jour automatique** : brancher les 40 stés sur un watcher quotidien
   (équivalent du daily-doc-watcher US) pour que les nouvelles publications soient
   détectées et intégrées automatiquement.

## Fichiers du kit
- État : `.conv-state/cac40-state.json` (source de vérité de l'avancement, à sauver après
  CHAQUE étape terminée, jamais en avance).
- Template de mission extraction : `.conv-state/cac40-template.txt` (instancier `__T__`,
  écrire dans `/tmp/cac40-<t>.txt`).
- Ce document.

## Phase 0 — Inventaire documentaire (OBLIGATOIRE avant toute extraction)

### 0.1 Composition du CAC 40
La liste locale `src/data/exchange-indices.json` clé `cac40` peut être PÉRIMÉE (l'indice
change). Vérifier la composition ACTUELLE sur le site Euronext (ou 2 sources concordantes :
Euronext + Boursorama/Les Échos). Mettre la liste vérifiée dans `cac40-state.json` clé
`univers` avec la date de vérification. C'est CETTE liste qui fait foi, pas l'ancienne.
En cas de divergence entre sources : noter dans `questions_yann`, prendre Euronext.

### 0.2 Documents requis PAR sté (tous, sur 5 ans : exercices 2021 → dernier publié)
| Type | Contenu KPI | Fréquence |
|---|---|---|
| Document d'enregistrement universel (URD) | KPI annuels, segments, risques, gouvernance, rémunération, actionnariat | annuel |
| Rapport financier semestriel | comptes S1, KPI semestriels | annuel (S1) |
| Communiqués de résultats (FY, S1, et T1/T3 si publiés) | KPI détaillés, souvent plus riches que les rapports | selon sté |
| Information trimestrielle T1/T3 (CA trimestriel) | CA, KPI d'activité | si la sté publie |
| Présentations résultats (slides investisseurs) | KPI opérationnels absents des rapports | chaque publication |
Les banques/assureurs (BNP, ACA, GLE, CS...) publient des comptes trimestriels complets :
pour elles le trimestriel est obligatoire.

### 0.3 Sources et collecte
- Site IR officiel de chaque sté (section "Résultats" / "Publications") : source primaire.
- info-financiere.fr / AMF : secours pour retrouver un document ancien.
- User-Agent : `Mettrik research yannricordeau100@gmail.com`, ~1 requête/seconde MAX.
- Tout document téléchargé est sauvegardé dans `data-lake/<TICKER>/ir/<TYPE>/` avec un nom
  `<TICKER>_<TYPE>_<periode>_<date-pub>.pdf` (ex `MC.PA_URD_FY2025_2026-03-15.pdf`).
  Types : URD, RFS (semestriel), CP (communiqué), TRIM (info trimestrielle), SLIDES.
- PDF → texte : `/opt/homebrew/bin/pdftotext -layout`. Garder le PDF ET le .txt.gz.
- Inventaire final par sté : dans `cac40-state.json` clé `inventaire.<TICKER>` = liste
  {type, periode, fichier} + clé `manquants` = ce qui n'a pas pu être trouvé, avec la
  raison factuelle. Une sté passe en Phase 2 UNIQUEMENT quand son inventaire couvre
  chaque période attendue sur 5 ans OU que chaque trou est documenté dans `manquants`.

## Phase 1 — Purge "page blanche" (par sté, juste avant son extraction)
1. AVANT toute suppression : backup une fois pour toutes au début de la chaîne :
   `tar czf ~/spx-app/.conv-state/cac40-backup-avant-purge.tar.gz` des fichiers existants
   des tickers CAC 40 dans `src/data/v2-pipeline/`, `src/data/v2-pipeline-enrich/`,
   `src/data/companies/`, `data-lake/<T>.PA/{kpis,kpis_q,governance}`,
   `.batches-drafts-safe/kpis-haut/`. Vérifier que le tar existe et fait >0 octets.
2. Puis, sté par sté au moment de son traitement : supprimer les anciens contenus KPI /
   gouvernance / risques de cette sté (fichiers listés ci-dessus la concernant). Ne JAMAIS
   toucher un ticker hors CAC 40. Ne JAMAIS toucher les stés US.
3. La purge d'une sté et sa ré-extraction se font dans la même passe : la page ne doit
   jamais rester vide plus longtemps qu'un cycle de traitement.

## Phase 2 — Extraction (norme identique au SP500)
- Fichier cible : `.batches-drafts-safe/kpis-haut/<TICKER>.json` (ex `MC.PA.json`).
  Ne JAMAIS écrire directement dans `src/data/v2-pipeline/` sans passer par le même chemin
  que la chaîne US.
- TOUS les KPI chiffrables présents dans les documents, aucune limite de nombre, aucun oublié :
  comptes consolidés, segments, zones géographiques, KPI opérationnels (boutiques, abonnés,
  volumes, carnets de commandes, ARR...), KPI sectoriels (banques : PNB, coût du risque,
  CET1, RoTE, dépôts/encours ; assureurs : primes, combined ratio, Solvency II ;
  luxe : croissance organique par division, nombre de magasins ; industriels : prises de
  commandes, backlog, book-to-bill).
- Fréquence : celle réellement publiée. Semestriel par défaut, trimestriel quand la donnée
  trimestrielle existe (CA T1/T3, banques). NE PAS fabriquer un trimestre non publié.
- Dérivation autorisée UNIQUEMENT pour les grandeurs additives : S2 = FY moins S1,
  T4 = FY moins 9 mois, marquées `_derived` avec le calcul. JAMAIS de dérivation sur
  marges, taux, BPA, effectifs, encours, ratios.
- Croissance "organique" vs publiée : prendre les DEUX quand publiées, libellés distincts.
- Devise : EUR. Unités "Mds €" / "M€". Normes IFRS : ne pas mélanger IFRS et indicateurs
  ajustés sans le dire dans le libellé ou le signal.
- Historique : 5 ans. KPI <3 ans → story (`is_short_history`).
- Zéro invention : verbatim des documents locaux `data-lake/<T>/ir/` uniquement. Une valeur
  non sourçable = absente, jamais estimée.
- Contrôles obligatoires avant écriture : somme des segments = consolidé ; somme des zones
  = CA ; S1+S2 = FY pour les grandeurs additives ; ordre chronologique ; `value` = dernier
  point ; `yoy` = même période N-1 (S1 vs S1, T1 vs T1 : recul de 2 en semestriel, 4 en
  trimestriel).
- Lint : `npx tsx scripts/kpi-lint.ts --tickers=<TICKER>` → 0 rouge exigé. Si le lint ne
  gère pas les tickers `.PA`, corriger le SCRIPT (pas contourner) et le noter dans l'état.
- Dédup par nom FR au sein du fichier.
- Hero KPI : choisir un KPI wow ≥5 ans, documenter `hero_kpi_rationale`.

## Phase 3 — Blocs de page sté (règle stricte)
Pour CHAQUE sté, auditer bloc par bloc :
| Bloc | Source FR | Décision |
|---|---|---|
| Hero + Indicateurs clés + Stories | documents IR | obligatoire |
| Facteurs de risque | URD chapitre facteurs de risque | présent si ≥3 risques sourcés |
| Gouvernance & rémunération | URD (rapport de rémunération, vote ex ante/ex post) | présent si CEO + rému + structure sourcés |
| Actionnariat (Top capital/votes) | URD chapitre actionnariat | présent si tableau publié |
| Positionnement IA | URD/CP/slides | présent si ≥2 preuves sourcées |
| Répartition CA (segments/géo) | comptes consolidés | présent si tables publiées |
Un bloc insuffisant = DÉSACTIVÉ pour cette sté via le mécanisme existant de blocs désactivés
(`resolveDisabledForTicker`, voir `src/lib/disabled-blocks-server.ts` pour le format).
JAMAIS un bloc à moitié rempli ou rempli avec des données inventées. Noter chaque bloc
désactivé + raison dans `cac40-state.json` clé `blocs_desactives.<TICKER>`.

## Phase 4 — Mise à jour automatique
1. Créer `scripts/fr-doc-watcher.py` sur le modèle de `scripts/daily-doc-watcher.py` :
   pour chaque sté CAC 40, vérifier le site IR (et info-financiere.fr en secours) pour
   toute nouvelle publication ; télécharger dans `data-lake/<T>/ir/` ; marquer la sté
   "à rafraîchir" dans un fichier d'état `src/data/_fr-doc-watcher-status.json`.
2. Le brancher sur la même cadence cron que le watcher US (voir launchd/plist existants,
   `.conv-state/com.mettrik.quarterly-refresh.plist` comme modèle). NE PAS casser le
   watcher US : fichier et plist séparés.
3. Tester en réel : 1 run complet du watcher, vérifier le statut écrit, avant de dire fait.
4. Le rafraîchissement des KPI suite à détection suit le même processus que la chaîne
   earnings-refresh US (`.conv-state/earnings-refresh-template.txt` adapté).

## Boucle de travail
1. Phase 0 d'abord pour TOUTES les stés (inventaire complet avant la première extraction :
   c'est la demande explicite de Yann).
2. Puis stés une par une, par capi décroissante : purge → extraction → blocs → lint → done.
3. Max 4 sub-agents en vol. Avant chaque lancement : `memory_pressure -Q` ; si "free
   percentage" < 30% ou swap en forte hausse, attendre. Le Mac a déjà crashé 2 fois.
4. Fichiers temporaires TOUJOURS préfixés par le ticker (`MC.PA_extract.txt`). Jamais de
   nom générique : collision entre agents = chiffres d'une autre sté sans s'en apercevoir.
5. Agent mort en vol (fichier cible non modifié, pas de retour) : relancer avec la note
   "une tentative précédente a pu commencer ; vérifie l'état du fichier, ne duplique rien".
6. Vérif post-agent : sonder 3 valeurs du fichier contre les documents sources AVANT de
   marquer done (des agents ont déjà inventé des trimestres entiers sur la chaîne US).
7. Sté réellement bloquée après 2 tentatives : la marquer `IMPOSSIBLE` dans l'état avec la
   raison factuelle, passer à la suivante, NE PAS boucler.

## Jalons tous les 10 stés (10, 20, 30, 40)
1. `git add .batches-drafts-safe/kpis-haut/ .conv-state/ data-lake/*/ir src/data/` puis
   commit `feat(cac40): stes X-Y (exhaustif, lint 0 rouge)` + push (branche staging).
2. Deploy hook `curl -s -X POST "$VERCEL_DEPLOY_HOOK_STAGING"` (URL dans `.env.local`).
3. Attendre READY (token `VERCEL_TOKEN` dans `.env.local`), puis
   `npx vercel alias set <url> mettrik-niveau2.vercel.app --token $VERCEL_TOKEN`.
4. Curl de vérif du CONTENU d'au moins 2 pages CAC 40 du jalon (avec
   `?audit_token=$VISUAL_AUDIT_TOKEN`, suivre la redirection 307) : hero présent,
   "Indicateurs clés" présent, aucun bloc désactivé visible. JAMAIS dire "fait" avant.
5. Rapport à Yann : 3 lignes max (jalon, lint, ETA restant).

## Règles de conduite (Yann, NON NÉGOCIABLES)
- Réponses MINIMALISTES : quelques lignes, tableau si plusieurs items, finir par TERMINE.
  Pas d'em-dash. Français. Pas d'intro ni de récap.
- Autonomie totale : ne jamais bloquer sur une question. Notifier, noter dans
  `questions_yann`, continuer sur ce qui ne dépend pas de la réponse.
- Ne JAMAIS être stoppé par une limite de tokens : surveiller la marge, basculer sur Opus
  avant d'être coincé.
- Rapports uniquement aux jalons ou si un problème bloque plus de 3 stés. Jamais de
  message "en attente" pendant qu'un agent tourne.
- Scope STRICT : uniquement les 40 stés CAC 40 et les fichiers listés ici. AUCUNE modif
  hors mission (pas de refactor, pas de fix opportuniste hors CAC 40 ; un défaut vu
  ailleurs = noté dans l'état, pas corrigé).
- Interdit : API Anthropic payante (`api.anthropic.com`). Sub-agents Task tool uniquement.
- Coupure réseau : retry 30 s ; signaler si >3 min.
- Date réelle (`date`) AVANT toute décision temporelle.
- ETA à chaque annonce de tâche.

## Reprise type (première commande)
Ouvrir Claude Code dans `~/spx-app` et coller :
"Lis .conv-state/cac40-HANDOFF.md et exécute la chaîne CAC 40 exactement selon ce document,
en totale autonomie, en commençant par la Phase 0."
En cas de reprise après interruption : lire `cac40-state.json`, vérifier les doublons
éventuels sur les stés `in_progress`, continuer.
