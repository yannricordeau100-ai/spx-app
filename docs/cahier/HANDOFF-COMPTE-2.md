# Passage de relais complet (07/09/2026 01:45) : a lire en entier avant toute action

Ce fichier donne a la session qui reprend TOUT ce qu il faut : contexte, regles du proprietaire, etat exact, et la liste des 11 chantiers a executer dans l ordre (du plus rapide au plus long), sans en oublier un seul. Chaque chantier a un critere de « fait ». Toujours `git pull origin staging` avant de commencer et `git push` a chaque etape.

## 0. Regles permanentes du proprietaire (non negociables)

- Reponses courtes, en francais, sans tiret long, sans blabla ; ETA pour chaque tache ; ne pas ecrire ce qui n est pas necessaire ; tableau recapitulatif quand un chantier est termine ; « TERMINE » a la fin.
- Verifier en reel (curl niveau2 + vue connectee) avant de dire « fait ». Toujours donner les liens des pages creees ou modifiees.
- Une societe citee = correction sur tout l univers (666 societes), sauf mention « seulement pour X ».
- Numero de version a chaque push : `bash scripts/version-bump.sh "resume"` puis commit + push, puis `nohup bash scripts/alias-niveau2-attente.sh > /tmp/alias.log 2>&1 &` (pose l alias mettrik-niveau2.vercel.app sur le build du HEAD, ~15 min ; jeton VERCEL_TOKEN de .env.local, le jeton CLI est mort : jamais `npx vercel` sans `--token`).
- mettrik.ai (n0) : uniquement sur « go n0 » explicite, via `bash scripts/go-n0.sh` (mettre de cote les fichiers non commites avec `git stash` pendant la verification, puis `git stash pop`). Ne JAMAIS toucher l interrupteur de maintenance ni l interrupteur tarifs (page /sandbox/lancement) ; ne jamais committer `src/data/companies/wkl.as.json`.
- Les 26 fichiers `.batches-drafts-safe/kpis-haut/*.json` et les `src/data/v2-pipeline/*.json` modifies localement viennent des robots (rafraichissement) : ne pas y toucher, ne pas les committer.
- Agents de recherche : modele Opus, 8 en parallele maximum, jamais le navigateur integre (mcp__Claude_Browser__*) ni Claude in Chrome dans un agent. Orchestration en Fable.
- CLAUDE IN CHROME : L EXTENSION EST RELIEE AU COMPTE CLAUDE DU PROPRIETAIRE UTILISE PAR L AUTRE SESSION. SI CETTE SESSION EN A BESOIN, DEMANDER AU PROPRIETAIRE, DEUX FOIS ET EN MAJUSCULES, DE CHANGER LE COMPTE CLAUDE CONNECTE DANS L EXTENSION. Le privilegier ensuite pour toute tache passant par un site (plus rapide).
- Jamais de valeur inventee ; le 10-K / 10-Q fait foi (ecart important = corriger, mineur = tolerer). Pas de prenom ni de tiret long dans les fichiers du Cahier (`_valide.py` le refuse).
- Verification en vue connectee : compte de test `audit.claude@mettrik-internal.test` (mot de passe regenerable via l API admin Supabase, voir memoire) ou cookie `mettrik:simulate-as=max` en curl. Fichiers en minuscules pour tout ce que lit le serveur (Vercel distingue la casse).
- RAM du Mac : surveiller `memory_pressure` ; le proprietaire a du demander un arret d urgence le 06/09 (serveurs de dev en double). Un seul serveur de dev a la fois ; les agents tournent dans le cloud.

## 1. Ou en est le travail (etat exact au 07/09 01:45)

