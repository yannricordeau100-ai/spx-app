# HANDOFF COMPTE 3 : relais complet du 08/09/2026 (fin de session compte 2)

Document commun aux comptes. L autre compte doit le lire INTEGRALEMENT avant d agir.
Regle de lecture : quand le proprietaire ecrit « continue X », X est un des chantiers
ci-dessous ; tout ce qu il faut savoir est ici. Les fichiers d etat detailles sont dans
`.conv-state/verif-prompts-07sept.md` (checklist des prompts du 07/09, a jour) et dans
les dossiers `docs/cahier/*`.

## 0. Regles permanentes (rappel, toutes actives)
- Reponses courtes en francais, sans tiret long, ETA a chaque tache, finir par TERMINE.
- Chaine obligatoire : edit -> `npx tsc --noEmit` -> commit -> push staging ->
  `nohup bash scripts/alias-niveau2-attente.sh > /tmp/alias.log 2>&1 &` (a relancer apres
  CHAQUE push, il vise le HEAD du lancement) -> attendre « NIVEAU 2 A JOUR » ->
  verifier en ligne EN VUE CONNECTEE avant de dire « fait ».
- VERSION BUMP OBLIGATOIRE a chaque push de DONNEES : `bash scripts/version-bump.sh "resume"`
  puis commit de `src/lib/version.ts` + `CHANGELOG.md`. Sinon le cache partage des fiches
  (`unstable_cache`, 6 h, cle = VERSION dans `src/lib/company-core/load-company.ts`) sert
  les ANCIENNES fiches apres deploiement (cas vu le 08/09 : CEO Puma perime pendant 1 h).
- Verification connectee : `t=$(grep -o '^VISUAL_AUDIT_TOKEN=.*' .env.local | cut -d= -f2)`
  puis `https://mettrik-niveau2.vercel.app/sandbox/v1-9-5/<ticker>?audit_token=$t` et les
  pages `/sandbox/...?audit_token=$t`. Jamais en anonyme.
- Ce que la prod LIT vraiment pour une fiche : `src/data/v2-pipeline/<t>.json` (socle) +
  couches `src/data/v2-pipeline-enrich/<t>.*.json` (description, ranks, tam, i18n...) via
  `src/lib/company-core/load-company.ts`. `src/data/companies/` N EST PAS LU au runtime
  (instantane perime) MAIS il alimente `scripts/ranks-univers.py` (rangs nocturnes) : toute
  correction d identite doit etre faite dans v2-pipeline ET companies (git add -f, dossier
  gitignore). Regle d or : une correction sur 1 ste = chercher le meme defaut sur les 666.
- Interdits : mettrik.ai (n0) sans « go n0 » ; interrupteur maintenance ; tarifs ; navigateur
  integre pour les AGENTS (moi seul peux l utiliser) ; valeur inventee (10-K fait foi) ;
  tiret long ; nom de personne dans le Cahier ; committer `src/data/companies/wkl.as.json`.
- Tout lien destine au proprietaire doit exister comme carte dans `/sandbox` (page
  `src/app/sandbox/page.tsx`, la recherche sandbox indexe automatiquement les cartes).
- Agents : Opus par defaut ; en cas de « session limit » 429 basculer Sonnet et sonder 3
  valeurs contre les sources avant d appliquer. Jamais s arreter sur une limite.
- Pas de questionnaire bloquant : decider seul, lister les decisions avec options A/B.
- RAM : pas de serveur dev sauf controle visuel bref puis `pkill -f "next dev"`.

