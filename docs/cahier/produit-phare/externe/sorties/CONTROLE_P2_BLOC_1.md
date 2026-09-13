# Contrôle final P2 - bloc 1

Date : 2026-09-12 (Europe/Zurich)

## Périmètre contrôlé

- 32 fichiers JSON produits, incluant `DHL.DE~B.json` retenu par arbitrage et `DHL.DE.json` conservé pour traçabilité.
- 254 valeurs annuelles non nulles et 254 objets source correspondants.
- 64 entrées de contrôle, soit exactement deux par fichier.
- Les 56 sociétés du bloc figurent dans `JOURNAL_P2_BLOC_1.md` ; les sociétés sans fichier y sont qualifiées comme échec sourcé ou sans produit confirmé.

## Résultat de validation

- `valide.py` a été relancé sur les 32 fichiers : 32 résultats `OK`, aucun échec.
- Chaque fichier contient les dix clés annuelles 2016 à 2025, avec `null` lorsque la valeur n'a pas été retrouvée ou n'est pas comparable.
- Chaque année non nulle possède une source avec URL ou chemin local, titre et extrait.
- Chaque fichier possède deux années contrôlées par une seconde source.

## Contrôle des sources et URL

- Les URL ont été contrôlées syntaxiquement ; les liens centraux SEC, rapports annuels et publications récentes utilisés dans les derniers fichiers ont également été ouverts avec succès.
- 23 références historiques de `DPZ`, `GD` et `GE` sont des chemins locaux `data-lake/...` plutôt que des URL HTTP. Les documents existent dans le dépôt et `valide.py` les accepte ; ils ont été conservés comme sources primaires locales traçables.
- Les anciennes URL génériques de Kuehne+Nagel ont été remplacées par les rapports ou pages d'archives accessibles du newsroom pour 2018-2023, et par la page de série Statista pour 2016-2017.
- Quelques secondes sources sont des republications ou documents distincts du même émetteur. Elles contrôlent une publication primaire différente ; les contrôles les plus sensibles utilisent une source de domaine tiers lorsque celle-ci était disponible.

## Corrections apportées

- Suppression des tirets longs signalés par le validateur dans `FGR.PA.json`, `GEBN.SW.json` et `GNRC.json`.
- Remplacement des liens historiques Kuehne+Nagel devenus non ouvrables.
- Nouvelle validation réussie après corrections.

Conclusion : le bloc 1 est structurellement conforme et entièrement validé. Les limites restantes sont documentaires : années laissées nulles, sources locales historiques et quelques contrôles reposant sur une republication du même émetteur.
