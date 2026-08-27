# Session V195 du 27 aout 2026, deuxieme reprise autonome (20h)

## Etat au demarrage
- clean-all-tickers : 871. online (desk_curated_companies) : 862. Restent 9 non-online.
- Pipeline CA relance : 0 couple (ticker,bloc) a traiter, file vide.
- Alias mettrik-niveau2 sain.

## Les 9 non-online sont TOUS bloques structurellement, inscrits dans _hero-suspect.json
Aucune publication possible ce run. Verification faite couche par couche
(v2-pipeline, v2-pipeline-specific-kpis, v2-pipeline-enrich) : aucun KPI
n atteint 16 trimestres, 5 exercices ou 8 semestres, sauf deux exceptions
traitees ci-dessous. Aucune source dans le data-lake pour aucun des 9
(ni sec-data/cat1-us, ni cat2, ni cat3, ni ir-scrape).

Huit sont des scissions ou des introductions de 2024-2026, donc trop jeunes :
ALAB (Astera Labs), AMRZ.SW (Amrize, ex-Holcim), HONA (Honeywell Aerospace),
NBIS (Nebius), Q (Qnity, ex-DuPont), SNDK (Sandisk, ex-Western Digital),
SPCX (SpaceX), FDXF (FedEx Freight, FDX deja en ligne).
FLEX est le cas structurel deja connu : segmentation refondue, 7 KPI tous
generiques (marges, R&D en %, capex, effectif, actifs, dette).

Deux exceptions examinees puis ecartees :
- SNDK porte un `EDGE_REV` annuel a 5 exercices [6,038 ; 3,637 ; 4,069 ; 4,127 ;
  12,16] Mds $ qui passerait le seuil. Ecarte : incoherent avec le trimestriel
  du meme dossier (Edge = 61 % du CA au dernier trimestre mais 92 % sur
  l exercice), et invérifiable, cat1-us/SNDK ne contient qu un instantane de
  page d accueil. Ne pas publier sans source verbatim.
- Q n a qu un seul KPI a 5 exercices, le Capex, generique.

## Audit qualifieur des 862 stes en ligne : 857 PASS, 5 FAIL, aucune regression
Les 5 FAIL sont les blocages structurels connus : APP (mono-segment),
RDDT (14 trim), CRWV (7 trim), GEV (10 trim), SW (10 trim). GOOGL, corrige au
run precedent, est repasse PASS.

## Blocs de repartition vides sur les stes publiees ce matin
Test relance sur les 871 fiches de clean-all : 7 blocs sans aucune valeur
chiffree, tous sur les 4 stes publiees a 10h. Le pipeline CA les avait deja
traites et rejetes (couples presents dans `done` du checkpoint), donc relancer
le pipeline ne pouvait rien donner.

Reparation mecanique (parts en pourcentage sommant a 100, value = share_pct,
unit = "%") : NDA-FI.HE segment, NDA-FI.HE geographie, UNM geographie.

Extraction verbatim par agent, verifiee valeur par valeur contre la source :
- SAND.ST : segment 3 parts (Mining 62 971 / Rock Processing 10 435 /
  Machining and Intelligent Manufacturing 47 273 MSEK, total 120 680 = CA du
  groupe) et geographie 6 parts (Europe 30 447, Amerique du Nord 30 880,
  Amerique du Sud, Afrique et Moyen-Orient 14 812, Asie, Australie et
  Nouvelle-Zelande 14 694). Source ir-scrape/SAND.ST/results/entire-en-svk-ar25.pdf,
  notes G2 p.120 et G3 p.122. Les quatre valeurs sondees sont verbatim.
- MAP.MC : segment 6 parts (Iberie 10,0 / MAPFRE RE 8,4 / Reste Amerique latine
  5,4 / Bresil 4,3 / Amerique du Nord 2,6 / EMEA 1,6 Mds €). Source
  ir-scrape/MAP.MC/misc/investment-story-mar-2026-def.pdf. Onglet geographie
  RETIRE : aucun decoupage continental FY2025 dans les sources locales, et
  cat3-european/MAP.MC/annual-report/2026.pdf est en fait un SFCR Bankinter,
  pas un rapport MAPFRE. A signaler pour la prochaine collecte.

## Doublons d historique sur les fiches en ligne : 9 paires trouvees, 11 KPI retires
Test : sur chaque fiche en ligne, deux KPI de meme unite dont la serie est
identique (>= 4 points, series non vides). ATTENTION au piege de normalisation :
certaines history sont des listes de dictionnaires {"q","v"} et non des nombres,
les lire naivement donne des faux positifs (RDDT DAUQ/WAUQ, SCMN.SW REV_Q/
OTHER_REV_Q sont des series bien differentes).
- HUM : cons_benefit_ratio_yr et cons_opcost_ratio_yr, doublons de
  "Consolidated benefit ratio" et "Consolidated operating cost ratio".
- AAPL : rev_china_country doublon de rev_geo_china.
- ADP : rev_PEO_passthrough doublon de PEO_zero_margin_passthrough.
- CPT : "Same Property Occupancy" doublon de "Same-Store Occupancy".
- BG : DAILY_PROD_CAPACITY doublon de daily_capacity (qui est le hero).
- BBY : geo_rev_us doublon de dom_rev.
- AMCR : "Sales by product - Containers, preforms, and closures" doublon du
  segment Rigid Packaging.
- PGR : "Periods Ended June 30," et "Periods Ended September 30," etaient des
  en-tetes de tableau extraits comme KPI, avec pour valeurs les annees
  (2,022 / 2,023 / 2,024 / 2,025) etiquetees en Mds $. Retires.
- SAN.MC : "Op Margin" et "Capital Ratios", history entierement nulle. Retires.
Les 13 fiches touchees requalifiees 13/13 PASS.

## Travail du cron repris et commite
56 fiches v2-pipeline-enrich et le data-lake XBRL avaient ete mis a jour par le
cron quarterly-refresh de 05h55 (103 stes detectees et traitees) sans jamais
etre commites, plus inf.l geographie par le pipeline CA de 08h18 (5 parts,
3,19 Mds £, coherent avec le CA d Informa). Tout est inclus dans le commit.

A SIGNALER A YANN : le rafraichissement trimestriel met a jour `value`,
`history` et `yoy` mais laisse le champ `description` intact. Sur NVDA le
resultat net vaut desormais 59 688 $M (trimestre au 26 juillet 2026) alors que
la description dit encore "a augmente de 65 % pour atteindre 120,1 Mds$ en 2026".
Defaut systemique, a traiter par une passe dediee sur les 56 fiches.

## Pieges rencontres
- `json.load` sur v1-9-5-clean-all-tickers.json rend un DICTIONNAIRE
  {generated_at, count, tickers}, pas une liste. En faire un set directement
  donne un set de 3 cles et fait passer tous les tests a vide.
- L indentation d origine varie d une fiche a l autre (aapl, adp, cpt, bby,
  amcr, pgr en indent 1 ; sand.st, map.mc, unm, bg, san.mc en indent 2 ;
  hum sur une seule ligne). Toujours relever
  `git show HEAD:<fichier> | sed -n 2p` avant de reecrire, sinon le diff
  passe de 40 a 3 400 lignes.
