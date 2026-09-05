# Verification independante - secteur 20 (115 societes)

Controle des fichiers `docs/cahier/donnees/<TICKER>.json` pour les 115 societes du secteur 20 (GICS Industrials).
Perimetre : toute serie d'au moins deux exercices (statut `trouve`, ou `existe` / `autre` avec `annees` renseigne), soit 205 series.
Methode : pour chaque serie, la valeur la plus ancienne et la valeur la plus recente ont ete recherchees dans la source citee (recuperation directe des documents : SEC EDGAR, communiques et rapports annuels des societes, API XBRL de la SEC, depot francais de l'information reglementee). Pour les series calculees, ce sont les deux postes sources du calcul qui ont ete verifies, ainsi que le resultat du rapport. L'unite et l'exercice fiscal ont ete controles en meme temps que la valeur.

Resultat : aucune valeur erronee. Aucun fichier n'a ete modifie.

| Ticker | KPI | Annees sondees | Resultat | Detail |
|---|---|---|---|---|
| ABBN.SW | ORDERS_ORGANIC | 2019 / 2025 | conforme | 1 et 15 % |
| ABBN.SW | BOOK_TO_BILL | 2019 / 2025 | conforme | 1.02 et 1.11 ratio |
| ABBN.SW | ORGANIC_GROWTH | 2019 / 2025 | conforme | 1 et 7 % |
| AIR.DE | BACKLOG | 2018 / 2025 | conforme | 459.5 et 618.8 Mds euros |
| AIR.DE | BOOK_TO_BILL | 2018 / 2025 | conforme | 0.87 et 1.68 ratio |
| AIR.DE | DELIVERIES | 2016 / 2025 | conforme | 688 et 793 avions |
| AIR.PA | BACKLOG | 2018 / 2020 | conforme | 459.5 et 373.1 Mds euros |
| AIR.PA | BOOK_TO_BILL | 2018 / 2025 | conforme | 0.87 et 1.68 ratio |
| AIR.PA | DELIVERIES | 2016 / 2020 | conforme | 688 et 566 avions |
| ALLE | SERVICE_RECURRING_MIX | 2022 / 2025 | conforme | 4.85 et 6.84 % |
| BA | FUNDED_BACKLOG | 2015 / 2025 | conforme | 97.4 et 93.77 % |
| BA | AFTERMARKET_MIX | 2015 / 2025 | conforme | 13.83 et 23.39 % |
| BLDR | END_MARKET_MIX | 2023 / 2025 | conforme | 69 et 68 % |
| BNR.DE | GROSS_MARGIN_RATE | 2020 / 2025 | conforme | 24.3 et 25.3 % |
| BR | RECURRING_REVENUE_GROWTH | 2023 / 2026 | conforme | 9 et 8 % |
| BR | CLOSED_SALES | 2019 / 2026 | conforme | 233.3 et 305.1 M $ |
| BR | REVENUE_RETENTION | 2010 / 2024 | conforme | 98 et 97 % |
| BVI.PA | ORGANIC_CC_GROWTH | 2016 / 2025 | conforme | -0.6 et 6.5 % |
| CARR | SERVICE_RECURRING_MIX | 2020 / 2025 | conforme | 28 et 28 % |
| CAT | DEALER_INVENTORY | 2014 / 2025 | conforme | -1 et 0.9 Mds $ |
| CAT | SERVICES_PARTS_MIX | 2022 / 2025 | conforme | 22 et 24 Mds $ |
| CAT | CAPTIVE_CREDIT_QUALITY | 2014 / 2022 | conforme | 2.17 et 1.89 % |
| CMI | BACKLOG | 2018 / 2025 | conforme | 710000000 et 6300000000 $ |
| CMI | SERVICES_PARTS_MIX | 2016 / 2025 | conforme | 62.2 et 47.4 % des ventes du segment Distribution |
| CSX | OPERATING_RATIO | 2016 / 2025 | conforme | 69.4 et 67.9 % |
| CSX | CARLOADS | 2016 / 2025 | conforme | 6451 et 6307 milliers d'unites |
| CSX | REVENUE_PER_CARLOAD | 2016 / 2025 | conforme | 1716 et 2234 $ / unite |
| CSX | FUEL_EFFICIENCY | 2020 / 2025 | conforme | 0.96 et 0.97 gallons / 1000 tonnes-milles brutes |
| CTAS | ORGANIC_GROWTH | 2017 / 2026 | conforme | 6.7 et 8.3 % |
| DD | SEGMENT_MARGIN | 2023 / 2025 | conforme | 29.7 et 30.1 % |
| DE | DEALER_INVENTORY | 2020 / 2025 | conforme | 21 et 23 % des ventes au detail des douze derniers mois |
| DE | PRICE_REALIZATION | 2016 / 2021 | conforme | 2 et 6 % |
| DE | PRECISION_AG_ADOPTION | 2021 / 2024 | conforme | 315 et 455 M acres |
| DE | CAPTIVE_CREDIT_QUALITY | 2015 / 2025 | conforme | 1.28 et 1.16 % |
| DG.PA | BACKLOG | 2016 / 2025 | conforme | 27.4 et 69.8 Mds EUR. 2025 = somme des trois poles publies dans le communique (17,5 + 18,1 + 34,2) |
| DG.PA | BOOK_TO_BILL | 2016 / 2025 | conforme | 1.01 et 1.02 ratio |
| DG.PA | BACKLOG_COVERAGE | 2016 / 2025 | conforme | 10 et 14 mois |
| DHL.DE | REVENUE_PER_PIECE | 2019 / 2025 | conforme | 3.47 et 4.03 euros par colis |
| DHL.DE | AIR_TONNAGE_OCEAN_TEU | 2020 / 2025 | conforme | 1667000 et 1767000 tonnes (fret aerien export) |
| DHL.DE | NET_REVENUE_MARGIN | 2016 / 2025 | conforme | 25.1 et 24.6 % |
| DHL.DE | ON_TIME_SERVICE | 2020 / 2025 | conforme | 94 et 95 % |
| DOV | ORDERS_ORGANIC | 2017 / 2024 | conforme | 9.6 et 6.5 % |
| DOV | BOOK_TO_BILL | 2017 / 2023 | conforme | 1.02 et 0.95 ratio |
| DOV | BACKLOG | 2017 / 2022 | conforme | 1200000000 et 3020224000 $ |
| DOV | AFTERMARKET_MIX | 2019 / 2025 | conforme | 30 et 40 % |
| DPW.DE | AVG_DAILY_VOLUME | 2016 / 2025 | conforme | 808 et 962 milliers d'envois par jour |
| DPW.DE | REVENUE_PER_PIECE | 2016 / 2025 | conforme | 53.5 et 76.1 euros par envoi |
| DPW.DE | AIR_TONNAGE_OCEAN_TEU | 2016 / 2025 | conforme | 3059000 et 3274000 EVP |
| DPW.DE | NET_REVENUE_MARGIN | 2016 / 2025 | conforme | 25.1 et 24.6 % |
| DPW.DE | ON_TIME_SERVICE | 2020 / 2025 | conforme | 94 et 95 % |
| DTG.DE | SERVICES_PARTS_MIX | 2019 / 2022 | conforme | 30 et 27 % |
| DTG.DE | CAPTIVE_CREDIT_QUALITY | 2018 / 2023 | conforme | 0.21 et 0.48 % |
| EFX | ORGANIC_CC_GROWTH | 2021 / 2025 | conforme | 15 et 7 % |
| EME | BACKLOG_COVERAGE | 2018 / 2025 | conforme | 5.85 et 9.36 mois |
| EMR | BACKLOG | 2016 / 2025 | conforme | 3.925 et 8.629 Mds $ |
| EMR | ORGANIC_GROWTH | 2016 / 2025 | conforme | -7 et 3 % |
| EN.PA | BACKLOG | 2016 / 2025 | conforme | 30.201 et 31.954 Mds € |
| ENR.DE | ORDERS | 2020 / 2025 | conforme | 34.001 et 58.928 Mds € |
| ENR.DE | BACKLOG | 2020 / 2025 | conforme | 79 et 138 Mds € |
| ENR.DE | BACKLOG_COVERAGE | 2020 / 2025 | conforme | 2.88 et 3.53 annees |
| ENR.DE | SERVICES_MIX | 2020 / 2025 | conforme | 34 et 34 % |
| ETN | BACKLOG | 2016 / 2025 | conforme | 4 et 19.8 Mds $ |
| ETN | ORGANIC_GROWTH | 2016 / 2025 | conforme | -4 et 8 % |
| EXPD | NET_REVENUE_MARGIN | 2017 / 2025 | conforme | 33.51 et 33.13 % |
| FAST | DAILY_SALES_GROWTH | 2014 / 2025 | conforme | 12.7 et 9.1 % |
| FAST | GROSS_MARGIN_RATE | 2015 / 2025 | conforme | 50.4 et 45 % |
| FAST | INVENTORY_TURNS | 2015 / 2025 | conforme | 2.16 et 2.66 x |
| FDX | AVG_DAILY_VOLUME | 2023 / 2026 | conforme | 16724 et 17558 milliers de colis / jour |
| FDX | REVENUE_PER_PIECE | 2023 / 2026 | conforme | 15.75 et 16.8 $ / colis |
| FER | BACKLOG | 2015 / 2025 | conforme | 8731 et 17438 M € |
| FGR.PA | BACKLOG | 2015 / 2025 | conforme | 11.4 et 29.9 Mds € |
| FGR.PA | BACKLOG_COVERAGE | 2015 / 2025 | conforme | 12.2 et 16.8 mois |
| FIX | BACKLOG | 2015 / 2025 | conforme | 711.6 et 11940 M $ |
| GD | BACKLOG | 2016 / 2025 | conforme | 62.206 et 118.046 Mds $ |
| GD | FUNDED_BACKLOG | 2016 / 2025 | conforme | 83.24 et 79.24 % |
| GD | AFTERMARKET_MIX | 2016 / 2025 | conforme | 37.8 et 37.16 % |
| GE | BACKLOG | 2019 / 2025 | conforme | 123.7 et 190.564 Mds $ |
| GEV | ORDERS | 2024 / 2025 | conforme | 44100000000 et 59300000000 $ |
| GEV | BACKLOG | 2022 / 2025 | conforme | 104899000000 et 150238000000 $ |
| GEV | BACKLOG_COVERAGE | 2022 / 2025 | conforme | 3.54 et 3.95 années |
| GEV | SERVICES_MIX | 2022 / 2025 | conforme | 46.65 et 45.01 % |
| GNRC | SERVICES_MIX | 2016 / 2025 | conforme | 8.3 et 11.5 % |
| HII | BACKLOG | 2016 / 2025 | conforme | 20735000000 et 53139000000 $ |
| HII | BOOK_TO_BILL | 2016 / 2025 | conforme | 0.74 et 1.35 ratio |
| HII | FUNDED_BACKLOG | 2016 / 2025 | conforme | 60.5 et 60.2 % |
| HII | AFTERMARKET_MIX | 2016 / 2025 | conforme | 20.3 et 34.9 % |
| HO.PA | BACKLOG | 2019 / 2025 | conforme | 33800000000 et 53323000000 EUR |
| HO.PA | BOOK_TO_BILL | 2020 / 2025 | conforme | 1.09 et 1.14 ratio |
| HON | ORGANIC_GROWTH_SEGMENT | 2015 / 2025 | conforme | 2 et 12 % |
| HON | SEGMENT_MARGIN | 2015 / 2025 | conforme | 21.1 et 24.5 % |
| HON | ORDERS_BACKLOG_LONG_CYCLE | 2018 / 2025 | conforme | 24850000000 et 37475000000 $ |
| HOT.DE | BACKLOG | 2019 / 2025 | conforme | 51362100000 et 72465200000 EUR |
| HOT.DE | BOOK_TO_BILL | 2019 / 2025 | conforme | 1.18 et 1.38 ratio |
| HOT.DE | BACKLOG_COVERAGE | 2019 / 2025 | conforme | 23.8 et 22.7 mois |
| HUBB | ORDERS_ORGANIC | 2016 / 2025 | conforme | 1 et 3.3 % |
| HUBB | BACKLOG | 2015 / 2025 | conforme | 319400000 et 2159000000 $ |
| IEX | ORDERS_ORGANIC | 2015 / 2025 | conforme | -2 et 6 % |
| IEX | BOOK_TO_BILL | 2023 / 2025 | conforme | 0.93 et 1.03 ratio |
| IMCD.AS | GROSS_MARGIN_RATE | 2015 / 2025 | conforme | 21.8 et 25 % |
| IMCD.AS | INVENTORY_TURNS | 2016 / 2025 | conforme | 6.86 et 5.03 x |
| IR | ORDERS_ORGANIC | 2022 / 2025 | conforme | 11.4 et 1.5 % |
| IR | BOOK_TO_BILL | 2022 / 2025 | conforme | 1.08 et 1.01 ratio |
| IR | AFTERMARKET_MIX | 2017 / 2025 | conforme | 41 et 36.5 % |
| ITW | BACKLOG | 2015 / 2022 | conforme | 1287 et 2700 M $ |
| ITW | PRICE_COST_SPREAD | 2015 / 2025 | conforme | 20 et 10 points de base de marge operationnelle |
| J | BACKLOG | 2022 / 2025 | conforme | 17456 et 23064 M $ |
| J | BOOK_TO_BILL | 2024 / 2025 | conforme | 1.35 et 1.1 ratio |
| J | BACKLOG_COVERAGE | 2022 / 2025 | conforme | 21.4 et 23 mois |
| J | CONTRACT_MIX | 2022 / 2025 | conforme | 29 et 32 % |
| JBHT | OPERATING_RATIO | 2014 / 2025 | conforme | 89.8 et 92.8 % |
| JCI | SERVICE_RECURRING_MIX | 2017 / 2022 | conforme | 26.6 et 23.8 % |
| KNIN.SW | AIR_TONNAGE_OCEAN_TEU | 2018 / 2020 | conforme | 4.7 et 4.5 millions d EVP |
| KNIN.SW | NET_REVENUE_MARGIN | 2017 / 2025 | conforme | 37.8 et 36 % |
| LDOS | ORGANIC_GROWTH | 2021 / 2025 | conforme | 9 et 3 % |
| LHX | BACKLOG | 2019 / 2025 | conforme | 20.6 et 38.7 Mds $ |
| LHX | FUNDED_BACKLOG | 2019 / 2025 | conforme | 78.6 et 69.5 % |
| LMT | FUNDED_BACKLOG | 2016 / 2025 | conforme | 68.6 et 62.1 % |
| LMT | AFTERMARKET_MIX | 2017 / 2025 | conforme | 14.9 et 16.5 % |
| LR.PA | ORGANIC_GROWTH | 2016 / 2025 | conforme | 1.8 et 7.7 % |
| LR.PA | ENERGY_TRANSITION_REVENUE | 2024 / 2025 | conforme | 22 et 22 % |
| MAS | VOLUME_PRICE_SPLIT | 2018 / 2025 | conforme | 2 et 2 % (contribution de l effet prix a la croissance du chiffre d affaires) |
| MMM | ORGANIC_GROWTH_SEGMENT | 2018 / 2025 | conforme | 2.8 et 3.2 % |
| MMM | SEGMENT_MARGIN | 2017 / 2025 | conforme | 21.8 et 24.9 % |
| MMM | NEW_PRODUCT_VITALITY | 2012 / 2016 | conforme | 33.1 et 30.4 % des ventes |
| MTX.DE | BACKLOG | 2017 / 2025 | conforme | 14.9 et 29.5 Mds EUR |
| MTX.DE | AFTERMARKET_MIX | 2017 / 2025 | conforme | 58.6 et 68 % |
| NDSN | BACKLOG | 2015 / 2019 | conforme | 228000 et 385000 milliers de $ |
| NDSN | AFTERMARKET_MIX | 2024 / 2025 | conforme | 43 et 40 % |
| NOC | BACKLOG | 2017 / 2025 | conforme | 42.878 et 95.681 Mds $ |
| NOC | BOOK_TO_BILL | 2020 / 2025 | conforme | 1.44 et 1.1 ratio |
| NOC | FUNDED_BACKLOG | 2017 / 2025 | conforme | 52.2 et 45.5 % |
| NSC | OPERATING_RATIO | 2015 / 2025 | conforme | 72.8 et 64.2 % |
| NSC | CARLOADS | 2015 / 2025 | conforme | 7478.9 et 7063.2 milliers d'unites |
| NSC | REVENUE_PER_CARLOAD | 2015 / 2025 | conforme | 1405 et 1724 $ / unite |
| NSC | TRAIN_SPEED_DWELL | 2021 / 2024 | conforme | 19.8 et 22 mph (vitesse moyenne des trains) |
| NSC | FUEL_EFFICIENCY | 2021 / 2024 | conforme | 1.12 et 1.08 gallons de gazole / 1000 tonnes-milles brutes |
| ODFL | OPERATING_RATIO | 2008 / 2025 | conforme | 91.6 et 75.2 % |
| OTIS | AFTERMARKET_MIX | 2018 / 2025 | conforme | 56.7 et 65.4 % |
| PAYX | CLIENT_RETENTION | 2017 / 2022 | conforme | 81 et 84 % |
| PAYX | CLIENT_FUNDS | 2015 / 2026 | conforme | 4080 et 5768.2 M $ |
| PCAR | BACKLOG | 2015 / 2025 | conforme | 5.9 et 4.9 Mds $ |
| PCAR | SERVICES_PARTS_MIX | 2015 / 2025 | conforme | 16 et 24 % |
| PCAR | CAPTIVE_CREDIT_QUALITY | 2015 / 2025 | conforme | 0.5 et 2.4 % |
| PH | BACKLOG | 2021 / 2026 | conforme | 6.5 et 12.8 Mds $ |
| PNR | BACKLOG | 2018 / 2025 | conforme | 332.5 et 567.5 M $ |
| PWR | BACKLOG_COVERAGE | 2016 / 2025 | conforme | 15.29 et 18.53 mois |
| PWR | CONTRACT_MIX | 2018 / 2025 | conforme | 37.93 et 54.04 % |
| RAND.AS | GROSS_PROFIT_PER_CONSULTANT | 2016 / 2025 | conforme | 121.88 et 111.98 milliers euros |
| REN.AS | SUBSCRIPTION_SHARE | 2016 / 2025 | conforme | 52.43 et 54.12 % |
| RHM.DE | BOOK_TO_BILL | 2022 / 2024 | partiel | 1.482 et 2.535 ratio. 2022 = 9 500 / 6 410 (rapport annuel 2023). 2024 non verifiable : le communique 2024 ne publie que les Nominations par division, pas le total groupe ; le rapport annuel 2024 est inaccessible (403) |
| RKLB | BACKLOG | 2021 / 2025 | conforme | 241500000 et 1847322000 $ |
| RKLB | DELIVERIES | 2020 / 2025 | conforme | 7 et 21 lancements |
| ROK | BACKLOG | 2015 / 2025 | conforme | 1164600000 et 2878000000 $ |
| ROK | ORGANIC_GROWTH | 2015 / 2025 | conforme | 1.1 et 1 % |
| RSG | LANDFILL_CAPACITY | 2016 / 2025 | conforme | 64 et 56 annees |
| RXL.PA | DAILY_SALES_GROWTH | 2018 / 2025 | conforme | 3.5 et 2.5 % |
| RXL.PA | GROSS_MARGIN_RATE | 2017 / 2025 | conforme | 24.7 et 25.1 % |
| SAF.PA | BACKLOG | 2018 / 2025 | conforme | 15620 et 12937 moteurs LEAP |
| SAF.PA | DELIVERIES | 2018 / 2025 | conforme | 1118 et 1802 moteurs |
| SAF.PA | AFTERMARKET_MIX | 2018 / 2025 | conforme | 43.9 et 51.6 % |
| SGO.PA | VOLUME_PRICE_SPLIT | 2018 / 2025 | conforme | 3 et 0.8 % (effet prix) |
| SGO.PA | END_MARKET_MIX | 2023 / 2025 | conforme | 50 et 50 % (renovation et infrastructures) |
| SGSN.SW | ORGANIC_CC_GROWTH | 2016 / 2025 | conforme | 2.5 et 5.6 % |
| SIE.DE | ORGANIC_GROWTH_SEGMENT | 2020 / 2025 | conforme | -6 et -4 % |
| SIE.DE | SEGMENT_MARGIN | 2021 / 2025 | conforme | 20.3 et 14.9 % |
| SIE.DE | ORDERS_BACKLOG_LONG_CYCLE | 2020 / 2025 | conforme | 70 et 117 Mds EUR |
| SPCX | DELIVERIES | 2023 / 2025 | conforme | 96 et 165 lancements |
| SU.PA | BACKLOG | 2019 / 2025 | conforme | 8104000000 et 25362000000 € |
| SU.PA | ORGANIC_GROWTH | 2019 / 2025 | conforme | 4.2 et 8.9 % |
| SU.PA | ENERGY_TRANSITION_REVENUE | 2019 / 2025 | conforme | 70 et 75 % |
| TRI | SUBSCRIPTION_SHARE | 2016 / 2025 | conforme | 86 et 81 % |
| TT | VOLUME_PRICE_SPLIT | 2017 / 2025 | conforme | 0.3 et 3 % (contribution du prix a la croissance du chiffre d'affaires) |
| TT | SERVICE_RECURRING_MIX | 2019 / 2025 | conforme | 31.4 et 34.4 % |
| TXT | BACKLOG | 2016 / 2025 | conforme | 8242 et 18823 M $ |
| TXT | AFTERMARKET_MIX | 2017 / 2025 | conforme | 33.6 et 34.1 % |
| UAL | LOAD_FACTOR | 2015 / 2025 | conforme | 83.4 et 82.2 % |
| UAL | RASM | 2015 / 2025 | conforme | 13.11 et 16.18 cents par siege-mile offert |
| UAL | CASM_EX_FUEL | 2017 / 2025 | conforme | 10.11 et 12.64 cents par siege-mile offert |
| UAL | YIELD | 2015 / 2025 | conforme | 15.72 et 19.67 cents par passager-mile paye |
| UAL | CAPACITY_ASM | 2015 / 2025 | conforme | 250003 et 330284 millions de sieges-miles offerts |
| UBER | GROSS_BOOKINGS | 2019 / 2025 | conforme | 65001 et 193454 M $ |
| UBER | TRIPS | 2019 / 2025 | conforme | 6904 et 13567 millions de courses et livraisons |
| UBER | ACTIVE_CONSUMERS | 2019 / 2025 | conforme | 111 et 202 millions d'utilisateurs actifs mensuels |
| UBER | DRIVER_SUPPLY | 2022 / 2025 | conforme | 5.4 et 9.7 millions de conducteurs et livreurs actifs mensuels |
| UNP | OPERATING_RATIO | 2016 / 2025 | conforme | 63.7 et 59.8 % |
| UNP | CARLOADS | 2016 / 2025 | conforme | 8442 et 8447 milliers d'unites |
| UNP | REVENUE_PER_CARLOAD | 2018 / 2025 | conforme | 2400 et 2749 $ / wagon |
| UNP | TRAIN_SPEED_DWELL | 2018 / 2025 | conforme | 26.1 et 24.3 miles par heure |
| UNP | FUEL_EFFICIENCY | 2016 / 2025 | conforme | 1.137 et 1.072 gallons / 1000 tonnes milles brutes |
| UPS | AVG_DAILY_VOLUME | 2016 / 2025 | conforme | 19.09 et 20.847 millions de colis / jour |
| UPS | REVENUE_PER_PIECE | 2016 / 2025 | conforme | 10.3 et 14.5 $ / colis |
| URI | GROSS_MARGIN_RATE | 2016 / 2025 | conforme | 41.7 et 38.2 % |
| URI | FLEET_TIME_UTILIZATION | 2015 / 2018 | conforme | 67.3 et 68.6 % |
| URI | RENTAL_RATE_CHANGE | 2019 / 2025 | conforme | -2.2 et 2.2 % |
| VLTO | CORE_PRICE | 2024 / 2025 | conforme | 1.8 et 1.9 % |
| VRSK | ORGANIC_CC_GROWTH | 2022 / 2025 | conforme | 6.5 et 6.6 % |
| VRSK | SUBSCRIPTION_SHARE | 2017 / 2025 | conforme | 80 et 83 % |
| VRT | ORGANIC_GROWTH | 2020 / 2025 | conforme | -0.9 et 26.3 % |
| WAB | SERVICES_PARTS_MIX | 2018 / 2025 | conforme | 57 et 60 % |
| WKL.AS | ORGANIC_CC_GROWTH | 2017 / 2025 | conforme | 3 et 6 % |
| WKL.AS | SUBSCRIPTION_SHARE | 2017 / 2025 | conforme | 76 et 83 % |
| WM | VOLUME_GROWTH | 2017 / 2025 | conforme | 2.1 et 0.9 % |
| WM | LANDFILL_CAPACITY | 2017 / 2025 | conforme | 43 et 38 annees |
| WM | RECYCLED_COMMODITY_PRICE | 2022 / 2025 | conforme | 100 et 75 $ / tonne courte |
| XYL | BACKLOG | 2015 / 2025 | conforme | 716 et 4615 M $ |

## Synthese

- Series sondees : 205
- Conformes (deux valeurs retrouvees dans la source) : 204
- Corrigees : 0
- Non verifiables (au moins une valeur) : 1
- Passees en `autre` : 0

## Points d'attention

- RHM.DE BOOK_TO_BILL : la valeur 2024 (2,535) suppose une Nomination consolidee du groupe d'environ 24 719 M EUR, montant qui ne figure pas dans les deux sources citees. Le communique annuel 2024 ne donne que les Nominations par division (8 349 + 12 307 + 5 065 M EUR) et le chiffre d'affaires groupe (9 751 M EUR) ; le rapport annuel 2024, qui contient le tableau pluriannuel des Nominations, renvoie une erreur 403 et n'a pas pu etre recupere. La valeur 2022 (9 500 / 6 410 = 1,482) est confirmee par le rapport annuel 2023.
- Sources injoignables remplacees par l'equivalent officiel : les rapports annuels DHL sur group.dhl.com (hote inaccessible) ont ete verifies via le Reporting Hub du groupe pour l'exercice 2025 et via les rapports annuels 2016, 2017, 2019, 2020 et 2021 archives ; le communique Bouygues 2025 (403) via la reprise integrale du communique par un diffuseur agree ; les comptes annuels Schneider 2020 (403) via une recuperation directe du meme fichier PDF ; le 10-K Hubbell de l'exercice 2015 (non cite en source) via le 10-K de l'exercice 2016.
- Retraitements : plusieurs series retiennent volontairement la valeur retraitee d'un rapport ulterieur plutot que la publication initiale (GD carnet finance 2016, DPW.DE volumes TDI 2016, DHL qualite de livraison 2023 et 2024, ALLE services 2022 et 2023, GD ligne Services 2016). Ces choix sont documentes dans les commentaires et ont ete confirmes dans les documents.