- Donnees KPI (docs/cahier/donnees) : 666/666 societes, 11 secteurs contre-verifies. Pose des KPI trouves et allonges : script `scripts/cahier-pose.py TICKER [--autres]` (nouveau = pastille violette, allonge = ambre avec points/barres ambre, autre = bleu), demonstration en ligne sur NVDA, NFLX, NEM, DD, SMCI, SLHN.SW, KDP (v2026.09.07.1). Generalisation a tout l univers : sur GO du proprietaire seulement.
- Tri par capitalisation (recherche + grille d accueil) et rangs (mondial, USA, secteur, sous-industrie) : en ligne (v2026.09.07.2), recalcules chaque jour par `scripts/ranks-univers.py` dans `.github/workflows/daily-earnings-refresh.yml` (cron 6h UTC, yfinance, zero jeton). 4 societes sans capitalisation yfinance : JDEP.AS (radiee), ML.PA, MT.PA, ROG.SW.
- TAM : atelier `/sandbox/tam` en ligne (candidats du Cahier `docs/cahier/tam/<T>.json`, cases a cocher, 2 candidats max, choix en base page tam / arbitrages). 89 societes faites (technologie sauf lots 45-18 et 45-19), 119 lots restants. Pose : `python3 scripts/tam-pose.py` puis commit des `src/data/v2-pipeline-enrich/<t>.tam.json` ; le bloc « Position marche » (format V1.0) est deja code dans company-view et s affiche des que market_positions existe.
- n0 (mettrik.ai) : build 77b15e96 du 06/09 13h ; site refermes (maintenance on) ; page tarifs en maintenance (interrupteur en base tarifs = maintenance, v.15+ necessaire sur n0 pour que le proxy l applique : pas encore deploye sur n0).
- Alias niveau2 : la derniere version poussee est v2026.09.07.6 (HEAD) ; l alias n a pas ete pose (script arrete a la demande). Premiere action : `nohup bash scripts/alias-niveau2-attente.sh > /tmp/alias.log 2>&1 &`.
- Copie locale V1.0 (5 societes, avril 2026) : dossier `~/spx-v1-0` (worktree git), serveur `npx next dev -p 3005` (peut tourner encore). Ne pas y toucher sauf demande.

## 2. Les 11 chantiers, dans l ordre (du plus rapide au plus long)

Regle : un chantier a la fois, TAM en tache de fond en permanence (8 agents). Apres chaque chantier : version-bump, push, alias, verification en ligne, lien au proprietaire, puis chantier suivant. Ne jamais sauter un point ; si un point est bloque, le dire et passer au suivant en le gardant dans la liste.

### A. Bloc « Voir ce que les chiffres ne disent pas seuls » (accueil) : contenu (ETA 20 min)
Point 8 du proprietaire, partie contenu : remplacer « 666 societes » par « des milliers d actions » et « 10 ans d historique » par « jusqu a 20 ans d historique » (chercher la chaine dans src/components/home-*.tsx et src/lib/i18n/dictionary.ts, FR et EN). Le nouveau design est en H.

### B. Onglet « Arbitrages KPI » de /sandbox/gics (ETA 15 min)
Point 2 : les 17 points ont ete arbitres le 06/09 (fichier docs/cahier/kpi/_RELECTURE-2026-09-05.md, tous « Arbitre le 06/09/2026 »). L onglet n a plus d utilite : le retirer de `src/components/sandbox/gics-atelier.tsx` (onglet « relecture ») en gardant le fichier de relecture dans le Cahier. Dire au proprietaire que c est retire parce que traite.

### C. Barre « Rang » : verification et doublon Alphabet (ETA 20 min)
Point 1 : le fichier `src/data/market-cap-order.json` date du 07/09 00:23 (yfinance). Il donne NVDA 5 563, AAPL 4 670, GOOGL 4 139, GOOG 4 101, MSFT 3 711 Mds $ : Apple est 2e, MAIS Alphabet est compte deux fois (GOOGL et GOOG = meme societe). Corriger `scripts/ranks-univers.py` pour ne compter Alphabet qu une fois dans les rangs (GOOG = meme rang que GOOGL, exclu de l ordre de capitalisation) et verifier de meme les autres doubles classes (BRK-B, FOX/FOXA, NWS/NWSA, etc.). Relancer le script, verifier que le rang mondial d Apple est #2 et le dire au proprietaire avec les 5 premiers.

