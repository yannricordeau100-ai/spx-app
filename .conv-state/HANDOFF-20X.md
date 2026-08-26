# HANDOFF — reprise du projet Mettrik par le compte MAX 20x

Rédigé le 27 août 2026 par la conversation du compte de secours (5x).
Tu es Claude Code sur le compte **ricordeauyann@gmail.com (MAX 20x)**, dans `~/spx-app`.
Ce document est ta source de vérité : tout ce qui s'est fait depuis le dimanche 24 août, ce qui est en cours, ce que Yann attend. Lis-le en entier avant d'agir.

---

## 1. RÈGLES PERMANENTES (à appliquer à chaque réponse, sans exception)

- Réponses **courtes, claires, organisées** : l'essentiel d'abord, tableaux ou puces, max ~8 lignes hors tableaux. Zéro blabla, zéro répétition d'une réponse à l'autre, zéro récapitulatif non demandé.
- **Pas de tiret cadratin.** Français par défaut. Pas de jargon technique non expliqué.
- Terminer les missions par `TERMINE`.
- **La vérité prime** : si une correction renforce le bear case, on l'applique quand même. Aucun chiffre non vérifié dans une source réelle n'entre en base.
- Ne dire « fait » qu'après la chaîne complète : `tsc → commit → push → deploy → alias → curl/vérif visuelle`.
- Déploiement : `npx vercel deploy --prod --archive=tgz --yes` puis `npx vercel alias set <url> mettrik-niveau2.vercel.app`. Vérifier ensuite EN LIGNE (pas en local).
- Vérification des pages : compte test `audit.claude` ou `?audit_token=` (valeur dans `.env.local`, `VISUAL_AUDIT_TOKEN`). Jamais conclure depuis la vue anonyme.
- **RAM** : le Mac a déjà crashé. Max 2 processus lourds en parallèle, `nice -n 10`, interdire aux sous-agents d'en lancer d'autres.
- Scope strict : QUE ce qui est demandé. Pas de refactor opportuniste.
- Git : jamais `git add -A` (le repo contient un data-lake massif non suivi) ; ajouter les fichiers un par un.
- État et plans dans des fichiers (`.conv-state/`), pas dans la conversation.
- Questions à Yann : uniquement si la réponse change réellement le travail. Sinon décider et avancer.

## 2. RÔLES DES COMPTES

- **Ce compte (20x)** : compte de TRAVAIL. Toutes les grosses missions passent ici.
- **Compte 5x (yannricordeau100…)** : secours uniquement. C'est lui qui a produit ce document.
- Le robot nocturne (cron 23h00) consomme les tokens du profil CLI connecté sur le Mac : Yann doit connecter ce CLI au compte 20x (voir §6).

## 3. LE PROJET EN UNE MINUTE

Mettrik AI (`~/spx-app`, Next.js 16) : app SaaS pour investisseurs, fiches KPI de **656 sociétés** (S&P 500 + CAC 40 + SMI + AEX + DAX + SOX), univers `src/data/v1-9-5-clean-all-tickers.json`, pages `/sandbox/v1-9-5/<ticker>` et `/<ticker>`, alias prod `mettrik-niveau2.vercel.app`.
Données KPI : `.batches-drafts-safe/kpis-haut/<TICKER>.json` (**prioritaire** à la fusion) puis `src/data/v2-pipeline/<ticker>.json` — fusion dans `src/lib/company-core/load-company.ts`. Documents sources dans `data-lake/<TICKER>/` (US : 10K/10Q/8K/ER/EP ; EU : ir/CP, SLIDES, TRIM, RFS, URD).

## 4. FAIT DEPUIS DIMANCHE (tout est déployé et vérifié en ligne)

