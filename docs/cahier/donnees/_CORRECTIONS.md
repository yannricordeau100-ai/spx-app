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
