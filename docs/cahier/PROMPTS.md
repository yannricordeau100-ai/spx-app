# Registre des prompts

Format d'un bloc : `## <identifiant> · <titre>` puis les champs `Catégorie`, `Objectif`, `Entrée`, `Sortie`, `Statut`, et le prompt lui-même dans un bloc de code.
Statuts : `brouillon` · `pret` · `en_cours` · `fait`.

## kpi-sous-industrie · KPI souhaités par sous-industrie
- Catégorie : KPI par catégorie
- Objectif : pour une sous-industrie GICS, lister les KPI qu'un investisseur veut voir (wow d'abord, génériques ensuite), avec définition, unité, fréquence et où la société les publie.
- Entrée : code GICS à 8 chiffres (ex. 45301020) ou ticker (le code est déduit).
- Sortie : `docs/cahier/kpi/<code>.json` (gabarit `kpi/_gabarit.json`), sans données chiffrées.
- Statut : brouillon
```
Tu travailles pour Mettrik AI (indicateurs pour investisseurs). Sous-industrie GICS <code> « <nom> ».
Liste les KPI qu'un investisseur exigerait pour juger une société de cette sous-industrie :
1. d'abord les KPI distinctifs (wow) propres au métier, 2. ensuite les génériques utiles.
Pour chaque KPI : nom FR, nom EN, définition en une phrase, unité, fréquence de publication, source habituelle
(rapport annuel, présentation résultats, communiqué, site IR), et 2 exemples de sociétés qui le publient.
Interdit : inventer un KPI qu'aucune société du secteur ne publie. Réponse au format du gabarit kpi/_gabarit.json.
```

## sources-internet · Hiérarchie des sources de données
- Catégorie : Sources
- Objectif : établir, par type de donnée (résultats, KPI opérationnels, gouvernance, risques) et par pays, l'ordre de confiance des sources internet et leurs formats.
- Entrée : type de donnée + pays (ou société exemple).
- Sortie : `docs/cahier/sources.md`.
- Statut : brouillon
```
Pour le type de donnée <type> et le pays <pays>, classe les sources internet par fiabilité décroissante
(régulateur, site IR de la société, agrégateurs, presse), avec pour chacune : URL type, format (PDF, HTML, XBRL, API),
fréquence, limites connues. Signale les pièges (données retraitées, unités, exercices décalés).
```

## kpi-societe · Créer ou compléter un KPI d'une société
- Catégorie : KPI par société
- Objectif : créer un KPI sur une fiche (ou compléter un KPI existant : années antérieures, trimestres manquants, correction), à partir des données fournies par Yann ou d'une source citée, puis vérifier en réel sur niveau2.
- Entrée : ticker, nom du KPI (short ou nom FR), action (créer / compléter / corriger), période, unité, données ou source.
- Sortie : `src/data/companies/<T>.json` (+ kpis-haut si concerné), fiche vérifiée sur niveau2, ligne dans le journal du Cahier.
- Statut : pret
```
KPI <TICKER> · <nom du KPI> · <créer|compléter|corriger>
Période : <ex. 2016-2020, ou T1 2024-T4 2025>
Unité : <ex. Mds $, %, millions d abonnés>
Données : <valeurs, une par période, ou "voir source">
Source : <URL, document, ou "fournies par Yann">
Notes : <ex. exercice décalé, définition particulière>
```
Règles d exécution : jamais inventer une valeur ; unités et périodes alignées sur la série existante ; vérifier 3 valeurs contre la source avant d écrire ; historique en nombres bruts ; pas de trou dans la série (garde-fou index_periode) ; déploiement niveau2 puis capture de contrôle.
