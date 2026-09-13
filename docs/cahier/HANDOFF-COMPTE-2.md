# Passage de relais complet (14/09/2026 01:15) : a lire en entier avant toute action

Remplace la version du 07/09. Tout ce qui est liste en section 3 est commite sur `staging` et en ligne sur niveau2.
Historique detaille : `git log staging --since=2026-09-07 --format="%ad %h %s" --date=format:%d/%m` (messages longs, source principale).
Relais plus anciens : `docs/cahier/HANDOFF-COMPTE-3.md` (etat 08/09), `.conv-state/HANDOFF-20X.md` (30/08). Bilan du 13/09 point par point : `.conv-state/chantier-13sept.md`.
Toujours `git pull origin staging` avant de commencer.

## 0. Regles permanentes du proprietaire (non negociables)

### Forme
- Reponses courtes, en francais, sans tiret long, sans blabla, ETA pour chaque tache, tableau recapitulatif final (une ligne par point du prompt), « TERMINE » a la fin.
- Toujours donner les liens des pages creees ou modifiees.
- Quand deux regles se contredisent : LE SIGNALER EN CAPITALES dans la reponse, appliquer la plus recente en attendant.
- Gros doute : ne pas executer la partie douteuse, poser la question clairement dans la reponse (options A/B), continuer le reste. Pas de questionnaire bloquant (AskUserQuestion refuse).
- Lenteur acceptee, mais 100 % du travail : aucun point oublie, aucun lot laisse a moitie ; un point bloque reste dans la liste.
- Uniquement les modifications demandees. Une societe citee = correction sur tout l univers, sauf « seulement pour X ».

### Mise en ligne
- version-bump obligatoire a chaque push (sinon l ancien cache des fiches est servi 6 h). Chaine complete : section 2.2.
- Dire « fait » seulement apres verification curl avec `audit_token` sur niveau2 (vue connectee), jamais en anonyme.
- mettrik.ai (n0) : uniquement sur « go n0 » explicite. Ne JAMAIS toucher les interrupteurs maintenance et tarifs (/sandbox/lancement).
- Ne jamais committer `src/data/companies/wkl.as.json`. Ne jamais faire `git add -A` : l arbre contient environ 13 500 fichiers modifies ou non suivis par les robots (data-lake, .conv-state) ; ajouter les chemins un par un.
- Ne jamais lancer `scripts/build-v17-public.ts` (il detruit `src/data/v1-7-public.json`, audit du 13/09).
- Registre `src/data/quarantaine-pollution.json` (56 tickers hors univers pollues par l identite IVR) : toute chaine d integration doit les refuser ; afficher son message et attendre le proprietaire.

### Donnees
- Jamais de valeur inventee. Le 10-K / 10-Q (ou rapport annuel) fait foi. Sonder 3 valeurs contre la source pour chaque lot d agent avant application.
- Valeur non exacte a la source : afficher 100+ ou ≈100, jamais un chiffre exact (`src/data/valeurs-approximatives.json`).
- AUCUNE TRADUCTION, NULLE PART (depuis le 13/09) : pas de `v2-pipeline-i18n`, crons de traduction commentes dans crontab, ne pas les reactiver (CLAUDE.md section 9). `scripts/verif-societe.py` signale encore i18n-en/de manquants : a ignorer.
- Univers = 7 indices (S&P 500, Nasdaq 100, SOX, CAC 40, DAX, AEX, SMI), 671 societes. Jamais d ajout par capitalisation.
- Une societe SORTIE d un indice RESTE (page et toutes les listes) ; la veille signale, elle ne retire jamais. Une societe DISPARUE PAR FUSION est REMPLACEE par la societe issue de la fusion (exemple applique : AVB + EQR -> VMRK Vivmark Residential, 17/08).
- Ajout d une societe : `.conv-state/ajout-societe-CHECKLIST.md` puis `python3 scripts/verif-societe.py T`. Compteur : `src/lib/univers.ts` NB_SOCIETES (plus jamais 666 en dur).
- Mises a jour : chaque bloc a jour a J+3 apres publication (CLAUDE.md section 8, `src/data/mise-a-jour-regles.json`). EN DEBUT DE SESSION : lire l alerte rouge et corriger le rouge AVANT que le proprietaire ouvre l email (section 4.J). Toute passe ecrit `_maj_<bloc>`.
- Blocs pas encore crees : « Disponible bientot », jamais de delai chiffre. Logos : Wikipedia / Commons seulement (`scripts/fetch-logo-wikipedia.py T "Titre"`), jamais par domaine ou ticker ; controler le PNG a l oeil.
- Fichiers du Cahier : ni prenom ni tiret long (`_valide.py` le refuse). Fichiers lus par le serveur en minuscules (Vercel distingue la casse).

