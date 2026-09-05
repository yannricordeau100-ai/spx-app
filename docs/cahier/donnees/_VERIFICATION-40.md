# Verification independante du secteur 40 (finance)

Controle mene le 5 septembre 2026 sur les 100 fiches `docs/cahier/donnees/<TICKER>.json` des societes du secteur 40.

## Methode

Toutes les series ayant au moins deux exercices renseignes ont ete retenues, quel que soit leur statut : 191 series, soit 382 valeurs sondees (la plus ancienne et la plus recente de chaque serie). Les 417 documents sources distincts ont ete telecharges et convertis en texte, puis chaque valeur a ete recherchee dans la source citee, en verifiant la presence de l exercice et du libelle du KPI a proximite. Les series calculees ont ete recalculees a partir des postes publies. Les valeurs qui n apparaissaient pas au premier passage ont fait l objet d une recherche ciblee, source par source.

## Resultat d ensemble

| Resultat | Series |
| --- | --- |
| Conforme | 185 |
| Non verifiable | 6 |
| Corrigee | 0 |
| Passee en autre | 0 |

Aucun ecart de valeur, d unite ou d exercice fiscal n a ete releve. Aucun fichier n a ete modifie ; `python3 docs/cahier/donnees/_valide.py` reste au vert (OK 329, problemes 0).

## Points a signaler

- **Allianz (ALV.DE)** : les cinq URL de rapports et supplements financiers citees sont bloquees par une protection anti-robot pour un client HTTP simple. Les memes documents ont ete recuperes par un autre canal et les dix valeurs sondees sont conformes.
- **BNP Paribas (BNP.PA)** : l URL du document d enregistrement universel 2025 renvoie une erreur 403. Le ratio 2025 de 61,2 % a ete confirme dans les diapositives officielles des resultats du quatrieme trimestre 2025, et le ratio 2017 de 69,4 % recalcule a partir des postes publies de l exercice 2017.
- **Fifth Third (FITB)** : l exercice 2015 n est couvert par aucune des cinq sources citees. La valeur a ete confirmee dans le rapport annuel 2015 de la banque (35 164 / 102 221 = 34,4 %). Il serait utile d ajouter cette source a la fiche.
- **ICE, revenu par contrat** : serie calculee. Le recalcul donne 1,078 pour 2016 alors que la fiche porte 1,07, et 1,2926 pour 2025 pour 1,29 porte. La fiche tronque au lieu d arrondir, de facon homogene sur toute la serie (2023 et 2024 suivent la meme regle). Aucune correction n a ete faite : c est une convention interne coherente, pas une erreur de lecture.
- **Hannover Re, perte a periode de retour** : l ordre des colonnes change d un rapport a l autre (rapport 2020 en tete 2020 puis 2019, rapport 2025 en tete 2024 puis 2025). La fiche suit le bon ordre dans les deux cas, mais c est un piege pour une reprise ulterieure.
- **Munich Re, boni de liquidation** : la presentation FY2025 affiche -1,8 % pour le quatrieme trimestre 2025 et -5,0 % pour l exercice. La fiche retient bien la valeur annuelle.
- **Zurich (ZURN.SW)** : la societe publie -2,3 % pour 2019 dans son graphique de decomposition ; la fiche inverse le signe pour rester homogene avec les exercices suivants, ce que le commentaire signale explicitement.

## Detail par serie