## 1. Etat des chantiers au 08/09 (tout ce qui suit est EN LIGNE et verifie)
| Chantier | Etat | Ou |
|---|---|---|
| TAM 666/666 (recherche, arbitrage delegue, pose) | termine, 0 cas particulier | /sandbox/tam, docs/cahier/tam, base desk_page_content tam/arbitrages |
| TAM comparabilite | 10 blocs non comparables retires (AAPL Services, ARM, MCD, HLT, UBER c1, TTD, MELI c1, PRX c1, ERIE, AC.PA) ; dominances reelles conservees (TSM, VRTX, ISRG, PFE) | rapport scratchpad perdu a la fermeture : re-auditer si besoin avec le meme critere |
| Concentration clients 666/666 | termine (top 1-3 partout, top 6-10 MANQUANT sur 608 stes, voir chantier D) | /sandbox/clients, docs/cahier/clients |
| Bourses mondiales 18 pays | termine, valide par le proprietaire | /sandbox/bourses, docs/cahier/bourses |
| Services Premium/Max | page SUPPRIMEE le 08/09 (le proprietaire a decide seul de ce qu il integre, ne plus en parler) ; benchmark conserve dans docs/cahier/services-max-preuves.json | |
| Logos douteux | 6 arbitres et appliques, valide | public/logos |
| Constellation pays accueil | valide | home-carte-pays.tsx |
| Prochains resultats deplace au bandeau prix | en ligne (voir chantier B pour la couleur) | stock-price-block.tsx COL 0, freshness-indicator.tsx compact |
| MOAT bandeau + toggle | en ligne, 34 textes generiques vides, fleches non verifiables sur ~150 stes | /sandbox/moat, src/data/moat-univers.json, docs/cahier/moat.json |
| NFLX 2025 | 325 M abonnes (8-K T4 2025, exhibit 99.1 verifie), 2 scories retirees, sur v2-pipeline ET companies | src/data/v2-pipeline/nflx.json |
| Depollution IVR | 8 fiches univers reconstruites (EDEN.PA EN.PA FGR.PA HEI.DE HNR1.DE WKL.AS MBG.DE BESI.AS), rangs recalcules, CEO Puma = Arthur Hoeld, alias HEN.DE DPW.DE AIR.DE VOW.DE | v2-pipeline, v2-pipeline-enrich, page.tsx URL_ALIASES |
| Export PNG : unite EN sous unite FR 2 lignes | corrige dans le code (chart-export.ts), A VERIFIER VISUELLEMENT sur un export reel (AAPL abonnements) | chantier B |
| Publication KPI Cahier 640 stes | en ligne | 26 stes robots exclues (chantier A) |

## 2. Chantiers a faire, dans l ordre demande par le proprietaire le 08/09

### A. 26 stes robots : DECISION PRISE PAR LE PROPRIETAIRE LE 08/09 = option A (valider apres controle puis poser le Cahier). ETA 2-3 h, agents
Plus besoin de toggle de decision : EXECUTER. Etapes : (1) pour chacun des 29 fichiers, `git diff` vs HEAD pour isoler les points ajoutes ; (2) controle `scripts/scan-unit-magnitude*.py` + sondage de 3 valeurs par ste contre le dernier 10-Q / rapport (agents Opus, Sonnet si 429) ; (3) si le controle passe : committer le fichier ; sinon `git checkout -- <fichier>` (revenir a la version d avant) et le dire ; (4) poser le Cahier sur ces stes (`scripts/cahier-pose.py`, verifier avec `scripts/scan-cahier-conformite.py`) ; (5) version-bump, push, alias, verification en ligne de 3 fiches (ex ADI, DIS, LULU) et tableau au proprietaire (validees / restaurees).
Rappel du contexte (pour le tableau) :
Creer `/sandbox/robots` (carte sandbox + page gate audit_token/owner, meme pattern que
`src/app/sandbox/clients/page.tsx`). Contenu, PRECIS :
- Le probleme : 29 fichiers de travail `.batches-drafts-safe/kpis-haut/<T>.json` (ADI ATO
  BBY BN.PA CIEN DIS ETN EXPD FOX G24.DE GIS GNRC GPC HON HOT.DE HPE J LULU MDT MSTR MT.PA
  NCLH NTAP ROG.SW ROST RSG SJM URW.PA VRSK) sont modifies mais NON commites : le robot
  nocturne earnings-refresh (passe du 3 septembre) y a ajoute 1 a 12 points en fin de serie
  (memes KPI, memes titres, seulement des points recents) et a minifie les fichiers. Un
  robot avait deja produit une regression le 28 aout (unites, magnitudes) : les points
  ajoutes n ont pas ete valides, donc ces stes ont ete EXCLUES de la pose des KPI du Cahier
  et n ont pas leurs nouveaux KPI en ligne. `git diff --stat .batches-drafts-safe/kpis-haut/`
  montre 29 fichiers ; comparer avec `git show HEAD:<fichier>` donne les points ajoutes.