### Données
- **ATT** (anti-thèses) : 52 stés résiduelles + 180 fiches identifiants corrigées, sondées aux sources.
- **Séries plates inventées** (ex NVDA « 50/50/50/50 ») : auditées sur toute la base, 14 corrigées, 3 supprimées.
- **Effectifs** : extraits de la section Human Capital des 10-K pour **455/533 stés US** (9 passes ; pièges déjoués : bénévoles GS, promotions TSLA, sous-ensemble US-only KO). Chip « Effectif » dans la ligne IPO/fondation. 78 US sans chiffre fiable (chip masquée), 123 EU non couvertes (pas de 10-K).
- **Répartition CA historisée** (FMP, plan Starter) : produit + géographie, jusqu'à 16 exercices, **520 stés US**. Sommes contrôlées = 100 %.
- **Alphabet** : mis à jour au T2 2026 (Gemini 950 M MAU, ~22 Mds jetons/min, backlog Cloud 514 Mds $, story « 9 lancements de modèles », KPI physiques promus en stories).
- **Table Supabase `desk_att`** opérationnelle (figeage testé) ; incident réparé : les variables Production Vercel pointaient sur un projet Supabase mort.

### UI fiches sociétés
- Bloc « interprétation » sous les graphs : supprimé. Blocs **Super-KPI : désactivés partout** (rendu + navigation).
- Bulle CAGR : 2 lignes centrées, « i » exercice fiscal à droite hors bulle.
- Tableau Indicateurs clés : lignes compactées (~93 px), variation entre parenthèses à droite de la valeur, chip catégorie supprimée, colonne nom rétrécie (2 lignes autorisées).
- Périodes normalisées PARTOUT (stories, tableau, transcripts) via `src/lib/period-label.ts` : trimestre calendaire réel, jamais de trimestre non terminé, priorité au libellé de période réel sur `last_data_date` (qui est souvent une date de collecte).
- Labels de graphs : plus de compact « k » sur unités physiques (« 6 262 » et non « 6,3 k » sous un axe MW) ; décimales homogènes (1,0 pas 1) ; langue des labels suit le toggle EN/FR du titre.
- Bande de couleur du header : ne déborde plus à gauche du logo (largeur mesurée).
- En-tête d'axe Y à droite : plus jamais coupé.

### Export PNG (bouton télécharger)
- Logo + nom sté et titre KPI centrés ; +50 % sur logo/nom/titre ; axe Y ensuite réduit de 20 %, graph entier de 10 % (titres intacts).
- CAGR centré sous le titre : flèche OBLIQUE en dégradé (haut-droite émeraude si positif, bas-droite framboise si négatif, liseré + ombre), « x %/an (CAGR) », en anglais « %/year », accordé à la langue du doc.
- KPI non financiers : magnitude en toutes lettres sur 2 lignes (« Milliards » / « Abonnés » ; « Billion » / « Subscribers »).
- Années sous les crochets décollées. Fichier : `src/lib/chart-export.ts`.

### Répartition du CA (bloc fiche)
- Treemap remplacé par des **lignes déterministes** (`repartition-bars.tsx`) : texte jamais dans les formes, donc plus aucun libellé tronqué. Libellés géo normalisés (`geo-label.ts` : Taïwan, Corée du Sud, « Segment » retiré).
- CA total affiché en haut, parts recalculées depuis les montants (=100 % garanti), ligne « Somme » retirée (contrôle silencieux), hauteur du bloc adaptative (plus de vide).
- Mode **Historique** : colonnes empilées 100 % par exercice, légende au-dessus, % au survol (`repartition-history.tsx`).

### Stories
- Classement **par famille** (déterministe, `src/lib/story-family.ts` : usage, clients, capacité, innovation, marché, opérations, revenus, géographie, bilan, risques, jalons).
- Déployé sur **10 stés pilotes** (`stories-pilot.ts`) : AXON, AVB, AES, BAX, AIG, CRH, CVX, DIS, F, META. Onglets avec compteurs + tri fraîcheur (récent/ancien) + mode « une vedette par famille ». Bug corrigé : la carte ignorait le filtre.
- **À faire** : généraliser aux 656 après validation de Yann sur les pilotes.

