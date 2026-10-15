# Audit des retards de résultats au 15 octobre 2026

Périmètre : 662 sociétés de `src/data/v1-9-5-clean-all-tickers.json`. Publication retenue depuis le 15/09/2026 : 10-Q, 10-K, 6-K de résultats, 8-K « item 2.02 » dont la date correspond à une date de résultats du calendrier (les 8-K 2.02 d annonce préalable ou de charge exceptionnelle sont écartés : ABBV, APA, APO, EMR, EOG, EQT, FANG, FCX, KMB, OXY, PRU, REGN, TSLA), ou date « précédente » du calendrier pour les sociétés hors SEC.
Dernier trimestre en ligne : fin de la dernière période affichée par la majorité des KPI périodiques de la fiche (même règle que `scripts/post-earnings-pipeline.py`, `fin_affichee`). Retard : la période publiée n est pas couverte.

**Résultat : 25 sociétés en retard** (dont ASML, corrigée ce jour). Aucune correction de masse n a été faite.

| Société | Publication | Document | Dernier trimestre en ligne | Cause |
|---|---|---|---|---|
| ASML | 2026-10-14 | 6-K résultats | 2026-06-30 → corrigé : 2026-09-30 | calendrier faux (précédente = 2026-09-27, fin de trimestre ; prochaine absente) + pièces du 6-K jamais téléchargées (page de garde seule) ; corrigé ce jour |
| BAC | 2026-10-14 | 8-K résultats | 2026-06-30 | extraction lancée : aucune valeur proposée par le moteur, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) |
| BLK | 2026-10-14 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 16, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) ; motif principal : phrase de preuve absente des documents ou sans le chiffre (11) |
| BNY | 2026-10-15 | 8-K résultats | 2026-06-30 | extraction lancée sans valeur retenue |
| C | 2026-10-13 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 14, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) |
| CPB | 2026-09-24 | 10-K | 2026-05-03 | date « précédente » du calendrier hors fenêtre : la chaîne post-résultats ne l a pas prise en charge |
| DPZ | 2026-10-13 | 10-Q | 2026-06-14 | extraction lancée : 0 valeur retenue sur 17, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) |
| FAST | 2026-10-14 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 4, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) ; motif principal : valeur complete absente de la phrase de preuve (3) |
| GS | 2026-10-13 | 8-K résultats | 2026-06-30 | extraction lancée : aucune valeur proposée par le moteur, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) |
| IBKR | 2026-10-15 | 8-K résultats | 2026-06-30 | publié le 15/10 : communiqué pas encore téléchargé (chaîne post-résultats, passage suivant) |
| JBHT | 2026-10-15 | 8-K résultats | 2026-06-30 | publié le 15/10 : communiqué pas encore téléchargé (chaîne post-résultats, passage suivant) |
| JBL | 2026-09-30 | 8-K résultats | 2026-05-31 | extraction lancée : 0 valeur retenue sur 8 ; motif principal : phrase de preuve absente des documents ou sans le chiffre (5) |
| JNJ | 2026-10-13 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 2, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) ; motif principal : chiffre absent des documents (1) |
| JPM | 2026-10-13 | 8-K résultats | 2026-06-30 | extraction lancée : moteur gratuit sans réponse exploitable, dossier de travail en attente dans .conv-state/earnings-inbox |
| MRSH | 2026-10-15 | 10-Q | 2026-06-30 | extraction lancée : 0 valeur retenue sur 14, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) ; motif principal : phrase de preuve absente des documents ou sans le chiffre (8) |
| MS | 2026-10-14 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 13, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) |
| PGR | 2026-10-14 | 8-K résultats | 2026-06-30 | date « précédente » du calendrier hors fenêtre : la chaîne post-résultats ne l a pas prise en charge |
| PLD | 2026-10-15 | 8-K résultats | 2026-06-30 | extraction lancée : moteur gratuit sans réponse exploitable, dossier de travail en attente dans .conv-state/earnings-inbox |
| PNC | 2026-10-15 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 20, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) ; motif principal : phrase de preuve absente des documents ou sans le chiffre (12) |
| RI.PA | 2026-10-15 | calendrier (date précédente) | 2026-03-31 | extraction lancée : 0 valeur retenue sur 17, période lue FY2026 (au lieu du trimestre) |
| SCHW | 2026-10-15 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 6, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) ; motif principal : phrase de preuve absente des documents ou sans le chiffre (6) |
| STT | 2026-10-14 | 8-K résultats | 2026-06-30 | extraction lancée : aucune valeur proposée par le moteur, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) |
| UNH | 2026-10-13 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 10, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) ; motif principal : chiffre absent des documents (5) |
| USB | 2026-10-15 | 8-K résultats | 2026-06-30 | extraction lancée : 0 valeur retenue sur 5, le moteur a lu la période Q2-2026 (document ancien pris à la place du communiqué) ; motif principal : phrase de preuve absente des documents ou sans le chiffre (3) |
| WFC | 2026-10-13 | 8-K résultats | 2026-06-30 | extraction lancée : moteur gratuit sans réponse exploitable, dossier de travail en attente dans .conv-state/earnings-inbox |

