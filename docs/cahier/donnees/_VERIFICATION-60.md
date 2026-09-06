# Verification independante du secteur 60 (immobilier)

Controle des fichiers `docs/cahier/donnees/<TICKER>.json` des 33 societes du secteur 60. Pour chaque serie comptant au moins deux exercices, les deux valeurs extremes ont ete recherchees dans la source citee, avec verification de l'unite et de l'exercice fiscal. Quand la source citee etait injoignable ou muette, la valeur a ete recherchee dans le depot SEC de l'accession correspondante, dans l'annexe reprenant la valeur en comparatif, dans la recherche plein texte EDGAR ou dans les archives web.

Perimetre : 120 series sondees, 240 valeurs verifiees. Une seule valeur erronee trouvee, corrigee. Le controle `python3 docs/cahier/donnees/_valide.py` reste au vert.

## Correction apportee

**CCI, ORGANIC_TENANT_BILLINGS.** Les exercices 2024 et 2025 etaient intervertis. Le communique de resultats de l'exercice 2025 (depot 8-K du 4 fevrier 2026) publie une contribution organique de 193 M$ soit 4,9 % pour 2025 et de 170 M$ soit 4,5 % pour 2024, ligne Organic Contribution to Site Rental Billings as Adjusted for Impact of Sprint Cancellations. Le communique de l'exercice 2024 confirme 4,5 % pour 2024 ; la valeur de 4,5 % portee en 2025 dans le fichier n'etait que la prevision publiee en fevrier 2025. Les deux exercices ont ete remis dans le bon ordre et le commentaire de la serie complete.

## Reserve majeure sur l'identite d'une societe

**VMRK.** Le fichier `VMRK.json` ne porte aucun nom de societe et toutes ses sources sont des documents deposes par AvalonBay Communities (numero SEC 915912) : rapports annuels `avb-*`, communiques trimestriels, mentions de communautes Avalon. Le lot `_lots/60-06.json` designe pourtant ce ticker sous le nom Vivmark Residential, emetteur qui n'existe pas sur EDGAR. Les quatre series de ce fichier sont conformes aux documents cites, mais ces documents ne correspondent pas a la societe nommee. A arbitrer hors du present controle : soit le ticker doit etre remplace par AVB, soit la ligne doit sortir de l'annuaire.

## Defauts de sourcage releves, sans incidence sur les valeurs

Ces points n'ont pas ete modifies, la consigne etant de ne toucher qu'aux valeurs erronees.

| Fichier | Serie | Defaut |
| --- | --- | --- |
| FRT | LEASED_VS_OCCUPIED, LEASING_SPREAD | L'URL du 10-K 2025 se termine par trois guillemets parasites, le lien est inutilisable tel quel |
| ESS | OCCUPANCY_EFFECTIVE_RENT | L'URL du 10-K de l'exercice 2005 renvoie une erreur 404 : numero de depot errone, le bon est 0000920522-06-000023 |
| AMT | ORGANIC_TENANT_BILLINGS, CHURN, AFFO_PS | Les liens des exercices 2020 a 2025 pointent la page de couverture du 8-K et non l'annexe 99.1 qui porte les chiffres |
| CCI | les trois series | Les sources sont des adresses de dossier de depot, sans nom de document |
| PLD, REG | FFO_AFFO_PS | Les sources de l'exercice le plus recent sont des pages de site investisseurs non ouvrables ; les valeurs figurent bien dans les depots SEC correspondants |
| PSA | FFO_AFFO_PS | La valeur 2010 ne figure pas dans le 10-K 2010 cite, la societe ne publiait pas encore le FFO ; elle figure dans le 10-K 2012 |
| PSA | RENT_PER_SQFT | La valeur 2007 est exacte mais le 10-K de l'exercice 2007 ne figure pas dans la liste des sources |
| LI.PA, URW.PA | series sur communiques globenewswire | Le site refuse les acces automatises ; verification faite via web.archive.org |