### Accueil
- Compteurs live : 26 430 indicateurs clés (dont 656 principaux), 18 163 stories (recalcul : `node scripts/build-kpi-counts.mjs` ; blocs graphiques masqués tant que 0 publié).
- **Deux citations** avec bascule au scroll (fondu) : Buffett (An Owner's Manual 1996) visible en bas d'écran, Holmström (Nobel 2016, MIT) quand le bloc passe dans la moitié haute. Réversible, FR/EN/DE/NL.

### Sandbox et outils
- Archivés : « V2 (50 stés…) », « Logo lab ». Descendus au-dessus des archives : bloc Datasets + Univers société.
- 3 outils de création de KPI, tous testés fonctionnels :
  1. `/sandbox/kpi-builder` → KPI du tableau (file `desk_kpi_requests`)
  2. `/sandbox/special-kpis` → blocs graphiques dédiés (`desk_special_kpis`)
  3. **NOUVEAU** `/sandbox/story-builder` → story depuis un lien web **ou un post X** (table `desk_story_kpis`, créée par Yann). Lecture X via fxtwitter, garde-fou : chiffre absent de la citation source = fiche « à vérifier », jamais publiée.

### Veille documentaire et pipeline de mise à jour
- `scripts/fr-doc-watcher.py` : univers élargi de 60 → **124 stés hors US** (annuaire `src/data/ir-directory.json`), contournement des blocages WAF (lecteur de repli), liens PDF markdown lus. 12 nouvelles publications détectées au premier passage (adidas T2 2026, BMW, Siemens, Heineken…).
- **`scripts/earnings-refresh.py` : LE pipeline central.** À chaque publication, pour chaque sté (US et non US) : analyse de TOUS les documents (communiqué, présentation, transcript, rapport), un nouveau point par KPI suivi (trimestre ou semestre), chiffre **vérifié littéralement dans un document** sinon rejeté, ajout à l'historique sans jamais écraser. Moteur : **Claude uniquement** (`claude -p`, décision Yann — les API Groq/Cerebras/Anthropic sont abandonnées pour ce pipeline). Si le CLI n'est pas connecté : dossiers de travail complets dans `.conv-state/earnings-inbox/` (rien n'est perdu).
- **Cron : tous les jours à 23h00** (heure du Mac) — enchaîne veille US, veille EU, extraction (`scripts/earnings-refresh.sh`, log `/tmp/earnings-refresh.log`). Condition unique : Mac allumé + internet à 23h.
- Test validé sur 20 stés (10 EU CAC/SMI/AEX, 10 US SP500/SOXX) : chaîne complète OK, 34 à 79 KPI reconnus par sté. Note : pas de société belge dans l'univers (BF.B = Brown-Forman US).

## 5. EN COURS / À FAIRE (par priorité)

1. **Yann doit connecter le CLI au compte 20x** (§6) — sans ça le robot de 23h produit des dossiers au lieu d'écrire les points.
2. **Surveiller la première exécution du cron 23h** (`/tmp/earnings-refresh.log`) et traiter les dossiers de `.conv-state/earnings-inbox/` s'il y en a.
3. **Fiche Axon à mettre à jour au T2 2026** (analyse faite, valeurs connues) : rétention nette 126 % (fiche : 125), réservations contractées 15,1 Mds $ (fiche : 14,3), ARR 1,6 Md $ — l'ARR existe en 3 exemplaires contradictoires sur la fiche (1,3 Md story / 1 493 M tableau), à unifier. Ajouter : croissance « AI Era » ~+700 %, 10ᵉ trimestre consécutif > +30 %.
4. Généraliser le rangement des stories aux 656 stés après validation des 10 pilotes par Yann.
5. Effectifs manquants : 78 US, 123 EU (source à définir pour l'EU).
6. Import en lot dans story-builder (coller une liste de liens X d'un coup) — utile pour le flux Grok (§7).
7. Clé FMP : abonnement Starter actif (segmentation OK) ; transcripts/13F/M&A verrouillés (palier supérieur). Ne rien payer de plus sans décision de Yann.

## 6. ACTION UNIQUE POUR YANN (déjà communiquée, la voici pour référence)

Dans **Terminal** (l'app macOS, pas une conversation) :
```
claude
```
Suivre le login (navigateur) avec **ricordeauyann@gmail.com** (le 20x), puis quitter. But : le robot de 23h consommera les tokens du 20x. Ni l'app Claude ni le navigateur n'ont besoin d'être ouverts ensuite ; la connexion survit aux redémarrages.

## 7. POSTS X PAR TICKER — ANALYSE COMPLÈTE (mise à jour : Yann a Grok premium via X, PAS l'API X, et ne paiera rien de plus)

| Besoin | Fiable < 5 % d'échec ? |
|---|---|
| Trouver TOUS les posts EN+FR d'un ticker sur une période, par programme | **Non** : x.com bloque les lecteurs gratuits, l'API X est payante (Basic ~200 $/mois limité aux 7 derniers jours ; archive complète ~5 000 $/mois). Exclu par décision de Yann. |
| Découverte via **Grok** (inclus dans l'abonnement X de Yann) | **Meilleure voie sans coût.** Grok interroge X nativement, ce que nous ne pouvons pas faire. Rappel non garanti < 5 % mais bon sur une fenêtre courte. |
| Extraction des métriques depuis des posts donnés (liens) | **Oui, < 5 %** : lecture via fxtwitter + garde-fou « chiffre présent dans le texte sinon rejet ». Déjà en place dans story-builder. |

**Process multi-niveaux retenu :**
1. **Découverte (Grok, ~1 min)** : Yann (ou une routine) demande à Grok : « Liste tous les posts X en anglais et en français mentionnant $TICKER entre le [date] et le [date], avec le lien de chaque post. » Fenêtre conseillée : **7 jours maximum par requête** (itérer par semaine pour une période longue) — au-delà, le rappel de Grok chute, surtout sur une action populaire.
2. **Extraction (automatique, sandbox)** : coller les liens dans story-builder → lecture fxtwitter → extraction des métriques, **surlignage de celles souhaitées** (liste fournie en consigne), citation exacte conservée, chiffre non retrouvé = rejeté.
3. **Fiabilité** : l'étape 2 est < 5 % d'échec (erreurs résiduelles = omissions, jamais d'invention). L'étape 1 dépend de Grok : cadence courte = rappel élevé.

**Modèle** : Opus suffit, Fable inutile ici (le goulot est l'accès aux données, pas l'intelligence). Sonnet + vérification convient aussi pour l'étape 2.
**Précision demandée par Yann** : le réglage « température 0 » ne concerne QUE les appels API dans les programmes de la sandbox. Dans l'app Claude, ce réglage n'existe pas : l'équivalent est le sélecteur de modèle + niveau de réflexion à droite de la barre de prompt.

## 8. PIÈGES CONNUS (gagnent des heures)

- `kpis-haut/<TICKER>.json` **écrase** les shorts en doublon de v2-pipeline : modifier les DEUX ou le bon.
- `vercel` : si le deploy échoue avec « No existing credentials », la session CLI a expiré → relancer, Yann approuve le code dans le navigateur. `EPIPE` = coupure réseau, simple retry.
- `grep` du système = ugrep : les classes `.{0,60}` après une alternation explosent (« exceeds complexity limits ») → passer par Python.
- Timers/cron : toujours vérifier la date réelle avant toute décision temporelle.
- Ticker absent de `clean-all-tickers` = redirect silencieux vers l'accueil : vérifier le `<title>` de la page.
- Le hero peut être écrasé par un override Supabase (`reference_mettrik_hero_override_supabase`).
- Sous-agents : leur interdire explicitement de lancer des sous-agents (pic RAM = crash).
- 4 dernières valeurs sûres pour tests : AAPL effectif 166 000, TSLA 134 785, NVDA Gemini n/a — voir `.conv-state/employees-10k.json` (champ `evidence`).

— Fin. Confirme ta lecture en 5 lignes max : état retenu, priorité n°1, et attends les instructions de Yann.
