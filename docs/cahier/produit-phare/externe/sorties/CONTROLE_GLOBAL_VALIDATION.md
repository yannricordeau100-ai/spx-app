# Contrôle global de validation P2

Date du contrôle : 2026-09-12.

## Périmètre

- 161 fichiers JSON présents dans `sorties/P2/`.
- 161 fichiers lus sans erreur JSON.
- 108 fichiers portent le statut `ok`.
- 53 fichiers portent le statut `echec`.
- Aucun fichier ne porte un autre statut.

## Résultat de `valide.py`

- 108 fichiers ne déclenchent aucune anomalie du validateur.
- 53 fichiers déclenchent au moins une anomalie.
- 51 échecs correspondent à une série vide de 0 point.
- 2 échecs correspondent à une série de 1 point : `PRX.AS.json` et `REN.AS.json`.
- `RHM.DE.json`, `TT.json`, `VLTO.json`, `VRT.json` et `WAB.json` cumulent `0 points` et `pas de controle`.
- `TSCO.json` et `URI.json` ont été corrigés : leurs suites de dix estimations consécutives ont été retirées et leur statut est désormais `echec`. Le validateur signale uniquement `0 points`.
- `KR.json` et `KVUE.json` passent les règles techniques du validateur avec respectivement 6 et 5 points; leur statut a été corrigé en `ok`.

## Longueur des séries

| Nombre de points non nuls | Nombre de fichiers |
|---:|---:|
| 0 | 51 |
| 1 | 2 |
| 5 | 10 |
| 6 | 13 |
| 7 | 10 |
| 8 | 5 |
| 9 | 6 |
| 10 | 64 |

- Séries complètes de 10 points : 64.
- Séries courtes de 1 à 9 points : 46.
- Séries sans point : 51.

## Structure

Les 161 fichiers contiennent les clés principales attendues : `ticker`, `produit`, `kpi`, `annees`, `estime`, `sources`, `controle`, `note` et `statut`. Tous possèdent les dix clés annuelles de 2016 à 2025 dans `annees`. Aucun fichier avec statut `ok` n'a moins de cinq points.

Les objets `sources` de certains fichiers ne contiennent que les années non nulles. Cette forme reste compatible avec `valide.py`, qui exige une URL seulement pour chaque valeur non estimée. Elle n'a donc pas été modifiée.

## Corrections

Aucune erreur structurelle n'a été détectée dans les fichiers avec statut `ok`.

### Corrections ciblées du 12 septembre 2026

- `TSCO.json` : dix valeurs dérivées des ventes de catégories animales ont été remplacées par `null`, car elles ne mesuraient pas directement 4health et constituaient dix estimations consécutives. `estime` est vide et le statut est `echec`.
- `URI.json` : dix valeurs dérivées des revenus totaux de location et de parts arrondies ont été remplacées par `null`, car elles constituaient dix estimations consécutives. `estime` est vide et le statut est `echec`.
- `KR.json` : 6 valeurs sourcées, deux contrôles et aucune anomalie du validateur; statut passé à `ok`.
- `KVUE.json` : 5 valeurs sourcées, deux contrôles et aucune anomalie du validateur; statut passé à `ok`.

Validation ciblée après correction : `TSCO.json echec 0 ['0 points']`, `URI.json echec 0 ['0 points']`, `KR.json ok 6 OK`, `KVUE.json ok 5 OK`.

## Journal consolidé

`JOURNAL.md` fusionne les journaux `JOURNAL_P2_BLOC_*.md` et `JOURNAL_P2_COMPLEMENTS_*.md`. Les lignes strictement identiques ont été supprimées. Le journal consolidé contient 227 lignes ; les entrées distinctes relatives au même ticker ont été conservées lorsqu'elles documentent un arbitrage, un candidat alternatif, une reprise ou un contrôle ultérieur.