| Ticker | KPI | Annees sondees | Resultat | Detail |
| --- | --- | --- | --- | --- |
| ACA.PA | CET1 | 2020 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ACA.PA | COST_RISK | 2020 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ACA.PA | ROTE | 2019 et 2024 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ACGL | PIF_RETENTION | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ACGL | RESERVE_DEV | 2014 et 2025 | conforme | 10-K 2025 : boni par segment 43 (assurance) + 322 (reassurance) + 235 (hypothecaire) = 600 M $. 2014 = 326,9 M $ lu dans le 10-K 2016. |
| AFL | PERSISTENCY | 2021 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| AGN.AS | APE | 2014 et 2022 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| AGN.AS | EMBEDDED_VALUE | 2022 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| AGN.AS | VNB_MARGIN | 2021 et 2022 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| AIG | INVEST_YIELD | 2023 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| AIG | RESERVE_DEV | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| AIZ | RESERVE_DEV | 2014 et 2025 | conforme | Base XBRL SEC : -127,462 M $ en 2014 (arrondi a -127,5) et -142,8 M $ en 2025, ce dernier confirme aussi dans le texte du 10-K 2025. |
| ALL | RESERVE_DEV | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ALV.DE | COMBINED_RATIO | 2016 et 2025 | conforme | Sources Allianz bloquees en acces direct (Cloudflare) : documents recuperes par un autre canal. Rapport annuel 2017 : 95,2 % en 2017 et 94,3 % en 2016. Supplement financier FY2025 : 92,2 % en 2025. |
| ALV.DE | GWP_SEGMENT | 2018 et 2025 | conforme | Rapport annuel 2019, Property-Casualty total revenues 55 401 M EUR en 2018 et 59 156 en 2019 ; supplement FY2025, total business volume 86 741 M EUR. |
| ALV.DE | INVEST_YIELD | 2022 et 2025 | conforme | Presentation analystes FY2023 : current yield 2,54 % en 2022 ; FY2025 : 3,71 % en 2025 (3,77 % en 2024). |
| ALV.DE | RESERVE_DEV | 2022 et 2025 | conforme | Supplement FY2023 : run-off ratio -4,2 % en 2022 ; supplement FY2025 : -1,9 % en 2025 (et -2,1 % en 2024). |
| ALV.DE | SEGMENT_EARNINGS | 2022 et 2025 | conforme | Supplement FY2023 : operating profit P&C 6 827 M EUR en 2022 ; supplement FY2025 : 8 992 M EUR en 2025. |
| AON | ORGANIC_GROWTH | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| APO | DRY_POWDER | 2020 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| APO | NET_FLOWS | 2021 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| AXP | NIM_LOANS | 2017 et 2024 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BEN | FEE_RATE | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BLK | DRY_POWDER | 2020 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BLK | FEE_RATE | 2021 et 2025 | conforme | Serie calculee, les deux postes (commissions et encours moyen) figurent bien dans les 10-K cites ; le taux lui-meme n est pas publie par la societe, ce que le commentaire indique. |
| BNP.PA | COST_INCOME | 2017 et 2025 | conforme | URD 2025 inaccessible (403). 2025 = 61,2 % confirme dans les diapositives officielles des resultats du 4e trimestre 2025. 2017 = 69,4 % recalcule des postes publies 2017 (29 944 / 43 161). |
| BNP.PA | COST_RISK | 2019 et 2020 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BNY | NET_FLOWS | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BRK-B | BVPS_GROWTH | 2008 et 2017 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BRK-B | DRY_POWDER | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BRK-B | FLOAT | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BRO | ADJ_MARGIN | 2021 et 2025 | conforme | 10-K 2022, EBITDAC Margin - Adjusted 33,2 % en 2021 ; 10-K 2025, 35,9 % en 2025. A noter que 2022 vaut 32,8 % dans le 10-K 2022 et 32,7 % apres retraitement dans le 10-K 2023, valeur retenue. |
| BRO | FEE_MIX | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BRO | ORGANIC_GROWTH | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BX | FEE_RATE | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BX | FRE | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| BX | NET_FLOWS | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| C | COST_INCOME | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CB | RESERVE_DEV | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CINF | COMBINED_RATIO | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CINF | EXPENSE_RATIO | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CINF | LOSS_RATIO | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CINF | RESERVE_DEV | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CME | ADV | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CME | OPEN_INTEREST | 2015 et 2020 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CME | RECURRING_REV | 2015 et 2025 | conforme | Recalcul : 399,4 / 3 326,8 = 12,0 % en 2015 ; 803,1 / 6 520,6 = 12,3 % en 2025. |
| CME | RPC | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| COF | DELINQ_30 | 2013 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| COF | NCO_RATE | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| COF | NIM_LOANS | 2013 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| COF | PURCHASE_VOLUME | 2013 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| COIN | ADV | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| COIN | RECURRING_REV | 2019 et 2025 | conforme | Recalcul : 19,944 / 482,949 = 4,1 % en 2019 ; 2 828,048 / 6 883,438 = 41,1 % en 2025. |
| COIN | RPC | 2019 et 2025 | conforme | Recalcul : 463,0 M $ / 80 Mds $ = 0,579 % en 2019 ; 4 055,4 M $ / 1 221 Mds $ = 0,332 % en 2025. |
| CPAY | PAYMENT_VOLUME | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CPAY | TAKE_RATE | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CPAY | TRANSACTIONS | 2022 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CS.PA | COMBINED_RATIO | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CS.PA | GWP_SEGMENT | 2018 et 2025 | conforme | Communique FY2025 : primes brutes emises et autres revenus Dommages 58 038 M EUR en 2025. 2018 = 35 320 M EUR lu dans le communique cite, presentation par segments anterieure a IFRS 17. |
| CS.PA | RESERVE_DEV | 2023 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| CS.PA | SEGMENT_EARNINGS | 2022 et 2025 | conforme | Recalcul : 2 931 / 6 080 = 48,2 % en 2022 ; 5 872 / 8 368 = 70,2 % en 2025. |
| DB1.DE | ADV | 2016 et 2025 | conforme | Statistiques mensuelles officielles recalculees : 2016 = 1 727,5 M contrats / 256 jours = 6,748 M ; 2025 = 8,166 M. |
| DB1.DE | ASSETS_INDEXED | 2016 et 2025 | conforme | Statistiques mensuelles, encours des fonds indiciels STOXX et DAX en decembre : 91,5 Mds EUR en 2016, 189,1 en 2025. |
| DB1.DE | OPEN_INTEREST | 2016 et 2025 | conforme | Statistiques mensuelles, encours notionnel de compensation de gre a gre en decembre : 948 Mds EUR en 2016, 43 668 en 2025. |
| DBK.DE | RWA_DENSITY | 2015 et 2025 | conforme | Recalcul : 396 714 / 1 629 130 = 24,4 % en 2015 ; 347 133 / 1 440 000 = 24,1 % en 2025. Denominateurs pris dans la base XBRL SEC. |
| DBK.DE | VAR | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| EDEN.PA | PAYMENT_VOLUME | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| EDEN.PA | VAS_SHARE | 2022 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| EG | GWP_MIX | 2019 et 2025 | conforme | Recalcul 2019 : (9 133,4 - 2 777,5) / 9 133,4 = 69,6 %. 2025 = 72,4 % indique explicitement dans le 10-K 2025. |
| EG | PML_RETURN | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| EG | RESERVE_DEV | 2013 et 2025 | conforme | Base XBRL SEC : -18,239 M $ en 2013 (arrondi -18,2) et 657 M $ en 2025. |
| ENX.PA | ADV | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ENX.PA | OPEN_INTEREST | 2020 et 2024 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ENX.PA | RECURRING_REV | 2021 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ENX.PA | RPC | 2019 et 2024 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ERIE | CLIENT_RETENTION | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ERIE | NEW_BUSINESS | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| FIS | PAYMENT_VOLUME | 2019 et 2022 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| FIS | TRANSACTIONS | 2019 et 2022 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| FITB | EFFICIENCY | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| FITB | NCO | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| FITB | NIB_DEPOSITS | 2015 et 2025 | conforme | 2025 : 40 926 / 165 228 = 24,8 % (10-K 2025). 2015 non couvert par les sources citees : verifie dans le 10-K 2015 (35 164 / 102 221 = 34,4 %). |
| FITB | NIM | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| GL | BENEFIT_RATIO | 2015 et 2025 | conforme | Base XBRL SEC : 2 016,2 / 2 998,7 = 67,2 % en 2015 ; 2 884,3 / 4 890,2 = 59,0 % en 2025. |
| GLE.PA | CET1 | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| GLE.PA | COST_INCOME | 2018 et 2025 | conforme | Recalcul 2018 : 17 931 / 25 205 = 71,1 %. 2025 = 63,6 % publie tel quel dans le communique du 4e trimestre 2025. |
| GLE.PA | COST_RISK | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| GLE.PA | ROTE | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| GS | IB_FEES | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| GS | NNA | 2023 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| HBAN | NCO | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| HBAN | NIB_DEPOSITS | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| HIG | PIF_RETENTION | 2016 et 2024 | conforme | Supplement financier : automobile 1 965 + habitation 1 176 = 3 141 milliers fin 2016 ; 1 171 + 712 = 1 883 fin 2024. |
| HIG | RESERVE_DEV | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| HNR1.DE | COMBINED_RATIO | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| HNR1.DE | GWP_MIX | 2016 et 2022 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| HNR1.DE | PML_RETURN | 2019 et 2025 | conforme | Attention a l ordre des colonnes, qui change : rapport 2020 en tete 2020 puis 2019 (-1 594 / -1 595), rapport 2025 en tete 2024 puis 2025 (-2 510 / -2 607). La fiche suit le bon ordre dans les deux cas. |
| HNR1.DE | RENEWAL_PRICE | 2020 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| HOOD | NNA | 2021 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ICE | ADV | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ICE | OPEN_INTEREST | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ICE | RECURRING_REV | 2020 et 2025 | conforme | Recalcul : 2 923 / 6 036 = 48,4 % en 2020 ; 5 056 / 9 931 = 50,9 % en 2025. |
| ICE | RPC | 2016 et 2025 | conforme | Serie calculee. 2025 recalcule a 1,2926 -> 1,29. 2016 recalcule a 1,078 : la fiche retient 1,07, troncature et non arrondi. Convention appliquee de facon homogene sur toute la serie (2023 1,355 -> 1,35 ; 2024 1,307 -> 1,30), aucune correction faite. |
| INGA.AS | CET1 | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| INGA.AS | COST_INCOME | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| INGA.AS | COST_RISK | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| INGA.AS | NIM | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| INGA.AS | ROTE | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| IVZ | FEE_RATE | 2020 et 2024 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| JPM | CET1 | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| JPM | COST_INCOME | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| JPM | NIM | 2016 et 2025 | conforme | 10-K 2018 : marge en base geree 2,25 % en 2016 ; 10-K 2025 : 2,50 % en 2025. |
| JPM | ROTE | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| KEY | EFFICIENCY | 2016 et 2023 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| KEY | NCO | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| KEY | NIB_DEPOSITS | 2019 et 2025 | non verifiable | 2025 = 27 985 / 149 276 = 18,7 % confirme (10-K 2025). 2019 : le depot moyen non remunere 2019 (28 376) est confirme mais le total des depots moyens 2019 n a pas pu etre isole pour recalculer 25,8 %. |
| KEY | NIM | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| KKR | AUM | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| KKR | DRY_POWDER | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| KKR | FRE | 2020 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| L | COMBINED_RATIO | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| L | GWP_SEGMENT | 2018 et 2024 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| L | INVEST_YIELD | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| L | RESERVE_DEV | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MA | CROSS_BORDER | 2016 et 2025 | non verifiable | 2025 = 15 % confirme (10-K 2025). 2016 = 12 % : aucune des sources citees ne couvre l exercice 2016, le plus ancien communique cite est celui du 4e trimestre 2017. |
| MA | PAYMENT_VOLUME | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MA | TRANSACTIONS | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MA | VAS_SHARE | 2021 et 2025 | conforme | Recalcul 2025 : 13 315 / 32 791 = 40,6 %. 2021 = 36,8 % sur les memes postes du 10-K 2021. |
| MCO | RECURRING_REV | 2019 et 2025 | non verifiable | 2025 = 4 840 / 7 718 = 62,7 % -> 63 confirme (10-K 2025). 2019 = 56 % : la colonne 2019 du tableau transaction/recurrent n a pas pu etre lue dans le texte extrait du 10-K 2021. |
| MET | BENEFIT_RATIO | 2016 et 2025 | conforme | Recalcul 2025 : 49 718 / 49 779 = 99,9 %. 2016 = 97,7 % lu dans le compte de resultat du 10-K 2018. |
| MRSH | ADJ_MARGIN | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MRSH | ORGANIC_GROWTH | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MS | DARTS | 2018 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MS | IB_FEES | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MS | NNA | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MS | VAR_EFF | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MSCI | ASSETS_INDEXED | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MSCI | RECURRING_REV | 2016 et 2025 | conforme | Recalcul : (1 150,669 - 210,229 - 26,771) / 1 150,669 = 79,4 % en 2016 ; 2 278,704 / 3 134,459 = 72,7 % en 2025. |
| MSCI | RETENTION | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MTB | CRE_CONC | 2019 et 2024 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MTB | NIB_DEPOSITS | 2014 et 2025 | conforme | Base XBRL SEC : 26 947,9 / 73 582,1 = 36,6 % en 2014 ; 46 509 / 166 909 = 27,9 % en 2025. |
| MUV2.DE | RENEWAL_PRICE | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| MUV2.DE | RESERVE_DEV | 2019 et 2025 | conforme | Presentation FY2025, annexe reassurance dommages : reserve releases -1,8 % au 4e trimestre 2025 mais -5,0 % sur l exercice 2025. C est bien la valeur annuelle qui est retenue. |
| NN.AS | APE | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| NN.AS | VNB_MARGIN | 2019 et 2025 | conforme | Recalcul : 358 / 1 741 = 20,6 % en 2019 ; 442 / 1 318 = 33,5 % en 2025. |
| NTRS | NET_FLOWS | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PFG | BENEFIT_RATIO | 2012 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PGHN.SW | FEE_RATE | 2012 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PGHN.SW | FRE | 2020 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PGHN.SW | NET_FLOWS | 2021 et 2025 | non verifiable | Serie reconstituee a partir de trois postes du tableau d evolution des encours ; ces postes ne sont pas isolables dans le texte extrait des rapports annuels PDF. Ni 2021 ni 2025 n a pu etre recoupe. |
| PGR | RESERVE_DEV | 2014 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PNC | COST_INCOME | 2012 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PNC | NIM | 2012 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PNC | ROTE | 2012 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PRU | APE | 2014 et 2025 | non verifiable | Serie reconstituee par somme des tableaux annualized new business premiums de chaque segment. Les tableaux existent bien dans les quatre 10-K cites mais la somme des segments n a pas pu etre reconstituee ligne a ligne dans le texte extrait. |
| PRU | BENEFIT_RATIO | 2014 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| PYPL | VAS_SHARE | 2016 et 2025 | conforme | Recalcul : 1 352 / 10 842 = 12,47 % en 2016 ; 3 374 / 33 172 = 10,17 % en 2025. |
| RF | CRE_CONC | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| RJF | VAR_EFF | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SLHN.SW | APE | 2012 et 2016 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SLHN.SW | EMBEDDED_VALUE | 2012 et 2016 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SLHN.SW | VNB_MARGIN | 2016 et 2023 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SPGI | ASSETS_INDEXED | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SPGI | RECURRING_REV | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SREN.SW | COMBINED_RATIO | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SREN.SW | GWP_MIX | 2016 et 2022 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SREN.SW | PML_RETURN | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SREN.SW | RENEWAL_PRICE | 2023 et 2026 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| STT | AUC | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| STT | AUM | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SYF | ACTIVE_CARDS | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SYF | DELINQ_30 | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SYF | NCO_RATE | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SYF | NIM_LOANS | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| SYF | PURCHASE_VOLUME | 2015 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| TFC | CET1 | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| TFC | COST_INCOME | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| TFC | COST_RISK | 2020 et 2025 | non verifiable | Serie calculee (dotation nette / encours moyen). Le 10-K 2025 confirme une dotation de 1,9 Md $ et un taux de pertes nettes de 0,54 %, mais le denominateur retenu n a pas pu etre isole pour recalculer 59,9 pb ; 2020 non recoupe. |
| TFC | NIM | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| TFC | ROTE | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| TROW | FEE_RATE | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| TRV | RESERVE_DEV | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| UBSG.SW | ROTE | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| UBSG.SW | RWA_DENSITY | 2016 et 2025 | conforme | Recalcul 2025 : 493 397 / 1 617 427 = 30,5 %. 2016 = 23,8 % sur les memes postes du rapport annuel 2018. |
| UBSG.SW | VAR | 2017 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| USB | COST_RISK | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| V | VAS_SHARE | 2023 et 2025 | conforme | 10-K 2025 : revenus des services a valeur ajoutee 10,9 Mds $ en 2025, 7,2 en 2023, pour un revenu net de 40,0 et 32,7 Mds $. |
| WFC | COST_RISK | 2016 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| XYZ | TRANSACTIONS | 2022 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ZURN.SW | INVEST_YIELD | 2019 et 2025 | conforme | Les deux valeurs retrouvees dans la source citee, au voisinage de l exercice et du libelle du KPI. |
| ZURN.SW | RESERVE_DEV | 2019 et 2025 | conforme | Rapport 2020, decomposition du ratio combine : -2,3 % en 2019 et -1,6 % en 2020 ; rapport 2025 : developpement favorable de 1,8 %. Le signe est inverse dans la fiche, ce que le commentaire signale. |