- Decisions a proposer, une case par ste ou globale : (A) valider les points du robot apres
  controle (`scripts/scan-unit-magnitude*.py` + sondage de 3 valeurs par ste contre le
  dernier 10-Q/rapport), committer, puis poser le Cahier (`scripts/cahier-pose.py`) ;
  (B) restaurer la version git (`git checkout -- <fichier>`), perdre les points recents,
  poser le Cahier ; (C) cas par cas. Recommandation : A pour les stes ou le controle passe,
  B sinon. Afficher pour chaque ste : nb KPI, nb points ajoutes, resultat du controle.
- Les cases cochees vont en base (desk_page_content, page robots / section decisions,
  route API sur le modele de `src/app/api/sandbox/services-max/route.ts`).

### B. Bandeau prix : couleur du texte « Prochains resultats » (ETA 20 min)
Dans `src/components/freshness-indicator.tsx` (bloc `compact`) : le libelle, la valeur
« T2 2027 J-7 » ET l icone « i » passent en BLANC avec un leger contour noir
(text-shadow ou -webkit-text-stroke fin ; pour l icone InfoTooltip passer color="#fff" et
un drop-shadow noir). Appliquer a toutes les stes (composant unique). Verifier sur une ste
avec date sure et future (ex CASY, COST : `next_earnings_date` dans v2-pipeline).
Meme chantier : verifier VISUELLEMENT l export PNG (bouton telecharger du graph) sur AAPL
« Abonnements payants » : l axe Y doit montrer « Milliards / Abonnes / Billions Subscribers ».

### C. MOAT : tendance / evolution « evaluation Mettrik » (ETA 2 h)
Le proprietaire veut la TENDANCE du moat (passe recent, present, futur proche : fleche
hausse / egale / baisse) telle qu il l a demandee le 07/09, affichee dans `/sandbox/moat`
sur CHAQUE ligne, integree a l existant (pas de nouvel onglet), et clairement marquee
comme notation / evaluation METTRIK, pas Morningstar. Aujourd hui `moat-univers.json`
porte `tendance` deduite des changements de note Morningstar depuis 2023 (stable par
defaut sur ~150 stes sans historique) : il faut une vraie evaluation Mettrik (agents Opus :
lecture des 2 derniers rapports annuels + risques + KPI de la fiche, verdict hausse/stable/
baisse avec 1 phrase de justification, source), stockee dans un champ separe
(`tendance_mettrik`, `justification_mettrik`, `date`), sans toucher aux champs Morningstar.
Puis : maquettes de design d integration sur la page concept (`src/app/concepts`, ajouter
une entree `mockups/moat-tendance.tsx`), 2 ou 3 variantes, donner le lien
`https://mettrik-niveau2.vercel.app/concepts/...` au proprietaire, qui choisit avant pose
sur les fiches (bandeau MoatStrip dans company-profile-card.tsx).

