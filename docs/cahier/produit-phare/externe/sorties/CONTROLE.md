# Contrôle provisoire : mission inachevée

Ce document décrit uniquement le travail effectivement réalisé. Il ne vaut pas contrôle final conforme à la section 7 de MISSION.md.

| Indicateur | Nombre |
|---|---:|
| Sociétés prévues | 168 |
| Fichiers P1 enregistrés | 168 |
| Identifications antérieures reprises | 134 |
| Nouvelles identifications avec deux recherches | 34 |
| Vérifications V1 avec deux nouvelles recherches | 20 |
| Accords sur un produit | 16 |
| Exceptions enregistrées | 4 |
| Exceptions sans produit confirmé | 1 |
| Exceptions avec désaccord | 3 |
| Vérifications V1 restantes | 148 |
| Séries P2 produites | 0 |
| Séries validées OK | 0 |
| Échecs de recherche de série établis | 0 |
| Séries de dix points | 0 |
| Séries courtes | 0 |

La phase 1 a été parcourue dans l’ordre de la liste. Les fichiers hérités ont été repris sans nouvelle identification. Les recherches des nouvelles identifications sont citées dans donnees_probables. Les choix de faible confiance restent provisoires.

La phase 2 a été effectuée pour les vingt premières sociétés, de AD.AS à GEBN.SW. Les justifications de P1 n’ont pas été relues pour cette vérification ; seuls les libellés de produit ont été consultés pour comparer. Prochaine société : GEV.

Les quatre exceptions portent sur BNR.DE (sans produit), CHRW (produits Robinson Fresh), DHL.DE (alternative express international TDI) et FTV (instruments Fluke). Pour CHRW et FTV, le candidat A initial est sans produit : aucun indicateur numérique ne doit lui être fabriqué.

## Travaux restant à effectuer

- Terminer les 148 vérifications indépendantes dans l’ordre.
- Rechercher les séries dans les rapports locaux, puis les sources publiques, pour chaque produit et chaque alternative pertinente.
- Tirer au hasard deux années par série et les contrôler dans une seconde source indépendante.
- Exécuter valide.py pour chaque fichier P2 et par tranche de vingt sociétés.
- Contrôler les codes HTTP des URL annuelles. Les résultats de recherche consultés ne constituent pas un contrôle HTTP 200.
- Tirer au hasard au moins dix séries et relire chaque valeur contre sa source.

Aucun fichier P2 n’existe à ce stade : valide.py n’a donc pas été exécuté, aucun contrôle de valeur ni audit aléatoire de série n’est déclaré accompli.

## Contradiction du validateur

MISSION.md autorise statut echec pour les séries de moins de cinq points. Le script valide.py refuse systématiquement ces séries, sans exception liée au statut. La consigne de conserver les données absentes à null prime sur toute tentative de produire artificiellement OK. Le validateur n’a pas été modifié.

## Choix à examiner

Faible confiance déclarée en P1 : CMG, HON, KVUE, LDOS, MMM, PH, RL, SGO.PA, TDG, ZAL.DE.

Parmi les nouvelles identifications, les preuves de prépondérance sont notamment insuffisantes pour les systèmes d’allumage TransDigm, CenTraVac, 4health, Ulta Beauty Collection, Xactimate et les marques propres Zalando. Leur existence est documentée ; leur position de produit phare doit encore être arbitrée en phase 2. Les revenus de segment ne pourront être employés qu’en dernier recours documenté.