## Detail par serie

| Ticker | KPI | Annees sondees | Resultat | Detail |
| --- | --- | --- | --- | --- |
| AMT | ORGANIC_TENANT_BILLINGS | 2016 et 2025 | Conforme | Communiques 4T 2017 et 4T 2025, ligne Organic Tenant Billings Growth, colonne annee pleine. Les liens 2020 a 2025 pointent la page de couverture du 8-K et non l'annexe 99.1 : valeurs retrouvees dans l'annexe du meme depot. |
| AMT | CHURN | 2019 et 2025 | Conforme | 10-K 2019 et 10-K 2025 : resiliations d'environ 6 % puis 2 % des loyers factures. Valeur arrondie a l'unite par la societe, unite % coherente. |
| AMT | AFFO_PS | 2016 et 2025 | Conforme | Communiques 4T 2017 et 4T 2025, ligne AFFO attributable to AMT common stockholders per Share, colonne annee pleine. |
| ARE | LEASED_VS_OCCUPIED | 2013 et 2025 | Conforme | 10-K 2017, tableau de donnees selectionnees (96,0 % pour 2013) et 10-K 2025 (90,9 % au 31 decembre 2025). Occupation des proprietes en exploitation en Amerique du Nord. |
| ARE | SS_NOI | 2016 et 2025 | Conforme | 10-K 2016 et 10-K 2025 : NOI a perimetre constant en base tresorerie, +6,0 % puis +0,9 %. |
| ARE | LEASING_SPREAD | 2016 et 2025 | Conforme | 10-K 2016 (+27,6 %) et 10-K 2025 (+7,0 %), loyers faciaux sur surfaces renouvelees ou relouees. |
| ARE | LEASE_EXPIRY | 2018 et 2025 | Conforme | 10-K 2018 et 10-K 2025 : duree moyenne ponderee restant a courir, tous locataires, 8,6 puis 7,5 ans. |
| ARE | FFO_AFFO_PS | 2016 et 2025 | Conforme | 10-K 2016 et 10-K 2025 : FFO par action diluee ajuste, 5,51 puis 9,01 dollars. |
| BXP | LEASED_VS_OCCUPIED | 2007 et 2025 | Conforme | 10-K 2011, tableau historique du parc en exploitation : 94,9 % au 31 decembre 2007 ; 10-K 2025 : 86,7 %. Le libelle passe de percentage leased a percentage occupied, changement deja signale en commentaire. |
| BXP | SS_NOI | 2016 et 2025 | Conforme | 10-K 2016 (2,37 %) et 10-K 2025 (0,78 %), NOI a perimetre constant hors residentiel et hotel. |
| BXP | LEASE_EXPIRY | 2019 et 2025 | Conforme | 10-K 2019 (8,4 ans) et 10-K 2025 (7,9 ans), duree moyenne ponderee des baux en place. |
| CBRE | AUM_FLOWS | 2016 et 2025 | Conforme | 10-K 2017 (86,6 Mds $ au 31 decembre 2016) et 10-K 2025 (155,5 Mds $). |
| CCI | ORGANIC_TENANT_BILLINGS | 2018 et 2025 | Corrigee | Ecart sur l'exercice le plus recent. Le communique de l'exercice 2025 donne 193 M$ soit 4,9 % pour 2025 et 170 M$ soit 4,5 % pour 2024 ; le fichier portait 4,9 % en 2024 et 4,5 % en 2025. Les deux exercices etaient intervertis, la valeur 4,5 % associee a 2025 etant en realite la prevision publiee en fevrier 2025. Les deux annees ont ete remises dans le bon ordre et le commentaire complete. Le point de depart 2018 (5,6 %) est conforme. |
| CCI | CHURN | 2018 et 2024 | Conforme | Communiques 4T 2018 et 4T 2024, ligne Non-renewals de l'exercice complet : -89 M$ puis -150 M$. Unite en millions de dollars, coherente avec le statut autre. |
| CCI | AFFO_PS | 2015 et 2024 | Conforme | Supplement 4T 2019 (4,10 $ pour 2015, version retraitee) et communique 4T 2024 (6,98 $). Coherent avec la regle de retraitement annoncee en commentaire. |
| CPT | SS_NOI | 2011 et 2025 | Conforme | Supplements 4T 2011 (+7,1 %) et 4T 2025 (+0,3 %), colonne annee pleine. |
| CPT | OCCUPANCY_EFFECTIVE_RENT | 2011 et 2025 | Conforme | Supplements 4T 2011 (94,6 %) et 4T 2025 (95,4 %), occupation moyenne du portefeuille comparable. |
| CPT | TURNOVER | 2013 et 2025 | Conforme | Supplements 4T 2014 (56 % pour 2013) et 4T 2025 (36 %), ligne Net turnover sur douze mois. |
| CPT | FFO_AFFO_PS | 2010 et 2025 | Conforme | Supplements 4T 2011 (2,72 $ pour 2010) et 4T 2025 (6,77 $), FFO dilue par action. |
| CSGP | RESILIENT_VS_TRANSACTIONAL | 2019 et 2025 | Conforme | 10-K 2021 (96 % pour 2019) et 10-K 2025 (93 %), part des contrats d'abonnement dans le chiffre d'affaires. |
| CSGP | SUBSCRIPTION_RENEWAL | 2012 et 2025 | Conforme | 10-K 2013 (94 % pour 2012) et 10-K 2025 (89 %), taux de renouvellement des abonnements. |
| DLR | LEASED_CAPACITY_MW | 2017 et 2025 | Conforme | Supplements 4T 2018 (90,2 % pour 2017) et 4T 2025 (84,7 %), ligne Occupancy at end of quarter. L'unite est un taux d'occupation, pas des megawatts : ecart deja documente en commentaire. |
| DLR | BOOKINGS_BACKLOG | 2024 et 2025 | Conforme | Communiques 4T 2024 (797 M$) et 4T 2025 (817 M$), carnet de baux signes non demarres. |
| DLR | RENEWAL_SPREAD | 2018 et 2025 | Conforme | Supplements 4T 2018 (+0,3 % en base tresorerie) et 4T 2025 (+6,7 %). |
| DLR | CHURN | 2020 et 2025 | Conforme | Supplements 4T 2020 (4,4 %) et 4T 2025 (5,4 %), ligne Churn colonne douze mois glissants. |
| DLR | FFO_AFFO_PS | 2017 et 2025 | Conforme | Supplements 4T 2018 (6,14 $ pour 2017) et 4T 2025 (7,39 $), Core FFO dilue par action. |
| DOC | SHOP_OCCUPANCY_REVPOR | 2020 et 2025 | Conforme | 10-K 2022 (81 % pour 2020, segment CCRC) et 10-K 2025 (87 %, segment Senior housing). Changement de libelle deja documente. |
| DOC | SS_NOI | 2018 et 2025 | Conforme | Communiques de l'exercice 2018 (1,4 % colonne Full Year) et de l'exercice 2025 (4,0 %). |
| DOC | FFO_AFFO_PS | 2017 et 2025 | Conforme | Communiques 2018 (1,95 $ pour 2017) et 2025 (1,84 $), FFO ajuste dilue par action. |
| EQIX | LEASED_CAPACITY_MW | 2016 et 2025 | Conforme | 10-K 2016 (157 400 baies facturees) et 10-K 2025 (299 300), Item 2 Properties, ligne Total. Unite en baies, ecart au libelle du KPI deja documente. |
| EQIX | FFO_AFFO_PS | 2018 et 2025 | Conforme | Communiques de l'exercice 2019 (20,69 $ pour 2018) et 2025 (38,33 $), AFFO dilue par action. |
| ESS | SS_NOI | 2005 et 2025 | Conforme | Communiques 4T 2005 (4,6 %) et 4T 2025 (3,2 %), NOI a perimetre constant sur l'annee. |
| ESS | OCCUPANCY_EFFECTIVE_RENT | 2004 et 2025 | Conforme | Point 2025 (96,2 %) verifie dans le 10-K 2025. Le lien du 10-K 2005 renvoie une erreur 404 (numero de depot errone) ; la valeur 96,0 % pour 2004 est confirmee dans le meme 10-K a son adresse reelle, depot 0000920522-06-000023. |
| ESS | FFO_AFFO_PS | 2011 et 2025 | Conforme | Communiques 4T 2011 (5,64 $) et 4T 2025 (15,94 $), Core FFO par action diluee. |
| EXR | SS_OCCUPANCY | 2005 et 2025 | Conforme | 10-K 2006 (85,4 % pour 2005) et 10-K 2025 (92,6 %), occupation a perimetre constant en fin d'exercice. |
| EXR | RENT_PER_SQFT | 2013 et 2023 | Conforme | 10-K 2013 (13,96 $) et 10-K 2023 (21,25 $), loyer annuel moyen par pied carre des clients en place. |
| EXR | ASKING_VS_INPLACE | 2013 et 2025 | Conforme | Ecart recalcule a partir des montants publies : 14,18 contre 13,96 dollars en 2013 (+1,6 %) et 13,16 contre 19,91 dollars dans le 10-K 2025 (-33,9 %). Calcul verifie. |
| EXR | SS_NOI | 2006 et 2025 | Conforme | 10-K 2006 (+7,9 %) et 10-K 2025 (-1,7 %), variation du NOI a perimetre constant. |
| EXR | FFO_AFFO_PS | 2015 et 2025 | Conforme | Communiques 4T 2015 (3,13 $) et 4T 2025 (8,21 $). |
| FRT | LEASED_VS_OCCUPIED | 2003 et 2025 | Conforme | 10-K 2003 (93,1 % loue) et 10-K 2025 (96,1 % loue, 94,1 % occupe). Le lien du 10-K 2025 se termine par trois guillemets parasites et n'est donc pas ouvrable tel quel ; verification faite sur l'adresse nettoyee. |
| FRT | LEASING_SPREAD | 2010 et 2025 | Conforme | 10-K 2011 (hausse moyenne de 8 % en base caisse pour 2010) et 10-K 2025 (15 %). Meme guillemets parasites en fin d'URL pour le lien 2025. |
| FRT | SS_NOI | 2005 et 2025 | Conforme | Communiques 4T 2005 (+6,1 %) et 4T 2025 (+3,6 %), resultat d'exploitation des proprietes comparables. |
| FRT | FFO_AFFO_PS | 2004 et 2025 | Conforme | Communique 4T 2005 (2,85 $ pour 2004) et 4T 2025 (7,22 $), FFO Nareit par action diluee. |
| HST | REVPAR | 2003 et 2025 | Conforme | 10-K 2003 (96,85 $) et 10-K 2025 (229,24 $), RevPAR des hotels comparables. |
| HST | ADR_OCCUPANCY | 2003 et 2025 | Conforme | 10-K 2003 (140,86 $) et 10-K 2025 (327,54 $), prix moyen par chambre des hotels comparables. |
| HST | HOTEL_EBITDA_MARGIN | 2013 et 2025 | Conforme | 10-K 2014 (25,3 % pour 2013) et 10-K 2025 (28,9 %). |
| HST | FFO_AFFO_PS | 2003 et 2025 | Conforme | 10-K 2003, tableau de reconciliation : 0,99 $ par action diluee ; 10-K 2025 : 2,03 $. |
| HST | RENOVATION_CAPEX | 2008 et 2025 | Conforme | 10-K 2008 (374 M$) et 10-K 2025 (287 M$), depenses de renouvellement et remplacement. |
| INVH | SS_NOI | 2018 et 2025 | Conforme | Supplements 4T 2018 (+4,4 %) et 4T 2025 (+2,3 %), croissance annuelle du NOI a perimetre constant. |
| INVH | AVERAGE_OCCUPANCY | 2017 et 2025 | Conforme | Supplements 4T 2018 (95,4 % pour 2017) et 4T 2025 (96,8 %). |
| INVH | BLENDED_RENT_SPREAD | 2017 et 2025 | Conforme | Supplements 4T 2018 (4,5 % pour 2017) et 4T 2025 (3,1 %), croissance combinee des loyers. |
| INVH | TURNOVER_COST | 2017 et 2025 | Conforme | Supplements 4T 2018 (35,8 % pour 2017) et 4T 2025 (22,8 %), rotation sur quatre trimestres glissants. Unite en % de rotation et non en cout, ecart deja documente. |
| IRM | ORGANIC_REVENUE | 2019 et 2020 | Conforme | Communiques 4T 2019 (+2,5 %) et 4T 2020 (+2,4 %), croissance organique des revenus de stockage. |
| IRM | CAPACITY_UTILISATION | 2019 et 2025 | Conforme | Supplements 4T 2020 (85,7 % pour le 4T 2019) et 4T 2025 (96,9 %), ligne Leased % Total des centres de donnees. |
| IRM | VOLUME_RETENTION | 2019 et 2025 | Conforme | Supplements 4T 2020 et 4T 2025, ligne Total Volume Storage : 704 218 puis 744 001 milliers de pieds cubes, soit 704,218 et 744,001 millions. Conversion d'unite conforme au commentaire. |
| IRM | FFO_AFFO_PS | 2019 et 2025 | Conforme | Communiques 4T 2020 (3,01 $ pour 2019) et 4T 2025 (5,17 $), AFFO par action. |
| KIM | LEASED_VS_OCCUPIED | 2012 et 2025 | Conforme | Communiques 4T 2012 (93,9 %) et 4T 2025 (96,4 %), occupation en quote-part. |
| KIM | LEASING_SPREAD | 2015 et 2017 | Conforme | Communiques 4T 2015 (+11,1 %) et 4T 2017 (+11,5 %), reversion locative en cumul annuel. Serie limitee a trois exercices, limite deja documentee. |
| KIM | SS_NOI | 2013 et 2025 | Conforme | Communiques 4T 2013 (+3,8 % aux Etats-Unis) et 4T 2025 (+3,0 %). |
| KIM | FFO_AFFO_PS | 2011 et 2025 | Conforme | Communiques 4T 2012 (1,27 $ pour 2011) et 4T 2025 (1,76 $), FFO par action diluee. |
| LI.PA | LEASED_VS_OCCUPIED | 2019 et 2025 | Conforme | Communique 2019 : vacance EPRA a 3,0 %, soit 97,0 % d'occupation ; dossier 2025 : taux d'occupation financiere de 97,1 %. Page globenewswire inaccessible en direct, consultee via web.archive.org. |
| LI.PA | LEASING_SPREAD | 2019 et 2025 | Conforme | Communique 2019 (+8,2 % de reversion) et dossier 2025 (+4,6 %). |
| LI.PA | TENANT_SALES_OCR | 2023 et 2025 | Conforme | Communiques 2023 (taux d'effort 12,8 %) et 2025 (12,5 %). |
| LI.PA | SS_NOI | 2021 et 2025 | Conforme | Communiques 2021 (+6,9 % a perimetre constant) et 2025 (+4,5 %). |
| LI.PA | FFO_AFFO_PS | 2018 et 2025 | Conforme | Communique 2019 (cash-flow net courant de 2,65 euros par action pour 2018) et dossier 2025 (2,72 euros). |
| MAA | SS_NOI | 2006 et 2025 | Conforme | Communiques 4T 2007 (+6,4 % pour 2006) et 4T 2025 (-1,4 % sur douze mois). |
| MAA | OCCUPANCY_EFFECTIVE_RENT | 2013 et 2025 | Conforme | Supplement 4T 2014 (95,0 % pour 2013) et communique 4T 2025 (95,6 %). |
| MAA | BLENDED_LEASE_SPREAD | 2018 et 2025 | Conforme | Communiques 4T 2018 (+2,5 %) et 4T 2025 (-0,1 % sur douze mois). |
| MAA | TURNOVER | 2006 et 2025 | Conforme | Communiques 4T 2007 (61,3 % pour 2006) et 4T 2025 (40,2 %). |
| MAA | FFO_AFFO_PS | 2006 et 2025 | Conforme | Communiques 4T 2007 (3,33 $ pour 2006) et 4T 2025 (8,32 $), FFO dilue par action. |
| O | LEASED_VS_OCCUPIED | 2006 et 2025 | Conforme | Communiques 4T 2006 (98,7 %) et 4T 2025 (98,9 %), occupation du portefeuille. |
| O | LEASING_SPREAD | 2014 et 2025 | Conforme | Communiques 4T 2014 (99,3 % de recuperation de loyer) et 4T 2025 (103,9 %). |
| O | SS_NOI | 2006 et 2025 | Conforme | Communiques 4T 2006 (+0,7 %) et 4T 2025 (+1,3 %), loyers a perimetre constant. |
| O | FFO_AFFO_PS | 2009 et 2025 | Conforme | Communiques 4T 2010 (1,86 $ pour 2009) et 4T 2025 (4,28 $), AFFO par action. |
| PLD | OCCUPANCY | 2012 et 2025 | Conforme | 10-K 2012 (94,0 %) et 10-K 2025 (95,6 %), occupation du portefeuille en exploitation. |
| PLD | RENT_CHANGE | 2017 et 2025 | Conforme | 10-K 2017 (+15,4 %) et 10-K 2025 (+50,1 %), variation de loyer sur renouvellement en base nette effective. |
| PLD | DEV_YIELD_ON_COST | 2018 et 2025 | Conforme | 10-K 2019 (6,5 % pour 2018) et 10-K 2025 (6,7 %), rendement stabilise moyen pondere. |
| PLD | FFO_AFFO_PS | 2017 et 2025 | Conforme | Communique 4T 2018 (2,81 $ pour 2017) et annexe 99.1 du 8-K du 21 janvier 2026 (5,81 $). Les liens hors SEC du fichier ne sont pas ouvrables ; valeur retrouvee dans le depot SEC correspondant. |
| PSA | SS_OCCUPANCY | 2007 et 2025 | Conforme | 10-K 2007 (88,5 %) et 10-K 2025 (92,0 %), occupation moyenne du vivier comparable. |
| PSA | RENT_PER_SQFT | 2007 et 2025 | Conforme | 10-K 2007 (13,46 $ par pied carre occupe) et 10-K 2025 (22,54 $). Le 10-K 2007 ne figure pas dans la liste des sources, la plus ancienne etant celle de 2008. |
| PSA | SS_NOI | 2008 et 2025 | Conforme | 10-K 2008 (+2,5 %) et 10-K 2025 (-0,5 %). |
| PSA | FFO_AFFO_PS | 2010 et 2025 | Conforme | Le 10-K 2010 cite ne mentionne pas le FFO, la societe ne le publiait pas encore dans son rapport annuel. Valeur 4,74 $ pour 2010 confirmee dans le 10-K 2012, tableau comparatif FFO per share. Point 2025 (15,81 $) confirme dans le 10-K 2025. |
| REG | LEASED_VS_OCCUPIED | 2014 et 2025 | Conforme | 10-K 2015 (95,8 % au 31 decembre 2014) et 10-K 2025 (96,5 %). |
| REG | LEASING_SPREAD | 2015 et 2025 | Conforme | 10-K 2015 (+9,6 %) et 10-K 2025 (+10,8 %), reversion sur baux comparables. |
| REG | SS_NOI | 2013 et 2025 | Conforme | 10-K 2013 (+3,9 %) et 10-K 2025 (+5,3 % hors indemnites de resiliation). |
| REG | FFO_AFFO_PS | 2016 et 2025 | Conforme | Communique 4T 2017 (2,73 $ pour 2016) et annexe 99.1 du 8-K du 5 fevrier 2026 (4,64 $). Le lien du fichier pointe le site investisseurs et non un document ouvrable ; valeur retrouvee dans le depot SEC. |
| SBAC | TENANTS_PER_TOWER | 2005 et 2025 | Conforme | 10-K 2005 (2,5 locataires par site) et 10-K 2025 (1,8). |
| SBAC | NEW_SITES_YIELD | 2005 et 2008 | Conforme | 10-K 2005 (36 tours construites) et 10-K 2008 (85). Unite en nombre de sites et non en rendement, ecart deja documente et statut autre. |
| SPG | LEASED_VS_OCCUPIED | 2012 et 2025 | Conforme | 10-K 2013 (95,3 % au 31 decembre 2012) et 10-K 2025 (96,4 %). |
| SPG | LEASING_SPREAD | 2013 et 2015 | Conforme | 10-K 2013 (+16,8 %) et 10-K 2015 (+18,0 %), hausse des paiements des locataires sur les baux ouverts. |
| SPG | TENANT_SALES_OCR | 2011 et 2018 | Conforme | 10-K 2013 (533 $ par pied carre pour 2011) et 10-K 2018 (661 $). |
| SPG | SS_NOI | 2013 et 2019 | Conforme | 10-K 2013 (+5,2 %) et 10-K 2019 (+1,4 %), NOI des proprietes comparables. |
| SPG | FFO_AFFO_PS | 2006 et 2025 | Conforme | 10-K 2008 (5,39 $ pour 2006) et 10-K 2025 (12,34 $), FFO dilue par action. |
| UDR | SS_NOI | 2009 et 2025 | Conforme | 10-K 2010 (-2,5 % pour 2009) et 10-K 2025 (+2,3 %). |
| UDR | OCCUPANCY_EFFECTIVE_RENT | 2010 et 2025 | Conforme | 10-K 2010 (95,6 %) et 10-K 2025 (96,9 %). |
| UDR | TURNOVER | 2024 et 2025 | Conforme | Supplement 4T 2025, tableau Annualized Turnover : 41,6 % en cumul 2024 et 38,5 % en cumul 2025. |
| UDR | FFO_AFFO_PS | 2011 et 2025 | Conforme | 10-K 2013 (1,28 $ pour 2011) et 10-K 2025 (2,43 $), FFO dilue par action. |
| URW.PA | LEASED_VS_OCCUPIED | 2019 et 2025 | Conforme | Communique 2020 (vacance de 5,4 % fin 2019, soit 94,6 % d'occupation) et communique 2025 (4,6 %, soit 95,4 %). Page globenewswire consultee via web.archive.org. |
| URW.PA | LEASING_SPREAD | 2021 et 2025 | Conforme | Communique 2022 (reversion de -5,2 % en 2021) et communique 2025 (+6,7 %). |
| URW.PA | TENANT_SALES_OCR | 2019 et 2025 | Conforme | Communique 2023, tableau OCR, ligne Total OCR Europe : 16,1 % pour 2019 ; communique 2025 : 15,7 %. |
| URW.PA | SS_NOI | 2018 et 2025 | Conforme | Communique 2019 : croissance a perimetre constant de +3,1 % en 2019 et +4,0 % en 2018 ; communique 2025 : +3,8 %. |
| URW.PA | FFO_AFFO_PS | 2018 et 2025 | Conforme | Communique 2019 (AREPS de 12,92 euros pour 2018) et communique 2025 (9,58 euros). |
| VICI | FFO_AFFO_PS | 2018 et 2025 | Conforme | 10-K 2019 (1,43 $ pour 2018) et 10-K 2025 (2,38 $ d'AFFO par action diluee). |
| VMRK | SS_NOI | 2010 et 2025 | Conforme | Valeurs conformes aux sources citees : 10-K AvalonBay 2010 (-2,8 %) et 10-K AvalonBay 2025 (+1,9 %). Voir la reserve d'identite ci-dessus. |
| VMRK | OCCUPANCY_EFFECTIVE_RENT | 2018 et 2025 | Conforme | 10-K AvalonBay 2019 (96,1 % pour 2018) et 10-K AvalonBay 2025 (95,9 %). Voir la reserve d'identite. |
| VMRK | TURNOVER | 2015 et 2025 | Conforme | Communiques AvalonBay 4T 2015 (54,2 %) et 4T 2025 (41,1 %). Voir la reserve d'identite. |
| VMRK | FFO_AFFO_PS | 2006 et 2025 | Conforme | 10-K AvalonBay 2010 (4,24 $ pour 2006) et 10-K AvalonBay 2025 (11,40 $). Voir la reserve d'identite. |
| VNA.DE | OCCUPANCY | 2015 et 2025 | Conforme | Rapport annuel 2015, chiffres cles : vacance de 2,7 %, soit 97,3 % d'occupation ; rapport annuel 2025 : vacance de 2,1 %, soit 97,9 %. |
| VNA.DE | LFL_RENTAL_GROWTH | 2015 et 2025 | Conforme | Rapport annuel 2015 (+2,9 % de hausse organique des loyers) et rapport annuel 2025 (+4,1 %). |
| VNA.DE | NAV_PS | 2019 et 2025 | Conforme | Rapport annuel 2023, chiffres cles EPRA sur cinq exercices (51,44 euros pour 2019) et rapport annuel 2025 (46,28 euros). |
| VTR | SHOP_OCCUPANCY_REVPOR | 2012 et 2025 | Conforme | 10-K 2013 (89,9 % pour 2012) et 10-K 2025 (87,3 %), occupation des residences exploitees. |
| VTR | SS_NOI | 2019 et 2025 | Conforme | Communiques de l'exercice 2019 (-4,4 % pour le segment des residences exploitees) et 2025 (+15,4 %). |
| VTR | FFO_AFFO_PS | 2012 et 2025 | Conforme | Communiques 2012 (3,80 $) et 2025 (3,48 $), FFO normalise par action diluee. |
| WELL | SS_NOI | 2017 et 2025 | Conforme | 10-K 2018, segment Seniors Housing Operating : +1 % en 2017 ; 10-K 2025 : +21,0 % en annee pleine. |
| WELL | RENT_COVERAGE | 2018 et 2025 | Conforme | Supplements 4T 2018 (1,09x) et 4T 2025 (1,19x), couverture des loyers du segment triple net. |
| WELL | FFO_AFFO_PS | 2012 et 2025 | Conforme | Communiques 4T 2013 (3,52 $ pour 2012) et 4T 2025 (5,29 $), FFO normalise par action diluee. |
| WY | TIMBERLAND_ACRES | 2014 et 2025 | Conforme | 10-K 2014 (6,9 millions d'acres) et 10-K 2025 (9 740 milliers d'acres detenus plus 649 loues, soit 10,389 arrondi a 10,4 millions). |
| WY | HARVEST_VOLUME | 2012 et 2025 | Conforme | 10-K 2016 (21 677 milliers de tonnes pour 2012) et 10-K 2025 (34 817). |
| WY | WOOD_PRODUCTS_VOLUME | 2010 et 2025 | Conforme | 10-K 2014 (3 289 millions de pieds-planche pour 2010) et 10-K 2025 (4 547). |
| WY | STANDING_INVENTORY | 2016 et 2025 | Conforme | 10-K 2016 (645 millions de tonnes) et 10-K 2025 (594). |
