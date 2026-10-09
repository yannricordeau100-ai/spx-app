# Test 10-K vs sources tierces (8 oct 2026)
Les KPI ne sont pas dans kpis-haut mais dans docs/cahier/produit-phare/<T>~ext.json (annees + sources par annee).

## 1. KPI a source tierce par annee (macrotrends/stockanalysis/ycharts)
| Ticker | KPI | Points | Periode | Annees tierces |
|---|---|---|---|---|
| SBUX | NET_REVENUE | 10 | 2016-2025 | 1 |
| SNA | NET_SALES | 10 | 2016-2025 | 7 |
| SU.PA | GROUP_REVENUE | 10 | 2016-2025 | 2 (+marketgenius, eulerpool, marketscreener) |
| TGT, TPR, TSN, UNP, WMT, XYL, YUM | GROUP_REVENUE | 10 | 2016-2025 | 10 |
13 autres fichiers produit-phare citent ces sites une seule fois (note), non traites.

## 2. Test (10 KPI, 100 points, 90 testables)
Methode : balises XBRL en ligne (ix:nonFraction) des 10-K du data-lake, contexte sans axe, duree ~1 an. 10-K avant 2019 : texte du tableau "selected data".
| KPI | Identiques | Ecarts | Couverture 10-K |
|---|---|---|---|
| SBUX | 10/10 | aucun (2016 via selected data 21 315,9) | 2012-2025 |
| SNA | 10/10 | 2025 : 4 743 vs 4 743,2 (arrondi) | 2012-2025 |
| TGT | 9/10 | 2016 : 70 271 introuvable, 10-K = 73 785 (FY janv. 2016) | 2012-2026 |
| TPR | 7/10 | 2016 : 4 488 = valeur FY2017 (10-K : 4 491,8) ; 2020 : 5 985 introuvable (10-K : 4 961,4) ; 2021 : 4 961 = valeur FY2020 (10-K : 5 746,3) | 2012-2026 |
| TSN | 10/10 | aucun | 2012-2025 |
| UNP | 10/10 | aucun | 2014-2025 |
| WMT | 10/10 | aucun (2016, 2017 confirmes par le 10-K 2018) | 2014-2026 |
| XYL | 10/10 | aucun | 2014-2025 |
| YUM | 10/10 | aucun | 2015-2025 |
| SU.PA | non testable | aucun 10-K ni XBRL (societe francaise, dossier data-lake/SU.PA sans financiers, fichier _WRONG_COMPANY.txt) | 0 |
Total : 86 points identiques sur 90 testables (96 %) ; 4 erreurs reelles (TGT 1, TPR 3), cause : decalage d'exercice macrotrends (TPR) et valeur inconnue (TGT). 2 points TGT/WMT = exercices clos en janvier, etiquette = annee de cloture (OK). Mixte TGT : 2017 en base "Sales" originale 69 495, 2018+ en "Total revenue" ASC 606 (72 714 vs 71 879 d'origine) : changement de base.
Autres ecarts de base possibles : SNA (net sales hors services financiers = balise Revenues avec axe, pas RevenueFromContract...), XYL (Revenues vs IncludingAssessedTax), WMT (total revenues 500 343 vs net sales 495 761).

## 3. Conclusion
- Interet : exactitude (4 erreurs sur 90 points, soit 4 %, toutes sur TPR/TGT) et tracabilite (document officiel, accession XBRL) pour 9 KPI sur 10. Les 10-K couvrent 10 ans (2016-2025) pour 9/9 : aucun historique perdu.
- Risque de ligne : choisir "Revenues" vs "RevenueFromContract..." (SNA, XYL, WMT : 3 lignes differentes) ou mauvais exercice. Eviter : lire les balises XBRL en ligne avec contexte annuel sans axe, correspondance exercice par date de cloture, controler l'ecart contre la valeur actuelle (>0,1 % = a examiner), choisir la balise qui correspond au libelle du KPI (SNA : Revenues avec axe "net sales").
- Pas de reduction d'historique : couverture 10-K >= serie. Exception SU.PA (aucune source officielle disponible dans le data-lake) : ne pas remplacer tant qu'un document d'enregistrement universel n'est pas collecte. Avant 2019 : pas toujours de balises XBRL, lire le tableau (SBUX/TGT/TSN/UNP 2016 faits ainsi).
- Priorite : corriger TPR 2016/2020/2021 et TGT 2016 ; les 6 autres (SBUX, SNA, TSN, UNP, XYL, YUM, WMT) sont exacts, seule la source change.
Aucun fichier servi modifie. Scripts : scratchpad/ixrev.py, cmp2.py.