### Emails
- Aucun email d information ou commercial aux clients. Seuls les necessaires partent (echec de paiement, contact, support, alerte) ; bienvenue et accompagnement bloques sauf adresses @mettrik.ai (`src/lib/resend.ts`, emailAutorise). Emails d authentification Supabase inchanges.

### Machine et agents
- RAM : surveiller `memory_pressure`, un seul serveur de dev a la fois, `nice -n 10` sur les lots (le Mac a deja plante).
- 3 AGENTS MAXIMUM EN PARALLELE (CETTE REGLE REMPLACE LES 8 AGENTS DE LA VERSION DU 07/09). Modele Opus, orchestration en Fable. Jamais le navigateur integre ni Claude in Chrome dans un agent.
- CLAUDE IN CHROME : L EXTENSION EST RELIEE AU COMPTE CLAUDE DU PROPRIETAIRE UTILISE PAR L AUTRE SESSION. SI BESOIN, DEMANDER AU PROPRIETAIRE, DEUX FOIS ET EN MAJUSCULES, DE CHANGER LE COMPTE CONNECTE.
- Verification connectee : compte test `audit.claude@mettrik-internal.test` ou cookie `mettrik:simulate-as=max` (ou `free`) + `?audit_token=<VISUAL_AUDIT_TOKEN de .env.local>`.
- Ne jamais recopier un mot de passe, une cle ou un jeton dans un fichier ou une reponse.

## 1. Glossaire

- **PV** : plus-value pour l investisseur (ce qu un chiffre lui apprend) ; champ `pv_score` des KPI.
- **ste / stes** : societe / societes.
- **DOB** : Droit au but : direct, objectif, bref (1 a 5 phrases).
- **n0** : mettrik.ai, site public de production (en maintenance).
- **niveau2** : https://mettrik-niveau2.vercel.app, preproduction servie depuis `staging`, ou tout est verifie.
- **go n0** : autorisation explicite du proprietaire de publier sur n0 (`scripts/go-n0.sh`).
- **KPI IC** : KPI du tableau « Indicateurs cles » (KPI avances en clair + KPI standard dans la barre depliable).
- **KPI IC total** : tous les KPI IC (standard + avances).
- **KPI total** : KPI IC total + KPI stories.
- **Types de KPI** : nombre de types de KPI IC differents ; un type = mesure qu un concurrent peut publier, meme en theorie (page /sandbox/kpi-definitions, memoire reference_mettrik_definitions_kpi.md).
- **KPI stories** : KPI de la section stories (`stories_kpis`) : jamais doublon d un KPI IC, derniere donnee de moins d un an, retrait des KPI anterieurs a N-2.
- **hero** : KPI principal en grand en haut de fiche (`hero_kpi`) ; l override Supabase prime.
- **kpis-haut** : `.batches-drafts-safe/kpis-haut/<T>.json`, couche des KPI avances, la plus lue ; remplace les KPI de meme identifiant.
- **v2-pipeline** : `src/data/v2-pipeline/<t>.json`, fiche principale d une societe.
- **v2-pipeline-enrich** : `src/data/v2-pipeline-enrich/<t>.json` (+ `.ranks`, `.tam`, `.description`), blocs enrichis et dates `_maj`.
- **Cahier** : `docs/cahier/`, referentiel commun aux comptes (donnees KPI, clients, TAM, moat, produit phare, bourses, KPI par industrie).
- **produit phare** : serie du produit ou volume emblematique (Industrie, Conso) ; registre `src/data/produit-phare.json`.
- **TAM** : marche adressable total ; bloc « Position marche » (`<t>.tam.json`, `docs/cahier/tam/<T>.json`, /sandbox/tam).
- **moat** : avantage competitif (niveau + tendance evaluee par Mettrik) ; `src/data/moat-univers.json`, /sandbox/moat.
- **ATT ou anti-these** : argument contre la these d investissement, bloc en bas de fiche ; `src/data/att/<t>.json`, procedure `.conv-state/ATT-PROCEDURE.md`.
- **_maj_<bloc>** : date ISO de derniere mise a jour d un bloc dans v2-pipeline-enrich ; absente = bloc orange.
- **J+3** : delai maximal de mise a jour d un bloc apres une publication de resultats.
- **alerte rouge** : bloc en retard au-dela de J+3 ; email + banniere sur /sandbox et /sandbox/mises-a-jour.
- **quarantaine** : tickers du registre `quarantaine-pollution.json`, jamais integres sans decision.
- **vitrine defloutee** : societes servies sans floutage aux inscrits gratuits (Google, Meta, Booking, Apple, Netflix, acces Max) ; `src/lib/freemium/tier-serveur.ts`.
- **comptes de reglage** : compte proprietaire, compte de marque mettrikai@gmail.com et comptes internes, en acces Max et admin sandbox (`src/lib/desk/auth.ts`).
- **floutage** : parties masquees selon le forfait (`src/lib/desk/floutage-zones.ts`).
- **clean-all** : `src/data/v1-9-5-clean-all-tickers.json`, liste de visibilite (ticker absent = redirection silencieuse vers l accueil).
- **chaine 23h** : passe nocturne sans modele (23h00) puis tache Claude (23h40), section 2.3.
- **prompt du dimanche** : prompt de reprise a recoller quand le quota se renouvelle (affiche sur /sandbox/unites-source) ; « travail du dimanche » = KPI gris a rechercher dans /sandbox/gics.
- **robots** : passes automatiques qui modifient data-lake, .conv-state et parfois les couches de fiche.
- **ER** : communique de resultats (earnings release).
- **Comparer** : comparaison de KPI entre societes (/api/compare, reserve aux abonnes).

