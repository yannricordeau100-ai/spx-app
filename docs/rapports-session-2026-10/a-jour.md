# Resultats publies du 15 sept au 8 oct 2026 : integration sur le site

Sources : earnings-calendar.json, resultats-dates.json, post-earnings-etat.json (cron 15 min/h), data-lake, kpis-haut + v2-pipeline (derniere periode de chaque historique), transcripts. Lecture seule.

## 17 societes publiees dans la fenetre

| Ste | Publication | Documents data-lake | Transcript | Derniere periode affichee | Statut | Cause |
|---|---|---|---|---|---|---|
| LEN | 16/09 | ER, 8-K, 10-Q (02/10) | 16/09 | Q3-2026 | A jour | - |
| AZO | 22/09 | 8-K (pas de 10-Q: FY clos, 10-K attendu) | 22/09 | Q4-FY2026 | A jour | - |
| CTAS | 23/09 | 8-K | 24/09 | Q1-FY2027 | A jour | - |
| EXO.AS | 23/09 | aucun nouveau doc (CP deja la) | 23/09 | H1-2026 (4 KPI sur 33) | A jour partiel | 19 KPI encore sur FY2025 |
| GIS | 23/09 | 10-Q, 8-K | 24/09 | Q1-FY2027 | A jour | - |
| PAYX | 23/09 | 10-Q, 8-K | 24/09 | Q1-2027 | A jour | - |
| COST | 24/09 | 8-K | 24/09 | Q4-2026 (14 KPI) / Q3-2026 (19 KPI) | A jour partiel | 19 KPI restent sur Q3 |
| DRI | 24/09 | 10-Q, 8-K, presentation | 25/09 | Q1-FY2027 | A jour | - |
| CCL | 29/09 | 10-Q, 8-K | 30/09 | Q3-2026 (17) / Q2-2026 (9) | A jour partiel | 9 KPI restent sur Q2 |
| CAG | 30/09 | 10-Q, 8-K | 01/10 | Q4-2026 (fin 31/05) | PAS A JOUR, rouge J+8 | Documents presents, EXTRACTION NON FAITE |
| FDS | 30/09 | 8-K seulement (dernier 10-Q = 01/07) | 01/10 | Q3-FY2026 (fin 31/05) | PAS A JOUR, rouge J+8 | 10-Q NON TELECHARGE + extraction non faite |
| JBL | 30/09 | 8-K seulement (dernier 10-Q = 30/06) | 01/10 | Q3-2026 (fin 31/05) | PAS A JOUR, rouge J+8 | 10-Q NON TELECHARGE + extraction non faite |
| MU | 30/09 | 8-K seulement (dernier 10-Q = 25/06) | 01/10 | Q3-FY2026 (fin 28/05) | PAS A JOUR, rouge J+8 | 10-Q NON TELECHARGE + extraction non faite |
| ACN | 01/10 | 8-K seulement (dernier 10-Q = 18/06) | 02/10 | Q3-FY2026 (fin 31/05) | PAS A JOUR, rouge J+7 | 10-Q NON TELECHARGE + extraction non faite |
| MKC | 01/10 | 10-Q, 8-K | 02/10 | Q2-2026 (40 KPI), Q3-2026 (4 KPI seulement) | PAS A JOUR (4/58 KPI) | Extraction partielle le 07/10, journal ne la voit pas (pas de _maj_le), rouge affiche a tort sur le fond mais 54 KPI en retard |
| NKE | 01/10 | 10-Q (02/10), 8-K | 02/10 | Q4-FY2026 (fin 31/05) | PAS A JOUR, rouge J+7 | Documents presents, EXTRACTION NON FAITE |
| STZ | 06/10 | 8-K (06/10) | non (dernier 30/06) | Q1-FY2027 (fin 31/05) | PAS A JOUR, pas encore rouge (J+2) | Attente J+7 ; transcript pas encore recupere |

Total : 17 publiees, 9 a jour (dont 3 partielles), 8 pas a jour (7 rouges + STZ en attente).

Hors fenetre mais dans le journal : ADBE (10/09, a jour apres 14 jours, rouge leve), KR (11/09 a jour).

## Causes racines des 8 retards
1. Extraction jamais declenchee pour CAG, NKE (et MKC en partie) : post-earnings-pipeline.py ne lance l extraction que si IL telecharge un document (n > 0). Les documents sont arrives par un autre veilleur, donc "nouveaux 0" a chaque tentative et extraction jamais lancee. 20 tentatives a 0, aucune erreur.
2. 10-Q absent pour FDS, JBL, MU, ACN (et STZ) : /tmp/edgar_inventaire.json n existe plus, donc aucun CIK, le pipeline envoie les societes US vers la veille IR europeenne (fr-doc-watcher) au lieu d EDGAR. Remede : python3 scripts/edgar-inventaire.py puis relancer le pipeline.
3. Delai J+3 du 10-Q US : FDS/JBL/MU/ACN/STZ ont deja des 8-K + transcripts, de quoi extraire les KPI du communique sans attendre le 10-Q.
4. Fichiers .conv-state/earnings-inbox/*.md existent (25 KPI a mettre a jour par societe) mais personne ne les traite : a traiter par agent ou par extract_kpis_batch.

## Societes du site dont la derniere periode affichee a plus d un trimestre de retard
Reference : date du dernier depot (derniers-depots.json) ramenee a sa fin de trimestre, comparee au dernier point des KPI (hors stories). Sur 662 : 647 a jour (ecart <= 45 j), 1 entre 45 et 90 j, 13 de plus d un trimestre, 1 sans reference (TRI).

| Groupe | Nb | Societes | Cause |
|---|---|---|---|
| Semestriels UE, H1 2026 publie fin juillet/debut aout, page encore sur 31/12/2025 | 12 | AGN.AS, DIM.PA, DSY.PA, HEN.DE, LI.PA, LONN.SW, PUB.PA, RHM.DE, RXL.PA, STMPA.PA, SU.PA, VIE.PA | Documents H1 (CP / semestriel / RFS) deja dans le data-lake depuis 22/07-06/08 ; extraction H1 non faite. Hors du journal post-resultats (fenetre 14 j depassee). |
| Trimestriel US recent | 1 | NKE | Voir ci-dessus (extraction non faite) |
| Sans reference de depot | 1 | TRI | Aucun 10-Q/20-F date dans le lake |

Vue plus large (indicatif) : 98 societes ont plus de la moitie de leurs KPI sur une periode a plus d un trimestre du dernier depot, meme si leur point le plus recent est a jour (KPI annuels ou series non rafraichies). Exemples : ABBV, ABT, AEE, ALL, AMGN, APD, AXP, BA, C...

## Note
- Le journal post-earnings ne suit que 24 societes (fenetre 14 j). Les 12 semestriels UE n y sont plus.
- CASY/COO/GIS dans le journal portent des dates aberrantes (kpi_maj_le 2027-03-31, dernier_document 8280-26-04) : bugs de lecture de date.
