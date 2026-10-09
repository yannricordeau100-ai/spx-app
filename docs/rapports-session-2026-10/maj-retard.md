# Mise à jour des sociétés en retard (8 oct 2026)

Rien n'est commité ni déployé. `wkl.as.json` n'a pas été touché.

## 1. Corrections de code (les deux causes)

| Fichier | Correction |
|---|---|
| `scripts/edgar-inventaire.py` | L'inventaire est désormais écrit dans `.conv-state/edgar_inventaire.json` (écriture atomique, l'ancien fichier est gardé si la régénération échoue). Les CIK ne viennent plus de l'ancien inventaire : ils sont lus dans `.conv-state/quarterly-refresh-cik-map.json` (et `sec-data/_meta/ticker-cik-map.json` si présent). Avant, sans le fichier /tmp, une régénération donnait un inventaire vide. UA : `Mettrik research ricordeauyann@gmail.com`. Régénéré : 529 sociétés avec CIK, 230 238 dépôts. |
| `scripts/post-earnings-pipeline.py` | (a) Lit l'inventaire dans `.conv-state`, le régénère s'il manque, et prend les cartes CIK du dépôt en secours. Une société américaine n'est plus jamais envoyée à la veille IR européenne : sans CIK, l'erreur est notée. (b) L'extraction se lance dès qu'un document de résultats du data-lake est plus récent que la dernière période affichée, quelle que soit la façon dont il est arrivé. Règle : la date du document dépasse la fin de période affichée (médiane des KPI de la cadence la plus courte, stories exclues) d'une période plus 7 jours. L'extraction n'est lancée qu'une fois par document (`extraction.doc`). (c) Passe de rattrapage hors de la fenêtre de 14 jours, sur tout l'univers, 5 sociétés par heure au plus (`--max-rattrapage`). (d) L'extraction appelle maintenant la vraie chaîne `earnings-refresh.py --tickers=T --apply`. Les anciens appels (`extract_quarterly`, `extract_kpis_batch`) n'écrivaient rien sur les fiches. (e) Pour un 8-K, l'exhibit 99 (le communiqué) est aussi téléchargé dans `data-lake/<T>/ER/`. La page de garde seule ne contient aucun chiffre, ce qui bloquait les sociétés au T4. (f) Option `--simulation` : aucun téléchargement, aucune écriture d'état, extraction lancée en `--dry-run`. |
| `scripts/edgar-telecharge-tout.py` | Lit l'inventaire dans `.conv-state` et le régénère s'il manque. |

**Tests**
- Simulation sur CAG : document du 30/09 détecté, période affichée 31/05, extraction lancée, fichier d'état intact.
- Communiqué testé dans un dossier de test : ACN et NKE récupérés ; MKC ignoré à raison, son communiqué n'existe qu'en images.
- Détection sur l'univers : 38 sociétés signalées, dont ACN, CAG, COST, FDS, JBL, MKC, MU, NKE, STZ et AGN.AS.
- Après la mise à jour, il ne reste que JBL (voir plus bas).

**Passage réel du cron de 10h15 avec le nouveau code**
- Extraction lancée pour COST, FDS, JBL, MKC, MU et NKE, plus le rattrapage d'AGN.AS, BBY, CIEN, CPB et CRM. Le moteur gratuit (Gemini) a répondu hors format ou a vu ses valeurs rejetées, sauf sur MKC.
- **Alerte MKC :** le moteur a écrit `consumer_rev` Q3-2026 = 1 229,8, qui est le coût des ventes total (1 229,9) et non les ventes Consumer (1 215,4). La preuve « 4 premiers chiffres » d'`earnings-refresh.py` a laissé passer l'erreur. Je l'ai corrigée.
- Ce garde-fou faible existait déjà dans la chaîne de 23h. Le nouveau déclenchement l'expose seulement plus tôt. À durcir : exiger le chiffre complet et le libellé dans la phrase de preuve.