## Causes, en résumé

- Extraction lancée mais aucune valeur retenue : les garde-fous du moteur gratuit rejettent tout (souvent parce que le moteur lit un document ancien, période Q2-2026, au lieu du communiqué du T3).
- Moteur gratuit sans réponse : dossier de travail déposé, rien n a été écrit sur la fiche.
- Calendrier : date « précédente » fausse ou absente, la société sort de la fenêtre de 14 jours de la chaîne.
- Publications du 15/10 : téléchargement attendu au passage horaire suivant.

## Les 55 sociétés sans prochaine date (avant réparation)

53 sociétés avaient `prochaine = None` dans `src/data/earnings-calendar.json` et 2 en étaient absentes (CCEP, FDXF). Les dates sont maintenant posées dans `src/data/earnings-dates-officielles.json`, fusionnées dans le calendrier par `scripts/build-earnings-calendar.py` (jamais écrasées par la régénération).

| Société | Prochaine publication | Officielle | Événement |
|---|---|---|---|
| AC.PA | 2026-10-22 | oui | CA T3 2026 (18h00) |
| AI.PA | 2026-10-29 | oui | Third Quarter 2026 Revenue |
| ASML | 2027-01-27 | oui | Q4 2026 and full-year results |
| BF.B | 2026-12-04 | non (estimée, ajbell.co.uk) | Q2 FY2027 results (estimee) |
| BLK | 2027-01-15 | non (estimée, ajbell.co.uk) | Q4 2026 results (estimee) |
| BN.PA | 2026-10-28 | oui | Q3 2026 sales |
| BNY | 2027-01-15 | oui | Q4 2026 results (T3 publie le 15/10/2026) |
| BRK-B | 2026-11-09 | non (estimée, earningswhispers.com) | Q3 2026 results (estimee ; Berkshire publie souvent le samedi precedent ; AJ Bell indique 2026-10-30) |
| CA.PA | 2026-10-21 | oui | CA T3 2026 |
| CBOE | 2026-10-30 | oui | Q3 2026 results |
| CCEP | 2026-11-03 | oui | Q3 2026 Trading Update |
| COHR | 2026-11-04 | non (estimée, nasdaq.com) | Q1 FY2027 results (estimee) |
| CPB | 2026-12-08 | non (estimée, nasdaq.com) | Q1 FY2027 results (estimee) |
| CRWV | 2026-11-09 | non (estimée, nasdaq.com) | Q3 2026 results (estimee ; AJ Bell 2026-11-10) |
| CS.PA | 2026-10-29 | oui | 9M 2026 Activity Indicators |
| DG.PA | 2026-10-22 | oui | CA T3 2026 (17h45) |
| DPZ | 2027-02-23 | non (estimée, ajbell.co.uk) | Q4 2026 results (estimee ; T3 publie le 13/10/2026) |
| EL.PA | 2026-10-20 | oui | Q3 2026 revenue |
| ERF.PA | 2026-10-21 | oui | 9M 2026 Trading Update |
| EXO.AS | 2027-03-30 | non (estimée, marketscreener.com) | FY2026 results (estimee ; Exor annonce 'mars 2027') |
| EXPD | 2026-11-03 | oui | Q3 2026 earnings release |
| FAST | 2027-01-20 | non (estimée, ajbell.co.uk) | Q4 2026 results (estimee) |
| FDXF | 2026-10-29 | non (estimée, nasdaq.com) | Prochain trimestre FedEx Freight Holding (estimee, peu fiable) |
| FERG | 2026-11-09 | non (estimée, earningswhispers.com) | Q3 2026 results (estimee) |
| HOLN.SW | 2026-10-23 | oui | Q3 2026 Trading Update |
| HONA | 2026-10-28 | oui | Q3 2026 results Honeywell Aerospace (apres cloture) |
| KER.PA | 2026-10-22 | oui | 2026 Q3 revenue (apres bourse) |
| LI.PA | 2026-10-21 | oui | Activite 9 mois 2026 (apres bourse) |
| LONN.SW | 2027-01-26 | non (estimée, marketscreener.com) | FY2026 results (estimee ; T3 publie le 14/10/2026) |
| MC.PA | 2027-01-27 | non (estimée, ajbell.co.uk) | Resultats annuels 2026 (estimee ; LVMH annonce 'janvier 2027' sans jour) |
| MKC | 2027-01-22 | non (estimée, ajbell.co.uk) | Q4 FY2026 results (estimee ; T3 publie le 01/10/2026) |
| MRSH | 2027-01-29 | non (estimée, ajbell.co.uk) | Q4 2026 results (estimee ; T3 publie le 15/10/2026) |
| MS | 2027-01-14 | oui | Q4 and full year 2026 results |
| OR.PA | 2026-10-22 | oui | Sales at September 30, 2026 (apres bourse) |
| PFG | 2026-10-26 | oui | Q3 2026 results (apres cloture, call le 27/10) |
| PGR | 2026-11-18 | oui | Resultats mensuels octobre 2026 (T3 publie le 14/10/2026) |
| PLD | 2027-01-21 | non (estimée, ajbell.co.uk) | Q4 2026 results (estimee ; T3 publie le 15/10/2026) |
| PNC | 2027-01-15 | oui | Q4 2026 results (T3 publie le 15/10/2026) |
| PRX.AS | 2026-11-24 | non (estimée, tipranks.com) | Interim results H1 FY2027 (estimee) |
| PSKY | 2026-11-10 | non (estimée, ajbell.co.uk) | Q3 2026 results (estimee ; Earnings Whispers 2026-11-03) |
| PUB.PA | 2027-02-03 | non (estimée, ajbell.co.uk) | Resultats annuels 2026 (estimee ; T3 publie le 13/10/2026) |
| QIA.DE | 2026-11-03 | non (estimée, nasdaq.com) | Q3 2026 results (estimee) |
| REN.AS | 2026-10-22 | oui | Trading update 9 mois 2026 |
| ROG.SW | 2026-10-22 | oui | Third Quarter Sales 2026 |
| RXL.PA | 2026-10-22 | oui | Q3 2026 sales |
| SCHW | 2027-01-21 | non (estimée, ajbell.co.uk) | Q4 2026 results (estimee ; T3 publie le 15/10/2026) |
| SGO.PA | 2026-10-27 | oui | CA 9 mois 2026 (apres bourse) |
| SNDK | 2026-10-29 | oui | Q1 FY2027 results |
| SPCX | 2026-11-03 | non (estimée, nasdaq.com) | Q3 2026 results SpaceX (Space Exploration Technologies, Nasdaq SPCX) (estimee) |
| STT | 2027-01-15 | oui | Q4 2026 results (T3 publie le 14/10/2026) |
| STZ | 2027-01-08 | non (estimée, ajbell.co.uk) | Q3 FY2027 results (estimee ; T2 publie le 06/10/2026) |
| SU.PA | 2026-10-16 | oui | Q3 2026 revenues (7h30 CET ; note de bas de page du S1 indiquait 29/10, calendrier IR actuel = 16/10) |
| UNA.AS | 2026-10-28 | oui | Q3 2026 Trading Statement |
| URW.PA | 2026-10-22 | oui | Q3 2026 trading update (apres bourse) |
| USB | 2027-01-19 | oui | Q4 2026 results |
