# Défauts constatés sur des séries DÉJÀ EN LIGNE (recherche données KPI, 5 sept 2026)

À corriger sur les fiches après validation. Source du constat : `docs/cahier/donnees/<TICKER>.json`, champ `commentaire`.

| Ticker | KPI en ligne | Défaut | Correction proposée |
|---|---|---|---|
| AAPL | iPhone (unités) 2019-2025 | Apple ne publie plus les volumes depuis l'exercice 2018 ; valeurs issues d'instituts de marché, marquées hors document | retirer, requalifier en estimation, ou tronquer à 2018 |
| PANW | RPO annuel | 5 valeurs ne correspondent pas aux clôtures des 10-K (ex. 2025 : 15,8 Mds $ officiels contre 13,5 en ligne) | remplacer par les valeurs officielles (fichier PANW) |
| KLAC | « Carnet de commandes » | la série en ligne est celle des passifs contractuels, pas le carnet | renommer, et poser la vraie série carnet 2018-2026 (fichier KLAC) |
| EPAM | Revenu par employé | ratio reconstitué, jamais publié par la société | marquer « calculé » ou retirer |
| DDOG | Billings | grandeur reconstituée, jamais publiée | marquer « calculé » ou retirer |
| TXN | Jours de stock | 15 points trimestriels sans période, maximum 209 alors que le 10-K donne 241 (2024) et 222 (2025) | remplacer par la série annuelle officielle 2016-2025 (fichier TXN) |
| WDAY | Rétention nette des abonnements | valeurs 99 / 97 / 95 absentes de toute publication ; Workday ne donne qu'un seuil (> 100 %) et une rétention brute (~98 % en 2025, ~97 % en 2026) | retirer et remplacer par la rétention brute publiée |
| JBL | Taux d'utilisation | un seul point (80 %, conférence T3 2026), aucune série publiée | retirer ou marquer « point unique » |
| GDDY | Taux de renouvellement | c'est un taux de rétention clients, pas un renouvellement d'abonnements | renommer |
| MSFT | CRPO | valeurs = obligations de prestation totales, pas la part à 12 mois | renommer « RPO commerciales totales » |
| PLTR | RPO / CRPO | années renseignées en pourcentage, unité différente de la série en montant | séparer les deux séries |

Séries en ligne trop courtes, exercices antérieurs retrouvés (à allonger) : ASM.AS (SPS 2022-2025, publié depuis bien plus longtemps), CAP.PA (book-to-bill 2023-2025, publié chaque année), FFIV (concentration clients depuis 2016), EPAM (utilisation et attrition dès 2018), WDC (exabytes annuels 2017-2024).
| BR | Croissance des revenus récurrents à change constant | valeurs en ligne 8, 8, 6 contre 9 / 6 / 7 / 8 % dans les 10-K (FY2023 à FY2026) | remplacer (fichier BR) |
| CARR | Part de l'après-vente | série en ligne 22, 24, 26, 28, 30 sans rapport avec les 10-K (28, 27, 23, 24, 25, 28 pour 2020 à 2025) | remplacer (fichier CARR) |
| CAT | Part services et pièces | renseignée en Mds $ alors que le KPI est un pourcentage ; Caterpillar ne publie que le montant | renommer en « Revenus de services » (Mds $) |

## FER (Ferrovial) : RESOLU le 05/09. Le 14 392 vient de la serie retraitee du Factbook officiel (6-K SEC)
Le brouillon `.batches-drafts-safe/kpis-haut/FER.json` affiche 14392 pour le carnet 2022 alors que les rapports annuels 2022 et 2023 indiquent 14743 M EUR. La valeur 2023 du brouillon (15179) correspond au comparatif retraite du rapport 2024, la valeur publiee etant 15632. Constat du 05/09/2026 (lot 20-08). Resolution : les deux series sont officielles, celle en ligne suit le Factbook (base homogeneisee), l autre les valeurs a la cloture. La serie en ligne a ete etendue a 2016-2025 et sourcee (Factbook 2026).

## Sous-industrie 20106020 (machines industrielles) : KPI sans objet pour les distributeurs et l'outillage a cycle court
Constat des lots 20-10 et 20-20 : GWW (distributeur) et SNA (outillage vendu par franchises) n'ont aucun des 5 KPI organiques de leur sous-industrie (verifie sur 10 exercices de 10-K chacun). A trancher par le proprietaire : reclassement, ou passe "KPI propres a la societe" prevue dans les ameliorations du 5 sept.