## 2. Téléchargements
- Les 10-Q de FDS, JBL, MU et ACN **n'existent pas**. Ces sociétés ont clos leur exercice au 31/08 (MU au 03/09), donc un 10-K est attendu fin octobre. Leurs communiqués (exhibit 99 des 8-K) ont été téléchargés dans `ER/`.
- STZ : 10-Q du 07/10 et communiqué du 06/10.
- Communiqués aussi pour CAG, NKE, COST et CCL. Les 10-Q de CAG, NKE, MKC et CCL et le 10-K COST du 07/10 étaient déjà présents ou ont été récupérés.
- EXO.AS : rapport S1 2026 (`ir/RFS/EXO.AS_RFS_S1-2026_2026-09-22.pdf`), absent du data-lake.
- SU.PA : communiqué S1 2026 (`ir/CP/SU.PA_CP_H1-2026_2026-07-30.pdf`). Le fichier `SU.PA_CP_FY2025_2026-08-01` est le communiqué annuel 2025, le diagnostic s'était trompé.

## 3. Mises à jour par société

Méthode : brouillons écrits par des agents, chaque valeur accompagnée de sa citation copiée du document. Le script `scratchpad/majr/apply.py` les applique et rejette un point si :
- la citation n'est pas retrouvée mot pour mot dans le document, ou la valeur n'y figure pas ;
- le point laisse un trou, ou la période ne suit pas la cadence de la série ;
- le format d'historique n'est pas respecté (`{q,v}` ou nombres + `history_periods`) ;
- l'échelle s'écarte de plus d'un facteur 3 des 4 derniers points (15 points pour un %).

Sept dépassements d'échelle ont été relus à la main et forcés : CAG marge op., marge nette et OCF (T4 avec dépréciations, OCF négatif au T1) ; NKE `na_ebit_margin` et `buybacks` = 0 ; MKC `buybacks` = 0 ; EXO.AS trésorerie.

Chaque point écrit reçoit aussi `last_data_date` (fin de période), `_maj_le` = 2026-10-08, un `yoy` et un `signal` recalculés.

Contrôle après écriture : aucun type mélangé, aucun décalage de `history_periods`, aucune période en double. Neuf points dépassent un facteur 5 de la médiane ; tous ont été relus, ce sont de vrais mouvements :
- MU (forte hausse sur la mémoire) ;
- OCF du T1 de CAG et NKE ;
- segment Vins et Spiritueux de STZ après les cessions.