### D. Concentration clients : top 6 a 10 (ETA 3-4 h, agents)
608 stes sur 666 n ont pas de `top10.pct`. Relancer une recherche DEDIEE au top 6-10 :
brief `docs/cahier/clients/_BRIEF.md`, lots `docs/cahier/donnees/_lots/*.json`, prompt
adapte : chercher explicitement « ten largest customers accounted for X % », « top 10
clients », « principaux clients » dans 10-K (Item 1 Customers, Concentration), rapports
annuels, URD, presentations investisseurs, transcripts ; accepter n entre 6 et 10 ; Opus
(Sonnet si 429) avec sondage de 3 valeurs par lot ; `_valide.py` a 0 probleme ; ne pas
ecraser un top10 deja renseigne. Objectif : maximiser la couverture SANS inventer (null
reste acceptable). Puis maquettes de design d integration du bloc clients sur la page
concept (`mockups/clients-concentration.tsx`, 2-3 variantes : top 1-3 + top 6-10 + diffus)
et donner le lien. Pas de pose sur les fiches sans choix du proprietaire.

### E. Lenteur d ouverture des fiches (ETA 2-3 h)
Le clic vers une nouvelle ste (accueil ou barre de recherche d une fiche) est tres long.
Causes connues : page `force-dynamic`, chargement de ~20 couches JSON par fiche, cache
partage 6 h + memoire 10 min (premiere ouverture apres deploiement 1,4 a 9,2 s), payload
HTML de la fiche ~200 Ko (la fiche entiere est serialisee dans la page). Pistes : mesurer
(curl -w time_total sur 5 fiches froides/chaudes), prefetch au survol dans la recherche et
les cartes accueil (`<Link prefetch>` + route de prechauffage), reduire le payload (ne pas
embarquer les champs `_` techniques, archives trimestrielles, notes internes), streaming
des blocs secondaires (risques, gouvernance) en Suspense, pre-chauffage des 100 plus
grosses capis apres deploiement. Livrer un avant/apres chiffre.

### F. Bloc « Comprendre les unites » : Materiaux ET Energie, invisible aujourd hui (ETA 1 h)
`src/components/company-view.tsx` ligne ~1943 : `{company.sector === "Matériaux" && <UnitesMateriaux />}`.
Le proprietaire ne le voit pas : la condition compare un libelle de secteur qui varie
selon les fiches (« Matériaux », « Materials », « Basic Materials »). Corriger : conditionner
sur le code GICS (secteur 15 Materiaux ET 10 Energie) via `docs/cahier/societes-gics.json`
(ou `src/data/...` equivalent charge cote serveur), etendre `docs/cahier/unites-materiaux.md`
+ `src/data/unites-materiaux.json` aux unites de l Energie (barils, boe, mcf, GW, TWh...)
avec ordre de grandeur du quotidien, verifier en ligne sur LIN, NEM, XOM, SLB, puis dire
au proprietaire sur quelles fiches il peut le voir.

### G. TAM : remettre le design d origine, sous « Comprendre la societe » (ETA 3 h)
Le proprietaire veut le style des cartes TAM faites AU DEBUT du projet : composant
`src/components/market-position-card.tsx` (bloc V1 « Position marche · TAM » : revenu du
segment, TAM, PART CAPTEE en % bien visible, source), pas la story actuelle
(`MarketPositionStoryCard` dans kpi-story-card.tsx). Legers ajustements seulement si
absolument necessaires. Placer le bloc TAM juste EN DESSOUS du bloc « Comprendre la
societe » (company-profile-card.tsx), pour toutes les stes ayant un TAM pose
(`src/data/v2-pipeline-enrich/<t>.tam.json`, 656 stes avec au moins un bloc). Regle
absolue : n afficher que les TAM COMPARABLES (meme perimetre que le revenu du segment) ;
part captee affichee = segment_revenue / tam. Si le proprietaire renvoie une image de
reference, la suivre. Verifier sur AAPL (aucun TAM affiche : Services retire, non
comparable), MSFT, TSM, LVMH.

