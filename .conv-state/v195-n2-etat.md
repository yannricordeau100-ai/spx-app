# V195 N2 : etat au 9 aout 2026

## Chiffres
- **845 stes en ligne** (table Supabase `desk_curated_companies`, lue au runtime
  par /api/online-tickers, aucun redeploy necessaire pour publier).
- Univers V195 (`v1-9-5-clean-all-tickers.json`, 589 tickers) : **577/589 en ligne**.
- Publication du 9 aout : IMB.L publie puis **retire le meme jour** (voir plus bas :
  sa fiche n'existe pas, la page redirige vers l'overview).

## ⚠ A ARBITRER EN PRIORITE : 269 stes en ligne SANS fiche
La page V1.9.5 (`src/app/sandbox/v1-9-5/[ticker]/page.tsx`, ligne 226) redirige
vers l'overview **toute ste absente de `v1-9-5-clean-all-tickers.json`**, meme si
`loadV17Company` rend des KPIs. Or 269 des 845 stes publiees dans Supabase sont
hors de cette liste : elles apparaissent dans la recherche et renvoient
l'overview au clic. Verifie en vue connectee (audit_token) : la page fait
2 166 745 octets a l'identique pour BABA, SHEL, TM, HSBC, UBS, TD, MUFG, UL,
9984.T, contre 361 a 415 Ko pour une vraie fiche (JNJ, MSI, ADBE).

Liste complete : `.conv-state/v195-online-hors-clean-9aout.txt`. Elle contient des
noms lourds : BABA, SHEL, TM, HSBC, UBS, GSK, NVO, RY, BP, AZN, SAP, RELX, BARC.L,
SIE.DE, VOW.DE, toute la cote canadienne .TO deja publiee, etc.

Deux issues possibles, c'est un arbitrage de perimetre, pas un fix technique :
1. **etendre** `v1-9-5-clean-all-tickers.json` a ces 269 tickers (elles ont des
   donnees, il faut verifier bloc par bloc avant de les rendre visibles) ;
2. **depublier** les 269 le temps de la verification (`publish-online.ts --hide`).

Je n'ai pas tranche seul : rendre 269 fiches visibles ou les retirer de la
recherche change ce que voient les clients.

## Univers V195 : la queue est fermee
Les 12 tickers restants echouent tous pour raison structurelle, verifiee.
Ne pas re-tenter sans nouvelle source :

| Ticker | Blocage |
|---|---|
| BG | Agribusiness supprime au 1er juillet 2025 (absorption Viterra). 10 trimestres verbatim max (Q1 2023 a Q2 2025), aucun 10-Q local avant 2024, les 8-K locaux n'ont que la page de couverture sans exhibit 99.1. |
| ALAB | 14 trimestres max (Q1 2023 a Q2 2026). Aucune desagregation par gamme Aries/Taurus/Leo/Scorpio : la seule ventilation est annuelle Product sales vs Engineering services, et Product sales = CA total en 2025. |
| PSKY | 10 trimestres (fusion Paramount Skydance). |
| SNDK | 11 trimestres (spin-off Western Digital fevrier 2025), hero = CA total. |
| TKO | 10 trimestres (entite creee 2023), hero = CA total. |
| Q | 8 trimestres (spin-off). |
| NBIS | 8 trimestres. |
| SPCX | 4 trimestres, 0 KPI specifique. |
| HONA | 2 semestres, 0 KPI specifique. |
| ARM, SOLV, AMRZ.SW, GFS | deja au blocked tail (AMRZ.SW : comptes carve-out depuis FY2022 seulement ; GFS : Foreign Private Issuer 20-F, end-market en dollars sur 2 exercices). |

## Chemin des filings : correction
Les filings sont dans **`/Users/yann/spx-app/data-lake/<TICKER>/{10K,10Q,8K}`**
(2189 tickers). `/Users/yann/Mettrik/sec-data/cat1-us|cat2|cat3` existe aussi mais
est incomplet : un agent y a cherche ALAB en vain alors que data-lake avait
2 10-K et 8 10-Q. Toujours pointer les agents sur data-lake en premier.