## 2. Ou sont les donnees et comment elles s affichent

### 2.1 Couches lues par une fiche, dans l ordre
1. `src/data/v2-pipeline/<t>.json` : identite, GICS, hero_kpi, kpis 5 ans, stories_kpis, ai_positioning, risks, governance.
2. `src/data/v2-pipeline-enrich/<t>.json` : repartition du CA, snapshot, pairs, next_earnings_date, `_maj_<bloc>` ; a cote `<t>.ranks.json`, `<t>.tam.json`, `<t>.description.json`.
3. `.batches-drafts-safe/kpis-haut/<T>.json` : REMPLACE les KPI de meme identifiant (`src/lib/company-core/load-company.ts`, vers les lignes 358 et 2688). Corriger ici, pas seulement dans v2-pipeline.
4. `src/data/companies/<t>.json` : legacy, lu par `scripts/ranks-univers.py` pour les rangs.
5. Hero : l override Supabase `desk_hero_kpi_overrides` prime sur hero_kpi (routes `src/app/api/desk/hero`, `src/app/api/admin/kpis-toggle/set-hero`) ; `apply-hero-fix` ne le touche pas.
6. Autres blocs : clients `docs/cahier/clients/<T>.json` ; moat `src/data/moat-univers.json` ; anti-these `src/data/att/<t>.json` ; transcript `src/data/transcripts/<t>.json` + synthese `src/data/transcript-summaries/<t>.json` ; blocs coupes `src/data/disabled-blocks-per-ste.json` ; valeurs approximatives `src/data/valeurs-approximatives.json`.
7. Logo : affiche seulement si le ticker est dans `src/data/logo-tickers.json` (`src/components/logos.tsx`) + fichier `public/logos/<T>.png` ; reglage par emplacement en base (logotheque).
8. Visibilite : clean-all (ci-dessus). Sitemap et recherche lisent clean-all.