### H. 56 fiches HORS univers polluees par l identite IVR (decision proprietaire)
Tickers : AED.BR AFX.DE ALTR.LS AUTO.L BAKKA.OL COFA.PA CRDA.L DEZ.DE EDV.L ELI.BR ENI.MI
ENT.L ERG.MI FDR.MC FER.MC FR.PA GBLB.BR GEF GET.PA GLPG.AS GMAB.CO HSX.L HWDN.L IBE.MC
JCQ.PA KNEBV.HE MAU.PA MNDI.L MNDI.MI MONC.MI NEX.PA NOS.LS ORNBV.HE OUT1V.HE PGS.OL PHR.LS
PVL.PA RACE.MI RMV.L SCYR.MC SGRO.L SINCH.ST SMIN.L SN.L SOLB.BR SPX.L STMMI.MI SUBC.OL
TEL.OL TEN.MI UBI.PA VEI.OL VIV.PA VLA.PA WCH.DE WRT1V.HE.
DECISION DU PROPRIETAIRE (08/09) : QUARANTAINE, FAIT. Registre `src/data/quarantaine-pollution.json`
(56 tickers + message), champ `_QUARANTAINE_POLLUTION` ecrit dans 153 fichiers (v2-pipeline,
description, companies), garde dans `src/app/sandbox/v1-9-5/[ticker]/page.tsx` : si un de
ces tickers est appele, un ENORME avertissement rouge s affiche EN PREMIER, avant tout rendu.
REGLE PERMANENTE : le jour ou des stes de ces pays sont integrees (n2 ou n0), ces 56 ne
doivent JAMAIS etre fabriquees comme des nouvelles stes classiques : la chaine d integration
(ajout a clean-all-tickers, build, pose Cahier, crons) doit refuser tout ticker present dans
le registre et remonter le message ; le proprietaire decide alors quoi faire. Ne retirer un
ticker du registre que sur son ordre explicite. Le drapeau `_cross_pollution_flagged_at` (20 mai 2026) n avait jamais ete
traite : ajouter un detecteur dans le cron pour qu un drapeau non traite remonte.

### I. Q (Qnity Electronics, scission DuPont 2025) : `kpis Net Sales` value 4.754 en
« M $ » au lieu de 4 754 (description et somme des segments le prouvent). Corriger dans
`src/data/v2-pipeline/q.json` avant la levee du gate IPO (environ 9 mois). ETA 15 min.

### J. Couleurs du graph hero (en attente de GO, ETA 3-4 h)
Clic sur le chiffre ou le texte du hero KPI = fait defiler 8 couleurs (vert, jaune, bleu,
rouge, chacune en clair et fonce) appliquees a la courbe ET aux barres ; preference
globale sauvegardee par compte (Supabase), meme couleur sur toutes les stes et tous les
KPI tant qu elle n est pas changee ; anonyme (META, GOOGL, BKNG gratuites) = couleur de
session non sauvegardee. Reprendre les degrades violet/cyan codes en dur dans
`src/components/charts/curve-chart.tsx` et `bars-chart.tsx`.

### K. En attente du proprietaire (a lui rappeler dans le premier message)
- GO chantier J (couleurs).
- Chantier H : DECIDE le 08/09 = quarantaine (fait, voir H). Chantier A : DECIDE = option A (executer).
- EL.PA : logo officiel EssilorLuxottica pose le 08/09 (public/logos/EL-PA.png, pastille claire), fait.
- « go n0 » pour mettrik.ai.
- Style TAM : image de reference si differente du composant V1.

## 3. Outils et commandes utiles
- Clients : `python3 docs/cahier/clients/_prochains.py --prochains N`,
  `python3 docs/cahier/clients/_valide.py <tickers>`.
- TAM : `docs/cahier/tam/_valide.py`, `_arbitre-apply.py <decisions.json>` (fusion sans
  ecraser), `SSL_CERT_FILE=$(python3 -c "import certifi;print(certifi.where())") python3 scripts/tam-pose.py`,
  puis `git add src/data/v2-pipeline-enrich/*.tam.json`.