### D. Dates de resultats attendus fausses (ETA 45 min)
Point 7 : NVDA affiche « resultats attendus le 26 aout 2026 » alors que la date est passee (source : `next_earnings_date` de src/data/companies/nvda.json, alimente par `scripts/earnings-dates-yfinance.py` dans le cron quotidien). Corriger pour TOUT l univers : (1) une date attendue anterieure a aujourd hui ne doit jamais etre affichee (masquer ou passer a la date suivante), (2) trouver pourquoi le cron ne l a pas mise a jour (yfinance calendar vide ? limite --limit 640 ? casse du fichier ?), corriger la cause, relancer sur les 666, (3) compter et dire combien de societes avaient une date passee. Le proprietaire attend de l efficacite, pas d explications longues.

### E. Position du « i » dans le tableau Indicateurs cles (ETA 30 min)
Point 0 : quand le nom de l indicateur tient sur 2 lignes, l icone « i » est rejetee tout a droite de la colonne ; elle doit rester collee au texte, meme style et meme placement qu avec 1 ligne. Fichier `src/components/kpi-row.tsx` (bloc `data-blur-part="indicateur"`, `flex items-center gap-2.5` avec le nom en `min-w-0` puis l InfoTooltip). Verifier en vue connectee sur une fiche avec des noms longs (ex. NEM, NFLX) et joindre les liens.

### F. Retirer « Actions les plus populaires » de l accueil (ETA 30 min) puis carte des pays (point 9, ETA 2 h)
Point 4 : archiver (ne pas supprimer du depot) la partie et la page « actions les plus populaires » : composants `src/components/home-popular-block.tsx` (et la page dediee si elle existe, chercher « populaires » dans src/app), retirer l appel dans `src/components/home-view.tsx`, garder les fichiers sous `src/components/_archive/` ou un commentaire d archivage.
Point 9 : GARDER la carte / graphique des pays qui est aujourd hui dans ce bloc ; la placer sous le bloc « KPI = indicateur » de l accueil ; au clic sur une region, afficher dessous les mini-blocs de societes (meme style qu aujourd hui), 10 d un coup, puis un bouton « montre-moi les 10 suivants » une seule fois (20 societes maximum par pays, tri par capitalisation decroissante via src/data/market-cap-order.json).

### G. Stories et textes des KPI organiques (ETA 3 h, agents)
Point 5, dans cet ordre :
1. Regle stricte : un KPI en story doit dater d un an au plus. Supprimer de la couche kpis-haut (`.batches-drafts-safe/kpis-haut/<T>.json`) et des fiches tout KPI story dont la derniere donnee est anterieure a 2025 (ex. NVDA « portefeuille de conceptions gagnees automobile », 2024, pose depuis le Cahier). Compter et dire combien ont ete retires (script, pas a la main).
2. NFLX : « revenu mensuel moyen par abonne » s arrete en 2024 ; trouver la valeur 2025 (croiser revenu streaming 2025 et abonnes moyens 2025 dans le 10-K 2025 si Netflix ne la publie plus directement), la poser, citer le calcul.
3. Textes (champ `signal`) de TOUS les KPI organiques poses depuis le Cahier (nouveaux, allonges, autres, marques `_cahier`) : les recrire entierement, 150 caracteres environ (la logique prime sur le compte), sans URL, sans « Allonge le 05/09 », en apportant la plus-value investisseur (niveau, tendance, sens), en prenant pour reference les textes des KPI existants de la fiche. Aller chercher une info manquante seulement si vraiment necessaire. Exemple a corriger : SMCI « stocks en jours » (texte actuel avec liens), NEM « reserves et ressources d or » (texte coupe).
4. Supprimer la mention « (serie annuelle) » de tous les titres de KPI, sans exception (script sur `.batches-drafts-safe/kpis-haut/*.json`, champs name_fr / name_en).
5. Verifier en vue connectee NVDA, NFLX, NEM, SMCI et donner les liens.

