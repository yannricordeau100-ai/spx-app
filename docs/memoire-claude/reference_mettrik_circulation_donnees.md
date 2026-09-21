---
name: reference-mettrik-circulation-donnees
description: "Pieges qui empechent une donnee d arriver sur une fiche societe : blocs enfermes dans if (enrich), KEPT_SOURCES, filtres silencieux"
metadata:
  node_type: memory
  type: reference
---

Decouvert le 21 septembre 2026, apres que Yann a signale que les graphiques
moyen terme approuves de LVMH et Hermes ne s affichaient pas.

**Cause** : dans `src/lib/company-core/load-company.ts`, plusieurs injections de
donnees vivaient a l interieur du bloc `if (enrich)`, c est a dire conditionnees
a l existence de `src/data/v2-pipeline-enrich/<ticker>.json`, qui manque pour
63 societes, surtout europeennes. Sorties de cette condition le 21 septembre :
les graphiques moyen terme, `v2-pipeline-specific-kpis` (36 societes) et
`v2-pipeline-exhaustive` (2 societes).

**Deuxieme cause, plus large** : la constante `KEPT_SOURCES` protege les couches
de KPI que la couche kpis-haut ne doit pas ecraser. Deux couches legitimes n y
figuraient pas, `v2-pipeline-specific-kpis` et `kpis-supplementary` : 510
societes et 7 385 indicateurs perdus. Ajoutees. Gains reels mesures au
chargement : CL 55 a 82, DIS 55 a 77, MU 61 a 82, OR.PA 51 a 65, zero doublon.
Il reste la couche de base non etiquetee et `kpis-v3-verif` hors liste blanche.

**Comment verifier une reparation de ce genre** : ecrire un script dans /tmp qui
charge avec `loadV17Company` une dizaine de societes touchees ET cinq societes
saines, AVANT puis APRES la modification, et comparer le nombre d indicateurs
par couche. Une societe saine qui bouge veut dire qu on a casse autre chose.

**Autres pieges du meme fichier** : `readJsonOrNull` et neuf catch nus font
passer un fichier illisible pour un fichier absent ; les blocs coupes par
societe vivent dans `src/data/disabled-blocks-per-ste.json` et
`src/data/v1-9-blocks-control.json`, avec une coupe de masse du 9 aout 2026
jamais revue (93 societes pour les evenements).

Liens : [[reference-mettrik-kpi-ajoute-invisible]] [[project-mettrik-hero-selection-defect]]