## 2e univers (`v1-9-universe.json`, 990 tickers) : cartographie faite
204 hors ligne, dont 9 couverts par la table d'alias de `load-company.ts`.
**194 qualifies le 9 aout**, resultat :

- **137 REDIRECT/empty** : `loadV17Company` ne renvoie aucun KPI. Ce n'est PAS un
  probleme de hero, donc **hors perimetre N2**. Deux causes distinctes :
  1. le ticker est aliase vers un canonical vide (LLOY.L vers LYG, RR.L vers
     RYCEF, BMW.DE vers BMWYY, BATS.L vers BTAFF) ;
  2. le ticker n'a aucune fiche generee (ENB.TO, BMO.TO, CNQ.TO, CP.TO, toute
     la cote canadienne .TO, et une partie de Vienne .VI).
  Il faut une generation de fiche (N1/N0), pas un fix hero.
- **28 hero generique**, 3 hero = CA total, ~10 profondeur insuffisante.
- **9 PASS bruts**, ramenes a **5 apres durcissement du qualifieur** (voir plus bas).

## Heros suspects a arbitrer (rien publie, revue Yann)

| Ticker | Hero | Valeur | Pourquoi je n'ai pas publie |
|---|---|---|---|
| 7203.T | Vehicle Sales (M unites, 5 ans) | 10,31 | Double blocage : hors clean-all (pas de fiche), et **TM est deja en ligne** donc publier creerait une 2e fiche Toyota. A traiter par un alias 7203.T vers TM dans `load-company.ts`. |
| CBK.DE | NET_Q | 898 | Resultat net trimestriel : ligne comptable, pas un KPI de demande. 23 KPIs specifiques disponibles, un meilleur hero existe surement. |
| HLMA.L | Adjusted Profit Before Tax | 422 | Ligne comptable ajustee. |
| INF.L | Dividend | 20 | Un dividende n'est pas une mesure d'activite. Hero a repointer. |
| UTG.L | One & Done | 35 | Libelle opaque, sans unite claire. A verifier a la source. |

## Contamination grave detectee : ENI.MI
La fiche ENI.MI (Eni SpA, petrolier italien) porte les KPIs d'une **autre entite** :
"Congress Attendance" 225, "Congress Countries" 11, "Loss Prevention Colloquium" 80,
extraits d'un Geschaftsbericht de l'IVR (association de la navigation fluviale).
Le `_validation` du fichier le dit lui-meme : "Ticker ENI.MI ne correspond pas a IVR
(association non cotee) mais conserve tel que fourni". A purger avant toute
publication d'ENI.MI.

## Durcissement du qualifieur (commits du 9 aout)

### 1. Gate de visibilite (le plus important)
Le qualifieur declarait PASS des stes dont la fiche n'existe pas : il lisait
`loadV17Company` mais pas la liste de visibilite de la page. C'est ce qui m'a fait
publier IMB.L, dont la page redirigeait vers l'overview. `qualify-stes.ts` charge
desormais `v1-9-5-clean-all-tickers.json` (avec la meme normalisation de
separateurs que la page) et rejette d'emblee tout ticker absent.

Effet immediat : IMB.L et 7203.T tombent en FAIL "hors clean-all", AAPL et JNJ
restent PASS.

### 2. Heros CA total deguises
`scripts/qualify-stes.ts` laissait passer des CA total sous des libelles non couverts.
Deux ajouts :
1. 17 variantes ajoutees a `TOTAL_REV` : `ca t`, `rev fy`, `rev q`, `group revenue`,
   `consolidated revenue`, `turnover`, `group turnover`, etc.
2. Nouveau rejet **par nom seul** : si le `short` normalise du hero est un libelle de
   CA total, on rejette meme si aucune autre valeur ne coincide. Necessaire car les
   unites divergent entre KPIs d'une meme fiche (IMCD.AS "CA_T" en M € face a
   "Revenue" en Mds €), ce qui faisait echouer la detection par valeur.