### 2.2 Chaine de mise en ligne
1. Modifier, puis `npx tsc --noEmit`.
2. `bash scripts/version-bump.sh "resume"`.
3. `git add <chemins precis>`, commit, `git push origin staging`.
4. `nohup bash scripts/alias-niveau2-attente.sh > /tmp/alias.log 2>&1 &` : attend le build Vercel du HEAD puis pose l alias niveau2 (environ 22 min, 30 min maximum). Jeton VERCEL_TOKEN de .env.local ; jamais `npx vercel` sans `--token`. Annuler les builds intermediaires.
5. Verifier : `curl -s "https://mettrik-niveau2.vercel.app/<page>?audit_token=$T" -H "Cookie: mettrik:simulate-as=max"` ; controler le title (gate de visibilite) et la valeur attendue.
6. Lien + tableau au proprietaire.
- n0 : `bash scripts/go-n0.sh` sur « go n0 » seulement (`git stash` des fichiers non commites pendant la verification, puis `git stash pop`).

### 2.3 Automatismes en place
- 23h00, service launchd `ai.mettrik.earnings-refresh` (`scripts/earnings-refresh.sh`, sans modele) : veille des documents US et EU, transcripts, calendrier, doublons KPI (`scan-kpi-doublons.py --apply`), declenchement de l alerte.
- 23h40, tache planifiee Claude `maj-societes-nuit` (`~/.claude/scheduled-tasks/`) : `earnings-refresh.py --apply` (nouveaux trimestres), etape 4bis positionnement IA, syntheses.
- Crons Vercel : `/api/cron/alertes-maj` 06:05 UTC (etat stocke en base `desk_page_content` alertes_maj / etat, email si le rouge change) ; `/api/cron/veille-indices` 06:35 UTC (email aux entrees et sorties).
- GitHub Actions `daily-earnings-refresh.yml` 6h UTC : rangs, dates yfinance, rafraichissement top 307.
- crontab : daily-doc-watcher 4h, fr-doc-watcher 4h30, loop_wakeup toutes les 30 min ; lignes de traduction commentees.

### 2.4 Sources gratuites (detail : memoire reference_mettrik_sources_gratuites.md)
- Transcripts : stockanalysis.com toutes places (`scripts/stockanalysis-transcripts.py`, User-Agent Chrome sinon 403) ; MarketBeat pour les US (`scripts/marketbeat-transcripts.py`). Syntheses : `scripts/summaries-refresh.py` (moteur local `claude -p`, sans cle API) ; `scripts/summaries-from-er.py` quand il n y a que le communique.
- Calendrier : MarketBeat US (`marketbeat-calendar.py`), stockanalysis EU (`stockanalysis-calendar.py`), fusion `build-earnings-calendar.py --sans-fmp` (672 societes sur 673).
- Documents : EDGAR (User-Agent obligatoire) ; data-lake/<T>/ ; sites IR (`src/data/ir-directory.json`).
- Indices : Wikipedia + portail Nasdaq (api.nasdaq.com) via `scripts/indices-wikipedia.py` -> `src/data/indices-composition.json`.
- Capitalisations et dates : yfinance. Logos : Wikipedia.
- FMP : devenu facultatif (segments geographiques, verif-release) ; ses endpoints EU et transcripts sont fermes par l abonnement.

## 3. Fait depuis le 07/09

Liens : prefixer par https://mettrik-niveau2.vercel.app ; les pages /sandbox demandent `?audit_token=` ou un compte admin.

### 07/09 (v2026.09.07.7 a .25)
- Les 11 chantiers A a K de la version precedente sont faits : accueil (« des milliers d actions », « jusqu a 20 ans », encart abonnement avec halo, carte des pays sous KPI INDICATEUR, bloc populaires archive), onglet Arbitrages KPI retire, Alphabet compte une fois dans les rangs, dates de resultats passees masquees, icone i collee au nom, stories anterieures a 2025 ecartees, accents, unites Materiaux (`docs/cahier/unites-materiaux.md`), TAM 666/666 arbitre et pose.
- Publication du Cahier : 553 KPI nouveaux + 50 allonges sur 640 stes, 1 454 textes reecrits.
- Moat : bandeau niveau + tendance sur 664 stes. Logos : 147 sur pastille blanche, /sandbox/logos-arbitrage.
- Corrections : CA.PA (KPI Compagnie des Alpes retires), HD et ULTA re-datees, PAH3.DE stories inventees retirees, VMC hero. Bourses : 18 pays (/sandbox/bourses).

