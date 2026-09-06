# Contrôle indépendant des séries du secteur 30

Date du contrôle : 6 septembre 2026. Périmètre : les 48 sociétés du secteur 30 (`_lots/30-*.json`).

Méthode : pour chaque série d au moins deux exercices (statut `trouve`, ou `existe` / `autre` avec des années renseignées), la valeur la plus ancienne et la valeur la plus récente ont été relevées dans la source citée, en contrôlant aussi l unité et l exercice fiscal. Les sources injoignables ont été reprises par résolution du dépôt EDGAR, puis par web.archive.org, puis par recherche du chiffre exact.

Résultat d ensemble : 105 séries sondées, 210 valeurs contrôlées, 105 séries conformes, aucune correction de valeur, aucune série passée en `autre`.

| Ticker | KPI | Années sondées | Résultat | Détail |
|---|---|---|---|---|
| AD.AS | DIGITAL_SALES | 2018 et 2025 | conforme | 3 494 M EUR et 13 399 M EUR, ligne Net consumer online sales |
| AD.AS | SSS_EXFUEL | 2017 et 2025 | conforme | 0,5 % (RA 2018) et 3,0 % (RA 2025, ligne Comparable sales growth excluding gasoline sales) |
| ADM | PROCESS_VOL | 2013 et 2025 | conforme | 31 768 et 36 324 milliers de tonnes, ligne Oilseeds du tableau Processed volumes |
| BEI.DE | AP_SPEND | 2012 et 2025 | conforme | 1 460 M EUR et 2 209 M EUR, depenses publicite et marketing commercial |
| BEI.DE | ORGANIC_GROWTH | 2009 et 2025 | conforme | -0,7 % (RA 2009) et 2,4 % (RA 2025, ligne Change organic groupe) |
| BF.B | AGING_INVENTORY | 2006 et 2026 | conforme | 274 M$ et 1 562 M$, ligne Barreled whiskey du bilan (exercices clos le 30 avril) |
| BF.B | DEPLETIONS | 2012 et 2018 | conforme | 10 760 milliers de caisses et 13,0 M caisses ; URL du 10-K 2018 erronee (404), corrigee |
| BF.B | ORGANIC_GROWTH | 2014 et 2021 | conforme | 6 % et 6 %, ligne Change in underlying net sales |
| BF.B | SHIP_VS_DEPL | 2014 et 2021 | conforme | +1 pt et +4 pts, ligne Estimated net change in distributor inventories |
| BG | ORIGINATION_VOL | 2023 et 2025 | conforme | 11 851 et 20 489 milliers de tonnes de soja negocie |
| BG | PROCESS_VOL | 2023 et 2025 | conforme | 35 950 et 41 013 milliers de tonnes de soja triture |
| BN.PA | ORGANIC_GROWTH | 2014 et 2025 | conforme | +4,7 % et +4,5 % en donnees comparables |
| CAG | ORGANIC_GROWTH | 2018 et 2026 | conforme | -0,2 % et -0,4 % organic net sales (exercices clos en mai) |
| CASY | FUEL_MARGIN | 2011 et 2026 | conforme | 15,2 et 42,6 cents par gallon hors frais de carte |
| CASY | SSS_EXFUEL | 2020 et 2026 | conforme | 0,8 % et 4,2 % inside same-store sales (exercices clos le 30 avril) |
| CCEP | LOW_SUGAR_MIX | 2023 et 2024 | conforme | 48,3 % et 49,9 % du volume en boissons pauvres ou sans calories |
| CCEP | ORGANIC_GROWTH | 2016 et 2025 | conforme | +1,0 % (pro forma fx-neutral 2016) et +2,8 % (comparable ajuste fx-neutral 2025) |
| CCEP | UNIT_CASE_VOL | 2016 et 2025 | conforme | 2 502 et 3 958 millions de caisses-unites |
| CHD | AP_SPEND | 2008 et 2025 | conforme | 294,1/2 422,4 = 12,1 % et 11,4 % des ventes nettes |
| CHD | ECOM_PEN | 2023 et 2024 | conforme | 20 % et 21,4 % des ventes consommateurs en ligne |
| CHD | ORGANIC_GROWTH | 2008 et 2025 | conforme | environ 7 % et 0,7 % de croissance organique |
| CL | AP_SPEND | 2006 et 2025 | conforme | 1 320,3 M$ et 2 703 M$ de publicite |
| CL | ORGANIC_GROWTH | 2008 et 2025 | conforme | 9,5 % et 1,4 % de croissance organique |
| CLX | AP_SPEND | 2009 et 2026 | conforme | 9,2 % et 11,1 % des ventes nettes |
| CLX | ORGANIC_GROWTH | 2020 et 2026 | conforme | +10 % et -8 % (colonne Total du tableau Organic Sales Growth, exercices clos le 30 juin) |
| COST | CATEGORY_MIX | 2019 et 2025 | conforme | 59 672 M$ et 109 564 M$ Foods and Sundries |
| COST | COMP_SALES | 2006 et 2025 | conforme | 8 % et 6 % de ventes comparables totales |
| COST | ECOM_PEN | 2018 et 2025 | conforme | environ 4 % et 7 % des ventes nettes |
| COST | MEMBERSHIP | 2006 et 2025 | conforme | 1 188 M$ et 5 323 M$ de cotisations |
| CPB | ORGANIC_GROWTH | 2011 et 2026 | conforme | -1 % et -2 % organic (exercices clos en juillet ou aout) |
| DG | CATEGORY_MIX | 2006 et 2026 | conforme | 65,3 % et 82,0 % de consommables |
| DG | COMP_SALES | 2006 et 2026 | conforme | 2,2 % (exercice clos fevrier 2006) et 3,0 % (exercice clos janvier 2026) |
| DG | STORE_EXPANSION | 2006 et 2026 | conforme | 7 929 et 20 893 magasins |
| DLTR | CATEGORY_MIX | 2013 et 2026 | conforme | 49,9 % et 48,6 % de consommables |
| DLTR | COMP_SALES | 2010 et 2026 | conforme | 7,2 % et 5,3 % de ventes comparables |
| DLTR | STORE_EXPANSION | 2010 et 2026 | conforme | 3 806 et 9 282 magasins |
| EL | ORGANIC_GROWTH | 2022 et 2026 | conforme | 8 % et 3 % de croissance organique (exercices clos le 30 juin) |
| GIS | INPUT_INFLATION | 2012 et 2026 | conforme | 10 % et 4 % d inflation des coûts d intrants |
| GIS | ORGANIC_GROWTH | 2016 et 2026 | conforme | flat (0 %) et -2 % organic net sales |
| HEIA.AS | NET_REV_HL | 2018 et 2025 | conforme | +2,0 % et +3,8 % de chiffre d affaires net par hectolitre |
| HEIA.AS | ORGANIC_GROWTH | 2018 et 2025 | conforme | +6,1 % et +1,6 % de croissance organique du chiffre d affaires net beia |
| HEIA.AS | VOLUMES_HL | 2005 et 2024 | conforme | 88,3 et 240,7 millions d hl de volume biere consolide |
| HEN.DE | ORGANIC_GROWTH | 2006 et 2025 | conforme | +6,0 % et +0,9 % de croissance organique |
| HEN3.DE | ORGANIC_GROWTH | 2006 et 2015 | conforme | +6,0 % et +3,0 % de croissance organique |
| HRL | ORGANIC_GROWTH | 2017 et 2025 | conforme | 3,0 % et 2,5 % organic net sales |
| HSY | ORGANIC_GROWTH | 2019 et 2025 | conforme | 1,8 % et 4,2 % organic constant currency |
| JDEP.AS | ORGANIC_GROWTH | 2020 et 2025 | conforme | -0,2 % et +15,3 % de croissance organique |
| KDP | LOW_SUGAR_MIX | 2020 et 2025 | conforme | 54 % et 61 % |
| KDP | ORGANIC_GROWTH | 2019 et 2025 | conforme | volume/mix +2,6 % et +4,8 % |
| KDP | UNIT_CASE_VOL | 2023 et 2025 | conforme | LRB -0,1 % et +1,0 % |
| KHC | ORGANIC_GROWTH | 2015 et 2025 | conforme | -1,6 % et -3,4 % Organic Net Sales |
| KMB | AP_SPEND | 2004 et 2025 | conforme | 421,3 M$ et 1 020 M$ de publicite (note Supplemental Data) |
| KMB | ORGANIC_GROWTH | 2015 et 2025 | conforme | 5 % et 1,7 % de croissance organique |
| KO | CONCENTRATE_GAP | 2006 et 2025 | conforme | ecart nul en 2006 (caisses 4 %, gallons 4 %) et +1 point en 2025 |
| KO | LOW_SUGAR_MIX | 2022 et 2024 | conforme | 28,7 % et 30,0 % |
| KO | ORGANIC_GROWTH | 2015 et 2025 | conforme | +4 % et +5 % de chiffre d affaires organique |
| KO | UNIT_CASE_VOL | 2004 et 2025 | conforme | 19,8 et 33,8 milliards de caisses-unites |
| KR | DIGITAL_SALES | 2017 et 2025 | conforme | +90 % et +16 % de ventes numeriques |
| KR | SSS_EXFUEL | 2006 et 2025 | conforme | 5,6 % et 2,9 % de ventes identiques hors carburant |
| KVUE | AP_SPEND | 2020 et 2025 | conforme | 1 230 M$ et 1 836 M$ de publicite |
| KVUE | ORGANIC_GROWTH | 2020 et 2025 | conforme | +2,9 % et -2,2 % de croissance organique |
| MDLZ | ORGANIC_GROWTH | 2013 et 2025 | conforme | +3,9 % et +4,3 % Organic Net Revenue |
| MKC | ORGANIC_GROWTH | 2015 et 2025 | conforme | +6,4 % (devises constantes) et +1,9 % (organique) |
| MNST | ORGANIC_GROWTH | 2022 et 2025 | conforme | +18,2 % et +10,7 % a devises constantes |
| MNST | UNIT_CASE_VOL | 2005 et 2025 | conforme | 48 214 et 958 955 milliers de caisses de 192 onces |
| MO | MARKET_SHARE | 2006 et 2025 | conforme | part de marche Marlboro 40,5 % aux deux bornes |
| MO | SHIPMENT_VOL | 2006 et 2025 | conforme | 183,4 et 61,752 milliards de cigarettes expediees |
| MO | SMOKE_FREE_MIX | 2021 et 2025 | conforme | on! 48,4 et 177,8 millions de bidons |
| NESN.SW | ORGANIC_GROWTH | 2009 et 2025 | conforme | +4,1 % et +3,5 % de croissance organique |
| OR.PA | AP_SPEND | 2012 et 2025 | conforme | 30,2 % et 32,2 % de frais publi-promotionnels |
| OR.PA | CHANNEL_MIX | 2020 et 2025 | conforme | 26,6 % et 30,2 % du chiffre d affaires en e-commerce |
| OR.PA | ORGANIC_GROWTH | 2014 et 2025 | conforme | +3,7 % et +4,0 % a donnees comparables |
| PEP | LOW_SUGAR_MIX | 2021 et 2025 | conforme | 53 % et 68 % du volume boissons |
| PEP | ORGANIC_GROWTH | 2012 et 2025 | conforme | +5 % et +2 % de chiffre d affaires organique |
| PG | AP_SPEND | 2014 et 2026 | conforme | 7,9 Mds$ et 10,2 Mds$ de publicite |
| PG | ORGANIC_GROWTH | 2011 et 2026 | conforme | +4 % et +1 % organic sales (exercices clos le 30 juin) |
| PM | MARKET_SHARE | 2008 et 2021 | conforme | 25,8 % et 27,3 % de part de marche internationale hors Chine |
| PM | SHIPMENT_VOL | 2017 et 2024 | conforme | 798,2 et 756,6 milliards d unites expediees |
| RI.PA | AGING_INVENTORY | 2023 et 2025 | conforme | 6 285 et 7 099 M EUR de stock a vieillissement |
| RI.PA | ORGANIC_GROWTH | 2021 et 2025 | conforme | +10 % et -3,0 % en organique (exercices clos le 30 juin) |
| SJM | ORGANIC_GROWTH | 2019 et 2026 | conforme | 0 % et +5 % hors cessions et change |
| STZ | AGING_INVENTORY | 2011 et 2026 | conforme | 1 012,1 M$ et 549,5 M$ de stocks en cours de vieillissement |
| STZ | DEPLETIONS | 2013 et 2026 | conforme | +3,4 % et -2,1 % d epuisements du segment Biere (exercices clos fin fevrier) |
| STZ | ORGANIC_GROWTH | 2021 et 2026 | conforme | effet prix +69,7 M$ et +128,2 M$ sur le segment Biere |
| STZ | SHIP_VS_DEPL | 2013 et 2026 | conforme | +4,0 % et -3,8 % de volumes expedies |
| SYY | CASE_VOLUME | 2016 et 2026 | conforme | +5,3 % et +1,4 % de volumes en caisses |
| SYY | PRODUCT_INFLATION | 2010 et 2026 | conforme | -1,5 % (deflation) et +3,0 % d inflation des produits |
| TAP | MARKET_SHARE | 2018 et 2023 | conforme | 20 % et 18 % de part de marche EMEA et Asie Pacifique |
| TAP | NET_REV_HL | 2021 et 2025 | conforme | +5,2 % et +4,8 % de chiffre d affaires net par hectolitre |
| TAP | ORGANIC_GROWTH | 2021 et 2025 | conforme | effet prix et mix +5,2 % et +3,8 % |
| TAP | VOLUMES_HL | 2017 et 2025 | conforme | 99,563 et 72,810 millions d hl de volume financier |
| TGT | CATEGORY_MIX | 2016 et 2025 | conforme | 13 831 M$ et 24 136 M$ Food and beverage |
| TGT | COMP_SALES | 2006 et 2025 | conforme | +4,8 % et -2,6 % de ventes comparables |
| TGT | ECOM_PEN | 2013 et 2025 | conforme | 2,0 % et 20,6 % des ventes en ligne |
| TGT | STORE_EXPANSION | 2006 et 2025 | conforme | 1 488 et 1 995 magasins |
| TSN | INPUT_INFLATION | 2017 et 2025 | conforme | effet cout d intrant 588 M$ et 1 207 M$ |
| TSN | ORGANIC_GROWTH | 2013 et 2025 | conforme | volume du segment Beef -1,8 % et -1,9 % |
| UNA.AS | AP_SPEND | 2014 et 2024 | conforme | 7 166 et 9 410 M EUR d investissement marque et marketing |
| UNA.AS | CHANNEL_MIX | 2020 et 2021 | conforme | 9 % et 13 % du chiffre d affaires en ligne ; source 2020 injoignable, valeur confirmee par recherche web |
| UNA.AS | MARKET_SHARE | 2021 et 2023 | conforme | 53 % et 37 % de l activite gagnant des parts ; source 2023 injoignable, valeur confirmee par recherche web |
| UNA.AS | ORGANIC_GROWTH | 2008 et 2025 | conforme | USG 7,4 % et 3,5 % |
| WMT | CATEGORY_MIX | 2019 et 2026 | conforme | 184 202 M$ et 285 482 M$ epicerie Walmart US |
| WMT | COMP_SALES | 2014 et 2026 | conforme | -0,6 % et +4,3 % Walmart US |
| WMT | MEMBERSHIP | 2011 et 2026 | conforme | 2 897 M$ et 6 750 M$ de cotisations et autres revenus |
| WMT | STORE_EXPANSION | 2010 et 2026 | conforme | 8 099 et 10 955 magasins |

## Anomalie corrigée

Une seule anomalie a été relevée, sur la citation et non sur la donnée : la série `DEPLETIONS` de BF.B citait le 10-K de l exercice 2018 sous l adresse `bfb-2018430x10k.htm`, qui renvoie une erreur sur le site de la SEC. Le document réel est `bfb-2018430x10kapril.htm`, dans le même dépôt. La valeur de 13,0 millions de caisses de neuf litres y est confirmée (tableau Major Brands Worldwide Results for Fiscal 2018). L adresse a été corrigée dans le fichier.

## Sources citées restées injoignables

Deux sources de UNA.AS ne sont plus servies par unilever.com ni archivées : le rapport annuel 2023 et la présentation des résultats annuels 2020. Les deux valeurs concernées ont été confirmées par ailleurs (37 % de l activité gagnant des parts de marché en 2023, commerce en ligne à 9 % des ventes en 2020) ; les séries restent conformes et n ont pas été modifiées.
