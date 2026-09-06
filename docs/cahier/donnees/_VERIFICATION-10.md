# Verification independante du secteur 10 (Energie)

Perimetre : 24 societes des lots `10-01` a `10-05`. Toutes les series portant au moins deux annees
ont ete controlees : statut `trouve`, ou statut `existe` / `autre` avec un dictionnaire `annees`
non vide. Pour chaque serie, deux valeurs ont ete sondees dans la source citee, la plus ancienne
et la plus recente, avec verification de l'unite, du libelle de la ligne et de l'exercice fiscal
(cloture au 31 decembre pour l'integralite du secteur, y compris TotalEnergies, Shell et SBM Offshore).

Methode : telechargement direct des documents cites (SEC EDGAR, factbooks PDF, pages de resultats),
conversion en texte et relecture du tableau autour de la valeur, afin de controler non seulement
le chiffre mais aussi la colonne d'exercice a laquelle il appartient. Aucune source n'a ete
injoignable, les recours de secours (API XBRL, recherche plein texte EDGAR, archive web) n'ont
donc pas eu a etre utilises.

Resultat global : 72 series sondees, 144 valeurs controlees, 72 conformes, 0 correction,
0 passage en `autre`, 0 serie non verifiable.

| Ticker | KPI | Annees sondees | Resultat | Detail du controle |
| --- | --- | --- | --- | --- |
| APA | PRODUCTION | 2014, 2025 | conforme | 10-K 2016 ligne Total BOE per day 597 837 (colonne 2014, prix petrole 91,66 confirmant l'exercice) ; 10-K 2025 ligne Total 464 383. Unite boe/jour correcte. |
| APA | LOE_BOE | 2014, 2025 | conforme | Tableau Production, Pricing, and Lease Operating Cost Data, ligne Total : 11,51 en 2014 et 11,36 en 2025. |
| BKR | ORDERS | 2017, 2025 | conforme | 10-K 2018 : commandes de 17 159 M$ en 2017 (chiffre retraite, celui retenu par la source citee) ; 10-K 2025 : 29,6 Mds $. |
| BKR | RPO | 2017, 2025 | conforme | 10-K 2017 : carnet de 21 022 M$ au 31 decembre 2017 ; 10-K 2025 : RPO de 35,9 Mds $. |
| COP | PRODUCTION | 2016, 2025 | conforme | 10-K 2016 : 1 569 MBOED ; 10-K 2025 : 2 375 MBOED. |
| COP | RRR | 2016, 2025 | conforme | 10-K 2016 : taux negatif de 194 pour cent ; 10-K 2025 : 80 pour cent. |
| COP | LOE_BOE | 2015, 2025 | conforme | Tableau Average Production Costs Per BOE, ligne Total consolidated operations : 13,67 en 2015 (10-K 2017) et 12,01 en 2025. |
| CVX | PRODUCTION | 2006, 2025 | conforme | 10-K 2008 ligne Net Oil-Equivalent Production, colonne 2006 : 2 667 MBOEPD ; 10-K 2025 : 3 723 MBOED. |
| CVX | RRR | 2014, 2025 | conforme | 10-K 2014 : 89 pour cent ; 10-K 2025 : 158 pour cent. |
| CVX | REF_UTIL | 2011, 2025 | conforme | 10-K 2012 : 89 pour cent en 2011 ; 10-K 2025 : 92,9 pour cent, taux d'utilisation des unites de distillation de brut. |
| DVN | PRODUCTION | 2018, 2025 | conforme | 10-K 2019 ligne Total 296 MBoe/j pour 2018 ; 10-K 2025 ligne Total 840 MBoe/j. Conversion en boe/jour coherente. |
| DVN | RRR | 2022, 2025 | conforme | Communiques annuels : 125 pour cent en 2022, 193 pour cent en 2025. |
| DVN | FD_COST | 2019, 2025 | conforme | Communiques annuels : 11 $ par boe en 2019, 6,14 $ en 2025. |
| DVN | LOE_BOE | 2017, 2025 | conforme | 10-K 2019 ligne LOE par boe 4,33 pour 2017 ; 10-K 2025 : 6,27. |
| DVN | NETBACK | 2020, 2025 | conforme | Tableau Field-Level Cash Margin, ligne Total : 12,89 en 2020 (10-K 2021), 24,97 en 2025. |
| EOG | PRODUCTION | 2006, 2025 | conforme | 10-K 2008 : 1 561 MMcfed en 2006, soit 260,2 kboe/jour a 6 Mcf pour 1 boe ; 10-K 2025 ligne Total 1 232,2 MBoed. |
| EOG | RRR | 2014, 2025 | conforme | Communique du 4e trimestre 2014 : 249 pour cent hors revisions de prix ; communique 2025, colonne Total : 254 pour cent. |
| EOG | FD_COST | 2017, 2025 | conforme | Communique 2022, tableau a colonnes 2019-2018-2017 : 8,40 en 2017 ; communique 2025, colonne Total : 14,54. |
| EOG | LOE_BOE | 2009, 2025 | conforme | 10-K 2010 ligne Lease and Well : 4,50 en 2009 ; 10-K 2025 : 3,72. |
| EOG | NETBACK | 2014, 2025 | conforme | Communique 2021, colonnes 2016-2015-2014 : 40,06 en 2014 ; communique 2025, colonnes 2025 a 2021 : 25,74. |
| EQT | PRODUCTION | 2011, 2025 | conforme | 10-K 2013 Total Sales Volume 199 355 MMcfe en 2011 ; 10-K 2025 : 2 382 367 MMcfe, soit 2 382,367 Bcfe. |
| EQT | LOE_BOE | 2018, 2025 | conforme | 10-K 2019 tableau par Mcfe, ligne LOE hors taxes de production : 0,07 en 2018 ; 10-K 2025 : 0,09. |
| EXE | PRODUCTION | 2022, 2025 | conforme | 10-K Chesapeake 2023, bloc 2022 Successor Period : 1 461 Bcfe ; 10-K Expand 2025 : 2 622 Bcfe. |
| EXE | LOE_BOE | 2022, 2025 | conforme | Charges de production par Mcfe : 0,33 en 2022 (colonne 2022 du 10-K 2023), 0,24 en 2025. |
| FANG | PRODUCTION | 2011, 2025 | conforme | 10-K 2013 ligne Daily combined volumes, colonne 2011 : 1 658 BOE/j ; 10-K 2025 : 921 036 BOE/j. |
| FANG | RRR | 2013, 2025 | conforme | Communique annuel 2013 : 975 pour cent ; communique annuel 2025 : 118 pour cent. |
| FANG | FD_COST | 2016, 2025 | conforme | Communique annuel 2016 : PD F&D de 7,26 $/boe ; communique 2025, colonne 2025 : 8,52 $/boe. |
| FANG | LOE_BOE | 2011, 2025 | conforme | 10-K 2013 ligne Lease operating expense, colonne 2011 : 16,41 ; 10-K 2025 : 5,55. |
| HAL | GEO_MIX | 2014, 2025 | conforme | 10-K 2016 : 32 870 M$ de chiffre d'affaires total moins 17 698 M$ en Amerique du Nord, soit 15 172 M$, egal a la somme des trois regions internationales ; 10-K 2025 : 22 184 moins 9 066, soit 13 118 M$, egal a 3 935 + 3 351 + 5 832. |
| KMI | VOLUMES | 2014, 2025 | conforme | 10-K 2016 ligne Natural gas transport volumes, colonne 2014 : 26 917 BBtu/j ; 10-K 2025 : 46 603 BBtu/j. |
| KMI | DCF | 2015, 2024 | conforme | Communique du 4e trimestre 2016 : 4 699 M$ en 2015 ; communique 2024 Table 6 : 4 881 M$. |
| KMI | PROJECT_BACKLOG | 2014, 2025 | conforme | Communique du 4e trimestre 2014 : carnet d'expansion et de coentreprises de 17,6 Mds $ ; communique 2025 : 10 Mds $. |
| MPC | THROUGHPUT | 2009, 2025 | conforme | 10-K 2011 ligne Total, colonne 2009 : 1 153 kb/j ; 10-K 2025 Net refinery throughput : 2 989 kb/j. |
| MPC | UTILIZATION | 2009, 2025 | conforme | 10-K 2011 ligne Crude Oil Capacity Utilization, colonne 2009 : 94 pour cent ; 10-K 2025 : 94 pour cent. |
| MPC | MARGIN_BBL | 2018, 2025 | conforme | 10-K 2020, colonne 2018 : 14,50 $/baril (valeur retraitee, celle de la source citee) ; 10-K 2025 : 16,87 $/baril. |
| MPC | OPEX_BBL | 2017, 2025 | conforme | 10-K 2019 Refining operating costs per barrel, colonne 2017 : 5,08 ; 10-K 2025 : 5,59. |
| OKE | VOLUMES | 2016, 2025 | conforme | 10-K 2018 Raw feed throughput, colonne 2016 : 836 MBbl/j ; 10-K 2025 : 1 496 MBbl/j. |
| OKE | DCF | 2016, 2020 | conforme | Communique du 4e trimestre 2017 : 1 322,3 M$ en 2016 ; 10-K 2020 : 1 881,6 M$. |
| OKE | COVERAGE | 2016, 2020 | conforme | Communique 2017 : ratio de 1,51 en 2016 ; 10-K 2020 : 1,17. |
| OXY | PRODUCTION | 2018, 2025 | conforme | 10-K 2018 : 658 kboe/j ; 10-K 2025 ligne Total Sales per Day : 1 434 Mboe/j. |
| OXY | RRR | 2016, 2025 | conforme | Communique du 4e trimestre 2018, schedule 13, colonnes 2016-2017-2018-moyenne : All-In 189 pour cent en 2016 ; communique 2025 : 98 pour cent. |
| OXY | FD_COST | 2016, 2025 | conforme | Meme schedule 13 : All-In 9,65 $/boe en 2016 ; communique 2025 : 11,52 $/boe. |
| OXY | LOE_BOE | 2017, 2025 | conforme | 10-K 2019, colonne 2017 : 11,20 $/boe ; 10-K 2025 : 8,94 $/boe. |
| PSX | THROUGHPUT | 2011, 2025 | conforme | 10-K 2013 ligne Crude oil processed Worldwide, colonne 2011 : 2 166 kb/j ; 10-K 2025 : 1 763 kb/j. |
| PSX | UTILIZATION | 2011, 2025 | conforme | 10-K 2013 Capacity utilization Worldwide, colonne 2011 : 92 pour cent ; 10-K 2025 : 94 pour cent. |
| PSX | MARGIN_BBL | 2011, 2025 | conforme | 10-K 2013 Refining Margins Worldwide, colonne 2011 : 9,79 ; 10-K 2025 Realized Refining Margins Worldwide : 10,88. |
| PSX | OPEX_BBL | 2022, 2024 | conforme | Document DEFA14A d'avril 2025 : couts controlables ajustes du raffinage de 6,98 $/baril en 2022 et 5,90 $/baril en 2024. |
| SBMO.AS | RPO | 2016, 2025 | conforme | Rapport annuel 2017 : carnet Directional de 17,1 Mds $ a fin 2016 ; communique de resultats annuels 2025 : 31,1 Mds $ pro forma Directional. |
| SHELL.AS | PRODUCTION | 2016, 2025 | conforme | Resultats du 4e trimestre 2016 : 3 668 kboe/j ; resultats 2025 : 2 800 kboe/j. |
| SHELL.AS | RRR | 2016, 2025 | conforme | Preliminary Reserves Update base SEC : 208 pour cent en 2016, moins 40 pour cent en 2025. |
| SHELL.AS | REF_UTIL | 2021, 2025 | conforme | Resultats 2022 : 80 pour cent en 2021 selon l'ancienne methode, valeur reprise par la source ; resultats 2025 : 92 pour cent. |
| SLB | RPO | 2018, 2025 | conforme | 10-K 2019 : carnet de 2,7 Mds $ au 31 decembre 2018 ; 10-K 2025 : 5,6 Mds $. |
| SLB | GEO_MIX | 2017, 2025 | conforme | Resultats 2018 : international 20 442 M$ sur un total de 30 440 M$, soit 67,2 pour cent ; resultats 2025 : 27 942 sur 35 708, soit 78,3 pour cent. |
| TPL | PRODUCTION | 2020, 2025 | conforme | 10-K 2021 : 16,2 MBoe/j en 2020 ; 10-K 2025 : 34,6 MBoe/j. |
| TPL | NETBACK | 2020, 2025 | conforme | Prix equivalent total par boe : 24,29 en 2020 (10-K 2021), 34,18 en 2025. |
| TRGP | VOLUMES | 2016, 2025 | conforme | Resultats 2017, bloc exercice complet, ligne Total Permian : 1 068,4 MMcf/j en 2016 ; resultats 2025 : 6 391,4 MMcf/j. |
| TRGP | DCF | 2016, 2023 | conforme | Resultats 2017, colonne exercice complet 2016 : 762,4 M$ ; resultats 2023 : 2 617,2 M$. |
| TTE.PA | PRODUCTION | 2010, 2025 | conforme | Form 20-F 2012 : 2 378 kboe/j en 2010 ; Factbook 2025 ligne Combined production : 2 529 kboe/j. |
| TTE.PA | RRR | 2015, 2025 | conforme | Form 20-F 2015 : taux de renouvellement de 107 pour cent ; Factbook 2025 ligne Proved reserve replacement rate : 116 pour cent. |
| TTE.PA | RESERVE_LIFE | 2014, 2025 | conforme | Factbook 2018 ligne Reserve life, colonne 2014 : 14,7 ans ; Factbook 2025 ligne Proved reserve life index : 12,2 ans. |
| TTE.PA | BREAKEVEN | 2021, 2025 | conforme | Factbook 2025 ligne Pre-dividend organic cash breakeven, colonnes 2025 a 2021 : 26,4 en 2025 et 22,9 en 2021. |
| TTE.PA | REF_UTIL | 2010, 2025 | conforme | Form 20-F 2012, tableau On crude, moyenne : 73 pour cent en 2010 ; Factbook 2025 Utilization rate on crude only : 86 pour cent. |
| VLO | THROUGHPUT | 2011, 2025 | conforme | Form 10-K 2012 ligne Total throughput volumes, colonne 2011 : 2 434 kb/j ; communique du 4e trimestre 2025, colonne exercice 2025 : 2 988 kb/j. |
| VLO | MARGIN_BBL | 2016, 2025 | conforme | Communique du 4e trimestre 2017, colonne exercice 2016 : 8,20 $/baril ; communique 2025 : 12,29 $/baril. |
| VLO | OPEX_BBL | 2011, 2025 | conforme | Form 10-K 2012, colonne 2011 : 3,83 $/baril ; communique 2025 : 4,93 $/baril. |
| WMB | VOLUMES | 2018, 2025 | conforme | Communique du 4e trimestre 2019, colonne exercice 2018 : 11,8 par jour ; communique 2025 : 15,0. Le Tbtu de 2019 et le MMdth de 2025 designent la meme grandeur. |
| WMB | DCF | 2020, 2025 | conforme | Communique 2021 : 3 638 M$ en 2020 ; communique 2025 : 5 858 M$. Valeurs stockees en dollars, coherentes. |
| WMB | COVERAGE | 2020, 2025 | conforme | Dividend Coverage Ratio : 1,87 en 2020 (communique 2021), 2,40 en 2025. |
| XOM | PRODUCTION | 2006, 2025 | conforme | Form 10-K 2007 ligne Oil-equivalent production, colonne 2006 : 4 237 kboe/j ; Form 10-K 2025 : 4 736 kboe/j. |
| XOM | RRR | 2009, 2018 | conforme | Communique du 16 fevrier 2010 : 133 pour cent de la production 2009 ; communique du 26 fevrier 2019 : 313 pour cent de la production 2018. |
| XOM | RESERVE_LIFE | 2009, 2018 | conforme | Memes communiques : duree de vie des reserves de 15,7 ans pour 2009 et de 17 ans pour 2018. |
| XOM | REF_UTIL | 2010, 2023 | conforme | Financial and Operating Review 2014, ligne Total worldwide, colonne 2010 : 84 pour cent ; Financial and Operating Data 2023, colonne 2023 : 87 pour cent. |

## Points de vigilance releves, sans consequence sur les valeurs

- Plusieurs series reposent sur des valeurs retraitees d'un exercice a l'autre : BKR ORDERS 2017
  (17 159 M$ apres passage a la norme sur le chiffre d'affaires, contre 17 376 M$ publies a
  l'origine), MPC MARGIN_BBL 2018 (14,50 retraite contre 14,25 publie en 2019) et SHELL.AS
  REF_UTIL 2021 (80 pour cent ancienne methode contre 72 pour cent nouvelle methode). Dans les
  trois cas, la valeur enregistree est bien celle du document cite en source, et le fichier
  signale deja le retraitement.
- EOG PRODUCTION 2006 resulte d'une conversion arithmetique exacte de la publication d'origine
  (1 561 MMcfed a 6 Mcf pour 1 boe donne 260,2 kboe/jour), et non d'une lecture directe.
- HAL GEO_MIX et SLB GEO_MIX sont des grandeurs calculees a partir de deux lignes du meme tableau.
  Les deux calculs ont ete refaits et se recoupent avec la somme des regions.
- Aucune source citee n'etait injoignable. Les documents SEC, les factbooks TotalEnergies et
  ExxonMobil et les pages de resultats SBM Offshore ont tous repondu.