Effet : TEP.PA, VER.VI, WKL.AS et IMCD.AS, qui passaient a tort, tombent
maintenant. `npx tsc --noEmit` propre.

## Pipeline CA
`ca-pipeline-autonome.py` relance le 9 aout : **0 (ticker,block) a traiter**, file vide.
Plus rien a backfiller cote revenue_by_segment / geography sur les V195.

## Prochaine action utile
Le travail N2 sur l'univers V195 est termine. Les gisements restants sont, par
ordre de rendement :
1. Generer les fiches manquantes de la cote canadienne (.TO) et de Vienne (.VI) :
   ~137 tickers sans aucune donnee, c'est du N1/N0.
2. Repointer les 28 heros generiques du 2e univers qui ont deja une fiche rendue.
3. Purger ENI.MI et arbitrer les 5 heros suspects ci-dessus.

---

# 11 aout 2026 : audit de qualite des 639 stes publiees

## Resultat
Le qualifieur durci du 9 aout mettait **121 des 639 stes publiees en FAIL**.
Apres cette passe : **601/639 PASS**, 38 restants.

## Defaut systemique n°1 : la couche kpis-haut echappe a toutes les purges
`loadV17Company` merge `.batches-drafts-safe/kpis-haut/<T>.json` **apres** :
- le filtre `disabled-kpis-per-ste.json` (ligne ~2464),
- le `remove[]` de `apply-hero-fix.py` (qui ne touche que base, enrich et
  specific-kpis).

Un KPI contamine (value = CA total) ou duplique qui vit dans cette couche
survivait donc aux deux mecanismes de purge existants. C'est ce qui expliquait
l'essentiel des 121 FAIL. Nouveau script : `scripts/purge-kpis-haut.py`.

## Defaut systemique n°2 : kpis-haut ecrase le hero_kpi
Meme fichier, fin du merge : `data.hero_kpi = bestHero.short` ou bestHero est le
KPI de plus haut `pv_score` de kpis-haut. Il ecrase le `hero_kpi` pose sur base
ET le `hero_kpi_override` pose sur enrich par `apply-hero-fix.py`.

Seul mecanisme qui gagne : la table Supabase `desk_hero_kpi_overrides`, appliquee
tout a la fin. Nouveau script : `scripts/set-hero-override.py`.

## Defaut systemique n°3 (NON CORRIGE, arbitrage Yann)
`effectiveDefaultHero` (company-view, replique dans qualify-stes.ts) ecrase un
hero explicite non trimestriel par `bestQ` = le meilleur KPI **quarterly de 16
points ou plus**, sans verifier que ce candidat n'est pas un CA total. Le filtre
`bestQ` n'exclut que les generiques au sens de `isGenericKpi`, or "REV_Q",
"REV_FY", "CA_T" n'y sont pas.

Consequence : sur une ste europeenne qui ne publie son segment principal qu'en
semestriel ou annuel, poser le bon hero ne sert a rien, la page rebascule sur le
CA total trimestriel. 12 stes sont dans ce cas et resteront FAIL tant que le
fallback n'exclut pas les libelles de CA total : ROG.SW, INGA.AS, CCEP, AI.PA,
BNP.PA, CFR.SW, GEBN.SW, ML.PA, STLAP.PA, LOGN.SW, HEI.DE, HOLN.SW.

Fix suggere (une ligne, hors perimetre N2) : ajouter le test `TOTAL_REV` a la
condition de `bestQ`, comme il existe deja pour le hero configure.

## Ce qui a ete fait
- 28 + 13 + 2 KPIs contamines purges de kpis-haut sur 37 stes.
- 59 heros repointes sur un KPI de demande deja present dans la fiche
  (revenu segment, volume, unites) : zero token d'extraction.
- 18 heros faibles mais specifiques flagges dans `src/data/_hero-suspect.json`.
- Aucune ste retiree, aucune publication : les 639 etaient deja en ligne.