- Rangs : `python3 scripts/ranks-univers.py --only T1,T2` (lit src/data/companies !).
- Conformite Cahier : `python3 scripts/scan-cahier-conformite.py`.
- Lecture base desk_page_content : voir `docs/cahier/tam/_arbitre-apply.py` (lire_base).
- Claude in Chrome (pour X) : extension installee et connectee au MEME compte que l app,
  panneau lateral ouvert, Chrome au premier plan avec l onglet X ; puis les outils
  `mcp__claude-in-chrome__*` repondent. Ne l utiliser que soi-meme, jamais un agent.

## 4. Prompt a coller dans l autre compte
```
Tu reprends le travail Mettrik dans ~/spx-app. Commence par `git pull origin staging`, puis lis INTEGRALEMENT `docs/cahier/HANDOFF-COMPTE-3.md` (regles, etat au 08/09, chantiers A a K, decisions deja prises) et `.conv-state/verif-prompts-07sept.md`. TON PREMIER MESSAGE doit contenir, sans rien oublier : (1) le tuto de connexion Claude in Chrome pour X (section 3 du handoff : extension installee, connectee au MEME compte, panneau lateral ouvert, Chrome au premier plan avec l onglet X, puis me dire quand c est pret), (2) la liste COMPLETE de tout ce qui n est pas termine ou pas valide (chantiers A a J avec ETA chacun, points K en attente de moi : GO couleurs graph, go n0, image de reference TAM), (3) le rappel des decisions deja prises que tu vas appliquer sans me redemander (26 robots = option A executer ; 56 fiches hors univers = quarantaine deja en place ; services Max = page supprimee, sujet clos ; EL.PA logo pose). Puis, dans cet ordre, un a la fois : A (26 robots : controle, validation ou restauration, pose du Cahier), B (texte « Prochains resultats » + icone i en blanc avec leger contour noir dans le bandeau prix, puis verification visuelle de l export PNG AAPL avec l unite anglaise « Billions Subscribers »), C (tendance MOAT evaluee par Mettrik sur chaque ligne de /sandbox/moat, integree a l existant sans nouvel onglet et marquee « evaluation Mettrik, pas Morningstar », puis maquettes de design sur la page concept et lien), D (concentration clients : relancer la recherche des top 6 a 10 sur les 608 stes sans donnee, agents Opus ou Sonnet avec reglages adaptes et sondage de 3 valeurs par lot, puis maquettes d integration sur la page concept et lien), E (lenteur d ouverture des fiches depuis l accueil et la barre de recherche : mesurer, corriger, avant/apres chiffre), F (bloc « Comprendre les unites » invisible : conditionner sur le code GICS 15 Materiaux et 10 Energie, etendre le contenu a l Energie, verifier en ligne et me dire ou le voir), G (bloc TAM au design d origine market-position-card avec la part captee en % bien visible, place juste sous « Comprendre la societe », seulement les TAM comparables, legers ajustements seulement si absolument necessaires), I (Q Qnity 4,754 -> 4 754 M), puis J des que je dis GO. Pour chaque chantier : fais-le en entier, tsc, commit, push, version-bump obligatoire si des donnees changent (sinon l ancien cache des fiches est servi 6 h), relance de l alias niveau2, verification en vue connectee, lien + tableau court, puis chantier suivant. Reponses courtes en francais, sans tiret long, ETA a chaque tache, finir par TERMINE. Jamais le navigateur integre pour les agents. Jamais mettrik.ai sans mon « go n0 ». Jamais l interrupteur maintenance ni tarifs. Jamais committer src/data/companies/wkl.as.json. Jamais traiter un ticker du registre src/data/quarantaine-pollution.json comme une ste classique. Commence maintenant par relancer l alias niveau2 (`nohup bash scripts/alias-niveau2-attente.sh > /tmp/alias.log 2>&1 &`) puis le chantier A.
```
