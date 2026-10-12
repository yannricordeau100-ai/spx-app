# Analytics personnels de « Mon compte et analytics »

Rapport du 13 octobre 2026. Lecture seule : aucun code modifié. Règle de départ : chaque chiffre affiché vient d'une donnée réellement collectée, sinon le bloc n'est pas affiché (état vide honnête).

## 1. Ce que font les plateformes (recherche web)

| Plateforme | Ce qu'elle met en avant sur soi | Source |
|---|---|---|
| Simply Wall St | Audit de diversification (secteurs, revenus par zone, par ligne), suivi des dividendes (revenu annuel et mensuel, rendement, rendement sur coût), alertes résultats/dividendes, valeurs sous/surévaluées | [page portefeuille](https://simplywall.st/webflow/features/portfolio) |
| Seeking Alpha | Score de santé du portefeuille, avertissements, alertes personnalisées, colonnes au choix. Pas d'analyse d'exposition ni de dividendes citée | [aide Seeking Alpha](https://help.seekingalpha.com/what-are-the-key-features-of-seeking-alphas-portfolio-tracker) |
| Morningstar X-Ray | Répartition par secteur (11 secteurs, 3 super-secteurs) comparée au S&P 500, régions, style, frais | [Morningstar X-Ray](https://morningstar.in/posts/64689/get-instant-x-ray-fund-holdings.aspx) |
| TipRanks | Bêta, P/E et rendement du portefeuille comparés à la moyenne des portefeuilles de la plateforme, dividendes, avertissements | [IG sur TipRanks](https://www.ig.com/en/help-and-support/articles/682183-what-is-tipranks) |
| Yahoo Finance | Métriques clés : dividendes, diversité d'actifs et de secteurs, alerte de surexposition à un secteur ; page d'accueil personnalisée selon les visites récentes | [Yahoo portfolios](https://finance.yahoo.com/portfolios), [tutoriel Plus](https://www.aol.com/news/yahoo-finance-plus-tutorial-175542390.html) |
| Koyfin | Listes de suivi illimitées, tableaux de bord personnalisables (outil de travail plus que de bilan personnel) | [revue Koyfin](https://daytradingz.com/koyfin-review) |
| Stock Analysis | Portefeuille, liste de suivi, calendrier de dividendes et de résultats | [fiche appli](https://apps.apple.com/us/app/-/id6751272467) |
| Spotify Wrapped | Top éléments, temps total comparé d'une année à l'autre, âge d'écoute, comparaison à son groupe d'âge ou pays, format qui se raconte et se partage ; engagement +19 % en 2025 selon Spotify (chiffre de l'entreprise, non vérifié) | [ADMA](https://adma.com.au/resources/personal-shareable-no-strings-attached-the-winning-formula-behind-spotify-wrapped) |
| Strava Year in Sport | Séries les plus longues, métriques les plus améliorées, bilan annuel personnel | [Yahoo/Strava](https://sg.news.yahoo.com/stravas-sport-rolling-now-spotify-133021954.html) (source mince) |

Non trouvé malgré la recherche : fonctions de bilan personnel chez Boursorama, Zonebourse, Investing.com (seulement des alertes et listes, sources anciennes de 2012), Finimize, Robinhood/Public/eToro (aucun « votre année » publié, seulement des classements globaux). Je ne les cite donc pas comme références.

Utile ou gadget :
- Utile (répond à une décision) : exposition par secteur, revenus et dates à venir de ses valeurs, événements sur ce qu'on suit ([aide Seeking Alpha](https://help.seekingalpha.com/what-are-the-key-features-of-seeking-alphas-portfolio-tracker), [Simply Wall St](https://simplywall.st/webflow/features/portfolio)).
- Gadget probable : scores de diversification ou de santé sans méthode affichée, insights « IA » sans base visible. Jugement de ma part, aucun sondage d'utilisateurs fiable trouvé (la recherche Reddit n'a rien donné d'exploitable).
- Attention aux séries : le plus gros risque est comportemental. La régulation américaine (SEC, [communiqué 2021-167](https://www.sec.gov/news/press-release/2021-167)) cite les jeux, séries, badges, notifications comme pouvant pousser à trader plus ; la recherche sur l'aversion myope aux pertes ([NBER w4369](https://www.nber.org/papers/w4369)) montre que consulter souvent fait sous-investir ; Morningstar mesure un écart de 1,2 point par an entre fonds et investisseurs, dû à leurs achats et ventes ([Advisor Perspectives](https://www.advisorperspectives.com/commentaries/2026/08/21/what-advisors-can-learn-from-the-investor-return-gap)). Conséquence : pas de série quotidienne culpabilisante, pas de « tu n'as pas regardé depuis 3 jours ». Les streaks de Duolingo aident la régularité mais créent aussi de l'anxiété ([études d'usagers](https://repositorio.21.edu.ar/items/a054e49c-9c76-4700-9529-a8580f073a96)).
- Vie privée : le recap marche quand l'utilisateur voit exactement quelles données sont comptées, sans collecte cachée ([Proton](https://proton.me/id/business/blog/spotify-wrapped-alternatives), source partisane).

## 2. Inventaire de la donnée Mettrik

### Déjà collecté par utilisateur

| Source | Contenu | Remarques réelles |
|---|---|---|
| `telemetrie_evenements` (migration `20260831_telemetrie.sql`) | ts, type, nom, session_id, `user_id`, chemin, appareil, duree_ms, props (jsonb) | Écrit par `src/app/api/telemetrie/route.ts`, collecteur `src/components/telemetrie-collecteur.tsx`. Sans politique RLS : lecture uniquement par service role. `user_id` rempli côté serveur si connecté |
| Pages vues | type=page, nom=vue, chemin = `location.pathname` (donc `/AAPL`), duree_ms | Query string non conservée (donc ni `?kpi=`, ni recherche) |
| Clics | type=clic, nom = `data-track`, sinon `aria-label`, sinon texte du bouton (80 car.), href | Aucun `data-track` posé nulle part dans `src/` : libellés non fiables pour compter un KPI |
| Appels API | type=api, nom = route sans query | `/api/compare` apparaît sans les sociétés comparées |
| `favorite_companies` (user_id, ticker, created_at) | Favoris société | Server actions `src/app/favorites/actions.ts`, RLS. Aucune migration dans le dépôt : table créée hors dépôt, à confirmer en base |
| `favorite_kpis` (user_id, ticker, kpi_short, is_super, created_at) | Favoris KPI | Idem |
| `user_saved_companies` (user_id, ticker, created_at) | « Mes sociétés » payant | `/api/company/saved`, `/mes-societes`. Doublon fonctionnel avec favorite_companies |
| `subscriptions`, `billing_events`, `support_tickets`, `desk_referrals` | Compte, plan, parrainage | Utiles pour l'en-tête du bloc, pas pour l'analytics d'usage |

### Pièges constatés (à traiter avant d'afficher un chiffre)

1. Comptes exclus : l'ingestion ignore le compte propriétaire (`DESK_OWNER_EMAIL`), les `@mettrik-internal.test` et les `usersExclus`. Le bloc sera donc vide sur le compte de Yann et sur `audit.claude`. Test avec un compte normal ou avec exclusion levée en préversion.
2. Historique réel limité : la collecte existe depuis le 31 août 2026. Afficher « depuis le [date de première donnée du compte] », jamais « cette année ».
3. Interrupteur global : si la télémétrie est coupée (`chargeReglageTelemetrie`), aucune donnée n'arrive. Les chiffres doivent dire « mesuré depuis… ».
4. Durée de page faussée : dans `finDePage`, `surCache` envoie un événement quand l'onglet passe en arrière-plan mais ne remet pas `debut` à zéro. Un retour sur l'onglet puis une navigation compte à nouveau tout le temps depuis l'ouverture, arrière-plan compris, donc un double comptage possible. Le temps passé ne doit pas être affiché avant correction (voir §4).
5. `enregistreEvenementServeur` (`src/lib/telemetrie/serveur.ts`) existe mais n'est appelée nulle part dans `src/`. Aucun événement serveur par utilisateur n'est donc émis aujourd'hui.
6. Rétention : aucune purge. La politique de confidentialité annonce 1 an pour les données de connexion puis anonymisation (`src/app/legal/confidentialite/page.tsx`, s6) ; il faut une tâche de purge ou d'anonymisation à 12 mois pour tenir cet engagement.
7. Visiteur anonyme : `user_id` nul, `session_id` limité à l'onglet. Rien d'avant la connexion n'est rattaché au compte.
8. Chemins non société : `/account`, `/pricing`, etc. partagent `chemin`. Filtrer par `^/([A-Za-z0-9.\-]{1,12})$` puis `ficheServie(ticker)` / `COMPANIES`, avec normalisation de casse et alias (`src/lib/ticker-aliases.ts`).

## 3. Les analytics retenus, classés par intérêt

Légende de faisabilité : A = possible tout de suite avec la donnée existante ; B = petite collecte à ajouter ; C = plus tard.

| # | Analytic | Pourquoi (recherche) | Donnée | Faisabilité |
|---|---|---|---|---|
| 1 | Sociétés les plus consultées (top 5, nombre de visites, dernière visite) | Équivalent du « top artistes » du Wrapped, et de la personnalisation par visites récentes de Yahoo | `telemetrie_evenements` type=page nom=vue, chemin `/TICKER`, `user_id` | A (nombre de visites). Le temps passé : B après correction du chrono |
| 2 | Secteurs regardés (répartition de ses vues par secteur, comparée à la répartition de l'univers) | Exposition par secteur comparée à un indice : cœur de Morningstar et Yahoo | Mêmes événements que 1 + secteur par société (`COMPANIES` dans `src/lib/data.ts`, `societeN1`, code GICS dans `gics_code`) | A, jointure côté serveur, aucune nouvelle collecte. Libellé honnête : « ce que tu regardes », pas « ton portefeuille » |
| 3 | KPI qui m'intéressent : favoris KPI + KPI ouverts le plus souvent | Les plateformes laissent choisir métriques et colonnes ; ici on montre ce que l'utilisateur consulte vraiment | Favoris : `favorite_kpis` (A). Ouvertures : à collecter | A pour les favoris. B pour les ouvertures : événement dans `handleKpiClick` (`src/components/company-view.tsx` ligne 635, appelé aussi par `onPickKpi`) |
| 4 | Mes favoris : prochaines publications de résultats et fraîcheur | Alertes résultats et calendriers (Simply Wall St, Stock Analysis, Seeking Alpha) : l'élément le plus actionnable | `favorite_companies` + `src/data/earnings-calendar.json` (mis à jour le 12/10/2026, fenêtre 200 jours, sources FMP/MarketBeat/StockAnalysis) | A, sous réserve de n'afficher que les dates présentes dans le fichier et d'indiquer « date estimée » si la source ne la confirme pas (à vérifier par société avant mise en ligne) |
| 5 | Régularité : semaines actives sur les 12 dernières, jours actifs du mois | Séries à la Strava/Duolingo, mais en version douce | Jours distincts de `ts` pour les pages vues du `user_id` | A. Pas de série quotidienne ni de rappel culpabilisant (risque comportemental ci-dessus). Temps passé : seulement après correction |
| 6 | Découvertes : nouvelles sociétés et nouveaux secteurs explorés ce mois, par rapport à tout l'historique | Pousse à élargir sa liste plutôt qu'à surveiller plus souvent ; équivalent du « nouveaux artistes » | Première visite par ticker dans les événements du `user_id` | A |
| 7 | Comparaisons réalisées (nombre, dernières paires société/KPI) | Comparaison à ses pairs : usage central du comparateur, réservé aux abonnés | `/api/compare` apparaît comme type=api sans paramètres | B : ajouter `enregistreEvenementServeur("comparaison", {a, ka, b}, user.id)` dans `src/app/api/compare/route.ts` quand l'appel est autorisé et que `?b=` est présent. Bloc verrouillé en gratuit |
| 8 | Mon regard comparé à la communauté (« tu regardes plus la santé que 80 % des membres ») | Comparaison au groupe (Wrapped, TipRanks) | Agrégat de tous les `user_id` | C : à ne faire qu'avec un seuil de k utilisateurs (par exemple 50) pour qu'aucun profil ne soit reconnaissable, et seulement quand l'effectif réel est suffisant. Aujourd'hui `/api/popular-stocks` est un JSON statique, pas de l'usage réel |
| 9 | « Mon année Mettrik » (bilan de décembre qui reprend 1 à 6, partageable) | Format Wrapped / Year in Sport | Mêmes données | A à partir de décembre 2026, en l'état. Elle ne couvre alors que septembre à décembre : titre « depuis septembre » |

Écartés volontairement : heure de connexion préférée, appareil, pays (gadget, sensible, aucune décision derrière) ; mots tapés dans la recherche (donnée trop intime, `/api/recherche-societes` ne les enregistre pas et ne doit pas le faire) ; temps passé total tant que le chrono est faux ; export graphique (aucun bouton d'export public identifié dans la fiche, `downloadSvgAsPngV2` n'est utilisé que par le bac à sable) ; scores de santé ou de diversification sans méthode publiée.

## 4. Vie privée et conformité

- Lecture limitée à l'utilisateur : le bloc est un composant serveur qui lit `user.id` depuis la session (`createSupabaseServerClient`) et interroge `telemetrie_evenements` avec le service role, filtre `user_id = user.id` imposé dans le code. Aucun paramètre d'URL ne désigne un autre utilisateur.
- Aucun tiers : tout reste dans notre base, comme le dit déjà la politique (s8 « mesure interne première partie »).
- Texte à ajouter dans `confidentialite/page.tsx` : « Votre activité (pages vues, favoris) vous est restituée dans votre compte », avec la durée de conservation réelle.
- Contrôles à fournir : bouton « Effacer mon historique d'activité » (DELETE sur `telemetrie_evenements` pour son `user_id`) et case « Ne plus mesurer mon activité » (drapeau lu à l'ingestion). Cela rend aussi l'accès et l'effacement RGPD concrets.
- Ne pas afficher de comparaison à d'autres membres sans seuil (point 8).

## 5. Proposition de mise en page

Emplacement : nouvelle section dans `src/app/account/page.tsx`, après le bloc d'en-tête et les deux cartes (favoris, abonnement), avant « Factures » (la page est une colonne `max-w-4xl`, cartes `rounded-2xl border-[#1f1f1f] bg-[#0a0a0a] p-6`). Titre : « Mon activité », sous-titre « Calculé uniquement à partir de tes visites depuis le [date] ».

Ordinateur (largeur 896 px) :
1. Ligne de 3 petites cartes chiffrées : sociétés vues ce mois, nouvelles sociétés explorées, semaines actives sur 12.
2. Deux colonnes : à gauche « Sociétés les plus consultées » (liste de 5 avec barre de proportion et logo), à droite « Secteurs regardés » (barres horizontales, avec trait de repère pour la répartition de l'univers).
3. Deux colonnes : « Mes KPI » (favoris puis les plus ouverts) et « Prochaines publications de mes favoris » (liste datée, 5 lignes).
4. Pleine largeur, repliable : « Comparaisons » (abonnés) et lien « Voir tout mon historique » / « Effacer ».

Mobile (375 px) : une seule colonne, marge 16 px. Les 3 chiffres passent en défilement horizontal ou en 3 lignes compactes ; chaque liste est limitée à 5 lignes avec « Voir plus » ; les barres de secteurs gardent le nom au-dessus de la barre ; les sections 3 et 4 sont repliées par défaut (accordéon) pour ne pas allonger la page ; boutons d'effacement en bas, tailles de touche d'au moins 44 px.

États : visiteur sans donnée (« Pas encore assez de visites : visite quelques fiches pour voir tes statistiques »), gratuit (comparaisons floutées avec offre Premium, comme le reste du site), collecte coupée (« La mesure est désactivée »). Aucun chiffre inventé : si moins de 3 visites, afficher seulement le compte.

## 6. Ce qu'il faut coder

Sans nouvelle collecte (A), dans l'ordre :
1. `src/lib/analytics-compte.ts` : fonction serveur `chargeAnalyticsCompte(userId)`. Une requête lit les événements page/vue du `user_id` (bornée, par exemple 12 mois, colonnes ts, chemin, duree_ms), puis agrégation en JS : tickers valides (regex + casse + alias + `ficheServie`), top, secteurs (via `COMPANIES`/`societeN1`), semaines actives, découvertes (premier ts par ticker). Favoris via `favorite_companies` et `favorite_kpis`. Prochaines publications via `earnings-calendar.json` (`par_ticker`).
2. Composant `src/components/account/mon-activite.tsx` (serveur) et inclusion dans `src/app/account/page.tsx`.
3. Index conseillé : `create index on telemetrie_evenements (user_id, ts desc) where user_id is not null` (l'index partiel actuel ne couvre que `user_id`). Migration à écrire, à appliquer par Yann.
4. Test avec un compte réel hors exclusions, sur plusieurs cas (zéro visite, 1 visite, 50 visites, plusieurs secteurs, alias de ticker), conformément à la règle des tests multi-cas.

Petites collectes (B) :
5. `src/components/telemetrie-collecteur.tsx` : dans `surCache`, remettre `debut = performance.now()` et `scrollMax = 0` après `finDePage()` quand l'onglet repasse en visible, pour ne compter que le temps visible ; sans cela, pas de temps passé.
6. `src/components/company-view.tsx` `handleKpiClick` : émettre un événement `clic` nommé `kpi_ouvert` avec props `{ticker, kpi}`. Le collecteur n'expose pas d'API d'événement personnalisé : ajouter `window.mtkTrack(type, nom, props)` dans le collecteur, ou poser `data-track` sur les deux boutons (lignes 2113 et 2172) en y mettant ticker et short.
7. `src/app/api/compare/route.ts` : appeler `enregistreEvenementServeur("comparaison", {a, ka, b}, user.id)` (la fonction existe déjà).
8. Contrôles : action serveur « effacer mon historique » et drapeau d'opposition lu dans `src/app/api/telemetrie/route.ts` ; purge à 12 mois (cron ou requête planifiée) ; mise à jour de la politique de confidentialité.

Décisions à valider par Yann :
- A. Lancer d'abord 1 à 6 et 9 (sans collecte), ou attendre les points 5 à 7 pour tout sortir en une fois (recommandé : A pour l'essentiel, les KPI ouverts s'ajoutent ensuite).
- B. Garder ou non « Mon regard comparé à la communauté » pour plus tard (recommandé : plus tard, quand l'effectif réel dépasse le seuil).
- Rien n'a été modifié, publié ni envoyé.
