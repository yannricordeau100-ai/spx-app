# Spec ré-extraction risques — chantier 69+8 stés

## Objectif
Régénérer le champ `risks` dans `src/data/v2-pipeline-enrich/<t>.json` avec des scores 1-5 **différenciés** (basé strictement sur le contenu du 10-K Item 1A), et marquer `_risks_reextracted_at = <now>`.

## Source
- `data-lake/<TICKER>/_risks_src_30k.txt` (extrait Item 1A du dernier 10-K, tronqué à ~30k chars)
- Si absent : `data-lake/<TICKER>/_risks_src.txt`
- Si les 2 absents : marquer status=fail et laisser tel quel (ne PAS inventer)

## Format cible
Chaque risque = objet avec :
```json
{
  "title": "Titre court en FR (≤80 chars)",
  "category": "Technologie | Concurrence | Crédit | Géopolitique | Industriel | Litige | Cyber | Régulation | Marché | Opérationnel | Financier | ESG | Climat | Personnel | Fiscal",
  "severity": 1-5,
  "trend": "up | stable | down | new | removed",
  "score_rationale": "Justification en 2-3 phrases citant explicitement les 4 critères : (1) position dans l'ordre de l'Item 1A, (2) intensité du langage (mots comme 'materially harm', 'could adversely', 'may affect'), (3) tendance vs 10-K N-1 si repérable, (4) poids catégoriel (cyber/régulation/géopolitique pondérés fort)",
  "summary": "Résumé en 2-3 phrases (150-300 chars) de la nature du risque, en FR investisseur"
}
```

## Règles de scoring (obligatoires)
- **5/5** : risque en début d'Item 1A, langage très intensif ("would materially harm"), catégorie critique (cyber, dépendance client, géopolitique), tendance up.
- **4/5** : haut de l'Item 1A ou langage fort, catégorie importante, tendance up/stable.
- **3/5** : milieu de l'Item 1A, langage neutre ("may affect", "could"), catégorie moyenne.
- **2/5** : bas de l'Item 1A, langage prudent, catégorie standard.
- **1/5** : très bas de l'Item 1A, mentionné mais faible impact, catégorie mineure.

**INTERDIT** : produire une liste où tous les risques ont la même sévérité. Une distribution saine a au moins 2 valeurs différentes (idéalement une pyramide 5/4/4/3/3/2 ou similaire).

## Nombre de risques
- **Min 5, max 10** par sté. Prioriser les 6-8 les plus matériels.

## Regles vocabulaire (rappel Yann)
- Pas d'em-dash (—), utiliser `:` ou split
- FR investisseur, pas de jargon dev
- Pas de "value-add", utiliser "PV"

## Sortie
Écrire `src/data/v2-pipeline-enrich/<t>.risks.json` (nouveau fichier, override du champ risks dans v2-pipeline-enrich/<t>.json via le loader).

Actually loader lit `v2-pipeline-enrich/<t>.json` champ `.risks`. Écrire DIRECTEMENT dans ce fichier :
- Ouvrir `src/data/v2-pipeline-enrich/<t>.json` (existe pour toutes ces 69+8 stés)
- Remplacer entièrement le champ `risks` par la nouvelle liste
- Mettre à jour `_risks_reextracted_at` à la date ISO now
- Sauvegarder

## Validation
- 5 ≤ nb risks ≤ 10
- Distribution : au moins 2 severities différentes
- score_rationale mentionne au moins 2 des 4 critères
- Aucun em-dash dans le fichier
- JSON valide