| Société | Période ajoutée | KPI mis à jour | Fichier | Restés sans mise à jour (motif principal) |
|---|---|---|---|---|
| CAG | Q1-2027 (clos 30/08/2026) | 37 | kpis-haut/CAG.json | 20 (13 annuels, exercice non clos ; 5 avec trou au Q4-2026) |
| NKE | Q1-FY2027 | 39 | kpis-haut/NKE.json | 12 (annuels) |
| MKC | Q3-2026 | 35 ajoutés + 4 corrigés + 3 confirmés (écrits par le moteur à 10h15) | kpis-haut/MKC.json | 16 (14 annuels) |
| STZ | Q2-FY2027 | 30 | kpis-haut/STZ.json | 10 (annuels) |
| CCL | Q3-2026 (KPI restés au T2) | 7 | kpis-haut/CCL.json | 4 (dont 2 avec trou au Q2) |
| COST | Q4-2026 + FY2026 | 14 | kpis-haut/COST.json | 13 (T4 de 16 semaines non publié par segment) |
| FDS | Q4-FY2026 + FY2026 | 32 | kpis-haut/FDS.json | 33 (segments absents du communiqué, attendre le 10-K) |
| JBL | Q4-2026 + FY2026 | 10 | kpis-haut/JBL.json | 38 (segments et données annuelles du 10-K, attendre le 10-K) |
| MU | Q4-FY2026 + FY2026 | 14 | kpis-haut/MU.json | 26 (stories, données absentes du communiqué) |
| ACN | Q4-FY2026 + FY2026 | 28 | kpis-haut/ACN.json | 11 |
| EXO.AS | S1 2026 | 7 KPI semestriels créés (dont 3 avec H2-2025) ; les 4 déjà en H1-2026 sont inchangés | kpis-haut/EXO.AS.json | 19 annuels laissés sur FY2025 (normal) |
| AGN.AS | S1 2026 | 7 créés | v2-pipeline/agn.as.json | 3 (OCG avant holding non publié tel quel) |
| DIM.PA | S1 2026 | 8 créés | v2-pipeline/dim.pa.json | 0 |
| DSY.PA | S1 2026 | 8 créés | kpis-haut/DSY.PA.json | 0 |
| HEN.DE | S1 2026 | 8 créés | kpis-haut/HEN.DE.json | 2 |
| LI.PA | S1 2026 | 7 créés | v2-pipeline/li.pa.json | 2 (définition différente) |
| LONN.SW | S1 2026 | 6 créés | kpis-haut/LONN.SW.json | 1 |
| PUB.PA | S1 2026 | 8 créés | kpis-haut/PUB.PA.json | 2 (voir point d'attention ci-dessous) |
| RHM.DE | S1 2026 | 7 créés | kpis-haut/RHM.DE.json | 2 (division scindée au 01/01/2026) |
| RXL.PA | S1 2026 | 6 créés | kpis-haut/RXL.PA.json | 0 |
| SU.PA | S1 2026 | 8 créés | kpis-haut/SU.PA.json | 3 trimestriels arrêtés au Q4-2025 (le Q1-2026 manque, donc trou) |
| VIE.PA | S1 2026 | 5 créés | kpis-haut/VIE.PA.json | 0 |
| STMPA.PA | rien à faire | 0 | - | 12 KPI trimestriels déjà au Q2-2026, mais marqués story, d'où le diagnostic « 31/12/2025 » |

**Règle pour les européens.** Un semestre n'est jamais mis dans une série annuelle. Je crée des jumeaux semestriels des grands KPI comptables, sur le modèle CAP.PA `REV_H1`, avec :
- `frequency` semiannual, H1-2025 et H1-2026 lus dans le même document S1 2026 ;
- l'unité et le `type_comparable` du jumeau annuel, `_source` « kpis-haut 10-Q/10-K ».

Vérification faite avec `scripts/fiche-sources.py`, qui utilise le chargeur du site :
- DIM.PA et HEN.DE servent les nouveaux KPI semestriels ;
- NKE sert 4,142 Md$ (NIKE Direct, T1 FY2027).

**MKC :** je suis parti de la version sur disque. Elle avait été modifiée par le moteur automatique du cron de 10h15, en plus de la passe partielle du 07/10. Sur les 4 points Q3 suspects :
- 3 étaient faux et sont corrigés : `consumer_organic` 2,0 devient 1,1, `flavor_organic` 2,0 devient 3,0, `flavor_op_income` 100,0 devient 117,4 ;
- `gross_margin` 39,3 est confirmé par le 10-Q ;
- `consumer_rev` 1 229,8, écrit par le moteur, devient 1 215,4 ;
- `last_data_date` ramené au 31/08/2026 sur les points Q3 (le moteur avait mis la date du jour).

## 4. Sondes (3 par société, citation exacte relue dans son contexte)
Toutes les citations du lot (environ 400 points) ont aussi été retrouvées mot pour mot par `apply.py`.

**CAG** (Q1-FY2027 (trimestre clos le 30/08/2026))
- `G&S Rev` CA Grocery & Snacks (M$), Q1-2027 = **1051.1** ; `CAG_2026-09-30_ER.html` : « | Net Sales | ​ | $ | 1,051.1 »
- `Rés. op.` Résultat opérationnel (M$), Q1-2027 = **268.4** ; `CAG_2026-09-30_ER.html` : « Operating profit | ​ | $ | 268.4 »
- `Dette nette` Dette nette (M$), Q1-2027 = **7388.5** ; `CAG_2026-09-30_ER.html` : « 1 | Net Debt | ​ | $ | 7,388.5 »

**NKE** (Q1-FY2027 (trimestre clos le 31/08/2026))
- `na_rev` Revenus Amérique du Nord ($B), Q1-FY2027 = **5.127** ; `NKE_2026-10-01_ER.html` : « Equipment | 302 | 327 | -8 | % | -8 | % | Total | 5,127 | 5,020 »
- `buybacks` Rachats d'actions ($B), Q1-FY2027 = **0** ; `NKE_2026-10-02.htm.gz` : « Repurchase of common stock | — | ( 126 ) | Dividends »
- `converse_ebit` Résultat opérationnel Converse ($B), Q1-FY2027 = **0.025** ; `NKE_2026-10-01_ER.html` : « Converse | 25 | 39 | -36 | % | Corporate 3 | (478) »

**MKC** (Q3-2026 (trimestre clos le 31/08/2026))
- `consumer_rev` Chiffre d'affaires segment Consumer (M USD), Q3-2026 = **1215.4** ; `MKC_2026-10-01.htm.gz` : « Three months ended August 31, 2026 | Net sales | $ | 1,215.4 »
- `op_income` Résultat opérationnel publié (M USD), Q3-2026 = **217.0** ; `MKC_2026-10-01.htm.gz` : « 6.7 | Operating income | 217.0 »
- `flavor_organic` Croissance organique Flavor Solutions (%), Q3-2026 = **3.0** ; `MKC_2026-10-01.htm.gz` : « Total Flavor Solutions | 7.7 | % | 1.3 | % | 6.4 | % | 3.4 | % | 3.0 »

**STZ** (Q2-FY2027 (trimestre clos le 31/08/2026))
- `Beer Rev FY26` Chiffre d'affaires segment Bière (M USD), Q2-FY2027 = **2473.6** ; `STZ_2026-10-06_ER.html` : « BEER | Net sales | $ | 2,473.6 | $ | 2,345.0 | 5 | % »
- `Beer Price/Mix FY26` Contribution prix : segment Bière (M USD), Q2-FY2027 = **12.8** ; `STZ_2026-10-07_0000016918-26-000040.htm.gz` : « $12.8 million of favorable impact from pricing in select markets »
- `W&S Organic Depletions` Déplétion organique Vins & Spiritueux (%), Q2-FY2027 = **10.2** ; `STZ_2026-10-06_ER.html` : « Depletions (1) | 10.2 | % | 8.7 | % »

**CCL** (Q3-2026 (trimestre clos le 31/08/2026))
- `NAA_Rev` Revenus segment Amérique du Nord (M USD), Q3-2026 = **5543** ; `CCL_2026-09-29.htm.gz` : « Three Months Ended August 31, 2026 | (in millions) | North America | Europe | Cruise Support | Tour and Other | Total | Total Revenues | $ | 5,543 | $ | 2,606 »
- `NA_OpInc` Résultat opérationnel Amérique du Nord (M USD), Q3-2026 = **1477** ; `CCL_2026-09-29.htm.gz` : « Adjusted depreciation and amortization expense (d) | 489 | 206 | 43 | 7 | 746 | Adjusted Operating Income (Loss) | 1,477 | 788 | ( 100 ) | 75 | 2,240 »
- `DPS` Dividende par action ($), Q3-2026 = **0.15** ; `CCL_2026-09-29.htm.gz` : « ($ 0.15 per share) | — | — | — | ( 204 ) | — | — | — | ( 204 ) | Share repurchases | — | — | — | — | — | ( 549 ) »

**COST** (Q4-2026 (16 semaines closes le 30/08/2026) et FY2026 (52 semaines))
- `membership_fee_revenue` Revenus cotisations membres (M USD), Q4-2026 = **1850** ; `COST_2026-09-24_ER.html` : « Membership fees | 1,850 | 1,724 | 5,907 | 5,323 »
- `dividend_per_share` Dividende par action ($), Q4-2026 = **1.47** ; `COST_2026-10-07_0000909832-26-000093.htm.gz` : « The Company's current quarterly dividend rate is $ 1.47 per share. »
- `CAHIER_MEMBERSHIP` Revenus d'adhésion annuels (M $), FY2026 = **5907** ; `COST_2026-10-07_0000909832-26-000093.htm.gz` : « Membership fees | $ | 5,907 | $ | 5,323 | $ | 4,828 | Membership fee revenue increased 11% in 2026 »

**FDS** (Q4-FY2026 et FY2026 (exercice clos le 31/08/2026))
- `ASV_TOTAL` Valeur d'abonnement annuel total (Mds USD), Q4-FY2026 = **2.5652** ; `FDS_2026-09-30_ER.html` : « Annual Subscription Value ("ASV") was $2,565.2 million at August 31, 2026. »
- `ASV_AMERICAS` ASV Amériques (Mds USD), Q4-FY2026 = **1.6782** ; `FDS_2026-09-30_ER.html` : « Americas | $1,678.2 | $1,570.1 | $1,678.2 | 7.1% | $414.3 | $388.7 | 6.7% »
- `CAPEX` Investissements (capex) (M USD), Q4-FY2026 = **27.401** ; `FDS_2026-09-30_ER.html` : « capitalized internal-use software | (27,401) | (33,966) | (19.3) | % »

**JBL** (Q4-2026 et FY2026 (exercice clos le 31/08/2026))
- `EPS_DIL` Bénéfice par action dilué ($/action), Q4-2026 = **3.76** ; `JBL_2026-09-30_ER.html` : « Diluted earnings per share (U.S. GAAP) | $ | 3.76 | $ | 1.99 | $ | 9.75 | $ | 5.92 »
- `INVENT` Stocks nets (M USD), Q4-2026 = **7413** ; `JBL_2026-09-30_ER.html` : « Inventories, net | 7,413 | 4,681 | Prepaid expenses and other current assets »
- `SHARES_OUT` Nombre d'actions en circulation (M actions), Q4-2026 = **104.8** ; `JBL_2026-09-30_ER.html` : « Weighted average shares outstanding: | Basic | 104.8 | 107.5 | 105.8 | 109.5 »

**MU** (Q4-FY2026 et FY2026 (exercice clos le 03/09/2026))
- `CMBU Rev (DC+HBM)` Revenus Cloud Memory (CMBU) (Mds $), Q4-FY2026 = **16.283** ; `MU_2026-09-30_ER.html` : « Cloud Memory Business Unit | Revenue | $ | 16,283 | $ | 13,769 | $ | 4,543 »
- `OCF Q` Flux de trésorerie opérationnels trimestriels (Mds $), Q4-FY2026 = **43.973** ; `MU_2026-09-30_ER.html` : « GAAP net cash provided by operating activities | $ | 43,973 | $ | 25,388 | $ | 5,730 »
- `Capex Q` Investissements trimestriels (capex) (Mds $), Q4-FY2026 = **11.11** ; `MU_2026-09-30_ER.html` : « Expenditures for property, plant, and equipment | (11,110) | (7,826) | (5,658) | (30,712) | (15,857) »

**ACN** (Q4-FY2026 et FY2026 (exercice clos le 31/08/2026))
- `BOOKINGS` Nouvelles commandes ($B), Q4-FY2026 = **22.17** ; `ACN_2026-10-01_ER.html` : « New bookings for the fourth quarter of fiscal 2026 were $22.17 billion »
- `REV_GEO_EM` CA EMEA ($B), FY2026 = **26.96** ; `ACN_2026-10-01_ER.html` : « Americas | $36.55 | 4 | % | 4 | % | EMEA | $26.96 | 9 | % | 4 | % | Asia Pacific | $10.68 »
- `OP_MARGIN` Marge opérationnelle GAAP (%), Q4-FY2026 = **15.3** ; `ACN_2026-10-01_ER.html` : « GAAP operating margin (operating income as a percentage of revenues) for the quarter was 15.3%, compared with GAAP operating margin of 11.6% »


**DIM.PA** (S1 2026, clos le 30/06/2026)
- `revenue_h1` Chiffre d'affaires semestriel (Mds €), H1-2026 = **1.5272** ; `DIM.PA_CP_H1-2026_2026-07-27.pdf` : « Sales revenue 1,527.2 1,489.6 2.5 6.4 | 8.02 »
- `underlying_ebitda_h1` EBITDA courant semestriel (M EUR), H1-2026 = **478.9** ; `DIM.PA_CP_H1-2026_2026-07-27.pdf` : « Underlying EBITDA4 478.9 461.9 3.7 »
- `EMEA Sales Revenue H1` Chiffre d'affaires semestriel région EMEA (M EUR), H1-2026 = **672.4** ; `DIM.PA_CP_H1-2026_2026-07-27.pdf` : «  EMEA3 672.4 624.7 7.6 7.7 »

**DSY.PA** (S1 2026, clos le 30/06/2026)
- `REV_H1` Chiffre d'affaires semestriel (non-IFRS) (M€), H1-2026 = **3065.5** ; `DSY.PA_S1_2026_2026-07-23.pdf` : « Total Revenue €3,065.0 €3,094.6 (1%) 4% €3,065.5 €3,096.2 (1%) 3% »
- `OPM_NIFRS_H1` Marge opérationnelle semestrielle non-IFRS (%), H1-2026 = **30.1** ; `DSY.PA_S1_2026_2026-07-23.pdf` : « Operating Margin 23,0% 30,1% 17,6% 30,1% »
- `EPS_NIFRS_H1` BNPA dilué semestriel non-IFRS (€), H1-2026 = **0.61** ; `DSY.PA_S1_2026_2026-07-23.pdf` : « €0.44 €0.16 €0.61 €0.37 €0.25 €0.61 22% (1%) »

**HEN.DE** (S1 2026, clos le 30/06/2026)
- `SALES_H1` Chiffre d'affaires semestriel du groupe (M €), H1-2026 = **10348** ; `HEN.DE_CP_H1-2026_2026-08-06.pdf` : « Henkel posted Group sales of 10,348 million euros in the first half of 2026, equivalent to a »
- `NET_INCOME_H1` Résultat net semestriel part des actionnaires (M €), H1-2026 = **988** ; `HEN.DE_SEMESTRIEL_H1-2026_2026-08-06.pdf` : « Net income attributable to shareholders of Henkel AG & Co. KGaA 1,110 988 -11.0% »
- `ADJ_EBIT_MARGIN_H1` Marge d’EBIT ajusté semestrielle (%), H1-2026 = **15.7** ; `HEN.DE_CP_H1-2026_2026-08-06.pdf` : « 15.7 percent (previous year: 15.5 percent). »

**LI.PA** (S1 2026, clos le 30/06/2026)
- `net_rental_income_h1` Revenus locatifs nets semestriels (IFRS) (M EUR), H1-2026 = **577.7** ; `LI.PA_SEMESTRIEL_H1-2026_2026-08-06.pdf` : « Net rental income 3.2.1 577.7 552.7 »
- `Italy Net Rental Income H1` Loyers nets semestriels Italie (M EUR), H1-2026 = **141.4** ; `LI.PA_SEMESTRIEL_H1-2026_2026-08-06.pdf` : « Italy 141.4 132.2 »
- `operating_income_h1` Résultat opérationnel semestriel (variation de juste valeur incluse) (Mds €), H1-2026 = **0.9331** ; `LI.PA_SEMESTRIEL_H1-2026_2026-08-06.pdf` : « Operating income 933.1 839.1 »

**LONN.SW** (S1 2026, clos le 30/06/2026)
- `CORE_EBITDA_MARGIN_H` Marge CORE EBITDA semestrielle (%), H1-2026 = **34.8** ; `LONN.SW_PRES_H1-2026_2026-07-22.pdf` : « Margin in % 34.8 30.4 4.4ppts »
- `FCF_H` Free cash flow opérationnel semestriel (M CHF), H1-2026 = **426** ; `LONN.SW_PRES_H1-2026_2026-07-22.pdf` : « Operational FCF before acq./div. 426 116 267.2 »
- `CAPEX_PCT_H` Capex semestriel en % du CA (%), H1-2026 = **15.7** ; `LONN.SW_PRES_H1-2026_2026-07-22.pdf` : « CapEx as % sales 15.7% -5.5ppts 21.2% »

**PUB.PA** (S1 2026, clos le 30/06/2026)
- `REV_TOTAL_S1` Chiffre d'affaires total semestriel (M€), H1-2026 = **8734** ; `PUB.PA_COMMUNIQUE_H12026_2026-07.pdf` : « Revenue 8,734 8,483 »
- `OP_INCOME_S1` Résultat opérationnel semestriel (M€), H1-2026 = **1149** ; `PUB.PA_COMMUNIQUE_H12026_2026-07.pdf` : « Operating income 1,149 1,102 »
- `EPS_S1` Bénéfice net par action semestriel (€), H1-2026 = **3.17** ; `PUB.PA_COMMUNIQUE_H12026_2026-07.pdf` : « Earnings per share (EPS) 3.17 3.28 »

**EXO.AS** (S1 2026, clos le 30/06/2026)
- `COMPANIES_VALUE_H` Valeur des participations industrielles (semestrielle) (M€), H1-2026 = **27009** ; `EXO.AS_RFS_S1-2026_2026-09-22.pdf` : « Companies(a) A 27,009 29,172 »
- `LTV_RATIO_H` Ratio d'endettement sur actifs (LTV, semestriel) (%), H1-2026 = **4.7** ; `EXO.AS_RFS_S1-2026_2026-09-22.pdf` : « LTV Ratio(a) (b) [A/B] 4.7% 6.9% »
- `GROSS_DEBT_H` Dette brute (semestrielle) (M€), H1-2026 = **3691** ; `EXO.AS_RFS_S1-2026_2026-09-22.pdf` : « Gross debt E (3,691) (3,708) »

**AGN.AS** (S1 2026, clos le 30/06/2026)
- `operating_income_s` Résultat opérationnel semestriel (Mds €), S1 2026 = **0.804** ; `AGN.AS_CP_H1-2026_2026-08-20.htm` : « result | 10,11 | 804 | 741 | 9 | 13 | August 20, 2026 »
- `cash_capital_holding` Trésorerie disponible au holding (Cash Capital at Holding) (M€), S1 2026 = **1656** ; `AGN.AS_CP_H1-2026_2026-08-20.htm` : « period | 1,656 | 2,011 | (18% | ) | Aegon’s Cash Capital at Holding increased during the first half of 2026 »
- `net_income_s` Résultat net semestriel (Mds €), S1 2026 = **0.608** ; `AGN.AS_CP_H1-2026_2026-08-20.htm` : « Net result of EUR 608 million, compared with EUR 606 million in the first half of 2025 »

**RHM.DE** (S1 2026, clos le 30/06/2026)
- `CA_H1` Chiffre d'affaires consolidé semestriel (M€), H1-2026 = **5227** ; `RHM.DE_CP_S1-2026_2026-08-06.pdf` : « €5,227 million (previous year: €3,749 million »
- `CA_VS_H1` Chiffre d'affaires semestriel de la division Vehicle Systems (M€), H1-2026 = **2431** ; `RHM.DE_RFS_S1-2026_2026-08-06.pdf` : « Sales 1,446 945 501 2,431 »
- `BPA_POURS_H1` Bénéfice par action semestriel des activités poursuivies (€), H1-2026 = **8.43** ; `RHM.DE_CP_S1-2026_2026-08-06.pdf` : « improved from 4.69 EUR in the same period of the previous year to 8.43 EUR »

**RXL.PA** (S1 2026, clos le 30/06/2026)
- `revenue_h1` Chiffre d'affaires semestriel (Mds €), H1-2026 = **9.9889** ; `RXL.PA_SEMESTRIEL_H1-2026_2026-07-27.pdf` : « Sales 4 9,988.9 »
- `net_income_h1` Résultat net part du groupe semestriel (Mds €), H1-2026 = **0.3403** ; `RXL.PA_SEMESTRIEL_H1-2026_2026-07-27.pdf` : « to the equity holders of the parent 340.3 »
- `europe_sales_h1` Ventes semestrielles de la zone Europe (M EUR), H1-2026 = **4802.9** ; `RXL.PA_CP_H1-2026_2026-07-27.pdf` : « Europe 4,796.7 4,802.9 »

**SU.PA** (S1 2026, clos le 30/06/2026)
- `REV_H1` Chiffre d'affaires semestriel (Mds €), H1-2026 = **21.226** ; `SU.PA_CP_H1-2026_2026-07-30.pdf` : « Revenues 19,336 21,226 »
- `NI_ADJ_H1` Résultat net ajusté semestriel (Mds €), H1-2026 = **2.696** ; `SU.PA_CP_H1-2026_2026-07-30.pdf` : « Adjusted Net Income (Group share)7 2,228 2,696 »
- `EBITA_ADJ_H1` EBITA ajusté semestriel (Mds €), H1-2026 = **4.093** ; `SU.PA_CP_H1-2026_2026-07-30.pdf` : « Adjusted EBITA 3,510 4,093 »

**VIE.PA** (S1 2026, clos le 30/06/2026)
- `REV_S1` Chiffre d'affaires du 1er semestre (Mds €), H1-2026 = **22.193** ; `VIE.PA_CP_H1-2026_2026-07-30.pdf` : « Revenue 22,048 22,193 »
- `MET_EAU_S1` Chiffre d'affaires de l'activité Eau du 1er semestre (Mds €), H1-2026 = **8.489** ; `VIE.PA_CP_H1-2026_2026-07-30.pdf` : « Water 8,545 8,489 »
- `FCF_NET_S1` Free cash-flow net du 1er semestre (Mds €), H1-2026 = **-0.288** ; `VIE.PA_CP_H1-2026_2026-07-30.pdf` : « Net free cash flow -451 -288 »


## 5. Fichiers modifiés

**Fiches**
- `.batches-drafts-safe/kpis-haut/` : ACN, CAG, CCL, COST, DSY.PA, EXO.AS, FDS, HEN.DE, JBL, LONN.SW, MKC, MU, NKE, PUB.PA, RHM.DE, RXL.PA, STZ, SU.PA, VIE.PA.
- `src/data/v2-pipeline/` : agn.as, dim.pa, li.pa.
- Sauvegardes avant écriture : `scratchpad/majr/backups/`.

**Code et état**
- `scripts/post-earnings-pipeline.py`, `scripts/edgar-inventaire.py`, `scripts/edgar-telecharge-tout.py`.
- `.conv-state/edgar_inventaire.json` (nouveau).

**Documents ajoutés au data-lake**
- `ER/` de FDS, JBL, MU, ACN, STZ, CAG, NKE, COST, CCL.
- 10-Q STZ, 8-K récents.
- EXO.AS RFS S1-2026, SU.PA CP H1-2026.

**Effets de bord, pas de mon fait direct**
- `src/data/_fr-doc-watcher-status.json`, réécrit par la veille IR lancée sur SU.PA et EXO.AS.
- `.conv-state/earnings-inbox/CAG.md`, réécrit par le test (le dry-run d'`earnings-refresh` écrit quand même le dossier).
- `.conv-state/post-earnings-etat.json` et des dossiers d'inbox (BBY, CPB, MU, CRM, NKE...), écrits par le cron de 10h15.

**Non touchés, modifiés par un autre processus :** `scripts/quarterly-refresh-run.py`, `scripts/verif-fuites-publiques.mjs`, `scripts/verif-release.py`.

## 6. Points d'attention
- **JBL, FDS, MU, ACN :** les segments et données annuelles ne viendront qu'avec le 10-K, fin octobre. Le pipeline relancera l'extraction à son arrivée. JBL reste détecté « à extraire » jusque-là.
- **NKE :** données existantes douteuses, non corrigées car hors périmètre : `na_ebit` Q4-FY2026 = 2,0 Md$ et `na_ebit_margin` 41,4 %, alors que les autres trimestres sont autour de 1 Md$ et 20 %.
- **PUB.PA :** `OP_MARGIN_S1` H1-2026 = 1 268 correspond à la marge opérationnelle courante (headline, H1-2025 = 1 242, cohérent), alors que la marge publiée hors coûts LiveRamp est de 1 261. La définition à suivre est à trancher. Point non modifié.
- **CASY, COO, GIS (diagnostic) :** dates aberrantes non traitées.

## 7. Ajout 10h40 : preuve durcie dans `earnings-refresh.py` (demande du coordinateur)

**Nouvelle fonction `preuve_stricte`**, appliquée à chaque valeur avant écriture, à 23h comme au déclenchement horaire. Elle exige :
1. la valeur complète dans la phrase de preuve, à l'arrondi publié près, ou au facteur 1000 exact (le cas MKC 1 229,8 / 1 229,9 est rejeté) ;
2. un mot distinctif du libellé du KPI dans la phrase ;
3. la période : un marqueur de cadence et l'année (4 chiffres, ou FY27 et équivalents) dans la phrase ou dans les 2 000 caractères qui la précèdent ;
4. pour un trimestre, aucun cumul (« six/nine/twelve months », « year-to-date ») dans la phrase.

L'échelle reste contrôlée par `echelle_compatible`. Tout rejet est sans écriture et journalisé dans `.conv-state/earnings-refresh-rejets.jsonl` : preuve fiable, chiffre absent, échelle, et la nouvelle preuve stricte.

**Tests**
- Contre-exemples rejetés : MKC 1 229,8 (valeur incomplète), ligne COGS 1 229,9 (libellé absent), cumul 9 mois étiqueté Q3.
- Valeur juste MKC 1 215,4 acceptée.
- Sur les points vérifiés : MKC 29/34 acceptés, CAG 22/36, NKE 25/33. Les rejets sont des fragments de tableau sans libellé ni période ; ils partent en dossier de travail, sans écriture.
- Passage réel à blanc MKC, CAG, NKE : 0 écriture, rejets journalisés.

**Interrupteur** : `.conv-state/post-earnings-extraction-off`. Posé pendant les tests, retiré après validation. Pour couper à nouveau : `touch .conv-state/post-earnings-extraction-off`. Détection et journal continuent, et le document n'est pas marqué comme traité.