## WKL.AS (Wolters Kluwer) : fiche en ligne polluee par une autre entite
Constat du lot 20-23 : `src/data/companies/WKL.AS.json` contient les donnees d une entite nommee IVR (participants a un congres, reunions de comites) et des agregats en euros non rattaches aux publications de Wolters Kluwer. Aucun KPI organique de la sous-industrie n y figure. Meme famille que la cross-pollution MC.PA/Moelis d aout. A corriger sur la fiche apres validation du proprietaire.

## SREN.SW (Swiss Re) : ratio combine 2023 en ligne sur l ancien referentiel
Constat du lot 40-18 : la fiche en ligne affiche 94,8 % pour 2023 (normes americaines) alors que Swiss Re publie 85,0 % pour le meme exercice retraite en IFRS 17. Rupture de referentiel a documenter ou serie a raccorder sur la fiche apres validation du proprietaire.

## PRU (Prudential Financial) : ratio de prestations en ligne different des 10-K
Constat du lot 40-16 : la serie en ligne donne 83,2 et 83,1 pour 2023 et 2024 alors que les 10-K publient 82,5 et 82,7. Serie officielle 2014-2025 dans donnees/PRU.json. A corriger sur la fiche apres validation du proprietaire.

## ABT (Abbott) : RPO Diagnostics affiche avec un facteur mille d ecart
Constat du lot 35-01 : la fiche en ligne affiche 0,004 et 0,006 Mds $ pour les obligations de prestation restantes Diagnostics 2023 et 2025 alors que les 10-K donnent 4,4 et 6,1 Mds $. Erreur d unite (facteur 1000). Serie officielle 2018-2025 dans donnees/ABT.json. A corriger sur la fiche apres validation du proprietaire.

## DXCM (Dexcom) : base clients en ligne perimee
Constat du lot 35-05 : la fiche affiche 2,8 millions de clients alors que Dexcom communique environ 3,5 millions a fin 2025. A rafraichir sur la fiche apres validation du proprietaire.

## AJG (Arthur J. Gallagher) : marge EBITDAC ajustee consolidee en ligne sans source
Constat du lot A31 (allongement) : la serie en ligne Adjusted EBITDAC Margin (24,5 ; 24,8 ; 25,1 ... 26,9, progression reguliere de 0,3 point par periode) ne correspond a aucune valeur publiee : Gallagher ne publie cette marge que par segment. Valeurs officielles du segment Courtage : 26,9 % (2016), 27,4 % (2017), 27,8 % (2018), 28,6 % (2019), 34,0 % (2022), 34,3 % (2023), 35,1 % (2024), 36,5 % (2025). Serie en ligne a remplacer par la serie sectorielle Courtage, apres validation du proprietaire. Detail dans donnees/AJG.json.

## SYK (Stryker) : series Mako en ligne non sourcees
Constat du lot 35-13 : la fiche porte deux series incompatibles pour la base installee Mako (700 / 800 / 860 / 3000 et 1200 / 1400 / 1600 / 1850) et une serie de procedures Mako en milliers par an qui ne correspond a aucune publication de Stryker, laquelle ne donne que des jalons cumules arrondis (1 million en 2023, 1,5 million en 2024, plus de 2 millions en 2025). Series a retirer ou a remplacer par les jalons publies, apres validation du proprietaire. Detail dans donnees/SYK.json.

## ARES (Ares Management) : resultat lie aux commissions en ligne anterieur aux retraitements
Constat du lot A33 (allongement) : les valeurs 2022 et 2023 en ligne pour le resultat lie aux commissions (FRE) sont celles des publications d origine, avant les reaffectations de couts et le redecoupage des groupes d investissement republies par la societe (2022 : 943 694 puis 977 892 puis 1 017 926 K $). A aligner sur la derniere republication, apres validation du proprietaire. Detail dans donnees/ARES.json.

## APTV (06/09/2026, lot 25-01)
Serie "Content per Vehicle" en ligne (180, 210, 230, 240) introuvable dans les documents officiels Aptiv : a retirer ou re-sourcer. Serie "growth over market" en ligne divergente des communiques annuels 2021, 2022, 2023 et 2025 (valeurs officielles 15, 11, 2 points ; 2024 et 2025 a 1 point derivees des deux grandeurs publiees). En attente de validation du proprietaire avant toute correction de fiche.

## CON.DE (06/09/2026, lot 25-03)
PREMIUM_MIX en ligne (52 %) contredit le rapport annuel 2025 : environ 62 % des ventes de la marque Continental en pneus 18 pouces et plus (49 % en 2020). Valeurs officielles dans le cahier, en attente de validation du proprietaire avant correction de fiche.

