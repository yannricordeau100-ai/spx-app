# Défauts constatés sur des séries DÉJÀ EN LIGNE (recherche données KPI, 5 sept 2026)

À corriger sur les fiches après validation. Source du constat : `docs/cahier/donnees/<TICKER>.json`, champ `commentaire`.

| Ticker | KPI en ligne | Défaut | Correction proposée |
|---|---|---|---|
| AAPL | iPhone (unités) 2019-2025 | Apple ne publie plus les volumes depuis l'exercice 2018 ; valeurs issues d'instituts de marché, marquées hors document | retirer, requalifier en estimation, ou tronquer à 2018 |
| PANW | RPO annuel | 5 valeurs ne correspondent pas aux clôtures des 10-K (ex. 2025 : 15,8 Mds $ officiels contre 13,5 en ligne) | remplacer par les valeurs officielles (fichier PANW) |
| KLAC | « Carnet de commandes » | la série en ligne est celle des passifs contractuels, pas le carnet | renommer, et poser la vraie série carnet 2018-2026 (fichier KLAC) |
| EPAM | Revenu par employé | ratio reconstitué, jamais publié par la société | marquer « calculé » ou retirer |
| DDOG | Billings | grandeur reconstituée, jamais publiée | marquer « calculé » ou retirer |
| TXN | Jours de stock | 15 points trimestriels sans période, maximum 209 alors que le 10-K donne 241 (2024) et 222 (2025) | remplacer par la série annuelle officielle 2016-2025 (fichier TXN) |
| WDAY | Rétention nette des abonnements | valeurs 99 / 97 / 95 absentes de toute publication ; Workday ne donne qu'un seuil (> 100 %) et une rétention brute (~98 % en 2025, ~97 % en 2026) | retirer et remplacer par la rétention brute publiée |
| JBL | Taux d'utilisation | un seul point (80 %, conférence T3 2026), aucune série publiée | retirer ou marquer « point unique » |
| GDDY | Taux de renouvellement | c'est un taux de rétention clients, pas un renouvellement d'abonnements | renommer |
| MSFT | CRPO | valeurs = obligations de prestation totales, pas la part à 12 mois | renommer « RPO commerciales totales » |
| PLTR | RPO / CRPO | années renseignées en pourcentage, unité différente de la série en montant | séparer les deux séries |

Séries en ligne trop courtes, exercices antérieurs retrouvés (à allonger) : ASM.AS (SPS 2022-2025, publié depuis bien plus longtemps), CAP.PA (book-to-bill 2023-2025, publié chaque année), FFIV (concentration clients depuis 2016), EPAM (utilisation et attrition dès 2018), WDC (exabytes annuels 2017-2024).
