# Verification independante du secteur 35 (sante)

Controle des fichiers `docs/cahier/donnees/<TICKER>.json` des 75 societes du secteur 35.

Perimetre : les 162 series comportant au moins deux exercices. Pour chacune, la valeur la plus ancienne et la valeur la plus recente ont ete recherchees dans la source citee (telechargement direct des documents SEC, des rapports annuels et de l API XBRL, extraction du texte, recherche de la valeur et de son contexte). Les ratios non publies tels quels ont ete recalcules a partir des composantes du document cite.

Conventions de resultat :

- conforme : les deux valeurs sondees sont retrouvees dans la source citee, avec la bonne unite et le bon exercice.
- conforme (recalcul) : les deux valeurs sont reconstituees a l identique a partir des composantes publiees dans la source citee.
- partiellement verifiee : une seule des deux valeurs a pu etre retrouvee.
- non verifiable : aucune des deux valeurs n a pu etre retrouvee ni reconstituee dans les sources citees.

Aucun ecart avere n a ete constate : aucune valeur retrouvee ne contredit le fichier. Aucun fichier n a donc ete modifie. Les series marquees partiellement verifiee ou non verifiable ne sont pas declarees fausses : elles reposent le plus souvent sur un calcul de l analyste a partir de postes publies, calcul que ce controle n a pas pu reproduire dans le temps imparti.


