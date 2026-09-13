# Contrôle final de la mission produit phare

Date : 12 septembre 2026.

## Bilan consolidé

| Indicateur | Nombre |
|---|---:|
| Séries principales P2 | 158 |
| Séries `ok` avec au moins 5 points | 105 |
| Séries en `echec` | 53 |
| Séries complètes de 10 points | 62 |
| Séries `ok` de 5 à 9 points | 43 |
| Séries vides | 51 |
| Séries à 1 point | 2 |
| Sociétés sans produit physique ou non traitables | 10 |

Les candidats alternatifs conservés pour traçabilité expliquent que le nombre total de JSON puisse dépasser les 158 séries principales.

## Validation globale

`CONTROLE_GLOBAL_VALIDATION.md` confirme la lecture des JSON, la présence des champs obligatoires et des années 2016 à 2025. Les 105 séries principales `ok` ont au moins cinq points. Les 53 échecs restent volontairement non conformes au seuil de cinq points afin de respecter l'interdiction d'inventer : 51 ont zéro point et `PRX.AS` et `REN.AS` ont un point sourcé. Les suites d'estimations non admissibles de `TSCO` et `URI` ont été retirées; `KR` et `KVUE` ont été remis à `ok` après validation.

## Audit aléatoire

`CONTROLE_AUDIT_10PCT.md` décrit un tirage reproductible, graine `20260912`, de 16 séries `ok`, soit plus de 10 %. Chaque valeur et les 37 contrôles secondaires ont été relus. Aucun écart numérique certain n'a été trouvé. Les alertes MELI et SNA provenaient respectivement d'une conversion milliards vers millions et d'extraits arrondis, confirmés par les secondes sources. Aucune correction numérique n'a été faite sans preuve.

## Accessibilité des sources

`CONTROLE_URL.md` couvre 955 références annuelles et 492 références distinctes, dont 469 URL HTTP(S) et 23 chemins `data-lake`. Parmi les URL, 222 ont répondu 200, une 202 et deux 302. Les refus HEAD, limitations et délais restent indéterminés. Les onze 404 ont été revus : six URL ont été remplacées avec certitude, couvrant sept références; cinq ont été conservées avec mention explicite faute d'équivalent officiel certain. Les huit fichiers touchés ont été revalidés. Les 23 chemins locaux concernent GE, GD et DPZ et devront être remplacés par des URL SEC si une publication entièrement web est requise.

## Sociétés sans produit physique ou non traitables

| Ticker | Motif |
|---|---|
| BNR.DE | Aucun produit propre identifiable |
| HOT.DE | Construction et services |
| IMCD.AS | Distribution de produits tiers |
| J | Ingénierie et conseil |
| ORLY | Distribution de pièces tierces |
| PAH3.DE | Holding sans activité opérationnelle propre |
| PDD | Place de marché sans produit physique propre |
| ROST | Distribution sans produit propre dominant |
| RXL.PA | Distribution de matériel électrique tiers |
| TJX | Distribution multimarque sans produit propre dominant |

Aucune série n'a été fabriquée pour ces dix sociétés.

## Points de vigilance

Les choix ou proxys les moins directs concernent CMG, HON, KVUE, LDOS, MMM, PH, RL, SGO.PA, TDG et ZAL.DE. Quand les volumes du produit ne sont jamais publiés, le revenu du segment porteur ou du groupe a été utilisé en dernier recours et signalé dans la note. Les arbitrages du propriétaire ont été appliqués aux fichiers principaux.

## Validation de cohérence

Les totaux concordent : `105 + 53 = 158`; `62 + 43 = 105`; `51 + 2 = 53`. L'échantillon de 16 séries dépasse 10 % des séries utilisables. Les contrôles consolidés couvrent la structure et `valide.py`, la relecture des valeurs et contrôles secondaires, et l'accessibilité des références.