### H. Accents des KPI organiques (ETA 1 h, agent)
Point 6 : les fichiers du Cahier et les KPI poses sont ecrits sans accents (contrainte du validateur d origine). Sur les fiches (kpis-haut, champs name_fr, signal, explanation des KPI marques `_cahier`), remettre les accents francais corrects (à, é, è, ê, ç...) par un passage d agent ou un script de correction verifie ; controler qu aucun mot n est casse. Ne pas toucher aux fichiers du Cahier eux-memes (le validateur est indifferent aux accents, mais le texte affiche doit etre accentue).

### I. Bloc « Voir ce que les chiffres ne disent pas seuls » : design 2026 (ETA 1 h 30)
Point 8, partie design : refaire le bloc (accueil) dans un style 2026 : plus un bloc de texte aligne a gauche ; composition soignee, legere surbrillance (halo) sur le point d appel a l action, coherence avec l identite Mettrik (fond sombre, violet / cyan). Montrer une capture ou le lien avant de considerer fait.

### J. Unites du secteur Materiaux (ETA 1 h 30, agent)
Point 3 : lister TOUTES les unites utilisees par les KPI des societes du secteur Materiaux (code GICS 15, tickers dans docs/cahier/donnees/_lots/15-*.json, unites dans src/data/companies/<t>.json et .batches-drafts-safe/kpis-haut/<T>.json) : pour chacune, l acronyme affiche, le nom complet, la signification, et un ordre de grandeur compare a un objet du quotidien que tout le monde visualise (taille, poids, volume, quantite). Livrable : `docs/cahier/unites-materiaux.md` (tableau) + resume au proprietaire.

### K. TAM (fond de tache permanent, ETA global ~6 h)
Boucle : `python3 docs/cahier/tam/_prochains.py --prochains 8` ; lancer 8 agents Opus avec le prompt de `docs/cahier/tam/_PROMPT-AGENT.md` (remplacer <LOT>) ; a chaque retour `python3 docs/cahier/tam/_valide.py <tickers>` ; pousser tous les ~40 societes (version-bump + alias) pour alimenter l atelier /sandbox/tam ; donner un ETA au proprietaire de temps en temps. Quand le proprietaire a coche des societes : `python3 scripts/tam-pose.py` puis commit des tam.json, push, alias, lien de la fiche.

## 3. Prompt a coller dans l autre compte

```
Tu reprends le travail Mettrik dans ~/spx-app. Commence par `git pull origin staging`, puis lis INTEGRALEMENT `docs/cahier/HANDOFF-COMPTE-2.md` (regles, etat, et les 11 chantiers A a K). Execute les chantiers dans l ordre A, B, C, D, E, F, G, H, I, J, un a la fois, avec K (TAM, 8 agents Opus) en tache de fond permanente. Pour chaque chantier : fais-le en entier, version-bump + push + alias niveau2, verifie en ligne (vue connectee), donne le lien et un tableau recapitulatif court, puis passe au suivant. Aucun point ne doit etre oublie : si un point est bloque, dis-le et garde-le en liste. Reponses courtes en francais, sans tiret long, ETA a chaque tache, pas de blabla. Jamais le navigateur integre pour les agents ; si tu as besoin de Claude in Chrome, demande-moi DEUX FOIS EN MAJUSCULES de changer le compte connecte. Jamais mettrik.ai sans mon « go n0 ». Jamais l interrupteur maintenance ni tarifs. Jamais committer src/data/companies/wkl.as.json ni les fichiers kpis-haut / v2-pipeline modifies par les robots. Commence maintenant par relancer l alias niveau2 (`nohup bash scripts/alias-niveau2-attente.sh > /tmp/alias.log 2>&1 &`), puis lance les 8 agents TAM, puis le chantier A.
```