### 08/09
- Relais `docs/cahier/HANDOFF-COMPTE-3.md` ; ses chantiers faits : 26 stes robots (19 validees, 7 restaurees), « Prochains resultats » en blanc, tendance moat Mettrik (/sandbox/moat), ouverture des fiches (squelette + prechauffage des 120 plus grosses), unites Materiaux et Energie, TAM sous « Comprendre », Qnity.
- Pollution IVR : 8 fiches de l univers depolluees, 56 hors univers en quarantaine. NFLX 2025. TAM non comparables retires. Clients 666/666.

### 09/09 (v2026.09.09.1 a .7)
- Tableau KPI en deux groupes (avances en clair, standard depliable) ; floutage par bloc (kpis, kpis_standard, moat, clients, tam, unites, prochains_resultats).
- 499 stories en doublon des KPI IC retirees ; classement des KPI standard fiabilise ; accents sur 487 intitules ; Hermes 8 KPI sur 10 ans.
- Concentration clients top 6-10 sur 661 stes (estimations marquees ≈) ; /sandbox/synchro ; SpaceX (SPCX) logo, dates, rangs ; releve des unites (1 217 entrees).
- « Disponible bientot » sans delai ; override hero purge des fiches ; concept terminal (anti-these MSFT).

### 10/09
- Produit phare : 78 series posees (53 en hero), /sandbox/produit-phare (exceptions), kit de mission IA externe `docs/cahier/produit-phare/externe/`.
- Graphes : chip CAGR a droite du titre ; calculette d unites ; rail de navigation fixe ; bascule 3D retiree.

### 11/09
- Comparer remis sur toutes les fiches (/api/compare, `src/data/compare-index.json`, trimestres calendaires, devises).
- Unites corrigees a la source (QCOM, CL, LMT) ; /sandbox/unites-source (archivee).

### 12/09
- /sandbox/kpi-definitions (KPI total, KPI IC total, types de KPI, unites par secteur) ; accueil : KPI totaux par industrie (`scripts/compte-kpi-industries.ts`).
- Apple et Netflix en vitrine ; telemetrie de provenance (/sandbox/telemetrie).
- Connexion : hCaptcha (fenetre + action serveur), changement de mot de passe avec captcha ; comptes admin sandbox ecrits dans le code.
- Graphe 3 ans ou Max (Max reserve au forfait Max) ; bouton Mes listes ; calculette 45 unites US.

### 13/09 (v2026.09.13.1 a .18 ; detail : .conv-state/chantier-13sept.md)
- Favoris (etoile, Mes favoris, story en favori) ; page Compte avec Factures (/sandbox/factures-apercu) ; 67 doublons annuels + 13 doublons retires (detecteur nocturne).
- Referentiel KPI par industrie GICS : 74 industries, 1 044 KPI (`docs/cahier/kpi-referentiel-gics-74.json`, /sandbox/kpi-definitions, /sandbox/gics).
- Comptes de reglage en acces Max ; /sandbox/emails (12 modeles) ; emails clients bloques sauf @mettrik.ai.
- Valeurs approximatives 100+ / ≈100 : 134 corrigees, 11 en doute (/sandbox/valeurs-approximatives).
- Systeme de mise a jour : calendrier passe et futur, regles J+3, etat vert / orange / rouge, alerte rouge (/sandbox/mises-a-jour).
- Produit phare : 53 series externes + lots Claude 1 a 6 integres, registre 230 stes.
- Risques GOOGL et META ; titre « Mettrik AI · Les chiffres qui font bouger chaque action » ; sources TAM masquees ; anti-these en bas de fiche ; IDE cree dans Stripe.
- Univers 671 : RDDT, FERG, FLEX, FDXF puis BE (entree au S&P 500 le 21/09) ; veille des indices ; /sandbox/indices ; SpaceX completee depuis le prospectus ; audit bloc par bloc de 28 stes recentes (liste : commit fada7e3b5c).
- Transcripts : 177 US (MarketBeat), 109 europeennes equipees (stockanalysis), 670 fiches sur 673 avec transcript ; calendrier 672/673 sans FMP ; captcha a usage unique ; traductions arretees.

### 14/09
- Fiche Reddit reparee (une clientele diffuse sans premier client faisait planter le rendu), v2026.09.14.1 : /rddt.