## Outils ajoutes
| Script | Role |
|---|---|
| `scripts/dump-hero-context.ts` | dump du rendu reel (hero effectif + tous les KPIs) pour decider un fix sans extraction |
| `scripts/purge-kpis-haut.py` | retire des KPIs de la couche kpis-haut |
| `scripts/disable-kpis.py` | ajout non destructif dans disabled-kpis-per-ste |
| `scripts/set-hero-override.py` | upsert desk_hero_kpi_overrides (le seul override qui gagne) |

---

# 12 aout 2026 : passe N2 sur les 639 stes publiees

## Resultat
Depart **614 PASS / 25 FAIL**, arrivee **635 PASS / 4 FAIL**. Les 4 restantes sont
structurelles et documentees plus bas. Zero publication nouvelle : les 639
etaient deja en ligne, c'est une passe de qualite du hero.

## Le defaut systemique n°3 du 11 aout etait a moitie corrige
Le fix du 11 aout (`kpi-total-revenue.ts` importe par `company-view`) etait pose
sur le RENDU mais `scripts/qualify-stes.ts` gardait sa copie locale de la liste
et son propre `bestQ` sans le filtre. Les deux divergeaient : la page affichait
le bon hero segment, le qualifieur voyait encore un CA total et rejetait la ste.
8 stes etaient en FAIL pour un defaut qui n'existait plus (AI.PA, BNP.PA, CCEP,
CFR.SW, HEI.DE, HOLN.SW, INGA.AS, ROG.SW). Lecon : quand un filtre passe dans
`src/lib/`, retirer la copie des scripts DANS LE MEME COMMIT.

## Defaut systemique n°4 : le fallback promeut une ligne comptable
### MESURE FAITE, CORRECTIF REJETE, ARBITRAGE YANN

Constat. `bestQuarterlyKpiShort` excluait les generiques et, depuis le 11 aout,
les CA totaux. Il ne connait pas les LIGNES COMPTABLES. Consequence sur les 639
publiees : une trentaine de stes affichent en hero un resultat net, un EBITDA, un
capex, un dividende par action, un poste de bilan ou un delai de paiement. Cas le
plus visible, **MSFT affichait "dividend_per_share" 0,91 $** alors que la fiche
contient le CA Microsoft Cloud sur 20 trimestres. HSIC affichait un delai de
paiement de 46,4 jours face a un CA Etats-Unis de 9,1 Mds $ sur 9 exercices.

Correctif tente : `src/lib/kpi-accounting.ts`, exclusion des lignes comptables du
fallback, cable sur le rendu et les deux outils. **Mesure sur les 639 : 631 PASS
avant, 611 PASS apres, 24 REGRESSIONS. Correctif retire.**

Pourquoi ca ne marche pas : une liste noire ne peut pas etre exhaustive. Les
heros ne se corrigent pas, ils se deplacent d'une ligne comptable vers une autre
que la liste ignore : KO passe de "eps_diluted_q" a "cash_q", POOL de "dps_q" a
"accounts_payable_q", TSCO de "Gross Profit" a "Lease Liability", ETR de
"operating_income" a "plant_in_service", UHS de "op_income" a "ar_net". La bonne
approche est une liste BLANCHE (le fallback ne promeut qu'une mesure d'activite
reconnue) ou, plus surement, le repointage sté par sté. C'est un arbitrage Yann.

Ce que le correctif aurait AUSSI apporte, a garder en tete pour la decision : 24
vrais gains, dont MSFT vers le RPO commercial, XOM vers la production totale, TGT
vers le nombre de magasins, AVB vers le parc de logements, NEE vers les clients
FPL ajoutes, LHX vers le carnet de commandes, FITB vers les depots, ATO vers le
volume distribue, AIG vers le resultat technique, EG vers les primes acquises.

