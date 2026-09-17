# Allocations stratégiques et secteurs à métrique propre

> Déposé le 17 sept 2026 par la session Claude Code (compte principal), à la demande de Yann.
> Mots-clés pour retrouver ce fichier : allocation, allocations, allocation stratégique, secteurs conseillés, KPI star, métrique reine.
> Deux raisonnements séparés, faits l'un après l'autre. Les tailles sont des ordres de grandeur (nombre de sociétés cotées aux États-Unis), base : environ 200 foncières cotées (REITs).

## A. Secteurs à métrique propre, comme le FFO des foncières

| Secteur | Taille vs REITs | KPI star du secteur | Autre info |
|---|---|---|---|
| Banques | environ +200 % | Marge nette d'intérêt (NIM) et ratio CET1 | Le plus gros gisement ; les fiches n'ont ni NIM ni CET1, seulement le chiffre d'affaires |
| Assurance dommages | environ -40 % | Ratio combiné | Une seule métrique décide de tout, très lisible, absente des fiches |
| Pétrole et gaz, exploration-production | environ -50 % | Production en barils équivalents par jour et taux de remplacement des réserves | Données publiées et homogènes, faciles à extraire |
| Midstream et infrastructures énergétiques | environ -75 % | Cash-flow distribuable (DCF) | Équivalent exact du FFO, même logique de distribution |
| Sociétés de crédit cotées (BDC) | environ -75 % | Actif net par action et résultat net d'intérêts par action | Petit univers, très normé |
| Services aux collectivités | environ -70 % | Base d'actifs régulée et rendement autorisé | Explique tout le modèle, jamais publié par les agrégateurs |
| Mines | environ -75 % | Coût complet de maintien (AISC) par once ou tonne | Norme mondiale, comparable entre sociétés |
| Hôtellerie et casinos | environ -85 % | RevPAR, et produit brut des jeux | Déjà partiellement présent |
| Assureurs santé | environ -95 % | Ratio de sinistralité médicale (MLR) | Petit univers mais métrique décisive |
| Logiciel par abonnement | environ égal | Revenu récurrent annuel (ARR) et taux de rétention nette | Très peu publié officiellement, extraction difficile |

Priorité retenue : banques, assurance dommages, midstream, services aux collectivités.

## B. Secteurs recommandés dans les allocations stratégiques classiques

Ce que recommandent les grandes banques d'investissement et les gérants institutionnels comme allocation stratégique de long terme, recoupé avec ce que l'histoire longue des marchés valide (défensifs à rendement élevé sur longue période : consommation de base, santé ; moteurs : technologie ; diversifiants : énergie, immobilier coté, or).

| Secteur | Place dans une allocation type | KPI star | Ce qui manque sur Mettrik |
|---|---|---|---|
| Consommation de base | Socle défensif, 8 à 12 % | Volumes et effet prix séparés, ventes comparables | L'effet prix contre volume n'est jamais isolé, c'est pourtant le débat central depuis 2022 |
| Santé et pharmacie | Socle défensif, 12 à 15 % | Ventes par molécule et échéances de brevets | Les échéances de brevets ne sont nulle part, c'est le risque numéro un du secteur |
| Technologie | Moteur, 20 à 28 % | Revenu récurrent, part de marché | Le mieux couvert aujourd'hui |
| Finance | 12 à 15 % | NIM, CET1, coût du risque | Voir tableau A, gros trou |
| Industrie | 8 à 12 % | Carnet de commandes et ratio prises/facturations | Présent pour quelques sociétés, pas harmonisé |
| Énergie | 4 à 8 % | Production et coût par baril | Voir tableau A |
| Services aux collectivités | 3 à 5 % | Base d'actifs régulée | Voir tableau A |
| Immobilier coté | 3 à 5 % | FFO et AFFO | Fait le 17 sept 2026 : 21 foncières en FFO ou AFFO annuel sourcé |
| Matériaux | 3 à 5 % | Volumes expédiés et prix moyen réalisé | Absent, alors que c'est un secteur purement volume-prix |
| Or et matières premières | 2 à 5 % en couverture | AISC, réserves | Peu de sociétés dans l'univers |

Les deux raisonnements convergent sur trois secteurs : finance, énergie, services aux collectivités. La santé n'apparaît que dans le second, avec un manque précis et peu coûteux à combler : les échéances de brevets.

## Décision de Yann (17 sept 2026)

Traiter tous les secteurs du tableau A : vérifier d'abord le classement GICS de chaque société (groupe, industrie, sous-industrie), vérifier que le KPI star figure dans le référentiel KPI par industrie, puis poser le KPI star en KPI héros (choisir quand deux existent) et extraire ce qui manque, sur 10 ans (5 minimum), en trimestriel dès que possible. Faire aussi le vocabulaire du secteur (unités, définitions), intégré aux définitions existantes. État d'avancement : `.conv-state/secteurs-kpi-star.json`.