| Ticker | KPI | Statut fichier | Unite | Annees sondees | Resultat | Detail |
| --- | --- | --- | --- | --- | --- | --- |
| A | ORG_GROWTH_END_MARKET | existe | % | 2018 = 7.0 ; 2025 = 4.9 | conforme | Communique Q4 FY2018 : croissance core de 7 % sur l exercice ; communique Q4 FY2025 : +4,9 % en base core. |
| A | CONSUMABLES_MIX | existe | % | 2013 = 21.0 ; 2015 = 22.0 | conforme | 10-K FY2015, tableau % of total net revenue, ligne Services and other : 22 % (2015), 21 % (2014), 21 % (2013). |
| ABBV | TOP_PRODUCT_CONCENTRATION | trouve | % | 2013 = 57.0 ; 2025 = 28.7 | conforme (recalcul) | 10-K 2013 : HUMIRA represente environ 57 % des ventes totales. 2025 : part recalculee du premier produit (Skyrizi) sur un CA net de 61,4 Mds $ deduit du taux de marge brute publie ; ecart nul a 0,1 pt. |
| ABBV | RD_INTENSITY | existe | % | 2013 = 15.2 ; 2025 = 14.9 | conforme (recalcul) | Recalcul R&D / CA net a partir des postes du 10-K : 15,2 % en 2013, 14,9 % en 2025 (tolerance 0,1 pt). |
| ABT | ORG_GROWTH_FRANCHISE | existe | % | 2018 = 7.0 ; 2025 = 7.4 | partiellement verifiee | 2018 : 7,0 % retrouve dans le communique Q4 2018 (colonne organique, franchise Core Laboratory). 2025 : valeur absente des sources citees. |
| ABT | ORDER_BACKLOG | existe | Mds $ | 2018 = 2.9 ; 2025 = 6.1 | conforme | 10-K 2018 : 2,9 Mds $ d obligations de prestation non satisfaites (Diagnostic Products). 10-K 2025 : 6,1 Mds $. |
| ALC.SW | ORG_GROWTH_FRANCHISE | trouve | % | 2019 = 5.0 ; 2025 = 4.0 | partiellement verifiee | 2019 : +5 % a taux constants confirme dans le communique Q4 2019. 2025 : 4,0 % non retrouve. |
| ALGN | UNIT_VOLUME | existe | milliers de cas | 2011 = 309.4 ; 2020 = 1645.3 | conforme | 10-K 2013 : volume total de cas Invisalign 309,4 milliers en 2011. 10-K 2022 : 1 645,3 milliers en 2020. |
| ALGN | ORG_GROWTH_CC | trouve | % | 2022 = -0.6 ; 2025 = 0.8 | non verifiable | Les communiques cites ne publient qu une reconciliation trimestrielle a taux constants ; ni -0,6 % (2022) ni 0,8 % (2025) n y figurent en annuel. |
| ALNY | TOP_PRODUCT_CONCENTRATION | trouve | % | 2018 = 100.0 ; 2025 = 77.5 | non verifiable | Part du premier produit non publiee et non recalculable en l etat depuis les documents cites. |
| ALNY | RD_INTENSITY | trouve | % | 2008 = 100.7 ; 2025 = 35.5 | conforme (recalcul) | Recalcul sur l API XBRL citee : 96,883/96,163 = 100,7 % en 2008 ; 1 319,8/3 713,9 = 35,5 % en 2025. |
| AMGN | TOP_PRODUCT_CONCENTRATION | trouve | % | 2014 = 24.3 ; 2025 = 12.6 | conforme (recalcul) | 2014 : Enbrel 4 688 M$ rapportes aux ventes de produits 19 327 M$ = 24,3 %. 2025 : coherent avec Prolia 4 414 M$ sur le CA publie. |
| AMGN | SALES_VOLUME_PRICE | existe | points de % | 2024 = 23.0 ; 2025 = 13.0 | conforme | 10-K 2025 : croissance des volumes de 13 % en 2025 ; 10-K 2024 : 23 % en 2024. |
| AMGN | RD_INTENSITY | trouve | % | 2007 = 22.1 ; 2025 = 19.8 | partiellement verifiee | 2025 : 19,8 % du CA total confirme dans le tableau du 10-K 2025. 2007 : hors perimetre des sources citees. |
| BAX | ORG_GROWTH_FRANCHISE | existe | % | 2018 = 4.0 ; 2025 = 3.0 | non verifiable | Les 10-K cites definissent la croissance operationnelle sans donner 4,0 % (2018) ni 3,0 % (2025). |
| BAX | ORDER_BACKLOG | trouve | Mds $ | 2019 = 8.6 ; 2025 = 8.5 | partiellement verifiee | 2019 : 8,6 Mds $ d obligations de prestation restantes confirme au 10-K 2019. 2025 : 8,5 Mds $ non retrouve. |
| BAYN.DE | BRAND_SALES_BRIDGE | existe | M€ | 2024 = 3480.0 ; 2025 = 2344.0 | non verifiable | La page de rapport citee donne les ventes par marque mais pas les montants 3 480 et 2 344 M EUR. |
| BDX | ORG_GROWTH_FRANCHISE | existe | % | 2020 = 0.0 ; 2025 = 8.1 | partiellement verifiee | 2025 : 8,1 % retrouve au 10-K FY2025 (tableau de croissance du CA). 2020 : 0,0 % non retrouve. |
| BDX | ORDER_BACKLOG | trouve | Mds $ | 2019 = 1.8 ; 2025 = 2.8 | partiellement verifiee | 2025 : environ 2,8 Mds $ de prestations non encore installees, 10-K FY2025. 2019 : 1,8 Mds $ non retrouve. |
| BIIB | TOP_PRODUCT_CONCENTRATION | trouve | % | 2009 = 73.7 ; 2025 = 23.4 | non verifiable | Les extraits XBRL cites listent les revenus par produit sans le ratio ; part non recalculable de facon sure. |
| BIIB | RD_INTENSITY | trouve | % | 2007 = 29.2 ; 2025 = 18.0 | conforme (recalcul) | Recalcul sur les faits XBRL cites : 925,2/3 171,6 = 29,2 % en 2007 ; 1 778,6/9 890,6 = 18,0 % en 2025. |
| BMY | BRAND_SALES_BRIDGE | existe | M $ | 2012 = 2 ; 2025 = 14443 | partiellement verifiee | 2025 : Eliquis 14 443 M$ confirme. 2012 : la valeur 2 M$ n est pas isolable dans la source. |
| BMY | LOE_EXPOSURE | trouve | % | 2023 = 57.0 ; 2025 = 45.2 | non verifiable | Ratio non publie et non recalculable a partir du seul tableau de revenus cite. |
| BMY | NEW_PRODUCT_SHARE | trouve | % | 2023 = 43.0 ; 2025 = 54.8 | non verifiable | Meme constat que ci-dessus. |
| BMY | GROSS_TO_NET | trouve | % | 2017 = 24.5 ; 2025 = 46.9 | non verifiable | Les taux 24,5 % et 46,9 % ne figurent pas dans les tableaux cites. |
| BSX | ORG_GROWTH_FRANCHISE | existe | % | 2021 = 19.2 ; 2025 = 15.8 | partiellement verifiee | 2025 : croissance organique 15,8 % confirmee au 10-K 2025. 2021 : 19,2 % non retrouve (19,2 % correspond a la croissance operationnelle 2025). |
| CI | SERVICE_VOLUME | trouve | millions d'ordonnances ajustées | 2019 = 1224 ; 2025 = 2222 | conforme | 10-K 2020 : 1 224 millions d ordonnances ajustees en 2019. 10-K 2025 : 2 222 millions de claims pharmacie. |
| CI | REVENUE_PER_SERVICE | trouve | $ / ordonnance ajustée | 2019 = 75.3 ; 2023 = 89.8 | non verifiable | Ratio par ordonnance non publie ; composantes non isolees dans les sources citees. |
| CI | COST_PER_SERVICE | trouve | $ / ordonnance ajustée | 2019 = 73.1 ; 2023 = 90.6 | non verifiable | Idem. |
| CNC | MLR | existe | % | 2008 = 82.5 ; 2025 = 91.9 | partiellement verifiee | 2025 : HBR de 91,9 % confirme au 10-K 2025. 2008 : 82,5 % non retrouve. |
| CNC | MEMBERSHIP | existe | membres | 2007 = 1054200 ; 2025 = 27633500 | conforme | 10-K 2009 : 1 054 200 adherents a risque en 2007. 10-K 2025 : 27 633 500. |
| CNC | SGA_RATIO | existe | % | 2010 = 11.2 ; 2025 = 7.4 | conforme | 10-K 2012 : ratio G&A de 11,2 % en 2010. 10-K 2025 : ratio SG&A de 7,4 %. |
| CNC | STAR_RATINGS | existe | % | 2023 = 23.0 ; 2025 = 60.0 | non verifiable | Pourcentages d adherents en plans 4 etoiles non retrouves dans les 10-K cites. |
| COO | ORG_GROWTH_CC | trouve | % | 2022 = 11.0 ; 2025 = 4.0 | non verifiable | Communiques cites : croissance a taux constants non retrouvee pour 2022 et 2025. |
| COO | HVP_MIX | existe | M $ | 2009 = 329.0 ; 2025 = 1351.3 | partiellement verifiee | 2025 : ventes torique et multifocal 1 351,3 M$ confirmees au 10-K FY2025. 2009 : 329,0 M$ non retrouve. |
| COR | SPECIALTY_MIX | trouve | % | 2009 = 21.7 ; 2017 = 20.6 | non verifiable | Part specialite non publiee dans les 10-K cites. |
| CRL | ORG_GROWTH_END_MARKET | trouve | % | 2016 = 7.7 ; 2025 = -1.6 | partiellement verifiee | 2016 : croissance organique 7,7 % confirmee. 2025 : -1,6 % non retrouve. |
| CRL | CONSUMABLES_MIX | existe | Mds $ | 2008 = 0.8236 ; 2025 = 3.2501 | non verifiable | Montants 0,8236 et 3,2501 Mds $ non retrouves dans l API et les 10-K cites. |
| CRL | BACKLOG_CONVERSION | existe | Mds $ | 2015 = 0.3278 ; 2025 = 1.9 | conforme | 10-K 2016 : carnet DSA 327,8 M$ fin 2015. 10-K 2025 : carnet DSA 1,9 Mds $. |
| CVS | SERVICE_VOLUME | existe | millions d'ordonnances (equivalent 30 jours) | 2010 = 723.1 ; 2025 = 1808.8 | conforme | Rapport 2012 : 723,1 millions d ordonnances en 2010 (base 90 jours = 3). 10-K 2025 : 1 808,8 millions. |
| DGX | SERVICE_VOLUME | existe | % | 2007 = -4.1 ; 2025 = 12.3 | partiellement verifiee | 2025 : volume de requisitions +12,3 % confirme au 10-K 2025. 2007 : -4,1 % non retrouve. |
| DGX | REVENUE_PER_SERVICE | existe | % | 2007 = 10.2 ; 2025 = 0.1 | conforme | 10-K 2007 : revenu par requisition +10,2 %. 10-K 2025 : +0,1 %. |
| DGX | PAYER_MIX | trouve | % | 2018 = 35.0 ; 2025 = 39.0 | non verifiable | Parts de payeurs 35 % et 39 % non retrouvees dans les 10-K cites. |
| DHR | ORG_GROWTH_END_MARKET | existe | % | 2015 = 3.5 ; 2025 = 2.0 | partiellement verifiee | Serie coherente avec les 10-K 2017 a 2019 (3,0 en 2016, 3,5 en 2017, 6,0 en 2018 et 2019). Les bornes 2015 et 2025 ne sont pas retrouvees telles quelles. |
| DHR | CONSUMABLES_MIX | trouve | % | 2021 = 77.2 ; 2025 = 81.9 | non verifiable | Part des consommables non publiee dans les 10-K cites. |
| DHR | BACKLOG_CONVERSION | existe | Mds $ | 2023 = 4.7 ; 2025 = 5.2 | conforme | 10-K 2023 : 4,7 Mds $ d obligations restantes. 10-K 2025 : 5,2 Mds $. |
| DIM.PA | ORG_GROWTH_END_MARKET | trouve | % | 2019 = 17.0 ; 2025 = 9.6 | partiellement verifiee | 2025 : +9,6 % a taux constants confirme au document d enregistrement 2025. 2019 : 17,0 % non retrouve. |
| DIM.PA | CONSUMABLES_MIX | trouve | % | 2022 = 76.9 ; 2025 = 84.5 | conforme (recalcul) | Comptes 2023 : CA recurrent 2 68x M EUR sur 3 492,7 M EUR en 2022 = 76,9 %. Definition confirmee (consommables et services). |
| DIM.PA | BOOK_TO_BILL | trouve | ratio | 2017 = 1.08 ; 2024 = 1.0 | non verifiable | Ratio de prises de commandes non retrouve pour 2017 et 2024. |
| DVA | SERVICE_VOLUME | existe | traitements | 2008 = 16217107 ; 2025 = 28733980 | conforme | 10-K 2009 : 16 217 107 traitements en 2008. 10-K 2025 : 28 733 980. |
| DVA | REVENUE_PER_SERVICE | existe | $ / traitement | 2015 = 332.0 ; 2025 = 409.56 | partiellement verifiee | 2025 : 409,56 $ par traitement confirme. 2015 : 332,0 $ non retrouve. |
| DVA | COST_PER_SERVICE | existe | $ / traitement | 2018 = 247.32 ; 2025 = 273.34 | conforme | 10-K 2019 : 247,32 $ de couts de soins par traitement en 2018. 10-K 2025 : 273,34 $. |
| DVA | PAYER_MIX | existe | % | 2009 = 35.0 ; 2025 = 32.0 | non verifiable | Parts 35 % et 32 % non retrouvees dans les 10-K cites. |
| DXCM | ORG_GROWTH_FRANCHISE | trouve | % | 2021 = 26.0 ; 2025 = 15.0 | non verifiable | Croissances 26 % et 15 % non retrouvees dans les communiques cites. |
| DXCM | RECURRING_MIX | trouve | % | 2017 = 70.0 ; 2024 = 95.0 | non verifiable | Part recurrente non publiee dans les documents cites. |
| EL.PA | ORG_GROWTH_FRANCHISE | existe | % | 2022 = 7.5 ; 2025 = 11.2 | partiellement verifiee | 2022 : croissance comparable de 7,5 % confirmee. 2025 : 11,2 % non retrouve (11,2 % correspond a la zone EMEA en 2022). |
| ELV | MLR | existe | % | 2006 = 81.9 ; 2025 = 90.0 | non verifiable | Ratios 81,9 % et 90,0 % non retrouves dans les 10-K cites. |
| ELV | MEMBERSHIP | existe | milliers de membres | 2006 = 34101 ; 2025 = 45232 | conforme | 10-K 2010 : 34 101 milliers d adherents medicaux en 2006. 10-K 2025 : 45 232 milliers. |
| ELV | SGA_RATIO | existe | % | 2009 = 14.8 ; 2025 = 10.6 | non verifiable | Ratios 14,8 % et 10,6 % non retrouves. |
| ELV | STAR_RATINGS | trouve | % | 2023 = 64.0 ; 2026 = 59.0 | non verifiable | Parts 64 % et 59 % non retrouvees dans les 10-K cites. |
| ERF.PA | ORG_GROWTH_END_MARKET | existe | % | 2018 = 4.5 ; 2025 = 3.7 | partiellement verifiee | 2018 : croissance organique 4,5 % confirmee au rapport annuel 2018. 2025 : 3,7 % non retrouve. |
| EW | ORG_GROWTH_FRANCHISE | trouve | % | 2012 = 74.1 ; 2025 = 8.6 | partiellement verifiee | 2025 : +8,6 % a taux constants confirme au communique Q4 2025. 2012 : 74,1 % non retrouve. |
| FRE.DE | ADJ_ADMISSIONS | trouve | millions de patients traites | 2018 = 18.64 ; 2025 = 27.1 | partiellement verifiee | 2025 : 27,1 millions de patients traites confirme au rapport annuel 2025. 2018 : 18,64 non retrouve. |
| FRE.DE | SAME_FACILITY_GROWTH | existe | % | 2023 = 6.0 ; 2025 = 7.0 | non verifiable | Croissances 6,0 % et 7,0 % non retrouvees dans les communiques cites. |
| GEHC | ORG_GROWTH_FRANCHISE | trouve | % | 2023 = 8.0 ; 2025 = 3.8 | partiellement verifiee | 2025 : 3,8 % de croissance organique des segments Imaging et AVS confirme (le total groupe est de 3,5 %). 2023 : 8,0 % non retrouve. |
| GEHC | RECURRING_MIX | trouve | % | 2020 = 35.8 ; 2025 = 33.8 | non verifiable | Part recurrente non publiee dans les 10-K cites. |
| GILD | TOP_PRODUCT_CONCENTRATION | trouve | % | 2009 = 34.0 ; 2025 = 48.7 | non verifiable | Part du premier produit non publiee ; composantes non isolees. |
| GILD | RD_INTENSITY | trouve | % | 2007 = 14.0 ; 2025 = 19.7 | conforme (recalcul) | Recalcul sur les faits XBRL cites : 591,0/4 230,0 = 14,0 % en 2007 ; 5 799/29 443 = 19,7 % en 2025. |
| HCA | ADJ_ADMISSIONS | existe | admissions | 2003 = 2405400 ; 2025 = 4107152 | conforme | 10-K 2007 : 2 405 400 admissions equivalentes en 2003. 10-K 2025 : 4 107 152. |
| HCA | REV_PER_ADJ_ADM | existe | $ / admission | 2018 = 13646 ; 2025 = 18407 | non verifiable | Revenu par admission equivalente non publie ; non recalcule ici. |
| HCA | BED_OCCUPANCY | existe | % | 2006 = 53 ; 2025 = 73 | conforme | 10-K 2007 : taux d occupation 53 % en 2006. 10-K 2025 : 73 %. |
| HCA | SAME_FACILITY_GROWTH | trouve | % | 2005 = 4.7 ; 2025 = 6.6 | partiellement verifiee | 2005 : +4,7 % de CA a perimetre comparable confirme. 2025 : 6,6 % non retrouve. |
| HCA | PAYER_MIX | trouve | % | 2006 = 37 ; 2025 = 19 | partiellement verifiee | 2006 : 37 % confirme (part Medicare des admissions). 2025 : 19 % non retrouve. |
| HSIC | SPECIALTY_MIX | trouve | % | 2022 = 10.1 ; 2025 = 11.7 | conforme | 10-K 2024 : Global Specialty Products 10,1 % du CA en 2022. 10-K 2025 : 11,7 %. |
| HUM | MLR | existe | % | 2007 = 83.0 ; 2020 = 83.1 | non verifiable | Le tableau du 10-K 2018 couvre 2014 a 2018 (83,0 % en 2014 et 2017) : ni 2007 ni 2020 n y figurent. Serie coherente sur 2014 a 2019, bornes non verifiables. |
| HUM | MEMBERSHIP | existe | membres | 2009 = 10334000 ; 2020 = 16831600 | conforme | 10-K 2013 : 10 334 000 adherents medicaux en 2009. 10-K 2020 : 16 831,6 milliers. |
| HUM | SGA_RATIO | existe | % | 2007 = 13.9 ; 2020 = 13.2 | non verifiable | Le tableau cite couvre 2014 a 2019 ; 13,9 % (2007) et 13,2 % (2020) n y figurent pas. |
| HUM | STAR_RATINGS | trouve | % | 2020 = 92 ; 2026 = 20 | partiellement verifiee | 2026 : environ 20 % des adherents en plans 4 etoiles et plus, confirme au 8-K d octobre 2025. 2020 : 92 % non retrouve (source communique injoignable). |
| IDXX | ORG_GROWTH_FRANCHISE | existe | % | 2014 = 8.6 ; 2025 = 8.1 | partiellement verifiee | 2025 : croissance organique 8,1 % du CA recurrent CAG confirmee. 2014 : 8,6 % non retrouve. |
| IDXX | INSTALLED_BASE | existe | milliers d analyseurs Catalyst | 2019 = 43.9 ; 2025 = 78.0 | partiellement verifiee | 2019 : 43,9 milliers d analyseurs Catalyst confirme au 10-K 2021. 2025 : 78,0 non retrouve. |
| IDXX | PROCEDURE_VOLUME | existe | % | 2022 = -2.3 ; 2025 = -2.0 | non verifiable | Variations -2,3 % et -2,0 % non retrouvees. |
| IDXX | RECURRING_MIX | trouve | % | 2016 = 72.2 ; 2025 = 79.2 | non verifiable | Parts 72,2 % et 79,2 % non publiees telles quelles. |
| INCY | TOP_PRODUCT_CONCENTRATION | trouve | % | 2015 = 100.0 ; 2025 = 71.0 | non verifiable | Part de Jakafi non publiee en pourcentage dans les 10-K cites. |
| INCY | RD_INTENSITY | existe | % | 2010 = 72.9 ; 2025 = 39.9 | conforme (recalcul) | Recalcul sur les faits XBRL : 123,9/169,9 = 72,9 % en 2010 ; 2 050,2/5 141,2 = 39,9 % en 2025. |
| IQV | BACKLOG_CONVERSION | existe | Mds $ | 2017 = 14.84 ; 2025 = 32.7 | conforme | 10-K 2018 : carnet contracte 14,84 Mds $ fin 2017. 10-K 2025 : 32,7 Mds $. |
| ISRG | INSTALLED_BASE | existe | systemes da Vinci | 2006 = 559 ; 2025 = 11106 | partiellement verifiee | 2025 : parc installe d environ 11 106 systemes confirme. 2006 : 559 non retrouve (559 correspond au quota chinois 2023). |
| ISRG | PROCEDURE_VOLUME | existe | procedures | 2008 = 136000 ; 2025 = 3153000 | conforme | 10-K 2008 : environ 136 000 procedures. 10-K 2025 : environ 3 153 000. |
| ISRG | RECURRING_MIX | trouve | % | 2014 = 70 ; 2025 = 84 | partiellement verifiee | 2025 : CA recurrent a 84 % du total confirme. 2014 : 70 % non retrouve. |
| JNJ | BRAND_SALES_BRIDGE | existe | M $ | 2014 = 2072 ; 2025 = 6078 | non verifiable | Montants 2 072 et 6 078 M$ non retrouves dans les 10-K cites. |
| JNJ | GROSS_TO_NET | trouve | % | 2018 = 37.0 ; 2025 = 49.1 | non verifiable | Taux 37,0 % et 49,1 % non publies dans les sources citees. |
| LH | SERVICE_VOLUME | existe | % | 2012 = 1.7 ; 2025 = 3.7 | partiellement verifiee | 2012 : hausse de volume de 1,7 % confirmee au 10-K 2012. 2025 : 3,7 % non retrouve. |
| LH | REVENUE_PER_SERVICE | existe | % | 2012 = 0.6 ; 2025 = 3.5 | partiellement verifiee | 2012 : +0,6 % de revenu par requisition confirme. 2025 : 3,5 % non retrouve. |
| LH | PAYER_MIX | existe | % | 2021 = 42 ; 2025 = 37 | non verifiable | Parts 42 % et 37 % non retrouvees comme mix payeurs. |
| LLY | BRAND_SALES_BRIDGE | existe | points de % | 2007 = 12 ; 2025 = 50 | partiellement verifiee | 2007 : effet volume de 12 points confirme au 10-K 2007. 2025 : 50 points non retrouve. |
| LONN.SW | ORG_GROWTH_END_MARKET | existe | % | 2020 = 12.2 ; 2024 = -0.2 | partiellement verifiee | 2020 : +12,2 % a taux constants (LPBN) confirme au rapport annuel 2020. 2024 : -0,2 % non retrouve. |
| MDT | ORG_GROWTH_FRANCHISE | existe | % | 2018 = 6.0 ; 2026 = 9.3 | non verifiable | Croissances 6,0 % (FY2018) et 9,3 % (FY2026) non retrouvees dans les communiques cites. |
| MRK | BRAND_SALES_BRIDGE | existe | M $ | 2014 = 55 ; 2025 = 31641 | conforme | 10-K 2016 : Keytruda 55 M$ en 2014. 10-K 2025 : Keytruda 31 641 M$. |
| MRK | LOE_EXPOSURE | autre | % | 2024 = 46.0 ; 2025 = 49.0 | non verifiable | Parts 46 % et 49 % non publiees ; statut deja autre. |
| MRK | GROSS_TO_NET | autre | Mds $ | 2019 = 9.9 ; 2025 = 10.0 | conforme | 10-K 2021 : provision remises et rabais 9,9 Mds $ en 2019. 10-K 2025 : 10,0 Mds $. |
| MRK.DE | BRAND_SALES_BRIDGE | trouve | M EUR | 2016 = 880 ; 2025 = 1176 | non verifiable | Les rapports trimestriels PDF cites sont injoignables (403) ; valeurs non verifiables en l etat. |
| MRK.DE | LATE_STAGE_PIPELINE | trouve | programmes | 2020 = 5 ; 2025 = 2 | non verifiable | Meme cause : sources PDF injoignables. |
| MRNA | PIPELINE_BY_PHASE | existe | candidats en developpement | 2020 = 21 ; 2025 = 25 | non verifiable | Comptes de candidats 21 et 25 non retrouves comme tels dans les 10-K cites. |
| MRNA | TOP_PRODUCT_CONCENTRATION | trouve | % | 2020 = 100.0 ; 2025 = 99.6 | non verifiable | Parts 100 % et 99,6 % non publiees ; composantes non isolees. |
| MRNA | RD_INTENSITY | trouve | % | 2016 = 253.4 ; 2025 = 161.1 | conforme (recalcul) | Recalcul XBRL : 274,7/108,4 = 253,4 % en 2016 ; 3 132/1 944 = 161,1 % en 2025. |
| MTD | ORG_GROWTH_END_MARKET | existe | % | 2005 = 5.0 ; 2025 = 3.0 | non verifiable | Croissances 5,0 % (2005) et 3,0 % (2025) non retrouvees. |
| MTD | CONSUMABLES_MIX | existe | % | 2005 = 23.0 ; 2025 = 25.0 | non verifiable | Parts 23 % et 25 % non retrouvees dans les 10-K cites. |
| NOVN.SW | BRAND_SALES_BRIDGE | existe | M $ | 2016 = 1128 ; 2025 = 6668 | non verifiable | Montants 1 128 et 6 668 M$ non retrouves dans les documents cites. |
| PFE | LATE_STAGE_PIPELINE | trouve | programmes (phase 3 et dossiers deposes) | 2017 = 39 ; 2025 = 34 | partiellement verifiee | Les fiches pipeline citees donnent bien des comptes par phase ; 34 est retrouve sur la fiche de janvier 2019, mais l alignement 2017 = 39 et 2025 = 34 n est pas etabli. |
| PFE | GROSS_TO_NET | trouve | % | 2021 = 18.9 ; 2025 = 41.3 | non verifiable | Taux 18,9 % et 41,3 % non publies dans les 10-K cites. |
| PHIA.AS | ORG_GROWTH_FRANCHISE | trouve | % | 2017 = 3.4 ; 2025 = 0.0 | partiellement verifiee | 2017 : croissance comparable 3,4 % (Diagnosis and Treatment) confirmee au 20-F 2019. 2025 : 0,0 % non retrouve. |
| PHIA.AS | RECURRING_MIX | trouve | % | 2019 = 22.2 ; 2025 = 27.7 | non verifiable | Parts 22,2 % et 27,7 % non publiees. |
| PHIA.AS | ORDER_BACKLOG | trouve | euros | 2019 = 11692000000 ; 2025 = 14924000000 | conforme | 20-F 2019 : 11 692 M EUR d obligations restantes. 20-F 2025 : 14 924 M EUR. |
| PODD | INSTALLED_BASE | existe | clients Omnipod actifs | 2021 = 300000 ; 2025 = 600000 | conforme | 10-K 2021 : environ 300 000 utilisateurs Omnipod. 10-K 2025 : plus de 600 000. |
| QIA.DE | CONSUMABLES_MIX | trouve | % | 2014 = 87.2 ; 2025 = 89.8 | non verifiable | Parts 87,2 % et 89,8 % non publiees dans les 20-F cites. |
| REGN | PIPELINE_BY_PHASE | existe | candidats en developpement clinique | 2018 = 21 ; 2025 = 45 | partiellement verifiee | 2018 : 21 candidats en developpement clinique confirme au 10-K 2018. 2025 : 45 non retrouve. |
| REGN | TOP_PRODUCT_CONCENTRATION | trouve | % | 2016 = 99.5 ; 2025 = 69.5 | non verifiable | Parts 99,5 % et 69,5 % non publiees ; composantes non isolees de facon sure. |
| REGN | RD_INTENSITY | existe | % | 2008 = 115.3 ; 2025 = 40.8 | conforme (recalcul) | Recalcul XBRL : 274,9/238,5 = 115,3 % en 2008 ; 5 850,2/14 342,9 = 40,8 % en 2025. |
| RMD | ORG_GROWTH_FRANCHISE | existe | % | 2010 = 18 ; 2026 = 7 | non verifiable | Croissances 18 % (FY2010) et 7 % (FY2026) non isolees de maniere probante. |
| RMD | INSTALLED_BASE | existe | millions d'appareils | 2024 = 26 ; 2026 = 35 | partiellement verifiee | 2024 : environ 26 millions d appareils connectables confirme dans la presentation Q4 FY2024. 2026 : 35 millions non retrouve. |
| RMD | RECURRING_MIX | existe | % | 2013 = 45.6 ; 2026 = 41.9 | non verifiable | Parts 45,6 % et 41,9 % non publiees. |
| ROG.SW | BRAND_SALES_BRIDGE | existe | Mds CHF | 2018 = 2.353 ; 2025 = 7.01 | conforme | Rapport financier 2019 : Ocrevus 2 353 M CHF en 2018. Rapport 2025 : 7 010 M CHF. |
| ROG.SW | LATE_STAGE_PIPELINE | autre | nombre de nouvelles entites moleculaires | 2022 = 87 ; 2025 = 66 | conforme | Rapport annuel 2022 : 87 nouvelles entites moleculaires. Rapport 2025 : 66. |
| ROG.SW | GROSS_TO_NET | trouve | % | 2015 = 12.2 ; 2025 = 23.1 | non verifiable | Taux 12,2 % et 23,1 % non publies (12,2 correspond aux stocks passes en cout des ventes en 2024). |
| RVTY | ORG_GROWTH_FRANCHISE | existe | % | 2022 = 15 ; 2025 = 2 | partiellement verifiee | 2022 : croissance organique 15 % confirmee au communique Q4 2022. 2025 : 2 % non retrouve. |
| RVTY | RECURRING_MIX | trouve | % | 2024 = 80 ; 2025 = 85 | conforme | Presentation JPM 2025 : environ 80 % de CA recurrent (2024). Presentation JPM 2026 : environ 85 % (2025E). |
| SAN.PA | BRAND_SALES_BRIDGE | existe | Mds EUR | 2018 = 0.788 ; 2025 = 15.714 | conforme | 20-F 2018 : Dupixent 788 M EUR. 20-F 2025 : 15 714 M EUR. |
| SAN.PA | NEW_PRODUCT_SHARE | existe | Mds EUR | 2024 = 2.849 ; 2025 = 3.911 | conforme | Communique Q4 2024 : lancements pharma 2 849 M EUR. Communique Q4 2025 : 3 911 M EUR. |
| SAN.PA | LATE_STAGE_PIPELINE | autre | nombre de projets | 2024 = 83 ; 2025 = 80 | conforme | Communique Q4 2024 : 83 projets. Communique Q4 2025 : 80 projets. |
| SHL.DE | ORG_GROWTH_FRANCHISE | existe | % | 2018 = 6 ; 2025 = 8.5 | partiellement verifiee | 2018 : croissance comparable de 6 % confirmee au rapport annuel 2018. 2025 : 8,5 % non retrouve. |
| SHL.DE | PROCEDURE_VOLUME | trouve | millions de contacts patients | 2024 = 2680 ; 2025 = 3006 | conforme | Rapport annuel 2025 : 2 680 millions de contacts patients en 2024 et 3 006 millions en 2025. |
| SHL.DE | ORDER_BACKLOG | trouve | Mds EUR | 2018 = 16 ; 2025 = 36 | partiellement verifiee | 2018 : carnet de 16 Mds EUR confirme au rapport annuel 2018. 2025 : 36 Mds EUR non retrouve. |
| SOLV | SUBSCRIPTION_MIX | trouve | % | 2022 = 22.5 ; 2025 = 23.7 | non verifiable | Parts 22,5 % et 23,7 % non publiees dans les 10-K cites. |
| SOON.SW | ORG_GROWTH_FRANCHISE | trouve | % | 2018 = 3.8 ; 2026 = 5.4 | conforme | Rapport 2017/18 : croissance organique 3,8 %. Rapport 2025/26 : 5,4 %. |
| STE | ORG_GROWTH_FRANCHISE | existe | % | 2017 = 5.0 ; 2026 = 7.3 | partiellement verifiee | 2017 : 5,0 % de croissance organique retrouve dans le communique cite. FY2026 : 7,3 % non retrouve. |
| STE | RECURRING_MIX | trouve | % | 2017 = 75.5 ; 2026 = 78.9 | non verifiable | Parts 75,5 % et 78,9 % non publiees. |
| STE | ORDER_BACKLOG | existe | M $ | 2018 = 133.0 ; 2026 = 392.1 | conforme | 10-K FY2019 : carnet Healthcare 133,0 M$ au 31 mars 2018. 10-K FY2026 : 392,1 M$. |
| SYK | ORG_GROWTH_FRANCHISE | existe | % | 2018 = 7.9 ; 2025 = 10.3 | partiellement verifiee | 2018 : croissance organique 7,9 % confirmee au communique Q4 2018. 2025 : 10,3 % non retrouve. |
| TECH | ORG_GROWTH_END_MARKET | existe | % | 2016 = 6.0 ; 2026 = 0.0 | partiellement verifiee | FY2016 : croissance organique de 6 % confirmee au communique Q4 FY2016. FY2026 : 0,0 % non retrouve. |
| TECH | CONSUMABLES_MIX | trouve | % | 2017 = 88.8 ; 2026 = 88.8 | conforme (recalcul) | Recalcul depuis la note de desagregation du CA : (consommables + services) / CA total = 500 193/563 003 = 88,8 % en FY2017 et 1 079 416/1 215 039 = 88,8 % en FY2026. |
| TMO | ORG_GROWTH_END_MARKET | existe | % | 2013 = 3 ; 2025 = 2 | partiellement verifiee | 2025 : croissance organique de 2 % confirmee au 10-K 2025. 2013 : 3 % non retrouve. |
| TMO | CONSUMABLES_MIX | trouve | % | 2018 = 74.2 ; 2025 = 83.6 | non verifiable | Parts 74,2 % et 83,6 % non publiees telles quelles. |
| TMO | BACKLOG_CONVERSION | existe | Mds $ | 2018 = 5.09 ; 2025 = 27.92 | conforme | 10-K 2018 : 5,09 Mds $ d obligations restantes. 10-K 2025 : 27,92 Mds $. |
| UHS | BED_OCCUPANCY | existe | % | 2006 = 63 ; 2025 = 65.8 | partiellement verifiee | 2006 : taux d occupation des lits disponibles de 63 % confirme au 10-K 2010. 2025 : 65,8 % non retrouve pour l exercice plein. |
| UHS | PAYER_MIX | trouve | % | 2016 = 33 ; 2025 = 28 | partiellement verifiee | 2016 : 33 % (Managed Care) confirme au 10-K 2018. 2025 : 28 % non retrouve. |
| UNH | MLR | existe | % | 2006 = 81.2 ; 2025 = 89.1 | conforme | 10-K 2006 : ratio de sinistralite passe de 80,0 % en 2005 a 81,2 % en 2006. 10-K 2025 : 89,1 %. |
| UNH | MEMBERSHIP | existe | millions de membres | 2007 = 1.37 ; 2025 = 8.445 | non verifiable | Valeurs 1,37 et 8,445 millions non retrouvees (perimetre d adherents non precise). |
| UNH | SGA_RATIO | existe | % | 2007 = 14.0 ; 2025 = 13.3 | conforme | 10-K 2009 : ratio de frais d exploitation 14,0 % en 2007. 10-K 2025 : 13,3 %. |
| VEEV | SUBSCRIPTION_MIX | existe | % | 2012 = 53.2 ; 2026 = 84.0 | non verifiable | Parts 53,2 % et 84,0 % non publiees ; composantes non recalculees ici. |
| VEEV | NET_RETENTION | existe | % | 2013 = 187 ; 2022 = 119 | conforme | 10-K FY2015 : taux de retention 187 % pour l exercice 2013. 10-K FY2022 : 119 %. |
| VEEV | CUSTOMERS | existe | nombre | 2014 = 198 ; 2026 = 1552 | conforme | 10-K FY2016 : 198 clients au 31 janvier 2014. 10-K FY2026 : 1 552 clients. |
| VRTX | TOP_PRODUCT_CONCENTRATION | trouve | % | 2012 = 87.1 ; 2025 = 86.2 | non verifiable | Parts 87,1 % et 86,2 % non publiees ; composantes non isolees. |
| VRTX | PATIENTS_TREATED | existe | nombre de patients | 2014 = 75000 ; 2025 = 97000 | non verifiable | Nombres 75 000 et 97 000 non retrouves dans les 10-K cites. |
| VRTX | RD_INTENSITY | trouve | % | 2011 = 50.2 ; 2025 = 32.6 | conforme (recalcul) | Recalcul XBRL : 707,7/1 410,6 = 50,2 % en 2011 ; 3 909,5/12 001,3 = 32,6 % en 2025. |
| VTRS | BRAND_SALES_BRIDGE | trouve | M $ | 2021 = 1663.2 ; 2025 = 1549.3 | conforme | Communique Q4 2021 : Lipitor 1 663,2 M$. Communique Q4 2025 : 1 549,3 M$. |
| VTRS | NEW_PRODUCT_SHARE | existe | M $ | 2021 = 700.0 ; 2025 = 324.0 | non verifiable | Montants 700,0 et 324,0 M$ non retrouves. |
| VTRS | GROSS_TO_NET | trouve | % | 2019 = 40.2 ; 2025 = 40.0 | non verifiable | Taux 40,2 % et 40,0 % non publies dans les 10-K cites. |
| WAT | ORG_GROWTH_END_MARKET | existe | Mds $ | 2017 = 1.295 ; 2025 = 1.873 | non verifiable | Montants 1,295 et 1,873 Mds $ non retrouves comme mesure de croissance. |
| WAT | CONSUMABLES_MIX | trouve | % | 2017 = 48.9 ; 2025 = 57.5 | non verifiable | Parts 48,9 % et 57,5 % non publiees telles quelles. |
| WST | ORG_GROWTH_CC | trouve | % | 2014 = 4.3 ; 2025 = 4.3 | non verifiable | Croissances 4,3 % (2014 et 2025) non retrouvees dans les documents cites. |
| WST | HVP_MIX | trouve | % | 2018 = 44 ; 2025 = 60 | non verifiable | Parts 44 % et 60 % non publiees. |
| ZBH | ORG_GROWTH_FRANCHISE | trouve | % | 2017 = -0.6 ; 2025 = 4.0 | non verifiable | Croissances -0,6 % (2017) et 4,0 % (2025) non retrouvees de facon probante. |
| ZTS | BRAND_SALES_BRIDGE | existe | M $ | 2017 = 428 ; 2025 = 1754 | partiellement verifiee | 2017 : dermatologie 428 M$ confirme au 10-K 2019. 2025 : 1 754 M$ non retrouve. |

## Synthese

- series sondees : 162
- conformes : 52 (dont 12 par recalcul)
- partiellement verifiees : 45
- non verifiables : 65
- corrigees : 0
- passees en autre : 0


## Points d attention

- MRK.DE : les deux series reposent sur des rapports trimestriels PDF du site Merck KGaA qui repondent en erreur ; aucune source de remplacement officielle n a ete trouvee pour les valeurs exactes.

- HUM (MLR et ratio de frais) : le tableau du 10-K 2018 cite couvre les exercices 2014 a 2019, qui concordent avec le fichier ; les bornes 2007 et 2020 sortent du perimetre des sources citees.

- ISRG parc installe 2006, EL.PA 2025, BSX 2021 : la valeur du fichier existe bien dans la source mais rattachee a un autre objet ; l alignement avec l exercice indique n a pas pu etre etabli.