## Corrections appliquees le 06/09/2026 (regle du proprietaire : le 10-K / 10-Q fait foi, ecarts importants corriges)
- ABT : RPO Diagnostics 0,004 / 0,006 corrige en 4,4 / 6,1 Mds $ (facteur 1000).
- DXCM : base clients rafraichie a 3,5 millions fin 2025 (point ajoute).
- CON.DE : part des pneus 18 pouces et plus 52 corrigee en 62 % (2025), point 2020 a 49 ajoute.
- HCA : taux d occupation annuel 2021 corrige 71 en 74, 2022 corrige 71 en 72.
- APTV : serie Content/Vehicle retiree (introuvable dans les documents officiels) ; growth over market remplacee par la serie des communiques (10, 15, 11, 2, 1, 1).
- SREN.SW : ratio combine P&C Re 2023 corrige 94,8 en 85,0 (IFRS 17, coherent 2024-2025).
- AJG : serie Adjusted EBITDAC Margin consolidee artificielle retiree (la serie officielle du segment Courtage existe deja sur la fiche).
- Laisses tels quels (ecart mineur, tolerance des usages financiers) : HCA admissions (0,5 %), IDXX (1,3 %), PRU (0,7 pt).
- Restent a traiter apres re-sourcage : SYK (series Mako), ARES (FRE avant retraitements).

## ROST (06/09/2026, lot 25-12)
VENTES_SURFACE en ligne avec une valeur unique non issue d une publication de la societe (la serie officielle s arrete a l exercice 2019, rubrique Selected Financial Data disparue des 10-K). A re-sourcer ou retirer apres validation du proprietaire.

## BF.B (06/09/2026, lot 30-01)
Serie en ligne des epuisements Jack Daniel's Tennessee Whiskey (6 valeurs, 12,5 a 13,4) non attribuable aux 10-K : Brown-Forman ne publie plus de volumes absolus par marque depuis l exercice 2019. Source a preciser ou serie a retirer apres validation du proprietaire.

## CCEP (06/09/2026, lot 30-02)
Serie en ligne Volume Growth (unit cases) : les deux valeurs (0,5 et 3,6) ne correspondent a aucun taux publie (officiellement 0,0 % en 2024 et 0,2 % en 2025 en volume comparable ajuste). Serie officielle en volumes absolus dans donnees/CCEP.json. A corriger apres validation du proprietaire (ecart important : la regle du 10-K fait foi s applique, correction a faire).

## JDEP.AS et KDP (06/09/2026, lot 30-05, ecarts importants : regle du 10-K fait foi, a corriger)
- JDEP.AS : serie en ligne Croissance des ventes organiques erronee (4 valeurs entieres non datees 4, 16, 4, 4 marquees trimestrielles) ; serie officielle 2020-2025 dans donnees/JDEP.AS.json.
- KDP : series annuelles Volume/mix et Net price realization non conformes aux 10-K ; valeurs officielles FY2019-FY2025 dans donnees/KDP.json. MARKET_SHARE reduit a deux points non dates.

## Corrections appliquees le 06/09/2026 au matin (regle du 10-K fait foi)
- JDEP.AS : serie Croissance des ventes organiques remplacee par la serie annuelle officielle 2020-2025 (-0,2 ; 6,1 ; 11,3 ; 3,9 ; 5,3 ; 15,3).
- KDP : Volume / Mix et Net Price Realization remplacees par les series annuelles officielles des 10-K 2019-2025.
- CCEP : Volume Growth (unit cases) corrigee en 0,0 (2024) et 0,2 (2025), volumes comparables ajustes.

## HEIA.AS (06/09/2026, lot 30-04) : identite corrigee
La fiche nommait la societe Heineken Holding N.V. alors que le ticker HEIA.AS designe Heineken N.V. (le holding est HEIO.AS). Nom corrige sur la fiche. Les KPI operationnels sont ceux de Heineken N.V., seule entite qui les publie.

## LIN (06/09/2026, lot 15-05) : corrige
Serie On-Site Mix en ligne (28 a 31 %) sans correspondance publiee ; remplacee par la note Revenue Recognition des 10-K (24, 27, 24, 23, 24 pour 2021-2025). Regle du 10-K fait foi.

## VMC (06/09/2026, lot 15-08) : corrige en partie
Les series granulats en ligne melangeaient des trimestres de 2019, 2020 et 2024 sans libelle. Remplacees par les series ANNUELLES officielles des 10-K : expeditions 2010-2025, prix ajuste du fret 2016-2025, marge brute cash par tonne 2010-2025. Reste a re-sourcer : la serie hero Aggregates gross profit per ton (meme melange de trimestres, pas de serie annuelle officielle etablie).