## 4. En cours et a faire

### A. Syntheses des transcripts europeens
- Etat : 105 transcripts europeens sans synthese au 14/09 00h (107 annoncees le 13/09). `/tmp/synth-eu.sh` (PID 17787 au 14/09 00h) attend que le moteur local `claude -p` sorte de sa limite hebdomadaire (remise a zero vers 1h, heure de Zurich), puis traite par lots de 8. Journal `/tmp/synth-eu.log` (seule ligne : attente, 23:28).
- En parallele, une seconde boucle (fenetre 01:05 a 12:00) attend pour 83 syntheses en retard (alerte rouge) : liste `$TMPDIR/synth_red.txt`, journal `.conv-state/maj-nuit-syntheses-<AAAAMMJJ>.log`.
- Prochaine action : `ps aux | grep synth-eu` et `tail /tmp/synth-eu.log`. Si le processus est mort, relancer `bash /tmp/synth-eu.sh` ou `nice -n 10 python3 scripts/summaries-refresh.py --tickers <lot de 8>` (liste = transcripts .pa .de .as .sw sans fichier dans transcript-summaries). Ne pas ajouter une troisieme boucle (RAM). Puis commit des syntheses, version-bump, alias, verification sur 3 fiches.
- Decision attendue : aucune.

### B. Textes des KPI (champ `signal`) a 150 caracteres
- Etat : 9 400 signaux sur 30 141 depassent 150 caracteres dans kpis-haut (mesure du 14/09 ; 9 351 sur 29 887 le 13/09).
- Regle : 150 caracteres maximum ; une explication pour l investisseur (pourquoi le chiffre compte, niveau, tendance) plutot qu une description ; sans URL ni mention d allongement ; francais accentue ; prendre les meilleurs textes existants comme modele.
- Prochaine action : script qui liste les signaux trop longs par ticker ; reecriture par lots (3 agents maximum) ; controle automatique (longueur, pas d URL, aucun chiffre absent de l history) ; montrer 10 exemples avant / apres au proprietaire avant de generaliser ; application, version-bump, alias, verification NVDA, NFLX, NEM, SMCI.
- Decision attendue : validation de l echantillon (recommandee vu le volume).

### C. Completion serieuse des societes ajoutees (BE, FERG, FLEX, FDXF, RDDT, VMRK)
- Etat (`verif-societe.py`, 14/09) : tous les artefacts presents ; absentes des listes curatees `carte-pays-kpis.json` et `home-wow-kpis.json` (normal). KPI sur 5 ans : BE 12, FERG 18, FLEX 15, FDXF 14, RDDT 8, VMRK 2. VMRK : gics_code vide, pas de repartition du CA, hero herite d AvalonBay (`AVB_apartment_homes_owned`, historique fusionne). BE : `src/data/v2-pipeline/be.json` modifie et non commite (1 ligne, 14/09 00:58) : verifier avant d ecraser.
- Prochaine action : pour chacune, bloc par bloc contre les sources (10-K, prospectus, communiques), selon la check-list : KPI IC >= 8 sur 5 ans quand publies, stories, synthese, risques, gouvernance, repartition, TAM, moat, clients, anti-these, rangs, dates `_maj` ; 3 valeurs sondees par societe ; lien de chaque fiche.
- Decision attendue : aucune (signaler les trous impossibles a combler).

### D. 16 anti-theses europeennes manquantes
- Etat : AGN.AS, AIR.DE, DIM.PA, DPW.DE, EDEN.PA, HEN.DE, JDEP.AS, LI.PA, P911.DE, PAH3.DE, PUM.DE, RAND.AS, RXL.PA, SGSN.SW, SOON.SW, VOW.DE (seules societes de l univers sans `src/data/att/<t>.json`).
- Prochaine action : `.conv-state/ATT-PROCEDURE.md`, 3 agents maximum, sources IR du data-lake, 3 faits sondes par lot ; commit, version-bump, alias, liens.
- Decision attendue : JDEP.AS est radiee (reste en ligne selon la regle des sorties) : faire son anti-these ou non.

