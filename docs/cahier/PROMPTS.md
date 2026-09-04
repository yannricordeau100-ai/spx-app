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