## STLD et SW (06/09/2026, lot 15-07) : corriges
- STLD : Steel mill utilization rate (86, 86, 89, sans exercice identifiable) remplace par la serie officielle des 10-K 2015-2025 (79 a 86).
- SW : serie Box Price (900 a 1100 $/t) introuvable dans les publications Smurfit Westrock, retiree (aucune valeur officielle de remplacement).
- SHW : deux entrees de marge segment presentes mais vides sur la fiche, a nettoyer lors du prochain passage data.

## AEE (06/09/2026, lot 55-01) : corrige en partie
Base tarifaire (hero) alignee sur les presentations officielles Ameren : 23,1 (2022), 27,0 (2024), 28,8 Mds $ (2025). Reste a clarifier : la serie Five-Year Capital Plan en ligne (6,3 a 20,8) dont la correspondance annee par annee avec les plans officiels (19,7 ; 26,3 ; 31,8) n est pas etablie ; a re-sourcer avant correction. AEP : plan quinquennal en ligne (78 Mds $) plus recent que le plan de cloture 2025 (72), pas d ecart avere.

## DTE (06/09/2026, lot 55-02)
Serie RateBase en ligne (20 a 24,5 Mds $) introuvable dans les 10-K : aucune base d actifs publiee par la societe. Source a verifier ou serie a retirer apres validation du proprietaire (probablement issue de presentations investisseurs non citees).

## ED et EOAN.DE (06/09/2026, lot 55-03) : corriges
- ED : serie Electric Rate Base (15,651 decroissant, sans correspondance 10-K) remplacee par la base CECONY electricite officielle 2014-2025 (17,3 a 29,4 Mds $).
- EOAN.DE : RAB 2020-2023 alignee sur les rapports annuels (34,9 ; 35,0 ; 36,4 ; 42,0).

## LNT et NRG (06/09/2026, lot 55-05) : corriges
- LNT : serie Rate Base consolidee (10,5 a 14,5, progression arithmetique parfaite jamais publiee) RETIREE ; aucun 10-K ne publie de base d actifs consolidee IPL plus WPL. Les comptes clients IPL/WPL arrondis au millier restent (ecart mineur tolere).
- NRG : capacite de production ramenee a 12 276 MW (10-K exercice 2025) ; les 25 GW etaient le perimetre annonce post LS Power, hors comptes.

## PPL et SO (06/09/2026, lot 55-06)
- PPL : serie Rate base growth (6,3 ; 9,8 ; 10,3 %) introuvable dans les 10-K, RETIREE de la fiche.
- SO : la serie base tarifaire 73 a 98 Mds $ signalee n existe pas sur la fiche actuelle (rien a retirer) ; Southern ne publie pas sa base d actifs, statut non_trouve au cahier.

## CBRE (06/09/2026, lot 60-01) : corrige
Serie Resilient Revenue Mix (52 a 60 %, progression reguliere sans exercices ni source retrouvee dans les 10-K) RETIREE de la fiche ; la societe ne publie ce decoupage que depuis 2023 sous des definitions changeantes.

## ORA.PA (06/09/2026, lot 50-04)
Serie PRISES_FIBRE en ligne (55,6 puis 60,1) en retard d un exercice ; valeur 2025 officielle 65,5 millions MAIS rupture de perimetre 2024 (sortie de l Espagne vers MasOrange) : les deux tranches ne sont pas chainables. A corriger en scindant la serie (pas de correction a l aveugle), donnees officielles dans donnees/ORA.PA.json.

## T (06/09/2026, lot 50-05) : corrige
Serie AT&T Fiber Locations (16,5 a 28,3, aucun perimetre officiel correspondant) remplacee par la serie officielle des prises raccordables fibre 2023-2025 (26,5 ; 28,9 ; 32,0 millions).

## TTD (06/09/2026, lot 50-06)
Serie en ligne Customer retention rate : 95 % identique sur 13 exercices alors que la societe ne publie qu un PLANCHER (superieur a 95 %), jamais de valeur exacte. Decision a prendre : annoter la serie comme plancher ou la retirer.

## VMRK (06/09/2026, contre-verif 60)
Fiche nee de la fusion AvalonBay + Equity Residential (aout 2026) nommee « Vivmark Residential » dans le lot, emetteur inexistant sur EDGAR ; les sources sont des depots AvalonBay (acquereur comptable). Identite officielle a arbitrer par le proprietaire (nom exact de l entite fusionnee).

## EOG (06/09/2026, lot 10-02) : corrige
Serie FindingCost en ligne (5,5 a 8,5, sans correspondance publiee) remplacee par la serie officielle Reserve Replacement Cost 2017-2025 (8,4 ; 9,1 ; 8,02 ; 6,69 ; 5,57 ; 5,13 ; 7,2 ; 6,68 ; 14,54 $/Boe).
