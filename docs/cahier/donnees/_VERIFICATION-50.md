# Verification independante du secteur 50 (services de communication)

Perimetre : les 31 societes listees dans `_lots/50-01.json` a `_lots/50-07.json`.

Regle appliquee : toute serie d'au moins deux annees (statut `trouve`, ou `existe` / `autre`
avec des annees renseignees) a ete sondee sur deux valeurs, la plus ancienne et la plus
recente, dans la source citee par le fichier, avec controle de l'unite et de l'exercice
fiscal. Les sources ont ete telechargees directement (documents SEC, rapports annuels PDF,
communiques de resultats) et les valeurs relues dans leur tableau ou leur phrase d'origine.

Resultat global : 74 series sondees, 148 valeurs relues, 74 conformes, 0 correction,
0 serie non verifiable, 0 passage en `autre`.

Les tickers jumeaux (FOX / FOXA, NWS / NWSA, GOOG / GOOGL) portent des series strictement
identiques, valeurs et sources comprises : la verification a ete faite une fois et vaut pour
les deux fichiers.

## Tableau des controles

| Ticker | KPI | Annees sondees | Resultat | Detail |
| --- | --- | --- | --- | --- |
| CHTR | AJOUTS_NETS_HD | 2016, 2025 | conforme | 10-K 2017 : hausse pro forma de 1 463 000 en 2016 ; 10-K 2025 : baisse de 393 000. Unite en milliers, exercice au 31 decembre. |
| CHTR | AJOUTS_NETS_VIDEO | 2016, 2025 | conforme | 10-K 2017 : baisse pro forma de 226 000 ; 10-K 2025 : baisse de 255 000. |
| CHTR | ARPU_RELATION | 2016, 2025 | conforme | 10-K 2017 : 109,57 $ en colonne 2016 ; 10-K 2025 : 119,05 $. Mesure annuelle, pas trimestrielle. |
| CHTR | PRISES_COMMERCIALISABLES | 2018, 2025 | conforme | Communique T4 2019 : 51 185 milliers ; communique T4 2025 : 58 399 milliers. Conversion en millions correcte. |
| CHTR | PENETRATION_HD | 2015, 2018 | conforme | Communique T4 2016 : 43,7 % pro forma ; communique T4 2018 : 49,9 %. |
| CMCSA | AJOUTS_NETS_HD | 2015, 2025 | conforme | 10-K 2017 : +1 367 en 2015 ; 10-K 2025 : -711. |
| CMCSA | AJOUTS_NETS_VIDEO | 2015, 2025 | conforme | 10-K 2017 : -36 en 2015 ; 10-K 2025 : -1 253. |
| CMCSA | ARPU_RELATION | 2021, 2025 | conforme | 10-K 2023 : 129,41 $ ; 10-K 2025 : 131,77 $. Perimetre Connectivity and Platforms. |
| CMCSA | PRISES_COMMERCIALISABLES | 2021, 2025 | conforme | 60 527 puis 64 983 milliers, convertis en millions. |
| CMCSA | PENETRATION_HD | 2021, 2025 | conforme | 52,8 % puis 47,6 %. |
| DIS | ABONNES_STREAMING | 2022, 2025 | conforme | 10-K 2023 : 102,9 millions au 1er octobre 2022 ; 10-K 2025 : 131,6 millions au 27 septembre 2025. Exercice fiscal clos fin septembre bien respecte. |
| DIS | ARM_STREAMING | 2022, 2025 | conforme | 6,22 $ puis 7,81 $ par mois. |
| DTE.DE | ARPU | 2018, 2025 | conforme | Source declaree T-Mobile US : 10-K 2020 donne 46,40 $ en 2018, 10-K 2025 donne 50,37 $. Statut `autre` justifie par le perimetre Etats-Unis. |
| DTE.DE | CHURN_POSTPAYE | 2018, 2025 | conforme | 1,01 % en 2018 et 0,93 % en 2025, taux mensuels T-Mobile US. |
| DTE.DE | AJOUTS_NETS_HD | 2018, 2025 | conforme | Rapport annuel 2018 : lignes haut debit de detail 13 561 contre 13 209, variation +352 ; rapport 2025 : 15 103 contre 15 152, variation -49. |
| DTE.DE | PRISES_FIBRE | 2020, 2025 | conforme | Rapport 2020 : plus de deux millions de foyers ayant l'option d'un raccordement direct ; rapport 2025 : 12,6 millions. Valeurs arrondies par l'emetteur, comme indique dans le commentaire. |
| EA | RESERVATIONS_NETTES | 2020, 2026 | conforme | 10-K 2021 : 5 372 M$ pour l'exercice clos en mars 2020 ; 10-K 2026 : 8 026 M$. |
| EA | DEPENSES_RECURRENTES | 2021, 2026 | conforme | 4 592 / 6 190 = 74,2 % ; 5 630 / 8 026 = 70,1 %. Les deux montants figurent dans le meme 10-K. |
| EA | PART_TELECHARGEMENT | 2018, 2020 | conforme | 3 538 / 5 180 = 68,3 % ; 4 052 / 5 211 = 77,8 %. |
| ECHO | AJOUTS_NETS_POSTPAYES | 2021, 2025 | conforme | 10-K 2022 : perte de 728 000 en 2021 ; 10-K 2025 : gain de 576 000. |
| ECHO | CHURN_POSTPAYE | 2021, 2025 | conforme | 4,58 % puis 2,84 % par mois. |
| ECHO | ARPA | 2021, 2025 | conforme | 39,00 $ puis 37,41 $. Reserve deja portee au commentaire : mesure par abonne, pas par compte. |
| ECHO | COUVERTURE_5G | 2023, 2024 | conforme | Seuils reglementaires : engagement de 70 % de la population a juin 2023, certification de 80 % au 31 decembre 2024. Nature de la donnee bien decrite dans le commentaire. |
| FOX et FOXA | PART_AUDIENCE | 2024, 2026 | conforme | 10-K 2024 : environ 2,0 % de l'ecoute television ; 10-K 2026 : environ 2,2 % en moyenne annuelle. |
| FOX et FOXA | ABONNES_DISTRIBUES | 2018, 2026 | conforme | 10-K 2019 : FOX News 87 millions au 30 juin 2018 ; 10-K 2026 : 55 millions au 30 juin 2026. |
| G24.DE | UTILISATEURS_ACTIFS | 2022, 2025 | conforme | 14,7 + 3,7 = 18,4 millions en 2022 ; 14,9 + 4,2 = 19,1 millions en 2025. Somme site plus application, comme annonce. |
| G24.DE | REVENU_PAR_UTILISATEUR | 2023, 2025 | conforme | 935 EUR par mois en 2023, 1 096 EUR en 2025, segment Professional. |
| G24.DE | VOLUME_ANNONCES | 2020, 2025 | conforme | -3,9 % en 2020 et +13,5 % en 2025, variations publiees. |
| GOOG et GOOGL | VOLUME_ANNONCES | 2017, 2025 | conforme | 10-K 2018 : impressions du reseau +3 % en 2017 ; 10-K 2025 : -7 %. |
| GOOG et GOOGL | PRIX_PAR_ANNONCE | 2017, 2025 | conforme | Cout par impression +8 % en 2017 et +7 % en 2025. |
| KPN.AS | PRISES_FIBRE | 2022, 2025 | conforme | Communique T4 2022 : 3 710 milliers selon la definition entree en vigueur au premier trimestre 2023 ; communique T4 2025 : 4 942 milliers pour le reseau KPN seul. |
| LYV | BILLETS_VENDUS | 2014, 2025 | conforme | 10-K 2016 : 163 184 milliers de billets factures ; 10-K 2025 : 345 987 milliers. Conversion en millions correcte. |
| META | UTILISATEURS_ACTIFS | 2018, 2025 | conforme | 2,03 milliard en decembre 2018 et 3,58 milliards en decembre 2025. |
| META | REVENU_PAR_UTILISATEUR | 2023, 2025 | conforme | Somme des quatre trimestres 2023 du tableau du 10-K 2024 : 9,47 + 10,42 + 10,93 + 12,33 = 43,15 $ ; 57,03 $ enonce pour 2025. Meme methode que celle publiee par l'emetteur. |
| META | VOLUME_ANNONCES | 2011, 2025 | conforme | 10-K 2012 : hausse de 42 % du nombre d'annonces en 2011 ; 10-K 2025 : impressions en hausse de 12 %. |
| META | PRIX_PAR_ANNONCE | 2011, 2025 | conforme | +18 % en 2011 et +9 % en 2025. |
| NFLX | ABONNES_STREAMING | 2015, 2024 | conforme | 10-K 2019 : 16 363 milliers d'ajouts nets payants en 2015 ; 10-K 2024 : 41 350 milliers. Reserve deja au commentaire : la serie porte les ajouts nets, pas le parc. |
| NFLX | ARM_STREAMING | 2013, 2024 | conforme | 8,03 $ puis 11,70 $ par mois, mesure mondiale. |
| NWS et NWSA | ABONNES_NUMERIQUES | 2017, 2026 | conforme | 10-K 2017 : 1 270 milliers d'abonnements numeriques seuls ; 10-K 2026 : 4 465 milliers. Exercice clos le 30 juin. |
| NWS et NWSA | DIFFUSION_PAYEE | 2017, 2026 | conforme | 2 277 milliers puis 4 827 milliers d'abonnements totaux. |
| NWS et NWSA | PART_CA_NUMERIQUE | 2018, 2026 | conforme | 10-K 2020 : 63 % en 2019 contre 60 % en 2018 ; 10-K 2026 : 84 %. Perimetre Dow Jones, statut `autre` justifie. |
| OMC | CROISSANCE_ORGANIQUE | 2005, 2024 | conforme | 10-K 2005 : croissance organique de 7,3 % ; 10-K 2024 : 5,2 %. |
| ORA.PA | PRISES_FIBRE | 2021, 2025 | conforme | Communique 2021 : 56,5 millions de foyers raccordables ; communique 2025 : 65,5 millions hors MasOrange et FiberCos. |
| PSKY | ABONNES_STREAMING | 2021, 2025 | conforme | 10-K 2021 : 32,8 millions ; 10-K 2025 : 78,9 millions au 31 decembre 2025. |
| PUB.PA | CROISSANCE_ORGANIQUE | 2015, 2025 | conforme | Communique 2015 : +1,5 % ; presentation 2025 : +5,6 %. |
| SCMN.SW | ARPU | 2022, 2025 | conforme | Facts and Figures : colonne 31.12.2022 a 47 CHF, colonne 31.12.2025 a 42 CHF. |
| SCMN.SW | CHURN_POSTPAYE | 2022, 2025 | conforme | 8,1 % puis 8,4 %, taux annualises. L'unite du fichier precise bien un taux annuel. |
| SCMN.SW | AJOUTS_NETS_HD | 2022, 2025 | conforme | Rapport 2022 : 2 027 contre 2 037 milliers, variation -10 ; rapport 2025 : 1 938 contre 1 967, variation -29. |
| T | ARPU | 2014, 2025 | conforme | Annexe 13 du 10-K 2016 : 62,99 $ en 2014 ; tableau de tendances T4 2025 : 56,70 $. |
| T | CHURN_POSTPAYE | 2014, 2025 | conforme | 0,97 % en 2014 et 0,90 % en 2025. |
| T | AJOUTS_NETS_HD | 2019, 2025 | conforme | 10-K 2021 : 1 124 milliers d'ajouts nets fibre en 2019 ; 10-K 2025 : 1 075. |
| T | PRISES_FIBRE | 2023, 2025 | conforme | Tableau de tendances T4 2025 : 26,5 millions fin 2023 et 32,0 millions fin 2025. |
| T | PENETRATION_FIBRE | 2021, 2025 | conforme | Tableau T4 2023 : 37 % au 31 decembre 2021 ; tableau T4 2025 : 40 % en 2025. |
| TMUS | AJOUTS_NETS_POSTPAYES | 2012, 2025 | conforme | 10-K 2014 : perte de 2 092 000 en 2012 ; 10-K 2025 : 3 294 milliers. |
| TMUS | CHURN_POSTPAYE | 2012, 2025 | conforme | 2,33 % en 2012 et 0,93 % en 2025. |
| TMUS | ARPA | 2018, 2025 | conforme | 10-K 2020 : 128,86 $ en 2018 ; 10-K 2025 : 148,97 $. |
| TMUS | COUVERTURE_5G | 2021, 2023 | conforme | 10-K 2021 : 310 millions de personnes, soit 94 % des Americains ; 10-K 2023 : plus de 330 millions, soit 98 %. |
| TTD | DEPENSES_GEREES | 2014, 2025 | conforme | 10-K 2017 : gross spend 211 266 milliers de dollars en 2014 ; 10-K 2025 : 13 394 683 milliers. Conversion en milliards correcte. |
| TTWO | RESERVATIONS_NETTES | 2018, 2026 | conforme | 10-K de mars 2019 : 1 990,602 M$ pour l'exercice 2018 ; 10-K de mars 2026 : 6 721,0 M$. |
| TTWO | DEPENSES_RECURRENTES | 2017, 2026 | conforme | 10-K de mars 2018 : 25,8 % pour l'exercice precedent ; 10-K de mars 2026 : 78,1 %. |
| TTWO | PART_TELECHARGEMENT | 2016, 2026 | conforme | 49,3 % puis 97,0 % du chiffre d'affaires net. |
| VZ | ARPU | 2018, 2025 | conforme | Annexe 13 du 10-K 2019 : ARPA 115,48 $ en 2018 ; 10-K 2025 : 147,31 $. |
| VZ | CHURN_POSTPAYE | 2018, 2025 | conforme | 0,76 % en 2018 et 0,92 % en 2025. |
| VZ | AJOUTS_NETS_HD | 2021, 2025 | conforme | 10-K 2022 : 328 (Consumer) plus 81 (Business) = 409 en 2021 ; 10-K 2025 : 844 plus 466 = 1 310 en 2025. Somme des deux segments verifiee. |
| VZ | PRISES_FIBRE | 2007, 2010 | conforme | Annexe 13 du 10-K 2007 : 9,3 millions de prises ; annexe 13 du 10-K 2010 : 15,6 millions. |
| VZ | PENETRATION_FIBRE | 2007, 2015 | conforme | 20,6 % de penetration FiOS data fin 2007 ; 41,8 % de penetration Fios Internet fin 2015. |
| WBD | ABONNES_DISTRIBUES | 2008, 2021 | conforme | 10-K 2008 : environ 99 millions d'abonnes americains de Discovery Channel ; 10-K 2021 : environ 81 millions. |

## Observations sans consequence sur les fichiers

Ces points ne sont pas des ecarts : ils sont deja enonces dans le champ `commentaire` de la
serie concernee et sont rappeles ici pour memoire du lecteur.

- NFLX ABONNES_STREAMING porte des ajouts nets d'abonnements et non un parc d'abonnes.
- ECHO ARPA est un revenu par abonne mobile, l'emetteur ne publiant aucune mesure par compte.
- ECHO COUVERTURE_5G reprend des seuils reglementaires et non une mesure de couverture annuelle.
- DTE.DE ARPU et CHURN_POSTPAYE portent sur la filiale americaine, d'ou le statut `autre`.
- NWS et NWSA PART_CA_NUMERIQUE porte sur le seul secteur Dow Jones, d'ou le statut `autre`.
- SCMN.SW CHURN_POSTPAYE est un taux annualise, unite differente des operateurs americains.
- DTE.DE PRISES_FIBRE reprend des valeurs arrondies par l'emetteur pour les exercices 2020 a 2023.

## Suite du controle

Aucune correction n'a ete apportee aux fichiers de donnees. Le controle
`python3 docs/cahier/donnees/_valide.py` reste au vert.