### E. Arbitrages produit phare
- Etat : 50 exceptions (35 hesitations, 15 sans produit) a cocher sur /sandbox/produit-phare ; choix stockes en base (`lireChoixPhare`, `src/lib/produit-phare.ts`). 108 stes sans produit identifie ou sans identification (`.conv-state/phare-reste.json`) ; 63 series indisponibles en externe ; registre 230 stes dont 101 integrees depuis l externe.
- Prochaine action : lire les choix deja faits en base, appliquer ceux-ci (`scripts/phare-integrer-externe.py`, `docs/cahier/produit-phare/externe/MODE-D-EMPLOI.md`), rappeler au proprietaire les lignes restantes.
- Decision attendue : cocher les exceptions restantes.

### F. 11 valeurs approximatives a trancher
- Etat : entrees de type `doute` dans `src/data/valeurs-approximatives.json`, visibles sur /sandbox/valeurs-approximatives (avertissement si les decisions sont verrouillees). Choix proposes : garder le premier nombre, decouper en deux KPI, supprimer le KPI.
- Prochaine action : appliquer les choix des qu ils sont faits (kpis-haut + fiche), version-bump, alias, liens.
- Decision attendue : proprietaire, ligne par ligne.

### G. Go n0
- Etat : pas de « go n0 » depuis le 12/09 ; mettrik.ai reste en maintenance ; tout le travail depuis n est que sur niveau2.
- Prochaine action : rien sans « go n0 ». Au go : `bash scripts/go-n0.sh`, verification curl sur mettrik.ai, sans toucher aux interrupteurs.
- Decision attendue : go n0.

### H. Stripe : IDE par defaut sur les factures
- Etat : IDE CHE-281.919.422 cree dans Stripe le 13/09 ; l API refuse de l activer par defaut sur les factures. Pas de TVA : rien d autre a faire.
- Action du proprietaire : Stripe > Parametres > Factures > Numero d identification fiscale, cocher par defaut.

### I. Mot de passe du compte proprietaire
- Etat : il a ete colle dans une conversation. A changer par le proprietaire ; ne jamais le reutiliser ni le recopier. Le rappeler en debut de session jusqu a confirmation.

### J. Alerte rouge des mises a jour
- Etat : email du 13/09 = 494 blocs rouges sur 384 stes. L etat est calcule en ligne et stocke en base (`desk_page_content`, alertes_maj / etat). CLAUDE.md section 8 cite `src/data/alertes-maj.json`, qui n existe pas.
- Prochaine action : en debut de session, `python3 scripts/alerte-mises-a-jour.py` (sans `--email`) ou /sandbox/mises-a-jour ; corriger les blocs rouges par ordre de retard ; ecrire `_maj_<bloc>`.

### K. Autres points ouverts
- Societes europeennes des vagues d aout : pas encore reauditees bloc par bloc (les 28 US recentes et SPCX l ont ete le 13/09).
- Faux email de veille Nasdaq du 13/09 (Nasdaq lu vide avant le garde-fou) : a ignorer, le garde-fou est en place.
- Actions de lancement du proprietaire (Stripe live, Resend, SMTP Supabase, test reel ; memoire project_mettrik_lancement.md) : etat non verifie dans ce relais.

## 5. Prompt a coller dans l autre compte

```
Tu reprends le travail Mettrik dans ~/spx-app. Fais `git pull origin staging`, puis lis INTEGRALEMENT docs/cahier/HANDOFF-COMPTE-2.md (regles section 0, glossaire, couches de donnees, fait depuis le 07/09, a faire A a K). Premier message : l etat de l alerte rouge (python3 scripts/alerte-mises-a-jour.py), l etat des deux boucles de syntheses (section 4.A), la liste des decisions que j ai a prendre (4.C a 4.I) et l ordre dans lequel tu vas traiter le reste, avec une ETA pour chaque point. Puis traite un point a la fois, en entier : version-bump, push staging, alias niveau2, verification curl avec audit_token, lien et tableau court. Maximum 3 agents, surveille la RAM. Aucune traduction. Aucun email aux clients. Jamais mettrik.ai sans mon « go n0 », jamais les interrupteurs maintenance ni tarifs, jamais committer wkl.as.json, jamais git add -A. Gros doute : demande-moi. Conflit de regles : signale-le EN CAPITALES. Reponses courtes en francais, sans tiret long, finir par TERMINE.
```