Ce qui reste en place du travail : le detecteur `isAccountingKpi` vit dans
`src/lib/kpi-accounting.ts` et le qualifieur l'utilise en **AVERTISSEMENT**
(colonne "⚠ hero = ligne comptable (a repointer)" sur les lignes PASS). Le rendu
n'est pas touche, le verdict PASS/FAIL n'est pas touche, mais chaque passe donne
desormais la liste a jour. Deux pieges de calibrage a ne pas reintroduire :
- "cash" et "div" seuls sont interdits dans la liste : "CASH_TRADING_REV" est un
  revenu de segment courtage, "DIV_PGP" la division Produits Grand Public de
  L'Oreal.
- une garde ACTIVITY_WORDS passe avant tout : si le libelle contient rev, sales,
  volume, units, backlog, deposits, premiums, capacity, etc., ce n'est jamais une
  ligne comptable. Sans elle "DA_rev" (segment Discrete Automation d'Emerson)
  tombait sur l'abreviation comptable "DA".

### Defaut n°4bis : 19 heros sont un CA total que le qualifieur ne voyait pas
En calibrant, j'ai etendu `isTotalRevenueLabel` au libelle prive de ses marqueurs
de periode. Effet : 19 stes publiees tombent, parce que leur hero configure EST
un CA total sous un nom que la liste ne reconnaissait pas : ADS.DE, AALB.AS,
ALGM, ASML, BEI.DE, DRI, DTE.DE, HEN3.DE, HEN3.DE, KHC, LSCC, MCHP, NESN.SW,
NOVN.SW, RNO.PA, SJM, SY1.DE ("REVENUE_Q", "SALES_Q", "CA_S", "net_sales_q",
"organic_net_sales"). C'est un VRAI defaut, pas un faux positif du filtre.

Je n'ai pas elargi le filtre : seul, il ferait basculer ces 19 pages sur le KPI
trimestriel suivant, le plus souvent une ligne comptable, donc pire. Il faut
repointer les 19 heros un par un, comme les 22 traites aujourd'hui, PUIS elargir
le filtre. C'est le prochain lot N2 naturel.

## Defaut systemique n°5 : apply-hero-fix est inerte sur une ste a kpis-haut
Constat sur CRH. `apply-hero-fix.py` ecrit le KPI sur base et pose `hero_kpi`,
mais `loadV17Company` REMPLACE la liste par la couche kpis-haut : le KPI extrait
n'existe pas dans le rendu, donc l'override Supabase qui le vise est ignore lui
aussi (il exige que le short soit dans `company.kpis`). Les trois mecanismes
tombaient ensemble. Sequence correcte, dans cet ordre :
1. `python3 scripts/apply-hero-fix.py /tmp/fix-<t>.json`
2. `python3 scripts/add-kpi-haut.py /tmp/fix-<t>.json` (injecte dans kpis-haut)
3. `python3 scripts/set-hero-override.py --file /tmp/repoint.json`
4. `npx tsx scripts/qualify-stes.ts <T>` pour verifier le hero REELLEMENT rendu

`scripts/add-kpi-haut.py` existait depuis le 11 aout mais ne gerait que le
trimestriel avec une etiquette de periode en argument. Reecrit : annuel et
semestriel geres, etiquettes deduites de `last_data_date`, backup et ecriture
atomique, plusieurs fix en un appel. L'ancien appel a 2 arguments reste tolere.

## Heros repares (aucun token d'extraction, KPI deja present dans la fiche)
6 le matin : GEBN.SW SEG_IFS, HSIC us_rev, LOGN.SW GAMING_Q, ML.PA SEG_AUTO_REV,
OR.PA DIV_PGP, SWKS us_revenue.
13 sur les heros comptables : EMR ID_rev, SBUX total_stores_ww, VRSK
underwriting_rev, WTW BACKLOG, MRK.DE LS_REV, TDG power_control_net_sales, CASY
fuel_gal_total, DTE electric_sales_volume, ORA.PA MOB_ACC, CON.DE CA_TIRES_Q,
KPN.AS REV_CONS_Q, KNIN.SW SEA_REV, RWE.DE PROD_RENOUV.

## Heros extraits ou etendus (verifies verbatim, chaque valeur croisee 2 fois)
| Ticker | Hero | Profondeur | Source |
|---|---|---|---|
| CRH | rev_road_sol_y (Road Solutions) | 5 exercices | 10-K FY2023 a FY2025, note "Principal activities and products" |
| VIE.PA | MET_EAU (metier Eau) | 5 exercices, etendu de 2 | URD 2022 a 2025 |
| SGO.PA | CA-ESMOA (Europe du Sud, MEA) | 9 semestres | Annexes 1 et 2 des communiques S1 et FY |
| SU.PA | EM_REV (Gestion de l'energie) | 6 exercices | URD 2021 a 2024 + CP FY2025 |
| LR.PA | REV_NCA_FY (Amerique du Nord et centrale) | 5 exercices | URD et slides FY2025 |
| SIKA.SW | REV_EMEA | 6 exercices | revues quinquennales AR 2024 et 2025 |
| STLAP.PA | REV_NA_H (Amerique du Nord) | 8 semestres | tableaux SEGMENT PERFORMANCE des communiques |

Pieges notes par les agents, a garder : chez Legrand l'ordre des colonnes du PDF
est brouille a l'extraction, il faut le valider par les renvois "dont France" et
"dont Etats-Unis" ; chez Sika le segment Global Business a ete reaffecte aux
regions en 2024 (EMEA 2023 = 4 499 ancienne base, 4 880 base retraitee), ne pas
melanger les deux ; chez Stellantis 2021 n'existe qu'en pro forma.

## Les 4 FAIL restantes sont structurelles, NE PAS RE-TENTER
| Ticker | Blocage |
|---|---|
| APP | Mono-segment depuis la cession des Apps : "CA Advertising" EST le CA total. Aucun sous-agregat publie sur 16 trimestres. |
| GEV | Spin-off GE avril 2024, donnees les plus anciennes Q1 2023 et FY2022, soit 14 trimestres ou 4 exercices maximum. |
| SW | Fusion Smurfit Kappa et WestRock juillet 2024, 14 trimestres max et rupture de perimetre (NA net sales 1 624 en 2023 puis 10 092 en 2024). |
| CRWV | IPO 2025, un seul 10-K, 9 trimestres, RPO publie depuis fin 2024 seulement. |

## A arbitrer par Yann
17 heros restent des lignes comptables faute de mieux dans la fiche, tous
documentes avec la raison dans `src/data/_hero-suspect.json` (50 entrees au
total). Deux familles :
- **extraction requise** (le bon KPI n'existe pas dans la fiche) : SRE, BF.B,
  UHS, POOL, INVH, CHD, DG, FE, ENGI.PA, EOAN.DE.
- **holding, structurellement sans KPI de demande** : PRX.AS, EXO.AS.
- **le bon hero existe mais reste annuel** : EIX (comptes clients SCE), AIG
  (primes acquises), DD (Water & Protection), BAS.DE (CA par zone), HSIC (CA
  Etats-Unis). Ces cinq sont debloquees par le garde-fou comptable du jour.

Rappel des deux arbitrages toujours ouverts depuis le 9 aout : les 269 stes en
ligne hors `v1-9-5-clean-all-tickers.json` (la page redirige vers l'overview) et
les doublons de listing (REN.AS face a RELX et REL.L).

---

# 15 aout 2026 : le lot des heros "CA total deguise" est traite

## Resultat
Depart 639 publiees, dont 19 dont le hero configure ETAIT un CA total sous un
nom que le filtre ne reconnaissait pas. Arrivee **635 PASS / 4 FAIL**, avec un
qualifieur nettement plus strict qu'au 12 aout. Les 4 FAIL sont les memes
blocages structurels documentes le 12 aout : APP, CRWV, GEV, SW.

## Le prealable annonce le 12 aout est fait, dans l'ordre
1. **24 heros repointes** sur un KPI de demande deja present dans la fiche
   (zero token d'extraction) : AALB.AS CA_AMERIQUE, ASML systems_sold, BEI.DE
   CONSUMER_SALES_Q, DRI OG_REV, DTE.DE SEG_US_REV_Q, HEN3.DE SEG_AT_SALES,
   LSCC revenue_end_market_comm_computing, MCHP mcu_rev, NESN.SW
   SALES_BEVERAGES, NOVN.SW COSENTYX_Q, SJM coffee_rev, SY1.DE TNH_REVENUE_H,
   puis APH comm_solutions_rev, EVRG rev_residential_q, EXC rev_comed, GIVN.SW
   CA_FB_S, IFX.DE REV_CHINA, JBL NB_CUST_90PCT, KR sales_ex_fuel_q, PCG
   elec_revenue_q, VST ca_retail.
2. **Filtre elargi** : `isTotalRevenueLabel` teste desormais aussi le libelle
   prive de ses marqueurs de periode, donc REVENUE_Q, SALES_Q, CA_S,
   net_sales_q, organic_net_sales tombent.
3. **3 heros extraits verbatim** pour les stes sans remplacant dans la fiche :
   KHC na_revenue (18 trimestres, Q1 2022 a Q2 2026, le segment North America
   n'existe pas avant 2022), ALGM automotive_rev (20 trimestres, base retraitee
   des reclassements retours/remises), RNO.PA CA_AUTO_S (9 semestres, perimetre
   homogene post-cession Russie). Chaque serie a ete sondee contre le filing
   d'origine avant application.

## Defaut systemique n°3 : referme
`effectiveDefaultHero` ne laisse plus le fallback quarterly ecraser un hero
explicite VALIDE (valeur reelle, non %, non generique, non CA total, serie >=3
points). C'est ce qui bloquait les stes europeennes publiant leur segment en
annuel ou en semestriel : le fallback promouvait la ligne comptable suivante.
Mesure sur les 639 : 41 heros effectifs changent, **30 gains** (ACLS carnet de
commandes, ASML systemes vendus, BF.B volumes Woodford, CIEN carnet, EOG
production Delaware, HEIA.AS volume Heineken, HSIC CA Etats-Unis, LHX carnet
finance, MA GDV, NEE capacite renouvelable ajoutee, POOL nombre de centres, SRE
base tarifaire, TGT nombre de magasins, TTD depense brute, VRT carnet, XEL base
tarifaire, etc.) contre 11 basculements vers une ligne comptable, tous
rattrapes par un repointage le jour meme sauf deux.
La copie locale de la regle a ete mise a jour DANS LE MEME COMMIT dans
`scripts/qualify-stes.ts` et `scripts/dump-hero-context.ts` (lecon du 12 aout).

## Defaut systemique n°6 : la contamination se prouve sur la SERIE, pas sur une valeur
L'elargissement du filtre a fait tomber 7 stes publiees sur une pure coincidence
numerique : DUK 7,6 GW face a 7,59 Mds $, GL 1 585 agents face a 1 599,7 M USD,
FICO carnet RPO 680 face a un CA de 674, MCHP EBITDA 12 mois face au CA du
trimestre, FOX tresorerie, PWR carnet, VTRS dette brute. Le test "value = CA
total" exige desormais **l'unite identique ET au moins deux points anterieurs
qui collent**. Les vraies contaminations (ALAB, ALGM et RNO.PA avant fix) restent
detectees. 7 faux positifs elimines, zero vraie contamination perdue.

## Reste a arbitrer (Yann)
- **ADS.DE** : hero = resultat operationnel faute de mieux. Les CA par zone
  (REV_EUROPE, REV_NORTH_AMERICA) n'ont que 7 semestres, il en faut 8. Un
  semestre de plus debloque la ste.
- **DSFIR.AS** : hero = EBITDA ajuste. Aucun CA de segment dans la fiche, alors
  que DSM-Firmenich publie Taste Texture & Health, Perfumery & Beauty et Animal
  Nutrition & Health. Extraction requise.
Les deux sont dans `src/data/_hero-suspect.json`.

## Rappels toujours ouverts
Les 269 stes en ligne hors `v1-9-5-clean-all-tickers.json` (la page redirige vers
l'overview) et les doublons de listing (REN.AS face a RELX et REL.L).
